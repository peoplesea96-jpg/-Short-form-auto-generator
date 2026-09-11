import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'detail-browser-'));
Object.assign(process.env,{APP_URL:'http://localhost:3102',SESSION_SECRET:'mock-session-secret-long-enough-32-characters',OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock',OPENAI_INPUT_KRW_PER_MILLION:'100',OPENAI_OUTPUT_KRW_PER_MILLION:'400',RATES_REVIEWED_AT:'test'});
const {db,hash}=await import('../server/db.mjs');const token=crypto.randomUUID();db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('detail-test','detail@example.test','unused',1,Date.now(),Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),'detail@example.test',Date.now()+3600000);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p','3102'],{env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',d=>logs+=d);server.stdout.on('data',()=>{});
const worker=spawn(process.execPath,['--import','./tests/mock-detail.mjs','server/worker.mjs'],{env:{...process.env,NODE_ENV:'test',WORKER_POLL_MS:'50'},windowsHide:true,stdio:['ignore','pipe','pipe']});worker.stdout.on('data',()=>{});worker.stderr.on('data',d=>logs+=d);
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(process.env.APP_URL)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1050}});await context.addCookies([{name:'studio_session',value:token,url:process.env.APP_URL}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(process.env.APP_URL);
 await page.getByRole('button',{name:'새 프로젝트',exact:true}).click();await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).fill('기존 제목');await page.getByLabel(/자료 사용 권한을 확인했으며/).check();
 const buffer=await sharp({create:{width:600,height:2800,channels:3,background:'#dad1ef'}}).png().toBuffer();await page.getByLabel('상세페이지 이미지 추가').setInputFiles({name:'detail.png',mimeType:'image/png',buffer});await page.getByRole('button',{name:'분석하고 초안 만들기',exact:true}).click();await page.getByRole('button',{name:'비용 확인하고 분석',exact:true}).click();await page.getByRole('button',{name:'분석 결과 검토',exact:true}).waitFor({timeout:60000});
 assert.equal(await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).inputValue(),'기존 제목');
 assert.equal(await page.getByRole('button',{name:'빈 입력란 자동 채우기',exact:true}).isDisabled(),true);
 await page.getByLabel('자동 채우기에 사용할 상품·옵션').selectOption('0');await page.getByRole('button',{name:'빈 입력란 자동 채우기',exact:true}).click();await page.getByText(/항목을 채웠습니다/).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).inputValue(),'기존 제목');assert.equal(await page.getByPlaceholder(/정확한 상품 정보/).inputValue(),'용량 500mL [출처 1]');assert.ok((await page.getByPlaceholder(/상품 특징, 전달할 메시지/).inputValue()).includes('온유 티'));
 await page.getByRole('button',{name:'분석 결과 검토',exact:true}).click();await page.getByLabel('광고에 사용할 상품·옵션').selectOption('1');await page.getByLabel('광고에 사용할 상품·옵션').selectOption('0');
 assert.equal(await page.getByLabel('원본 기재 정보 · 진위 검증 아님 제안 내용').inputValue(),'용량 500mL [출처 1]');await page.getByLabel('프로젝트 이름 제안 내용').fill('검토한 제목');
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/detail-review.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1050});
 await page.getByRole('button',{name:'선택한 내용으로 입력란 채우기',exact:true}).click();await page.getByRole('dialog',{name:'상세페이지 분석 결과 검토'}).waitFor({state:'hidden'});assert.equal(await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).inputValue(),'검토한 제목');await page.getByLabel(/입력 자료와 이미지의 사용 권한/).check();await page.getByRole('button',{name:'프로젝트 만들기',exact:true}).click();await page.getByRole('heading',{name:'검토한 제목',exact:true}).waitFor();
 const result=await page.request.get(process.env.APP_URL+'/api/projects');const data=await result.json();assert.equal(data.projects[0].assets.length,0);assert.equal(data.projects[0].detailAnalysis.images.length,1);assert.equal(data.projects[0].detailAnalysis.review.fields.title,'검토한 제목');const anonymous=await browser.newContext();const denied=await anonymous.request.get(process.env.APP_URL+data.projects[0].detailAnalysis.images[0].url);assert.equal(denied.status(),401);assert.deepEqual(errors,[]);console.log(JSON.stringify({flow:'upload → quote → worker analysis → review → selected fields → project',passed:true,isolated:true,realApiCalls:0}));
}catch(e){console.error(logs.slice(-2000));throw e;}finally{if(browser)await browser.close();server.kill();worker.kill();await Promise.all([server,worker].map(p=>new Promise(r=>{p.once('exit',r);setTimeout(r,3000);})));db.close();}
