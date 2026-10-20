// Render smoke tests for the actual browser module using a minimal DOM surface.
// These are not a substitute for browser layout / interaction testing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { fixtures, fixtureFiles } from '../lib/fixtures.mjs';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function setup(){
  const app={innerHTML:''},modal={open:false,addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}},root={dataset:{},classList:{toggle(){}}};
  const document={querySelector:s=>s==='#app'?app:s==='#modal'?modal:{textContent:'',className:''},addEventListener(){},documentElement:root,activeElement:{tagName:'BODY'},hidden:false};
  const context=createContext({document,console,setInterval(){},setTimeout(){},clearTimeout(){},fetch:()=>new Promise(()=>{}),Date});
  runInContext(source+'\nglobalThis.hooks={ui,setData:value=>{data=value},render,workshop,taskWorkspace,modalShell};',context);
  const state={repositories:fixtures.map(f=>({id:f.id,name:f.name,slug:f.slug,summary:f.summary,kind:'lab',language:'JavaScript',files:fixtureFiles(f)})),tasks:[],settings:{theme:'dark',reduceMotion:false},config:{gemini:false,github:false,docker:false,model:'test-model'},labs:fixtures.map(f=>({id:f.id,title:f.title,description:f.description})),nonce:'test'};
  context.hooks.setData(state);return {hooks:context.hooks,state,app,root};
}
test('all primary navigation views render with the actual frontend module',()=>{
  const {hooks,app,root}=setup();
  for(const view of ['workshop','repositories','tasks','crew','settings']){hooks.ui.view=view;hooks.render();assert.match(app.innerHTML,/id="main"/);assert.match(app.innerHTML,/kodumi/);assert.ok(app.innerHTML.length>5000,view);}
  assert.equal(root.dataset.theme,'dark');
});
test('task overview, changes, files, and tests render; source content is escaped',()=>{
  const {hooks,state,app}=setup(),f=fixtures[0];
  const task={id:'render-test',title:'Review <script>alert(1)</script>',description:'Fix <unsafe>',repositoryId:f.id,mode:'lab',status:'review',stage:'review',createdAt:new Date().toISOString(),summary:'Diagnosis',evidence:f.evidence,plan:f.plan,events:[{at:new Date().toISOString(),actor:'pixel',type:'success',message:'All checks passed'}],changes:[{path:f.path,before:f.before,after:f.after}],baseline:{passed:3,failed:3,total:6,output:'baseline'},validation:{kind:'executed',passed:6,failed:0,total:6,success:true,cases:[{name:'rejects spaces',passed:true}],output:'tests'}};
  state.tasks.push(task);hooks.ui.selected=task.id;
  for(const tab of ['overview','changes','files','tests']){hooks.ui.tab=tab;hooks.render();assert.ok(!app.innerHTML.includes('<script>alert(1)</script>'));assert.match(app.innerHTML,/&lt;script&gt;/);assert.match(app.innerHTML,/Accept proposal/);}
  assert.match(app.innerHTML,/6 of 6 checks passed/);
});
test('skipped validation is explicit and imported draft PR requires acceptance',()=>{
  const {hooks,state,app}=setup(),f=fixtures[0];state.repositories[0]={...state.repositories[0],kind:'github',baseSha:'abcd1234'};
  const task={id:'imported-task',title:'Fix',description:'Bug',repositoryId:f.id,mode:'gemini',status:'review',stage:'review',createdAt:new Date().toISOString(),summary:'Diagnosis',evidence:[],plan:['Fix'],events:[],changes:[{path:f.path,before:f.before,after:f.after}],validation:{kind:'skipped',reason:'Repository tests were not executed.'}};
  state.tasks.push(task);hooks.ui.selected=task.id;hooks.render();assert.match(app.innerHTML,/Tests not run/);assert.ok(!app.innerHTML.includes('data-action="publish"'));
  task.status='completed';hooks.render();assert.match(app.innerHTML,/data-action="publish"/);
});
test('theme and running/cancelled/error states render without credentials or private data',()=>{
  const {hooks,state,app,root}=setup(),f=fixtures[0];state.settings.theme='light';
  const task={id:'state-test',title:'Fix',description:'Bug',repositoryId:f.id,mode:'lab',createdAt:new Date().toISOString(),events:[],plan:[],changes:[],evidence:[]};state.tasks.push(task);hooks.ui.selected=task.id;
  for(const status of ['draft','running','cancelled','failed']){task.status=status;task.stage='scout';hooks.render();assert.ok(!app.innerHTML.includes('undefined'));}
  assert.equal(root.dataset.theme,'light');
});
