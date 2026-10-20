import { randomUUID } from 'node:crypto';
import { getFixture } from './fixtures.mjs';
import { runFixture } from './runner.mjs';
import { generateProposal } from './gemini.mjs';
import { check, cleanText, HttpError } from './validation.mjs';
const pause=()=>new Promise(resolve=>setTimeout(resolve,220));
export class Engine {
  constructor(store,config){this.store=store;this.config=config;this.active=new Map();}
  repository(id){const r=this.store.data.repositories.find(x=>x.id===id);check(r,'Repository not found.',404);return r;}
  task(id){const t=this.store.data.tasks.find(x=>x.id===id);check(t,'Task not found.',404);return t;}
  async create(input){
    check(this.store.data.tasks.length<100,'This local workspace supports 100 tasks. Delete an old task to continue.',409);
    const repo=this.repository(input.repositoryId);
    const mode=input.mode==='gemini'?'gemini':'lab';
    check(repo.kind==='lab'||mode==='gemini','Imported repositories require Gemini mode.');
    if(mode==='gemini')check(this.config.geminiKey,'Add GEMINI_API_KEY to .env and restart to enable Gemini tasks.',409);
    const fixture=getFixture(repo.id);
    const task={id:randomUUID(),repositoryId:repo.id,title:cleanText(mode==='lab'?fixture.title:input.title,140),description:cleanText(mode==='lab'?fixture.description:input.description,6000),mode,status:'draft',stage:null,createdAt:new Date().toISOString(),events:[],plan:[],changes:[],evidence:[],baseline:null,validation:null,summary:'',approvedAt:null,pr:null};
    this.store.data.tasks.unshift(task);await this.store.save();return task;
  }
  async event(task,actor,message,type='info'){
    task.events.push({at:new Date().toISOString(),actor,message,type});await this.store.save();
  }
  async start(id){
    const task=this.task(id);check(this.active.size===0,'Another task is running. Wait or cancel it first.',409);
    check(['draft','failed','cancelled','interrupted','needs_changes'].includes(task.status),'This task has already produced a proposal. Create a new task to investigate again.',409);
    const controller=new AbortController();this.active.set(id,controller);
    Object.assign(task,{status:'running',stage:'scout',changes:[],plan:[],evidence:[],baseline:null,validation:null,summary:'',error:null,usage:null,startedAt:new Date().toISOString(),events:[]});
    await this.store.save();
    const work=this.run(task,controller.signal).catch(async error=>{
      if(task.status==='cancelled'||controller.signal.aborted)task.status='cancelled';
      else {task.status='failed';task.error=error.status?error.message:'The workflow could not finish. Check your connection and server configuration, then retry.';}
      await this.event(task,'system',task.error||'Task cancelled. No changes were published.','error');
    }).finally(()=>this.active.delete(id));
    // Keep promise observed while returning a task immediately to the UI.
    work.catch(()=>{});return task;
  }
  async run(task,signal){
    const repo=this.repository(task.repositoryId),fixture=getFixture(repo.id);
    const stop=()=>{if(signal.aborted)throw new HttpError(409,'Task cancelled.');};
    await this.event(task,'scout',`Reading ${repo.files.length} ${repo.kind==='lab'?'bundled':'snapshot'} files in ${repo.slug}.`);await pause();stop();
    if(fixture){
      task.evidence=fixture.evidence;task.baseline=await runFixture(fixture,fixture.before,{signal});stop();
      await this.event(task,'scout',`Reproduced the bug: ${task.baseline.failed} of ${task.baseline.total} regression checks fail.`,task.baseline.failed?'warning':'success');
    }else{
      task.evidence=repo.files.filter(f=>/\.[cm]?[jt]sx?$/.test(f.path)).slice(0,6).map(f=>({path:f.path,line:1,text:'Included in the imported snapshot. AI relevance is assessed during planning.'}));
      await this.event(task,'scout',`Snapshot pinned to ${repo.baseSha.slice(0,8)}.${repo.partial?' Only a subset of source files is available.':''} Imported code will not be executed.`);
    }
    task.stage='atlas';await this.event(task,'atlas',task.mode==='lab'?'Preparing the lab’s documented repair plan.':'Requesting an evidence-based diagnosis and patch from Gemini.');stop();
    let proposal;
    if(task.mode==='gemini'){
      proposal=await generateProposal({description:task.description,files:repo.files,model:this.config.geminiModel,key:this.config.geminiKey,signal});
      task.summary=proposal.summary;task.plan=proposal.plan;task.usage=proposal.usage;task.model=proposal.model;
    }else{
      task.summary=fixture.evidence[0].text+' This guided lab uses a bundled repair, not an LLM response.';
      task.plan=fixture.plan;proposal={changes:[{path:fixture.path,content:fixture.after}]};
    }
    stop();await this.event(task,'atlas',`Prepared ${task.plan.length} implementation steps.`);await pause();stop();
    task.stage='forge';
    task.changes=proposal.changes.map(c=>({path:c.path,before:repo.files.find(f=>f.path===c.path).content,after:c.content}));
    await this.event(task,'forge',`Prepared a patch for ${task.changes.length} ${task.changes.length===1?'file':'files'}. Repository originals remain intact.`);await pause();stop();
    task.stage='pixel';await this.event(task,'pixel','Checking the proposed change against available validation.');
    if(fixture){
      const code=task.changes.find(c=>c.path===fixture.path)?.after||fixture.before;
      try {
        task.validation=await runFixture(fixture,code,{dockerImage:this.config.dockerImage,signal});stop();
        task.validation.kind='executed';
        await this.event(task,'pixel',`${task.validation.passed}/${task.validation.total} regression checks passed.`,task.validation.success?'success':'error');
      } catch(e){if(signal.aborted)throw e;if(e.status!==409)throw e;task.validation={kind:'skipped',reason:e.message,success:false};await this.event(task,'pixel',e.message,'warning');}
    }else{
      task.validation={kind:'skipped',success:false,reason:'Imported repository tests were not run. Download the patch and run the project’s own checks before merging.'};
      await this.event(task,'pixel',task.validation.reason,'warning');
    }
    stop();task.stage='review';task.status=task.validation.kind==='executed'&&!task.validation.success?'needs_changes':'review';task.finishedAt=new Date().toISOString();
    await this.event(task,'system',task.status==='review'?'Your proposal is ready. Review the diff, evidence, and validation before accepting.':'Validation found failures. Review the results or retry this task.',task.status==='review'?'success':'warning');
  }
  async cancel(id){const task=this.task(id),controller=this.active.get(id);check(controller,'This task is not running.',409);task.status='cancelled';controller.abort();await this.store.save();return task;}
  async approve(id){const task=this.task(id);check(task.status==='review','Only proposals awaiting review can be accepted.',409);task.status='completed';task.approvedAt=new Date().toISOString();await this.event(task,'developer','Accepted the proposal in this workspace. Publishing a GitHub draft PR is a separate action.','success');return task;}
  async remove(id){const task=this.task(id);check(!this.active.has(id),'Cancel the running task before deleting it.',409);this.store.data.tasks=this.store.data.tasks.filter(t=>t!==task);await this.store.save();}
}
