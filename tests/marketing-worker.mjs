import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const data=mkdtempSync(path.resolve('test-results/marketing-worker-'));
Object.assign(process.env,{DATA_DIR:data,NODE_ENV:'test',WORKER_POLL_MS:'20',HIGGSFIELD_API_KEY:'fixture:secret',SESSION_SECRET:'fixture-only-secret-'.repeat(3),APP_URL:'https://frame.example.test',MARKETING_MOCK_PNG:path.join(data,'fixture.png')});
const {db,id,getProject,saveProject,budget}=await import('../server/db.mjs');const {createProject}=await import('../server/domain.mjs');const {storeFile}=await import('../server/media.mjs');const {quoteMarketing,enqueueMarketing}=await import('../server/marketing-images.mjs');
writeFileSync(process.env.MARKETING_MOCK_PNG,await sharp({create:{width:100,height:200,channels:3,background:'#baadcc'}}).png().toBuffer());
const owner='worker-fixture@example.test',preset={id:id(),name:'Fixture ad'};
globalThis.fetch=async()=>Response.json({items:[preset],total:1,cursor:null});
for(const mode of ['ambiguous','rejected','partial','success','saved-complete']){
 const p=createProject(owner,{title:mode,kind:'product',description:'테스트 전용 상품 정보입니다.',audience:'테스트',facts:'원본',source:'',cta:'',rights:true});const asset=await storeFile(p.id,owner,readFileSync(process.env.MARKETING_MOCK_PNG),'image/png','product.png');p.assets=[asset];p.scenes=[{id:id(),revision:1,seconds:5,visual:'상품',narration:'제품',asset:asset.id,scriptApproved:true,imageApproved:true,audioApproved:true,videoApproved:true,image:{...asset,id:'selected-old'},video:{id:'video-old'},history:[]}];saveProject(p);
 const q=await quoteMarketing(owner,p.id,{unit:p.scenes[0].id,asset:asset.id,preset:preset.id,prompt:'밝은 광고',resolution:'2k',quality:'high',count:2,reservePerImage:500});
 const job=await enqueueMarketing(owner,p.id,q,id()),log=path.join(data,mode+'.jsonl');writeFileSync(log,'');
 if(mode==='saved-complete'){const saved=Array.from({length:2},()=>({...asset,id:id(),scene:p.scenes[0].id,revision:1,cost:null,costType:'unconfirmed'}));db.prepare('UPDATE jobs SET result=? WHERE id=?').run(JSON.stringify(saved),job.id);}
 const child=spawn(process.execPath,['--import','./tests/mock-marketing.mjs','server/worker.mjs'],{windowsHide:true,env:{...process.env,MARKETING_MOCK_MODE:mode,MARKETING_MOCK_LOG:log},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);child.stdout.on('data',()=>{});
 try{let result;for(let n=0;n<450;n++){result=db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);if(['done','failed','unknown'].includes(result.status))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(result.status,mode==='ambiguous'?'unknown':['partial','rejected'].includes(mode)?'failed':'done',mode+' '+errors+' '+result.error);
  const calls=readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),paid=calls.filter(x=>x.method==='POST');assert.equal(paid.length,mode==='saved-complete'?0:['partial','success'].includes(mode)?2:1);
  const updated=getProject(p.id,owner).scenes[0];assert.equal(updated.image.id,'selected-old');assert(updated.imageApproved);assert.equal(updated.video.id,'video-old');assert(updated.videoApproved);
  assert.equal(result.actual,mode==='rejected'?0:null);assert.equal(budget(owner,p.id).project,mode==='rejected'?0:1000);
  if(['partial','success','saved-complete'].includes(mode))assert.equal(updated.candidates.image.length,mode==='partial'?2:3);
 }finally{child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2000);});db.prepare('DELETE FROM worker_lock').run();db.prepare('DELETE FROM heartbeat').run();}
}
db.close();console.log('Marketing worker: POST idempotency, GET retries, partial results, restart after all saved, retained approvals and unconfirmed billing passed (no real requests).');
