import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from './validation.mjs';

export function collect(command,args,options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP}});
    let output='',killed=false;
    const timer=setTimeout(()=>{killed=true;child.kill('SIGKILL');},20000);
    const add=data=>{if(output.length<180000)output+=data.toString();else {killed=true;child.kill('SIGKILL');}};
    child.stdout.on('data',add);child.stderr.on('data',add);
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('close',code=>{clearTimeout(timer);resolve({code,output,timedOut:killed});});
  });
}
export function parseTap(result){
  const cases=[...result.output.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)].map(m=>({name:m[2],passed:m[1]==='ok'}));
  return {passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,total:cases.length,cases,success:result.code===0&&cases.length>0,output:result.output,timedOut:result.timedOut};
}
export async function runFixture(fixture,source,{dockerImage='',signal}={}) {
  // Host execution is restricted to exact shipped fixture bytes; this is not a JS sandbox.
  const trusted=source===fixture.before||source===fixture.after;
  if(!trusted&&!dockerImage) throw new HttpError(409,'This AI patch needs Docker validation. Configure KODUMI_DOCKER_IMAGE or review and test the exported patch yourself.');
  if(dockerImage&&!/^[a-zA-Z0-9][a-zA-Z0-9_./:@-]*$/.test(dockerImage))throw new HttpError(500,'Invalid Docker image configuration.');
  const directory=await mkdtemp(join(tmpdir(),'kodumi-'));
  const container='kodumi-'+randomUUID();
  try{
    await mkdir(dirname(join(directory,fixture.path)),{recursive:true});
    await writeFile(join(directory,fixture.path),source);
    await writeFile(join(directory,'regression.test.mjs'),fixture.tests);
    const command=trusted?process.execPath:'docker';
    const args=trusted?['--test','--test-reporter=tap','regression.test.mjs']:['run','--rm','--pull=never','--name',container,'--network=none','--memory=128m','--cpus=0.5','--pids-limit=64','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user','65534:65534','--mount',`type=bind,src=${directory},dst=/work,readonly`,'--workdir','/work',dockerImage,'node','--test','--test-reporter=tap','regression.test.mjs'];
    // Docker's unprivileged user needs read/traverse access to the temporary fixture directory.
    if(!trusted){const {chmod}=await import('node:fs/promises');await chmod(directory,0o755);}
    let result;
    try {result=await collect(command,args,{cwd:directory,signal});}
    catch(e){if(e.code==='ENOENT')throw new HttpError(409,'Docker is not installed or is not on PATH. The AI proposal has not been executed.');throw e;}
    if(!trusted&&(!result.output.includes('TAP version')||result.timedOut))await collect('docker',['rm','-f',container]).catch(()=>{});
    return parseTap(result);
  }finally{
    if(!trusted)await collect('docker',['rm','-f',container]).catch(()=>{});
    await rm(directory,{recursive:true,force:true});
  }
}
