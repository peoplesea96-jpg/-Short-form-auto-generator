import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
const dir=mkdtempSync(path.join(tmpdir(),'frame-avatars-'));process.env.DATA_DIR=dir;
Object.assign(process.env,{GEMINI_API_KEY:'fixture',GEMINI_IMAGE_USD_PER_IMAGE:'.04',USD_TO_KRW:'1000',RATES_REVIEWED_AT:'fixture'});
const {db,saveProject,id}=await import('../server/db.mjs');
const {listAvatars,registerAvatar,getAvatar,saveCast,referenceBytes,castPlanPrompt}=await import('../server/avatars.mjs');
const {createProject,active,quote,enqueue}=await import('../server/domain.mjs');
const {storeFile,cleanup}=await import('../server/media.mjs');
const {resolvedReferences}=await import('../server/project-profiles.mjs');
const {inputFingerprint}=await import('../server/generation-models.mjs');
const {generateImage,startVideo}=await import('../server/providers.mjs');
const {generateOpenaiImage}=await import('../server/openai-image.mjs');
const {manageVersion}=await import('../server/creative-structure.mjs');
const owner='avatar-owner@example.test',other='other@example.test';
const png=await sharp({create:{width:16,height:16,channels:3,background:'#af5362'}}).png().toBuffer();
const metadata={name:'내 모델',ageGroup:'40s',gender:'male',style:'professional',description:'회색 셔츠',rights:true};
const upload=()=>new File([png],'portrait.png',{type:'image/png'});
const create=()=>{const p=createProject(owner,{title:'테스트 상품',kind:'product',description:'참조 상품을 시연하는 광고입니다.',audience:'고객',facts:'',cta:'',source:'',rights:true});p.scenes=[{id:id(),seconds:10,revision:1,narration:'',visual:'상품을 든 인물',visualRole:'presenter_product',presentation:'scene',referenceMode:'none',scriptApproved:true,imageApproved:true,videoApproved:true,image:{id:id()},video:{id:id()}},{id:id(),seconds:10,revision:1,narration:'',visual:'상품',visualRole:'product',referenceMode:'none',scriptApproved:true,imageApproved:true,videoApproved:true},{id:id(),seconds:10,revision:1,narration:'',visual:'상품',visualRole:'product',referenceMode:'none',scriptApproved:true}];saveProject(p);return p;};
test('library has a real built-in image and private owner-scoped uploads',async()=>{
 const built=listAvatars(owner)[0];assert.ok((await referenceBytes({...built.reference,role:'presenter'})).length>1000);
 const a=await registerAvatar(owner,metadata,upload());assert.equal(getAvatar(owner,a.id).name,metadata.name);assert.ok(listAvatars(owner).some(x=>x.id===a.id));assert.ok(!listAvatars(other).some(x=>x.id===a.id));assert.throws(()=>getAvatar(other,a.id),/선택/);
 assert.equal((await sharp(await referenceBytes(a.reference)).metadata()).format,'webp');
 await cleanup();assert.ok(db.prepare('SELECT id FROM files WHERE id=?').get(a.reference.id));
});
test('registration rejects missing rights, invalid formats and oversized files',async()=>{
 await assert.rejects(()=>registerAvatar(owner,{...metadata,rights:false},upload()));
 await assert.rejects(()=>registerAvatar(owner,metadata,new File(['<svg/>'],'x.svg')));
 await assert.rejects(()=>registerAvatar(owner,metadata,{size:11*1024*1024}),/10MB/);
});
test('cast selection guards ownership and jobs, only invalidates person shots, keeps candidates',()=>{
 let p=create();const before=p.scenes[0].image.id,builtin=listAvatars(owner)[0];
 assert.throws(()=>saveCast(other,p.id,{revision:p.revision,avatarId:builtin.id},active));
 assert.throws(()=>saveCast(owner,p.id,{revision:p.revision,avatarId:builtin.id},()=>true),/진행 중/);
 p=saveCast(owner,p.id,{revision:p.revision,avatarId:builtin.id},active);
 assert.equal(p.cast.presenter.id,builtin.id);assert.equal(p.scenes[0].image,null);assert.equal(p.scenes[0].candidates.image[0].id,before);assert.equal(p.scenes[0].scriptApproved,false);assert.equal(p.scenes[1].imageApproved,true);
 assert.throws(()=>saveCast(owner,p.id,{revision:0,avatarId:null},active),/변경/);
});
test('product references and person identity are independently resolved and fingerprinted',async()=>{
 let p=create();const asset=await storeFile(p.id,owner,png,'image/png','product.png');p.assets=[asset];p.scenes[0].referenceMode='manual';p.scenes[0].asset=asset.id;saveProject(p);
 assert.throws(()=>resolvedReferences(p,p.scenes[0]),/아바타/);
 const productHash=inputFingerprint(p,p.scenes[1],'image'),old=inputFingerprint(p,p.scenes[0],'image');
 p=saveCast(owner,p.id,{revision:p.revision,avatarId:listAvatars(owner)[0].id},active);
 const refs=resolvedReferences(p,p.scenes[0]);assert.deepEqual(refs.map(x=>x.role),['identity','presenter']);assert.equal(refs[0].id,asset.id);assert.notEqual(inputFingerprint(p,p.scenes[0],'image'),old);assert.equal(inputFingerprint(p,p.scenes[1],'image'),productHash);
 assert.equal(resolvedReferences(p,p.scenes[1]).length,0);
});
test('image job snapshot carries the chosen presenter and reference role without a paid request',()=>{
 let p=create();p=saveCast(owner,p.id,{revision:p.revision,avatarId:listAvatars(owner)[0].id},active);p.scenes[0].scriptApproved=true;saveProject(p);
 const q=quote(owner,p.id,'image',p.scenes[0].id),job=enqueue(owner,p.id,q,'avatar-test-'+id());const input=JSON.parse(job.input);
 assert.equal(input.project.cast.presenter.id,p.cast.presenter.id);assert.equal(input.referenceSets[p.scenes[0].id][0].role,'presenter');assert.equal(job.status,'queued');db.prepare('DELETE FROM jobs WHERE id=?').run(job.id);
});
test('Gemini request actually contains selected uploaded avatar bytes and labels',async()=>{
 let p=create();const a=await registerAvatar(owner,metadata,upload());p=saveCast(owner,p.id,{revision:p.revision,avatarId:a.id},active);
 const old=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({output_image:{mime_type:'image/png',data:png.toString('base64')}}),{status:200});};
 try{await generateImage(p,p.scenes[0],{provider:'gemini',version:'fixture'});const refs=request.input.filter(x=>x.type==='image');assert.equal(refs.length,1);assert.equal(refs[0].data,(await referenceBytes(a.reference)).toString('base64'));assert.match(request.input.filter(x=>x.type==='text').map(x=>x.text).join('\n'),/presenter|selected person/);}finally{globalThis.fetch=old;}
});
test('OpenAI image edit sends avatar as an image attachment, not only a prompt name',async()=>{
 let p=create();p=saveCast(owner,p.id,{revision:p.revision,avatarId:listAvatars(owner)[0].id},active);const old=globalThis.fetch;let request,url;
 globalThis.fetch=async(u,options)=>{url=u;request=options.body;return new Response(JSON.stringify({data:[{b64_json:png.toString('base64')}]}),{status:200});};
 try{await generateOpenaiImage(p,p.scenes[0],'Presenter reference',{version:'fixture'});assert.match(url,/images\/edits$/);assert.equal(request.getAll('image[]').length,1);assert.deepEqual(Buffer.from(await request.get('image[]').arrayBuffer()),await referenceBytes(p.cast.presenter.reference));}finally{globalThis.fetch=old;}
});
test('video animates approved image and preserves chosen actor direction',async()=>{
 let p=create();p=saveCast(owner,p.id,{revision:p.revision,avatarId:listAvatars(owner)[0].id},active);p.scenes[0].image=await storeFile(p.id,owner,png,'image/png','approved.png');const old=globalThis.fetch;let body;
 globalThis.fetch=async(u,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({id:'fixture'}),{status:200});};
 try{await startVideo(p,p.scenes[0],{version:'fixture'});assert.equal(body.input[0].data,png.toString('base64'));assert.match(body.input[1].text,/Preserve this person's face/);}finally{globalThis.fetch=old;}
});
test('version activation restores project cast independently',()=>{
 let p=create();p=saveCast(owner,p.id,{revision:p.revision,avatarId:listAvatars(owner)[0].id},active);p=manageVersion(owner,p.id,{revision:p.revision,operation:'create',name:'다른 구성',hook:'product'},active);const original=p.versions[0].id;p=saveCast(owner,p.id,{revision:p.revision,avatarId:null},active);assert.match(castPlanPrompt(p),/미선택/);p=manageVersion(owner,p.id,{revision:p.revision,operation:'activate',version:original},active);assert.ok(p.cast.presenter);assert.match(castPlanPrompt(p),/presenter_product/);
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
