import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('test-results/avatar-e2e-'+Date.now());await mkdir(out,{recursive:true});process.env.DATA_DIR=path.join(out,'data');
const {db,hash,saveProject}=await import('../server/db.mjs');
const {createProject}=await import('../server/domain.mjs');
const {storeFile}=await import('../server/media.mjs');
const owner='avatar-browser@example.test',raw=randomBytes(32).toString('hex');
db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('avatar-browser',owner,'not-a-login-password',1,Date.now(),Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw),owner,Date.now()+3600000);
const p=createProject(owner,{title:'아바타 연결 실제 API 검증',kind:'product',description:'실제 API와 저장소를 검증하는 테스트 상품입니다.',audience:'테스트',facts:'',source:'',cta:'',rights:true,productionDirection:{enabled:true,minProductRatio:.8,maxPresenterRatio:.4,captionMode:'none'}});
const png=await sharp({create:{width:32,height:32,channels:3,background:'#bc7541'}}).png().toBuffer(),asset=await storeFile(p.id,owner,png,'image/png','product.png');p.assets=[asset];
p.scenes=Array.from({length:3},(_,i)=>({id:'fixture-scene-'+i,seconds:10,narration:'',speechMode:'none',visual:i?'상품 근접':'상품을 든 인물',visualRole:i?'product':'presenter_product',presentation:'scene',evidence:'',fiction:true,revision:1,asset:asset.id,referenceMode:'manual',scriptApproved:false,imageApproved:false,audioApproved:false,videoApproved:false,history:[]}));saveProject(p);
const base='http://127.0.0.1:3116',env={...process.env,DATA_DIR:process.env.DATA_DIR,APP_URL:base,SESSION_SECRET:randomBytes(32).toString('hex'),GEMINI_API_KEY:'fixture-not-valid',GEMINI_IMAGE_USD_PER_IMAGE:'.04',USD_TO_KRW:'1000',RATES_REVIEWED_AT:'fixture',OPENAI_API_KEY:'',HIGGSFIELD_API_KEY:'',ELEVENLABS_API_KEY:''};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3116'],{env,stdio:'pipe',windowsHide:true});let log='';server.stdout.on('data',b=>log+=b.toString());server.stderr.on('data',b=>log+=b.toString());
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'studio_session',value:raw,url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();
 await page.getByRole('heading',{name:'AI 아바타 · 프로젝트 출연자'}).waitFor();
 await page.getByRole('button',{name:'한국어 쿠킹 프레젠터 선택',exact:true}).click();await page.getByRole('status').filter({hasText:'선택된 출연자: 한국어 쿠킹 프레젠터'}).waitFor();
 await page.getByText('내 아바타 추가',{exact:true}).click();await page.getByLabel('아바타 이름').fill('사용자 등록 테스트');await page.getByLabel('인물 연령대').selectOption('40s');await page.getByLabel('인물 성별').selectOption('male');await page.getByLabel('인물 타입').selectOption('professional');await page.getByLabel('인물 이미지 (JPEG·PNG·WebP, 10MB 이하)').setInputFiles('public/avatars/korean-cooking-presenter.jpg');await page.getByLabel('이 인물 이미지의 광고 사용과 AI 생성 서비스 전달에 필요한 권한·동의를 확보했습니다.').check();await page.getByRole('button',{name:'아바타 등록',exact:true}).click();
 const library=page.locator('details').filter({has:page.locator('summary').filter({hasText:'아바타 라이브러리'})}).first();await library.locator('summary').first().click();await page.getByLabel('아바타 연령 필터').selectOption('40s');await page.getByRole('button',{name:'사용자 등록 테스트 선택',exact:true}).click();await page.getByRole('status').filter({hasText:'선택된 출연자: 사용자 등록 테스트'}).waitFor();
 await page.reload();await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();await page.getByRole('status').filter({hasText:'선택된 출연자: 사용자 등록 테스트'}).waitFor();
 const api=async(suffix,body)=>{const r=await context.request.post(base+'/api/projects/'+p.id+'/'+suffix,{headers:{Origin:base},data:body});assert.equal(r.status(),200,await r.text());return r.json();};
 const libraryResponse=await context.request.get(base+'/api/avatars');const avatars=(await libraryResponse.json()).avatars;const custom=avatars.find(x=>x.name==='사용자 등록 테스트');assert.ok(custom);assert.equal((await context.request.get(base+custom.reference.url)).status(),200);
 const anon=await browser.newContext();assert.equal((await anon.request.get(base+'/api/avatars')).status(),401);assert.notEqual((await anon.request.get(base+custom.reference.url)).status(),200);await anon.close();
 await api('approve',{stage:'script'});const q=await api('quote',{kind:'image',scene:p.scenes[0].id});const response=await context.request.post(base+'/api/projects/'+p.id+'/generate',{headers:{Origin:base},data:{quote:q,confirmed:true,idempotencyKey:'avatar-e2e-'+randomBytes(16).toString('hex')}});assert.equal(response.status(),202,await response.text());
 const job=db.prepare('SELECT * FROM jobs WHERE project=?').get(p.id),snapshot=JSON.parse(job.input);assert.equal(job.status,'queued');assert.equal(snapshot.project.cast.presenter.id,custom.id);assert.deepEqual(snapshot.referenceSets[p.scenes[0].id].map(x=>x.role),['identity','presenter']);assert.equal(snapshot.referenceSets[p.scenes[0].id][1].id,custom.reference.id);
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 const result={passed:true,realLocalApi:true,registered:true,selectedAndReloaded:true,privateMediaProtected:true,queuedAvatarReference:true,providerExecuted:false,workerStarted:false,paidCalls:0,output:out};await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();server.kill();db.close();await writeFile(path.join(out,'server.log'),log);}
