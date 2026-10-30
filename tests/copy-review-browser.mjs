import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('test-results/copy-review-e2e-'+Date.now());await mkdir(out,{recursive:true});process.env.DATA_DIR=path.join(out,'data');
const {db,hash,saveProject}=await import('../server/db.mjs');
const {createProject}=await import('../server/domain.mjs');
const {storeFile}=await import('../server/media.mjs');
const owner='avatar-browser@example.test',raw=randomBytes(32).toString('hex');
db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('avatar-browser',owner,'not-a-login-password',1,Date.now(),Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw),owner,Date.now()+3600000);
const p=createProject(owner,{title:'아바타 연결 실제 API 검증',kind:'product',description:'실제 API와 저장소를 검증하는 테스트 상품입니다.',audience:'테스트',facts:'',source:'',cta:'',rights:true,productionDirection:{enabled:true,minProductRatio:.8,maxPresenterRatio:.4,captionMode:'none'}});
const png=await sharp({create:{width:32,height:32,channels:3,background:'#bc7541'}}).png().toBuffer(),asset=await storeFile(p.id,owner,png,'image/png','product.png');p.assets=[asset];
p.scenes=Array.from({length:3},(_,i)=>({id:'fixture-scene-'+i,seconds:10,narration:'',speechMode:'none',visual:i?'상품 근접':'상품을 든 인물',visualRole:'product',presentation:'scene',evidence:'',fiction:true,revision:1,asset:asset.id,referenceMode:'manual',scriptApproved:true,imageApproved:false,audioApproved:false,videoApproved:false,history:[]}));const oldImage=await storeFile(p.id,owner,png,'image/png','wrong-label.png');p.scenes[0].image=oldImage;p.scenes[0].candidates={image:[{...oldImage,generation:{label:'GPT Image 2.5'}}]};p.scenes.forEach(scene=>{scene.image=oldImage;scene.imageApproved=true;scene.narration='생활 속 보틀을 찾으시나요?';scene.scriptApproved=false;scene.speechMode='voiceover';scene.evidence='사용자 제공 상품 설명';scene.copy={role:'situation',sourceIds:['brief.description'],missingInformation:['정확한 상품명 확인'],reviewNotes:['사용자 원문 확인 필요']};scene.audio={...oldImage,duration:10.4};scene.audioApproved=false;});saveProject(p);
const base='http://127.0.0.1:3120',env={...process.env,DATA_DIR:process.env.DATA_DIR,APP_URL:base,SESSION_SECRET:randomBytes(32).toString('hex'),GEMINI_API_KEY:'fixture-not-valid',GEMINI_IMAGE_USD_PER_IMAGE:'.04',USD_TO_KRW:'1000',RATES_REVIEWED_AT:'fixture',OPENAI_API_KEY:'',HIGGSFIELD_API_KEY:'',ELEVENLABS_API_KEY:''};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3120'],{env,stdio:'pipe',windowsHide:true});let log='';server.stdout.on('data',b=>log+=b.toString());server.stderr.on('data',b=>log+=b.toString());
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'studio_session',value:raw,url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:/아바타 연결 실제 API 검증/}).click();
 const reviews=page.getByRole('region',{name:'광고 카피 검수'});await expect(reviews).toHaveCount(3);
 await page.getByRole('button',{name:'대본 일괄 승인 (3)',exact:true}).click();await expect(page.getByText('카피 검수의 출처·상품·조건 확인 항목을 체크해 주세요.',{exact:true})).toBeVisible();
 await reviews.first().getByLabel('확인해야 할 정보',{exact:true}).fill('상품명과 SKU 확인');
 await page.getByRole('button',{name:'변경사항 저장',exact:true}).click();
 for(let i=0;i<3;i++)await reviews.nth(i).getByRole('checkbox',{name:/상품명·옵션과/}).check();
 await page.getByRole('button',{name:'대본 일괄 승인 (3)',exact:true}).click();await expect(page.getByRole('button',{name:'다음 단계 →',exact:true})).toBeEnabled();
 let current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);assert.ok(current.scenes.every(scene=>scene.copyApproval?.hash));assert.deepEqual(current.scenes[0].copy.missingInformation,['상품명과 SKU 확인']);
 await page.getByRole('button',{name:'4 음성 검토',exact:true}).click();await page.getByLabel('씬 2 내레이션 수정',{exact:true}).fill('다른 생활 상황을 살펴보세요.');await page.getByRole('button',{name:'수정 대본 저장',exact:true}).nth(1).click();
 await expect(reviews.nth(1).getByRole('checkbox',{name:/상품명·옵션과/})).not.toBeChecked();
 current=JSON.parse(db.prepare('SELECT body FROM projects WHERE id=?').get(p.id).body);assert.equal(current.scenes[1].scriptApproved,false);assert.equal(current.scenes[1].imageApproved,true);assert.equal(current.scenes[1].audio,null);
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 const result={passed:true,reviewRequired:true,copyMetadataSaved:true,batchApproval:true,editInvalidatesReview:true,imagePreserved:true,paidCalls:0,output:out};await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();server.kill();db.close();await writeFile(path.join(out,'server.log'),log);}
