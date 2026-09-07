import {spawn} from 'node:child_process';
import path from 'node:path';

const port=String(process.env.PORT||3100);
const processes=new Map();
let stopping=false;
let finalCode=0;

function launch(name,args){
  const child=spawn(process.execPath,args,{env:process.env,stdio:'inherit'});
  processes.set(name,child);
  child.once('error',error=>{
    console.error(`${name} process failed to start:`,error);
    shutdown(1);
  });
  child.once('exit',(code,signal)=>{
    processes.delete(name);
    if(!stopping){
      console.error(`${name} process stopped unexpectedly (${signal||code||'unknown'}).`);
      shutdown(code&&code>0?code:1);
      return;
    }
    if(processes.size===0)process.exit(finalCode);
  });
}

function shutdown(code=0){
  if(stopping)return;
  stopping=true;
  finalCode=code;
  for(const child of processes.values())child.kill('SIGTERM');
  setTimeout(()=>process.exit(finalCode),10000).unref();
}

process.once('SIGTERM',()=>shutdown(0));
process.once('SIGINT',()=>shutdown(0));

launch('web',[path.resolve('node_modules/next/dist/bin/next'),'start','-H','0.0.0.0','-p',port]);
launch('worker',['--env-file-if-exists=.env.local',path.resolve('server/worker.mjs')]);
