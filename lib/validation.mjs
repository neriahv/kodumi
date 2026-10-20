export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export function check(value,message,status=400){if(!value)throw new HttpError(status,message);}
export function cleanText(value,max=4000){check(typeof value==='string'&&value.trim().length>0&&value.length<=max,`Enter text between 1 and ${max} characters.`);return value.trim();}
export function safeRepo(input){
  const value=String(input||'').trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'').replace(/\.git$/,'');
  check(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(value)&&!value.endsWith('/..'),'Use a GitHub repository in owner/name format.');return value;
}
export function safePath(path){
  return typeof path==='string'&&path.length<240&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.'))&& !/(^|\/)(node_modules|vendor|dist|build|coverage)(\/|$)/.test(path)&&/\.(m?[jt]sx?|cjs|json|md|css|html)$/.test(path)&&!/(secret|credential|lock\.json)/i.test(path);
}
export function validateProposal(proposal,files){
  check(proposal&&typeof proposal==='object','The AI returned an invalid proposal.',502);
  check(typeof proposal.summary==='string'&&proposal.summary.length<=8000,'The AI summary is missing or too long.',502);
  check(Array.isArray(proposal.plan)&&proposal.plan.length>0&&proposal.plan.length<=12&&proposal.plan.every(x=>typeof x==='string'&&x.length<=1200),'The AI plan is invalid.',502);
  check(Array.isArray(proposal.changes)&&proposal.changes.length>0&&proposal.changes.length<=5,'The AI must propose changes to 1–5 existing files.',502);
  const seen=new Set();
  for(const change of proposal.changes){
    check(safePath(change.path)&&files.some(f=>f.path===change.path)&&!seen.has(change.path),'The AI proposed an unsupported or duplicate file path.',502);
    check(typeof change.content==='string'&&Buffer.byteLength(change.content)<=60000,'A proposed file is missing or exceeds 60 KB.',502);
    check(files.find(f=>f.path===change.path).content!==change.content,'The AI proposed an unchanged file.',502);seen.add(change.path);
  }
  return proposal;
}
