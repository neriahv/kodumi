import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','.kodumi','node_modules'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(/\.(mjs|js)$/.test(path))result.push(path);}return result;}
for(const file of await files('.')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(1);}}
console.log('All JavaScript files passed syntax checks.');
