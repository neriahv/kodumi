import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProposal } from '../lib/gemini.mjs';
import { GitHub } from '../lib/github.mjs';

test('Gemini response is validated and usage recorded; key stays in headers',async()=>{
  let request;
  const result=await generateProposal({description:'Fix bug',files:[{path:'src/a.js',content:'old'}],model:'test-model',key:'test-key',fetchImpl:async(url,options)=>{request={url,options};return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'src/a.js:1 is broken',plan:['Fix'],changes:[{path:'src/a.js',content:'new'}]})}]}}],usageMetadata:{totalTokenCount:123}});}});
  assert.equal(result.changes[0].content,'new');assert.equal(result.usage.totalTokenCount,123);assert.equal(request.options.headers['x-goog-api-key'],'test-key');assert.ok(!request.url.includes('test-key'));
});
test('Gemini rejects truncated responses, provider failures, and test-file edits',async()=>{
  const base={description:'x',files:[{path:'regression.test.mjs',content:'old'}],model:'model',key:'key'};
  await assert.rejects(generateProposal({...base,fetchImpl:async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]})}),/did not complete/);
  await assert.rejects(generateProposal({...base,fetchImpl:async()=>new Response('',{status:429})}),/429/);
  await assert.rejects(generateProposal({...base,fetchImpl:async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'x',plan:['x'],changes:[{path:'regression.test.mjs',content:'new'}]})}]}}]})}),/cannot modify/);
});
test('GitHub snapshot pins source to commit and excludes hidden / binary / oversized files',async()=>{
  const urls=[];
  const gh=new GitHub('',async(url)=>{urls.push(url);const path=url.replace('https://api.github.com','');let result;
    if(path==='/repos/owner/repo')result={name:'repo',default_branch:'main',language:'JavaScript'};
    else if(path==='/repos/owner/repo/commits/main')result={sha:'abc123',commit:{tree:{sha:'tree123'}}};
    else if(path.includes('/git/trees/'))result={tree:[{type:'blob',mode:'100644',path:'src/a.js',size:10,sha:'blob1'},{type:'blob',mode:'100644',path:'.env',size:10,sha:'secret'},{type:'blob',mode:'100644',path:'big.js',size:50000,sha:'big'}]};
    else if(path.endsWith('/git/blobs/blob1'))result={encoding:'base64',content:Buffer.from('export const a=1;').toString('base64')};
    else throw Error('Unexpected URL '+path);return Response.json(result);
  });
  const result=await gh.snapshot('owner/repo');assert.equal(result.baseSha,'abc123');assert.equal(result.files.length,1);assert.equal(result.files[0].path,'src/a.js');assert.equal(result.kind,'github');assert.ok(urls.every(u=>u.startsWith('https://api.github.com/')));
});
test('GitHub draft publishing refuses stale snapshots',async()=>{
  const gh=new GitHub('key',async()=>Response.json({sha:'changed'}));
  await assert.rejects(gh.createDraft({slug:'owner/repo',branch:'main',baseSha:'original'},{id:'test'}),/base branch changed/);
});
test('GitHub draft publishing creates a separate ref and a draft PR',async()=>{
  const requests=[];
  const gh=new GitHub('key',async(url,options)=>{
    const path=url.replace('https://api.github.com','');requests.push({path,...options});let data;
    if(path.includes('/commits/main'))data={sha:'base'};
    else if(path.includes('/git/ref/'))return new Response('{}',{status:404});
    else if(path.endsWith('/git/trees'))data={sha:'new-tree'};
    else if(path.endsWith('/git/commits'))data={sha:'new-commit'};
    else if(path.endsWith('/git/refs'))data={object:{sha:'new-commit'}};
    else if(path.endsWith('/pulls'))data={html_url:'https://github.com/owner/repo/pull/1',number:1};
    else throw Error('Unexpected URL');return Response.json(data);
  });
  const task={id:'task-1',title:'Fix',summary:'Bug diagnosis',plan:['Fix'],changes:[{path:'src/a.js',after:'new'}]};
  const result=await gh.createDraft({slug:'owner/repo',branch:'main',baseSha:'base',treeSha:'tree'},task);
  assert.equal(result.number,1);const pr=requests.find(r=>r.path.endsWith('/pulls'));assert.equal(JSON.parse(pr.body).draft,true);const ref=requests.find(r=>r.path.endsWith('/git/refs'));assert.equal(JSON.parse(ref.body).ref,'refs/heads/kodumi/task-1');assert.ok(!requests.some(r=>r.method==='PATCH'));
});
