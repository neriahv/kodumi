import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { Store } from '../lib/store.mjs';

async function setup(t,config={}){
  const dir=await mkdtemp(join(tmpdir(),'kodumi-app-test-'));
  const app=await createApp({dataDirectory:dir,config:{geminiKey:'',githubToken:'',dockerImage:'',...config}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{for(const controller of app.engine.active.values())controller.abort();while(app.engine.active.size)await new Promise(r=>setTimeout(r,20));app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await app.store.chain;await rm(dir,{recursive:true,force:true});});
  const state=await(await fetch(base+'/api/state')).json();
  const request=(path,method='GET',body)=>fetch(base+'/api/'+path,{method,headers:method==='GET'?{}:{'content-type':'application/json','x-kodumi-token':state.nonce},...(body?{body:JSON.stringify(body)}:{})});
  return {...app,base,dir,state,request};
}
test('end-to-end lab: create, run, real validation, download, approve, persist, delete',async t=>{
  const app=await setup(t);assert.equal(app.state.repositories.length,3);assert.equal(app.state.config.gemini,false);
  const create=await app.request('tasks','POST',{repositoryId:'lab-login',mode:'lab',title:'Ignore this custom prompt'});assert.equal(create.status,201);const task=await create.json();assert.equal(task.title,'Reject whitespace-only login credentials');
  assert.equal((await app.request(`tasks/${task.id}/approve`,'POST',{})).status,409);
  assert.equal((await app.request(`tasks/${task.id}/run`,'POST',{})).status,202);
  assert.equal((await app.request(`tasks/${task.id}/run`,'POST',{})).status,409);
  const deadline=Date.now()+15000;while(app.engine.active.size&&Date.now()<deadline)await new Promise(r=>setTimeout(r,40));
  assert.equal(app.engine.active.size,0);const result=app.engine.task(task.id);assert.equal(result.status,'review');assert.ok(result.baseline.failed>0);assert.equal(result.validation.failed,0);assert.equal(result.validation.total,6);assert.ok(result.events.some(e=>e.actor==='pixel'));
  const patch=await app.request(`tasks/${task.id}/patch`);assert.match(await patch.text(),/\+.*email\.trim/);
  const report=await(await app.request(`tasks/${task.id}/report`)).json();assert.equal(report.task.status,'review');assert.ok(!JSON.stringify(report).includes('GEMINI_API_KEY'));
  assert.equal((await app.request(`tasks/${task.id}/approve`,'POST',{})).status,200);assert.equal(result.status,'completed');
  const restored=new Store(app.dir);await restored.init();assert.equal(restored.data.tasks[0].status,'completed');
  assert.equal((await app.request(`tasks/${task.id}`,'DELETE',{})).status,200);assert.equal(app.store.data.tasks.length,0);
});
test('local API rejects CSRF, cross-origin requests, invalid JSON, and missing AI credentials',async t=>{
  const app=await setup(t);
  assert.equal((await fetch(app.base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(app.base+'/api/state',{headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(app.base+'/api/settings',{method:'PATCH',headers:{'content-type':'application/json','x-kodumi-token':app.state.nonce},body:'invalid'})).status,400);
  assert.equal((await app.request('tasks','POST',{repositoryId:'lab-login',mode:'gemini',title:'Bug',description:'Fix'})).status,409);
  assert.equal((await app.request('settings','PATCH',{theme:'other'})).status,400);
});
test('cancellation prevents a reviewable outcome and allows a retry',async t=>{
  const app=await setup(t),task=await(await app.request('tasks','POST',{repositoryId:'lab-cart'})).json();
  await app.request(`tasks/${task.id}/run`,'POST',{});await app.request(`tasks/${task.id}/cancel`,'POST',{});
  while(app.engine.active.size)await new Promise(r=>setTimeout(r,20));assert.equal(app.engine.task(task.id).status,'cancelled');assert.equal(app.engine.task(task.id).approvedAt,null);
  assert.equal((await app.request(`tasks/${task.id}/run`,'POST',{})).status,202);
});
test('theme persists and the frontend has security headers and no external dependencies',async t=>{
  const app=await setup(t);await app.request('settings','PATCH',{theme:'light',reduceMotion:true});
  const state=await(await app.request('state')).json();assert.equal(state.settings.theme,'light');assert.equal(state.settings.reduceMotion,true);
  const response=await fetch(app.base+'/');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);assert.match(await response.text(),/Kodumi/);
  for(const path of ['/app.js','/styles.css','/assets/favicon.svg','/assets/fonts.css'])assert.equal((await fetch(app.base+path)).status,200,path);
  assert.equal((await fetch(app.base+'/missing')).status,404);
});
test('restart marks interrupted tasks instead of pretending they completed',async t=>{
  const app=await setup(t);const task=await app.engine.create({repositoryId:'lab-login'});task.status='running';await app.store.save();
  const restored=new Store(app.dir);await restored.init();assert.equal(restored.data.tasks[0].status,'interrupted');assert.match(restored.data.tasks[0].events[0].message,/server restarted/);
});
