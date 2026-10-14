import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 320"><rect width="180" height="320" fill="#ded8ef"/><text x="45" y="160">FIXTURE</text></svg>'),expires=Date.now()+600000;
const preset={id:'11111111-1111-4111-8111-111111111111',name:'Premium product ad',preview:image};let paid=0;
const p={id:'marketing-fixture',revision:1,brief:{title:'광고 이미지 테스트',kind:'product',description:'상품 원본과 광고 기획',audience:'사장님',facts:'원본 자료',rights:true},duration:15,bgm:'none',bgmVolume:.12,assets:[{id:'asset',name:'상품 원본',url:image,expires}],finals:[],created:Date.now(),scenes:[{id:'scene',revision:1,seconds:7.5,narration:'상품 소개',visual:'제품 정면',asset:'asset',scriptApproved:true,imageApproved:true,audioApproved:true,videoApproved:true,image:{id:'old',url:image,expires},history:[]}]};
await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname.slice(5),b=req.method()==='POST'?req.postDataJSON():{};let data;
 if(path==='me')data={email:'fixture@example.test',admin:false};else if(path==='models')data={models:[{id:'marketing-flare',kind:'image',label:'Higgsfield Marketing Studio · 광고 이미지',resolutions:['1k','2k','4k'],workflow:'marketing-image',enabled:true},{id:'nano-banana',kind:'image',label:'Nano Banana',resolutions:['1K']},{id:'kling',kind:'video',label:'Kling fixture',resolutions:['standard'],enabled:true},{id:'gemini-legacy',kind:'video',label:'既存',resolutions:['720p']}]};else if(path==='status')data={gemini:true,script:true,rates:true,worker:true};else if(path==='projects')data={projects:[p],budget:{month:0}};
 else if(path==='voices')data={configured:true,provider:'gemini',voices:[],models:[]};
 else if(path.endsWith('/generation-settings')){p.generationSettings=b.settings;p.revision++;data=p;}
 else if(path==='marketing-presets')data={items:[preset],total:1};
 else if(path.endsWith('/marketing-quote')){assert.equal(b.unit,'scene');assert.equal(b.count,2);assert.equal(b.preset,preset.id);data={kind:'marketing-image',request:b,preset,amount:b.count*b.reservePerImage,budget:{project:0,month:0}};}
 else if(path.endsWith('/marketing-generate')){paid++;assert(b.confirmed);assert(b.idempotencyKey);const s=p.scenes[0];s.candidates={image:[s.image,...Array.from({length:2},(_,i)=>({id:'new-'+i,url:image,expires,cost:null,costType:'unconfirmed',reserved:500,marketing:{preset,quality:'high'},generation:{label:'Marketing Studio',version:'fixture',resolution:'2k'}}))]};p.revision++;data={ok:true};}
 else if(path.endsWith('/select-candidate')){p.scenes[0].image=p.scenes[0].candidates.image.find(c=>c.id===b.file);p.scenes[0].imageApproved=false;p.scenes[0].videoApproved=false;p.revision++;data=p;}
 else if(path.endsWith('/approve')){assert.equal(b.stage,'image');assert.equal(b.scene,'scene');p.scenes[0].imageApproved=true;p.revision++;data=p;}
 else if(path==='projects/'+p.id)data={project:p,budget:{project:1000,month:1000},jobs:[]};else throw Error('Unexpected fixture '+path);
 await route.fulfill({json:data});
});
try{
 await page.goto('http://localhost:3102');await page.getByRole('button',{name:/광고 이미지 테스트/}).click();const defaults=page.locator('.generation-settings');assert.equal(await defaults.getByLabel('영상 모델',{exact:true}).locator('option[value="kling"]').getAttribute('disabled'),null);await defaults.getByLabel('이미지 모델',{exact:true}).selectOption('marketing-flare');await defaults.getByRole('button',{name:'Higgsfield 이미지 설정·프리셋 선택',exact:true}).click();
 const panel=page.getByRole('region',{name:'Marketing Studio 광고 이미지'});
 assert.equal(p.generationSettings.image.model,'marketing-flare');const gallery=page.getByRole('dialog',{name:'광고 이미지 프리셋 선택'});await gallery.getByRole('button',{name:preset.name}).click();await page.locator('.scene').first().getByRole('button',{name:'비교 후보 추가',exact:true}).click();await gallery.getByRole('button',{name:preset.name}).click();assert.equal(paid,0);
 await panel.getByLabel('광고 이미지 예약 예산',{exact:true}).fill('500');await panel.getByRole('button',{name:'예약 예산 확인 후 후보 생성'}).click();
 const dialog=page.getByRole('dialog',{name:'광고 이미지 생성 확인'});await dialog.waitFor();assert.equal(paid,0);assert(await dialog.getByRole('button',{name:'확인하고 생성'}).isDisabled());
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'확인하고 생성'}).click();await panel.getByRole('heading',{name:'선택한 장면의 이미지 후보 3개'}).waitFor();assert.equal(paid,1);assert.equal(p.scenes[0].image.id,'old');assert(p.scenes[0].imageApproved);
 await panel.getByRole('button',{name:'이 후보 선택',exact:true}).first().click();await panel.getByRole('button',{name:'선택한 이미지 승인',exact:true}).waitFor();assert.equal(p.scenes[0].image.id,'new-0');assert.equal(p.scenes[0].imageApproved,false);
 await panel.getByRole('button',{name:'선택한 이미지 승인',exact:true}).click();await panel.getByRole('button',{name:'이미지 승인 완료',exact:true}).waitFor();assert(p.scenes[0].imageApproved);assert.equal(paid,1);
 await page.screenshot({path:'test-results/marketing-image-comparison.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Preset selection, budget consent, 2 candidates, retained selection, compare/select/approve: passed (mock only).');
}finally{await browser.close();}
