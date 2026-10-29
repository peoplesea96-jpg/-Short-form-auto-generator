import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('test-results/approval-controls-e2e-'+Date.now());await mkdir(out,{recursive:true});process.env.DATA_DIR=path.join(out,'data');
const {db,hash,saveProject}=await import('../server/db.mjs');
const {createProject}=await import('../server/domain.mjs');
const {storeFile}=await import('../server/media.mjs');
const owner='avatar-browser@example.test',raw=randomBytes(32).toString('hex');
db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('avatar-browser',owner,'not-a-login-password',1,Date.now(),Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw),owner,Date.now()+3600000);
const p=createProject(owner,{title:'아바타 연결 실제 API 검증',kind:'product',description:'실제 API와 저장소를 검증하는 테스트 상품입니다.',audience:'테스트',facts:'',source:'',cta:'',rights:true,productionDirection:{enabled:true,minProductRatio:.8,maxPresenterRatio:.4,captionMode:'none'}});
const png=await sharp({create:{width:32,height:32,channels:3,background:'#bc7541'}}).png().toBuffer(),asset=await storeFile(p.id,owner,png,'image/png','product.png');p.assets=[asset];
p.scenes=Array.from({length:3},(_,i)=>({id:'fixture-scene-'+i,seconds:10,narration:'',speechMode:'none',visual:i?'상품 근접':'상품을 든 인물',visualRole:'product',presentation:'scene',evidence:'',fiction:true,revision:1,asset:asset.id,referenceMode:'manual',scriptApproved:true,imageApproved:false,audioApproved:false,videoApproved:false,history:[]}));const oldImage=await storeFile(p.id,owner,png,'image/png','wrong-label.png');p.scenes[0].image=oldImage;p.scenes[0].candidates={image:[{...oldImage,generation:{label:'GPT Image 2.5'}}]};saveProject(p);
const base='http://127.0.0.1:3118',env={...process.env,DATA_DIR:process.env.DATA_DIR,APP_URL:base,SESSION_SECRET:randomBytes(32).toString('hex'),GEMINI_API_KEY:'fixture-not-valid',GEMINI_IMAGE_USD_PER_IMAGE:'.04',USD_TO_KRW:'1000',RATES_REVIEWED_AT:'fixture',OPENAI_API_KEY:'',HIGGSFIELD_API_KEY:'',ELEVENLABS_API_KEY:''};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3118'],{env,stdio:'pipe',windowsHide:true});let log='';server.stdout.on('data',b=>log+=b.toString());server.stderr.on('data',b=>log+=b.toString());
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'studio_session',value:raw,url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();
 await page.getByRole('button',{name:'2 스토리보드',exact:true}).click();
 // Make one script unapproved through the same isolated fixture store.
 const stored=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);stored.scenes[1].scriptApproved=false;saveProject(stored);
 await page.reload();await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();
 const next=page.getByRole('button',{name:'다음 단계 →',exact:true});
 await expect(next).toBeDisabled();await page.getByLabel('다음 단계 진행 조건',{exact:true}).hover();await expect(page.getByRole('tooltip')).toContainText('씬 2: 대본 승인 필요');
 await page.getByRole('button',{name:'대본 일괄 승인 (1)',exact:true}).click();await expect(next).toBeEnabled();await next.click();
 await page.getByLabel('다음 단계 진행 조건',{exact:true}).focus();await expect(page.getByRole('tooltip')).toContainText('씬 2: 이미지 생성 후 승인 필요');
 await page.getByRole('button',{name:'이미지 일괄 승인 (3)',exact:true}).click();
 await expect(page.getByText('유효한 장면 이미지를 먼저 생성해 주세요.',{exact:true})).toBeVisible();
 let current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);assert.equal(current.scenes[0].imageApproved,false);
 current.scenes.forEach(scene=>{scene.image=oldImage;});saveProject(current);
 await page.reload();await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();await page.getByRole('button',{name:'3 장면 이미지',exact:true}).click();
 await page.getByRole('button',{name:'이미지 일괄 승인 (3)',exact:true}).click();await expect(next).toBeEnabled();
 current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);assert.ok(current.scenes.every(scene=>scene.imageApproved));
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 const result={passed:true,bulkScript:true,bulkImage:true,missingImageRollback:true,hoverAndKeyboardTooltip:true,paidCalls:0,output:out};await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();server.kill();db.close();await writeFile(path.join(out,'server.log'),log);}
