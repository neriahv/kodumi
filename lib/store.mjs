import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtures, fixtureFiles } from './fixtures.mjs';

export class Store {
  constructor(directory) { this.directory=directory; this.chain=Promise.resolve(); }
  async init() {
    await mkdir(this.directory,{recursive:true});
    try { this.data=JSON.parse(await readFile(join(this.directory,'workspace.json'),'utf8')); }
    catch(e) {
      if(e.code!=='ENOENT') throw new Error('Workspace data could not be read. Back up the data directory before repairing it.');
      this.data={version:1,repositories:fixtures.map(f=>({id:f.id,name:f.name,slug:f.slug,language:f.language,summary:f.summary,kind:'lab',files:fixtureFiles(f),createdAt:new Date().toISOString()})),tasks:[],settings:{theme:'dark',reduceMotion:false}};
    }
    for(const task of this.data.tasks) if(task.status==='running') {
      task.status='interrupted'; task.stage='scout';
      task.events.push({at:new Date().toISOString(),actor:'system',message:'The server restarted. Run this task again to resume from a fresh snapshot.'});
    }
    await this.save();
  }
  save() {
    const json=JSON.stringify(this.data,null,2);
    const job=this.chain.then(async()=>{const tmp=join(this.directory,'workspace.tmp');await writeFile(tmp,json);await rename(tmp,join(this.directory,'workspace.json'));});
    this.chain=job.catch(()=>{}); return job;
  }
}
