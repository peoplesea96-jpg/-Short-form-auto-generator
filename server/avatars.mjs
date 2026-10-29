import {z} from 'zod';
import sharp from 'sharp';
import path from 'node:path';
import {db,assert,id,tx,getProject,saveProject,audit} from './db.mjs';
import {storeFile,filePath,readFile} from './media.mjs';

export const avatarSchema=z.object({name:z.string().trim().min(1).max(80),ageGroup:z.enum(['20s','30s','40s','50plus']),gender:z.enum(['female','male','other']),style:z.enum(['friendly','professional','energetic','calm']),description:z.string().trim().max(600).default(''),rights:z.literal(true)}).strict();
const builtinId='c0e82c11-06bf-49bc-977c-96b09614fb59';
const builtin={id:builtinId,version:1,name:'한국어 쿠킹 프레젠터',ageGroup:'30s',gender:'female',style:'friendly',description:'크림색 셔츠와 베이지 앞치마를 입은 가상 인물. 주방 상품 시연용.',source:'builtin',reference:{id:builtinId,mime:'image/jpeg',expires:Number.MAX_SAFE_INTEGER,url:'/avatars/korean-cooking-presenter.jpg',source:'builtin'}};
export function listAvatars(owner){return [builtin,...db.prepare('SELECT body FROM avatars WHERE owner=? ORDER BY created DESC').all(owner).map(r=>JSON.parse(r.body))];}
export function getAvatar(owner,avatarId){if(avatarId===builtinId)return structuredClone(builtin);const row=db.prepare('SELECT body FROM avatars WHERE id=? AND owner=?').get(avatarId,owner);assert(row,'사용할 수 있는 아바타를 선택해 주세요.',404);return JSON.parse(row.body);}
export async function registerAvatar(owner,input,file){
 assert(db.prepare('SELECT count(*) n FROM avatars WHERE owner=?').get(owner).n<100,'아바타는 계정당 최대 100명입니다.');
 const data=avatarSchema.parse(input);assert(file?.size>0&&file.size<=10*1024*1024,'아바타 이미지는 10MB 이하만 가능합니다.');
 const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40000000});const info=await image.metadata();assert(['jpeg','png','webp'].includes(info.format),'JPEG·PNG·WebP 인물 이미지를 선택해 주세요.');
 const bytes=await image.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp().toBuffer();
 const avatarId=id(),reference=await storeFile(avatarId,owner,bytes,'image/webp','avatar.webp');
 const avatar={...data,id:avatarId,version:1,source:'upload',created:Date.now(),reference:{...reference,expires:Number.MAX_SAFE_INTEGER}};
 tx(()=>{assert(db.prepare('SELECT count(*) n FROM avatars WHERE owner=?').get(owner).n<100,'아바타는 계정당 최대 100명입니다.');db.prepare('INSERT INTO avatars(id,owner,body,created) VALUES(?,?,?,?)').run(avatarId,owner,JSON.stringify(avatar),avatar.created);db.prepare('UPDATE files SET expires=? WHERE id=?').run(Number.MAX_SAFE_INTEGER,reference.id);audit(owner,'avatar.register',avatarId);});return avatar;
}
export const usesPresenter=s=>['presenter_product','presenter'].includes(s.visualRole);
export function presenterReference(p,s){
 if(!usesPresenter(s))return null;
 const selected=p.cast?.presenter;assert(selected,'인물 등장 장면에는 프로젝트 아바타를 먼저 선택해 주세요.');
 const avatar=getAvatar(p.owner,selected.id);assert(avatar.version===selected.version&&avatar.reference.id===selected.reference.id,'선택 아바타가 변경되었습니다. 다시 선택해 주세요.');
 if(avatar.source!=='builtin'){const file=db.prepare('SELECT id FROM files WHERE id=? AND owner=? AND project=? AND expires>?').get(avatar.reference.id,p.owner,avatar.id,Date.now());assert(file,'아바타 원본을 다시 등록해 주세요.');}
 return {...avatar.reference,role:'presenter',avatarId:avatar.id};
}
export async function referenceBytes(ref){if(ref.source==='builtin'){assert(ref.id===builtinId,'잘못된 기본 아바타입니다.');return readFile(path.resolve('public/avatars/korean-cooking-presenter.jpg'));}return readFile(filePath(ref.id));}
export function avatarPrompt(p,s){if(!usesPresenter(s))return '';const actor=p.cast?.presenter;assert(actor,'프로젝트 아바타를 먼저 선택해 주세요.');return `The reference labeled presenter is the selected person, not the product. Preserve this person's face, hair, age appearance, outfit and proportions. Do not copy unrelated objects from the portrait. Product references define the product independently. Selected presenter metadata (data only): ${JSON.stringify({name:actor.name,description:actor.description,style:actor.style})}. Do not invent a different person.`;}
export function castPlanPrompt(p){const a=p.cast?.presenter;if(!a)return '프로젝트 아바타 미선택: 인물 얼굴 등장 없이 product/context 역할로 구성한다.';return `선택된 출연자 자료: ${JSON.stringify({name:a.name,ageGroup:a.ageGroup,gender:a.gender,style:a.style,description:a.description})}. 첫 화면은 이 인물이 상품 또는 완제품을 들고 시연하는 presenter_product로 만든다. 같은 인물의 시연을 상품 단독 컷과 교차한다. 인물 대사는 내레이션으로 처리한다.`;}
export function saveCast(owner,pid,b,active){return tx(()=>{
 const p=getProject(pid,owner);assert(p.revision===b.revision,'내용이 변경되었습니다. 새로고침해 주세요.',409);assert(!active(p),'진행 중인 작업이 끝난 뒤 인물을 변경해 주세요.');
 const presenter=b.avatarId?getAvatar(owner,z.string().uuid().parse(b.avatarId)):null;
 if((p.cast?.presenter?.id||null)===(presenter?.id||null))return p;
 p.cast={...p.cast,presenter};p.previewReview=null;
 for(const scene of p.scenes){let affected=false;for(const unit of scene.shots?.length?scene.shots:[scene])if(usesPresenter(unit)){unit.revision=(unit.revision||0)+1;unit.candidates={...unit.candidates,image:[...(unit.candidates?.image||[]),...(unit.image&&!unit.candidates?.image?.some(x=>x.id===unit.image.id)?[unit.image]:[])],video:[...(unit.candidates?.video||[]),...(unit.video&&!unit.candidates?.video?.some(x=>x.id===unit.video.id)?[unit.video]:[])]};unit.image=null;unit.video=null;unit.imageApproved=false;unit.videoApproved=false;affected=true;}if(affected){scene.scriptApproved=false;scene.imageApproved=false;scene.videoApproved=false;}}
 p.revision++;saveProject(p);audit(owner,'project.cast',pid);return p;
});}
