import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='https://short-form-auto-generator-production.up.railway.app';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const health=await page.request.get(base+'/api/health');assert.equal(health.status(),200);const healthBody=await health.json();assert.equal(healthBody.worker,true);
 const privateApi=await page.request.get(base+'/api/projects');assert.equal(privateApi.status(),401);
 const root=await page.goto(base);assert.equal(root.status(),200);
 await page.goto(base+'/preview');await page.getByRole('button',{name:/매일의 작은 쉼/}).click();await page.getByRole('button',{name:'1 자료 입력',exact:true}).click();
 await page.getByRole('heading',{name:'AI 아바타 · 프로젝트 출연자'}).waitFor();await page.getByRole('heading',{name:'상품 중심 제작 기준'}).waitFor();const avatarImage=await page.request.get(base+'/avatars/korean-cooking-presenter.jpg');assert.equal(avatarImage.status(),200);assert.equal((await page.request.get(base+'/api/avatars')).status(),401);await page.getByText('현재 앱은 내레이션 방식입니다.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'3 장면 이미지',exact:true}).click();await page.getByRole('heading',{name:'이미지 수정·재생성',exact:true}).waitFor();await page.getByLabel('어떻게 수정할까요?').waitFor();await page.getByLabel('수정 조건 적용 범위').waitFor();await page.getByRole('button',{name:'이 조건으로 재생성 · 비용 확인'}).waitFor();
 await page.screenshot({path:'test-results/image-revision-deployed-20261030.png',fullPage:true});assert.deepEqual(errors,[]);
 const report={url:base,health:healthBody,rootStatus:200,unauthenticatedProjects:401,imageRevisionPanel:true,referenceRoleSelection:true,avatarLibraryPanel:true,builtinAvatarImage:true,privateAvatarApiProtected:true,productionDirectionPanel:true,lipSyncLimitationVisible:true,jsErrors:errors,paidCalls:0,scope:'Public live preview and health; authenticated write/generation not exercised'};
 await writeFile('test-results/image-revision-deploy-smoke-20261030.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
