import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { Engine } from './lib/engine.mjs';
import { GitHub } from './lib/github.mjs';
import { HttpError, check, safePath } from './lib/validation.mjs';
import { patchFor } from './lib/diff.mjs';
import { fixtures } from './lib/fixtures.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export async function createApp(options={}){
  const config={geminiKey:process.env.GEMINI_API_KEY||'',geminiModel:process.env.GEMINI_MODEL||'gemini-3.8-flash',githubToken:process.env.GITHUB_TOKEN||'',dockerImage:process.env.KODUMI_DOCKER_IMAGE||'',...options.config};
  const store=new Store(options.dataDirectory||resolve(process.env.KODUMI_DATA_DIR||join(root,'.kodumi')));await store.init();
  const engine=new Engine(store,config),github=options.github||new GitHub(config.githubToken),nonce=randomBytes(24).toString('hex'),publishing=new Set();
  async function body(req){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;check(size<=20000,'Request body is too large.',413);chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new HttpError(400,'Request must contain valid JSON.');}
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('Cache-Control','no-store');
    const json=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try{
      const host=new URL('http://'+(req.headers.host||'invalid')).hostname;
      check(['127.0.0.1','localhost','[::1]'].includes(host),'Kodumi is a local workspace. Use http://localhost:3000.',403);
      if(req.headers.origin)check(['http://'+req.headers.host].includes(req.headers.origin),'Cross-origin requests are not allowed.',403);
      const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname),method=req.method;
      if(path.startsWith('/api/')){
        if(method!=='GET'){
          const header=String(req.headers['x-kodumi-token']||'');check(header.length===nonce.length&&timingSafeEqual(Buffer.from(header),Buffer.from(nonce)),'Refresh the page before submitting changes.',403);
          check((req.headers['content-type']||'').startsWith('application/json'),'Use application/json.',415);
        }
        if(method==='GET'&&path==='/api/state')return json({...store.data,config:{gemini:!!config.geminiKey,model:config.geminiModel,github:!!config.githubToken,docker:!!config.dockerImage},nonce,labs:fixtures.map(f=>({id:f.id,title:f.title,description:f.description}))});
        if(method==='GET'&&path==='/api/health')return json({ok:true,version:'1.0.0'});
        if(method==='POST'&&path==='/api/tasks')return json(await engine.create(await body(req)),201);
        if(method==='PATCH'&&path==='/api/settings'){
          const data=await body(req);if(data.theme!==undefined){check(['light','dark'].includes(data.theme),'Unknown theme.');store.data.settings.theme=data.theme;}
          if(data.reduceMotion!==undefined){check(typeof data.reduceMotion==='boolean','Invalid motion preference.');store.data.settings.reduceMotion=data.reduceMotion;}
          await store.save();return json(store.data.settings);
        }
        if(method==='POST'&&path==='/api/repositories'){
          check(store.data.repositories.length<20,'This workspace supports 20 repositories.',409);
          const input=await body(req),repo=await github.snapshot(input.slug);
          check(!engine.active.size,'Wait for the active task before importing a snapshot.',409);
          // Preserve snapshots referenced by existing tasks by assigning a new identity to each import.
          repo.id+='-'+randomBytes(4).toString('hex');store.data.repositories.push(repo);await store.save();return json(repo,201);
        }
        const match=path.match(/^\/api\/tasks\/([a-zA-Z0-9-]+)(?:\/(run|cancel|approve|patch|report|pr))?$/);
        if(match){
          const [,id,action]=match,task=engine.task(id);
          if(method==='GET'&&action==='patch'){
            check(task.changes.length,'Run the task before downloading a patch.',409);
            res.writeHead(200,{'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="kodumi-${id.slice(0,8)}.patch"`});return res.end(patchFor(task.changes));
          }
          if(method==='GET'&&action==='report'){
            res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="kodumi-${id.slice(0,8)}-report.json"`});return res.end(JSON.stringify({task,repository:engine.repository(task.repositoryId).slug,exportedAt:new Date().toISOString()},null,2));
          }
          if(method==='DELETE'&&!action){await engine.remove(id);return json({ok:true});}
          if(method==='POST'&&action==='run')return json(await engine.start(id),202);
          if(method==='POST'&&action==='cancel')return json(await engine.cancel(id));
          if(method==='POST'&&action==='approve')return json(await engine.approve(id));
          if(method==='POST'&&action==='pr'){
            const input=await body(req),repo=engine.repository(task.repositoryId);
            check(input.confirm===true,'Explicit publication confirmation is required.');
            check(task.status==='completed'&&repo.kind==='github','Accept an imported-repository proposal before creating its draft PR.',409);
            check(task.changes.every(c=>safePath(c.path)&&repo.files.some(f=>f.path===c.path&&f.content===c.before)),'Patch snapshot does not match.',409);
            check(!publishing.has(id),'Draft pull request creation is already in progress.',409);
            if(task.pr)return json(task.pr);
            publishing.add(id);
            try{
              task.publishBranch=`kodumi/${task.id}`;await store.save();
              task.pr=await github.createDraft(repo,task);await engine.event(task,'developer',`Created draft pull request #${task.pr.number}.`,'success');return json(task.pr,201);
            }finally{publishing.delete(id);}
          }
        }
        throw new HttpError(404,'API endpoint not found.');
      }
      check(method==='GET'||method==='HEAD','Method not allowed.',405);
      const relative=path==='/'?'index.html':path.slice(1);
      const filename=resolve(root,'public',relative);check(filename.startsWith(resolve(root,'public')+sep),'File not found.',404);
      let bytes;try{check((await stat(filename)).isFile(),'File not found.',404);bytes=await readFile(filename);}catch{throw new HttpError(404,'File not found.');}
      res.writeHead(200,{'content-type':mime[extname(filename)]||'application/octet-stream'});res.end(method==='HEAD'?undefined:bytes);
    }catch(e){if(!res.headersSent)json({error:e.status?e.message:'The server could not complete this request.'},e.status||500);else res.end();}
  });
  return {server,store,engine};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {server}=await createApp(),port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  server.listen(port,host,()=>console.log(`\n  kodumi · Your AI coding crew\n  http://localhost:${port}\n  Press Ctrl+C to stop.\n`));
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Set another PORT in .env.`:'Kodumi could not start. Check HOST and PORT.');process.exitCode=1;});
}
