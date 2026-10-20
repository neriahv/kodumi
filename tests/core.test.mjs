import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../lib/fixtures.mjs';
import { runFixture } from '../lib/runner.mjs';
import { safePath, safeRepo, validateProposal } from '../lib/validation.mjs';
import { patchFor } from '../lib/diff.mjs';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { collect } from '../lib/runner.mjs';

for(const fixture of fixtures){
  test(`${fixture.name}: real baseline fails and shipped repair passes`,async()=>{
    const before=await runFixture(fixture,fixture.before),after=await runFixture(fixture,fixture.after);
    assert.ok(before.failed>0);assert.equal(before.success,false);assert.equal(after.success,true);assert.equal(after.failed,0);assert.equal(before.total,after.total);assert.ok(after.total>=5);
  });
}
test('untrusted AI code is not executed on the host',async()=>{
  await assert.rejects(runFixture(fixtures[0],'throw new Error("untrusted")'),/needs Docker/);
});
test('path validation blocks traversal, hidden files, secrets, dependencies, and unsupported files',()=>{
  for(const path of ['../server.mjs','/etc/passwd','src/../../file.js','.github/workflows/ci.yml','.env','src\\evil.js','node_modules/a.js','src/credentials.json','src/file.sh'])assert.equal(safePath(path),false,path);
  for(const path of ['src/auth/validate.mjs','src/Form.tsx','README.md'])assert.equal(safePath(path),true,path);
});
test('repository input stays on GitHub owner/name namespace',()=>{
  assert.equal(safeRepo('https://github.com/neriahv/emberary'),'neriahv/emberary');
  for(const value of ['https://evil.example/a','a/b/c','a/..','../../etc'])assert.throws(()=>safeRepo(value));
});
test('proposal validation rejects invented, unchanged and duplicate paths',()=>{
  const files=[{path:'src/a.js',content:'old'}],base={summary:'Diagnosis',plan:['Fix'],changes:[{path:'src/a.js',content:'new'}]};
  assert.equal(validateProposal(base,files),base);
  assert.throws(()=>validateProposal({...base,changes:[{path:'src/b.js',content:'new'}]},files));
  assert.throws(()=>validateProposal({...base,changes:[{path:'src/a.js',content:'old'}]},files));
  assert.throws(()=>validateProposal({...base,changes:[...base.changes,...base.changes]},files));
});
test('exported unified patch applies with git apply',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kodumi-patch-test-'));
  try{
    const f=fixtures[0],file=join(directory,f.path);await mkdir(dirname(file),{recursive:true});await writeFile(file,f.before);
    await writeFile(join(directory,'fix.patch'),patchFor([{path:f.path,before:f.before,after:f.after}]));
    const result=await collect('git',['apply','--unsafe-paths','fix.patch'],{cwd:directory});
    assert.equal(result.code,0,result.output);assert.equal(await readFile(file,'utf8'),f.after);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('patch preserves a missing final newline',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'kodumi-newline-test-'));
  try{await writeFile(join(directory,'a.js'),'old');await writeFile(join(directory,'fix.patch'),patchFor([{path:'a.js',before:'old',after:'new'}]));const result=await collect('git',['apply','fix.patch'],{cwd:directory});assert.equal(result.code,0,result.output);assert.equal(await readFile(join(directory,'a.js'),'utf8'),'new');}
  finally{await rm(directory,{recursive:true,force:true});}
});
