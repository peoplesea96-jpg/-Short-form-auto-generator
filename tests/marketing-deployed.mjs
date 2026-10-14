import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const app='https://short-form-auto-generator-production.up.railway.app',pages='https://peoplesea96-jpg.github.io/-Short-form-auto-generator/';
const browser=await chromium.launch({headless:true});
try{
 for(const [name,url] of [['app',app+'/preview'],['pages',pages]]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const r=await page.goto(url,{waitUntil:'networkidle'});assert.equal(r.status(),200);await page.getByRole('button',{name:/매일의 작은 쉼/}).click();await page.locator('.generation-settings').getByLabel('이미지 모델',{exact:true}).locator('option[value="marketing-flare"]').waitFor({state:'attached'});await page.getByRole('button',{name:'Higgsfield 이미지 설정·프리셋 선택',exact:true}).waitFor();assert(!/도입 보류/.test(await page.locator('.generation-settings').innerText()));await page.getByRole('button',{name:'3 장면 이미지',exact:true}).click();
  const panel=page.getByRole('region',{name:'Marketing Studio 광고 이미지'});await panel.getByRole('button',{name:'프리셋 선택',exact:true}).waitFor();await panel.screenshot({path:`test-results/marketing-deployed-${name}.png`});assert.deepEqual(errors,[]);await page.close();console.log(name+': deployed Marketing Studio screen verified');
 }
 const health=await fetch(app+'/api/health',{cache:'no-store'});assert.equal(health.status,200);const d=await health.json();assert(d.worker);console.log('Health',d);
 for(const [path,method] of [['/api/marketing-presets','GET'],['/api/projects/fixture/marketing-quote','POST'],['/api/projects/fixture/marketing-generate','POST']]){
  const r=await fetch(app+path,{method,headers:{Origin:app,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});assert.equal(r.status,401);console.log(path+': authentication enforced');
 }
}finally{await browser.close();}
