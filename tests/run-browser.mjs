import {spawn} from 'node:child_process';
import path from 'node:path';
import {mkdtempSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p','3102'],{windowsHide:true,env:{...process.env,DATA_DIR:mkdtempSync(path.resolve('test-results/browser-'))},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
try{for(let n=0;n<90;n++){if(output.includes('Ready in'))break;if(server.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,1000));}if(!output.includes('Ready in'))throw Error(output);
 for(const script of ['tests/marketing-browser.mjs','tests/generation-browser.mjs','tests/profiles-browser.mjs'])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{windowsHide:true,env:process.env,stdio:'inherit'});child.once('error',reject);child.once('exit',c=>c===0?resolve():reject(Error(script+' failed: '+c)));});
}finally{server.kill();}
