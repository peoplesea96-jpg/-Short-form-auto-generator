import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'frame-direction-'));process.env.DATA_DIR=dir;
const {directionSchema,validateDirection,directionReport,assertSpeechSupported,captionsEnabled}=await import('../server/production-direction.mjs');
const {db,saveProject}=await import('../server/db.mjs');
const {createProject,active,plan}=await import('../server/domain.mjs');
const {savePlanning,normalizeAdScenes}=await import('../server/ad-planning.mjs');
const {validateFinishing,previewHash}=await import('../server/finishing.mjs');
const {inputFingerprint}=await import('../server/generation-models.mjs');
const {videoPayload}=await import('../server/higgsfield.mjs');
const {startVideo}=await import('../server/providers.mjs');
const direction=directionSchema.parse({});
const unit=(seconds,visualRole)=>({seconds,visualRole,presentation:'scene',speechMode:'voiceover',narration:'해동 후 구워 주세요.'});
const project=()=>({productionDirection:direction,scenes:[unit(2,'presenter_product'),unit(12,'product'),unit(4,'presenter_product'),unit(2,'product')]});
test('duration-weighted coverage, product opener and person cap apply to scenes and shots',()=>{
 const p=project();assert.doesNotThrow(()=>validateDirection(p));assert.equal(directionReport(p).presenterRatio,.3);
 p.scenes[0].visualRole='presenter';assert.throws(()=>validateDirection(p),/첫 화면/);
 p.scenes[0].visualRole='presenter_product';p.scenes[1].visualRole='presenter_product';assert.throws(()=>validateDirection(p),/비중/);
 p.scenes[1].visualRole='context';assert.throws(()=>validateDirection(p),/상품 노출/);
 p.scenes=[{seconds:20,shots:project().scenes}];assert.doesNotThrow(()=>validateDirection(p));
 p.scenes[0].shots[1].presentation='photo_card';assert.throws(()=>validateDirection(p),/사진 카드/);
});
test('unknown roles, product-free references and photo end cards cannot pass silently',()=>{
 const p=project();delete p.scenes[0].visualRole;assert.throws(()=>validateDirection(p),/역할/);
 p.scenes=project().scenes;p.scenes[1].referenceMode='none';assert.throws(()=>validateDirection(p),/참조 모드/);
 delete p.scenes[1].referenceMode;p.finishing={endCard:{enabled:true}};assert.throws(()=>validateDirection(p),/마지막 상품/);
});
test('lip sync is rejected before quote or provider requests, regardless of visual policy',async()=>{
 const scene={speechMode:'lipsync',narration:'안녕하세요'};
 assert.throws(()=>plan({scenes:[scene]},'video'),/립싱크/);
 assert.throws(()=>videoPayload({model:'seedance'},'https://example.com/a.png',scene),/립싱크/);
 await assert.rejects(()=>startVideo({},scene),/립싱크/);
 assert.throws(()=>assertSpeechSupported({speechMode:'none',narration:'발화'}),/비워/);
 assert.doesNotThrow(()=>assertSpeechSupported({speechMode:'none',narration:''}));
});
test('policy saves preserve files, invalidate approvals and respect ownership/revision',()=>{
 let p=createProject('owner',{title:'상품',kind:'product',description:'테스트 상품 설명입니다.',audience:'고객',facts:'',cta:'',source:'',rights:true,productionDirection:direction});
 p.scenes=[{...unit(15,'product'),id:'scene',scriptApproved:true,imageApproved:true,videoApproved:true,image:{id:'keep'},shots:[{...unit(15,'product'),imageApproved:true,videoApproved:true}]}];saveProject(p);
 const body={operation:'direction',revision:p.revision,direction:{...direction,maxPresenterRatio:.3}};
 assert.throws(()=>savePlanning('other',p.id,body,active));
 p=savePlanning('owner',p.id,body,active);assert.equal(p.scenes[0].image.id,'keep');assert.equal(p.scenes[0].shots[0].videoApproved,false);assert.equal(p.scenes[0].scriptApproved,false);
 assert.throws(()=>savePlanning('owner',p.id,body,active),/변경/);
 assert.equal(db.prepare('SELECT count(*) n FROM jobs WHERE project=?').get(p.id).n,0);
});
test('no-caption mode is separate from narration and blocks finishing text reintroduction',()=>{
 const p=project(),f={cues:[],texts:[],endCard:{enabled:false,seconds:3,asset:'',title:'',message:''}};
 assert.equal(captionsEnabled(p),false);assert.equal(captionsEnabled({}),true);
 assert.doesNotThrow(()=>validateFinishing(p,f));f.texts=[{text:'다시 나타난 자막',start:0,end:1}];assert.throws(()=>validateFinishing(p,f),/무자막/);
});
test('direction and screen role changes invalidate media and preview fingerprints',()=>{
 const p={...project(),brief:{description:'상품',audience:'고객'},assets:[]},s=p.scenes[0];
 const before=inputFingerprint(p,s,'image'),preview=previewHash(p);s.visualRole='product';
 assert.notEqual(inputFingerprint(p,s,'image'),before);assert.notEqual(previewHash(p),preview);
});
test('new storyboard metadata survives normalization and bad paid output is rejected without retry',()=>{
 const p={...project(),duration:20};const raw=[6,14].map((seconds,i)=>({narration:'',visual:'상품',evidence:'',fiction:true,speechMode:'none',seconds,beatRole:'상품',shots:[{...unit(seconds,i?'product':'presenter_product'),title:'상품',purpose:'시연',visual:'상품을 든 인물',motion:'들기',framing:'medium',soundCue:''}]}));
 const result=normalizeAdScenes(p,raw);assert.equal(result[0].shots[0].visualRole,'presenter_product');assert.equal(result[0].speechMode,'none');
 raw[0].shots[0].visualRole='presenter';assert.throws(()=>normalizeAdScenes(p,raw),/첫 화면/);
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
