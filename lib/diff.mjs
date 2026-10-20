// A deliberately simple full-file unified hunk, valid for git apply.
export function patchFor(changes){
  return changes.map(({path,before,after})=>{
    const lines=s=>s.endsWith('\n')?s.slice(0,-1).split('\n'):s.split('\n');
    const a=before===''?[]:lines(before),b=after===''?[]:lines(after);
    const h=`diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -${a.length?1:0},${a.length} +${b.length?1:0},${b.length} @@\n`;
    const removed=a.map((x,i)=>'-'+x+'\n'+(i===a.length-1&&!before.endsWith('\n')?'\\ No newline at end of file\n':'' )).join('');
    const added=b.map((x,i)=>'+'+x+'\n'+(i===b.length-1&&!after.endsWith('\n')?'\\ No newline at end of file\n':'' )).join('');
    return h+removed+added;
  }).join('');
}
