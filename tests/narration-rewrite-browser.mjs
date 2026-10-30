import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('test-results/narration-rewrite-e2e-'+Date.now());await mkdir(out,{recursive:true});process.env.DATA_DIR=path.join(out,'data');
const {db,hash,saveProject}=await import('../server/db.mjs');
const {createProject}=await import('../server/domain.mjs');
const {storeFile}=await import('../server/media.mjs');const {storeNarrationDraft}=await import('../server/narration-rewrite.mjs');
const owner='avatar-browser@example.test',raw=randomBytes(32).toString('hex');
db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('avatar-browser',owner,'not-a-login-password',1,Date.now(),Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw),owner,Date.now()+3600000);
const p=createProject(owner,{title:'아바타 연결 실제 API 검증',kind:'product',description:'실제 API와 저장소를 검증하는 테스트 상품입니다.',audience:'테스트',facts:'',source:'',cta:'',rights:true,productionDirection:{enabled:true,minProductRatio:.8,maxPresenterRatio:.4,captionMode:'none'}});
const png=await sharp({create:{width:32,height:32,channels:3,background:'#bc7541'}}).png().toBuffer(),asset=await storeFile(p.id,owner,png,'image/png','product.png');p.assets=[asset];
p.scenes=Array.from({length:3},(_,i)=>({id:'fixture-scene-'+i,seconds:10,narration:'',speechMode:'none',visual:i?'상품 근접':'상품을 든 인물',visualRole:'product',presentation:'scene',evidence:'',fiction:true,revision:1,asset:asset.id,referenceMode:'manual',scriptApproved:true,imageApproved:false,audioApproved:false,videoApproved:false,history:[]}));const oldImage=await storeFile(p.id,owner,png,'image/png','wrong-label.png');p.scenes[0].image=oldImage;p.scenes[0].candidates={image:[{...oldImage,generation:{label:'GPT Image 2.5'}}]};saveProject(p);
const base='http://127.0.0.1:3121',env={...process.env,DATA_DIR:process.env.DATA_DIR,APP_URL:base,SESSION_SECRET:randomBytes(32).toString('hex'),GEMINI_API_KEY:'fixture-not-valid',GEMINI_IMAGE_USD_PER_IMAGE:'.04',USD_TO_KRW:'1000',RATES_REVIEWED_AT:'fixture',OPENAI_API_KEY:'fixture',HIGGSFIELD_API_KEY:'',ELEVENLABS_API_KEY:'',OPENAI_MODEL:'fixture',SCRIPT_MAX_KRW:'100',OPENAI_INPUT_KRW_PER_MILLION:'100',OPENAI_OUTPUT_KRW_PER_MILLION:'100'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3121'],{env,stdio:'pipe',windowsHide:true});let log='';server.stdout.on('data',b=>log+=b.toString());server.stderr.on('data',b=>log+=b.toString());
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'studio_session',value:raw,url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();
 await page.getByRole('button',{name:'전체 내레이션 다시 생성',exact:true}).click();await expect(page.getByText('전체 3개 씬의 새 내레이션 후보를 만듭니다.',{exact:false})).toBeVisible();assert.equal(db.prepare('SELECT count(*) n FROM jobs WHERE project=?').get(p.id).n,0);
 await page.getByRole('button',{name:'확인하고 실행',exact:true}).click();await page.getByText('작업을 접수했습니다. 화면을 닫아도 작업은 계속됩니다.',{exact:true}).waitFor();
 const job=db.prepare('SELECT * FROM jobs WHERE project=?').get(p.id);assert.equal(job.kind,'narration');
 let current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);storeNarrationDraft(current,JSON.parse(job.input).project,current.scenes.map(scene=>({id:scene.id,narration:'생활 속 배수구 관리가 필요하신가요?',speechMode:'voiceover',evidence:'',copy:{role:'situation',sourceIds:[],missingInformation:[],reviewNotes:[]}})));current.revision++;saveProject(current);db.prepare("UPDATE jobs SET status='done',actual=1 WHERE id=?").run(job.id);
 await page.reload();await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();await page.getByRole('region',{name:'새 내레이션 비교'}).waitFor();assert.equal(JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body).scenes[0].narration,'');
 await page.getByRole('button',{name:'새 내레이션 전체 적용',exact:true}).click();await expect(page.getByRole('region',{name:'새 내레이션 비교'})).toHaveCount(0);
 current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);assert.equal(current.scenes[0].narration,'생활 속 배수구 관리가 필요하신가요?');assert.equal(current.scenes[0].image.id,oldImage.id);assert.equal(current.scenes[0].seconds,10);assert.equal(current.scenes[0].scriptApproved,false);
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 const result={passed:true,costBeforeQueue:true,compareBeforeApply:true,imageAndTimingPreserved:true,proposalFixture:true,workerStarted:false,paidCalls:0,output:out};await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();server.kill();db.close();await writeFile(path.join(out,'server.log'),log);}
