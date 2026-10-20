import { HttpError, check, safePath, safeRepo } from './validation.mjs';
export class GitHub {
  constructor(token='',fetchImpl=fetch){this.token=token;this.fetch=fetchImpl;}
  async request(path,{method='GET',body,signal}={}){
    const response=await this.fetch('https://api.github.com'+path,{method,redirect:'error',headers:{accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Kodumi/1.0',...(this.token?{authorization:`Bearer ${this.token}`}:{})},...(body?{body:JSON.stringify(body),headers:{accept:'application/vnd.github+json','content-type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Kodumi/1.0',...(this.token?{authorization:`Bearer ${this.token}`}:{})}}:{}),signal:signal||AbortSignal.timeout(20000)});
    if(!response.ok)throw new HttpError(response.status===404?404:502,`GitHub returned HTTP ${response.status}. Check the repository, token permissions, and API rate limit.`);
    return response.json();
  }
  async snapshot(input){
    const slug=safeRepo(input),base='/repos/'+slug;
    const repo=await this.request(base);
    const branch=repo.default_branch;
    const commit=await this.request(`${base}/commits/${encodeURIComponent(branch)}`);
    const tree=await this.request(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`);
    const candidates=tree.tree.filter(f=>f.type==='blob'&&safePath(f.path)&&f.mode==='100644'&&f.size<40000)
      .sort((a,b)=>Number(/\.[jt]sx?$|\.mjs$/.test(b.path))-Number(/\.[jt]sx?$|\.mjs$/.test(a.path))||a.path.localeCompare(b.path));
    const selected=candidates.slice(0,16);check(selected.length,'No supported source files found in this repository.');
    const files=[];
    for(const entry of selected){const blob=await this.request(`${base}/git/blobs/${entry.sha}`);if(blob.encoding==='base64'){const content=Buffer.from(blob.content,'base64').toString('utf8');if(!content.includes('\0'))files.push({path:entry.path,content,sha:entry.sha});}}
    return {id:'github-'+slug.replace('/','--'),name:repo.name,slug,language:repo.language||'Code',summary:repo.description||'Imported GitHub snapshot',kind:'github',branch,baseSha:commit.sha,treeSha:commit.commit.tree.sha,files,partial:tree.truncated||candidates.length>selected.length,sourceFileCount:candidates.length,createdAt:new Date().toISOString()};
  }
  async createDraft(repo,task){
    check(this.token,'Add GITHUB_TOKEN to .env and restart before creating a draft PR.',409);
    const base='/repos/'+safeRepo(repo.slug);
    const current=await this.request(`${base}/commits/${encodeURIComponent(repo.branch)}`);
    check(current.sha===repo.baseSha,'The base branch changed after import. Import a fresh snapshot and run a new task before publishing.',409);
    const branch=task.publishBranch||`kodumi/${task.id}`;
    const branchPath=encodeURIComponent('heads/'+branch);
    let ref;
    try{ref=await this.request(`${base}/git/ref/${branchPath}`);}catch(e){if(e.status!==404)throw e;}
    if(ref){
      const pulls=await this.request(`${base}/pulls?head=${encodeURIComponent(repo.slug.split('/')[0]+':'+branch)}&state=all`);
      const existing=pulls.find(p=>p.head?.ref===branch);
      if(existing)return {url:existing.html_url,number:existing.number,branch};
    }else{
      const tree=await this.request(`${base}/git/trees`,{method:'POST',body:{base_tree:repo.treeSha,tree:task.changes.map(c=>({path:c.path,mode:'100644',type:'blob',content:c.after}))}});
      const commit=await this.request(`${base}/git/commits`,{method:'POST',body:{message:`fix: ${task.title}\n\nProposed by Kodumi; reviewed by a developer.`,tree:tree.sha,parents:[repo.baseSha]}});
      ref=await this.request(`${base}/git/refs`,{method:'POST',body:{ref:'refs/heads/'+branch,sha:commit.sha}});
    }
    const body=`## Summary\n${task.summary}\n\n## Plan\n${task.plan.map(p=>'- '+p).join('\n')}\n\n## Validation\nImported repository code was not executed by Kodumi. Run this repository's checks before merging.\n\nCreated after explicit developer review. Base snapshot: ${repo.baseSha}.`;
    const pr=await this.request(`${base}/pulls`,{method:'POST',body:{title:task.title,head:branch,base:repo.branch,body,draft:true}});
    return {url:pr.html_url,number:pr.number,branch};
  }
}
