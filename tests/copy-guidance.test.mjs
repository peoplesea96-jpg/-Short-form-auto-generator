import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {copyPrompt,copyInput,reviewCopy,copyReviewKey} from '../server/copy-guidance.mjs';
const dir=mkdtempSync(path.join(tmpdir(),'frame-copy-'));process.env.DATA_DIR=dir;
Object.assign(process.env,{OPENAI_MODEL:'fixture',OPENAI_API_KEY:'fixture',OPENAI_INPUT_KRW_PER_MILLION:'1',OPENAI_OUTPUT_KRW_PER_MILLION:'1'});
const {db,id,saveProject,getProject}=await import('../server/db.mjs');
const {createProject,approve,updateScenes,sceneSchema}=await import('../server/domain.mjs');
const {generateScript}=await import('../server/providers.mjs');
const {requestPlan,normalizeAdScenes}=await import('../server/ad-planning.mjs');
const owner='copy@test';
const metadata=()=>({role:'situation',sourceIds:['brief.facts'],missingInformation:[],reviewNotes:['제공 원문 확인 필요']});
function fixture(){const p=createProject(owner,{title:'테스트 광고 제목',kind:'product',description:'용량 정보를 제공한 테스트 보틀입니다.',audience:'고객',facts:'용량 1000mL',source:'',cta:'',rights:true});p.scenes=Array.from({length:3},()=>({id:id(),narration:'용량은 천 밀리리터입니다.',visual:'제품',evidence:'사용자 원문: 용량 1000mL',fiction:true,seconds:10,asset:'',revision:1,scriptApproved:false,imageApproved:true,audioApproved:false,videoApproved:false,image:{id:id(),expires:Date.now()+60000},copy:metadata(),speechMode:'voiceover'}));saveProject(p);return p;}
test('conservative checks separate direction, natural demonstration and fictional claims',()=>{
 const p={scenes:[]};for(const narration of ['먼저 제품을 보여줍니다.','사용 전에는 붓고, 기다리는 방식으로 안내합니다.','마지막까지 제품을 보이며, 하수구 냄새 관리용으로 전합니다.','[근거 확인 필요] 제품입니다.'])assert.ok(reviewCopy(p,{narration}).some(x=>x.severity==='block'));
 assert.equal(reviewCopy(p,{narration:'여는 방법, 보여드릴게요.'}).length,0);
 assert.ok(reviewCopy(p,{narration:'99.9% 살균',fiction:true,evidence:''}).some(x=>x.rule==='R02'));
 assert.equal(reviewCopy(p,{narration:'퇴근 후 한 끼 어떠세요?',fiction:true}).length,0);
});
test('approval requires human review, persists provenance, invalidates on source change',()=>{
 let p=fixture();assert.throws(()=>approve(owner,p.id,p.scenes[0].id,'script'),/다시 검토/);
 p=approve(owner,p.id,p.scenes[0].id,'script',{revision:p.revision,copyReviewed:[p.scenes[0].id]});assert.ok(p.scenes[0].copyApproval.hash);assert.deepEqual(p.scenes[0].copy,metadata());
 const old=copyReviewKey(p,p.scenes[0]);p.brief.facts='용량 500mL';assert.notEqual(copyReviewKey(p,p.scenes[0]),old);
 p.scenes[0].audio={duration:5,expires:Date.now()+60000};saveProject(p);assert.throws(()=>approve(owner,p.id,p.scenes[0].id,'audio'),/카피와 근거/);
});
test('scene save preserves copy metadata even legacy client omits it, edits preserve image',()=>{
 let p=fixture();const image=p.scenes[0].image.id;const input=p.scenes.map(s=>{const x={...s};delete x.copy;return x;});input[0].narration='보틀을 찾으시나요?';p=updateScenes(owner,p.id,p.revision,input,30);
 assert.deepEqual(p.scenes[0].copy,metadata());assert.equal(p.scenes[0].image.id,image);assert.equal(p.scenes[0].imageApproved,true);assert.equal(p.scenes[0].audio,null);assert.deepEqual(sceneSchema.parse(p.scenes[0]).copy,metadata());
});
test('unknown references and a failing scene block batch approval atomically',()=>{
 const p=fixture();p.scenes[1].copy.sourceIds=['invented'];saveProject(p);assert.throws(()=>approve(owner,p.id,null,'script',{revision:p.revision,copyReviewed:p.scenes.map(s=>s.id)}),/없는 출처/);assert.ok(getProject(p.id,owner).scenes.every(s=>!s.scriptApproved));
});
test('both generation routes carry common policy, source contract and copy schema in both caption modes',async()=>{
 const old=globalThis.fetch;let body;globalThis.fetch=async(url,opt)=>{body=JSON.parse(opt.body);return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({scenes:Object.fromEntries((JSON.parse(body.input).sceneLayout||[]).map(s=>[s.key,{...s}]))})}]}],usage:{}}));};
 try{for(const mode of ['none','narration']){const p=fixture();p.productionDirection={enabled:true,minProductRatio:.8,maxPresenterRatio:.4,captionMode:mode};if(mode==='narration')p.productionDirection.captionMode='narration';
 // Both supported caption modes exercise the actual direction schema.
 await generateScript(p);assert.ok(body.text.format.schema.properties.scenes.properties.scene_1.properties.copy);assert.match(body.instructions,/narration-v0.3-sales/);assert.doesNotMatch(body.instructions,/CTA는 마지막 장면 위에 표시되므로/);assert.equal(JSON.parse(body.input).copyContext.sources[1].status,'source_observed');
 try{await requestPlan(p,'storyboard');}catch{}assert.match(body.instructions,/소비자에게 실제로/);assert.ok(body.text.format.schema.properties.scenes.items.properties.copy);if(mode==='none')assert.match(body.instructions,/무자막: 화면 CTA/);
 }}finally{globalThis.fetch=old;}
});
test('planning normalization retains copy metadata',()=>{const p=fixture();const raw=p.scenes.map(s=>({...s,beatRole:'제품',shots:[{title:'제품',purpose:'소개',visual:'제품',motion:'',framing:'close',seconds:10,soundCue:''}]}));const result=normalizeAdScenes(p,raw);assert.deepEqual(result[0].copy,metadata());});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
