import {revisionReasons,revisionReasonInstructions} from './image-revision-reasons.mjs';
import {z} from 'zod';
import {db,assert} from './db.mjs';
export const imageRevisionSchema=z.object({reason:z.enum(Object.keys(revisionReasons)).optional(),instructions:z.string().trim().max(2000),useProjectReferences:z.boolean(),baseImage:z.string().uuid().nullable(),references:z.array(z.object({id:z.string().uuid(),role:z.enum(['identity','package','composition','background','mood'])}).strict()).max(5)}).strict();
export function projectImages(p){const all=[...(p.assets||[])];for(const scene of p.scenes)for(const unit of scene.shots?.length?scene.shots:[scene])all.push(...(unit.image?[unit.image]:[]),...(unit.candidates?.image||[]));return [...new Map(all.map(x=>[x.id,x])).values()];}
function checked(p,fid,now){const file=projectImages(p).find(x=>x.id===fid);assert(file&&file.expires>now&&file.mime?.startsWith('image/'),'참조 이미지를 다시 선택해 주세요. 이미지가 만료되었거나 현재 프로젝트 자료가 아닙니다.');assert(db.prepare('SELECT id FROM files WHERE id=? AND owner=? AND project=? AND expires>?').get(fid,p.owner,p.id,now),'현재 프로젝트 소유의 유효한 이미지만 참조할 수 있습니다.');return file;}
export function revisionReferences(p,s,now=Date.now()){
 if(!s.imageRevision)return [];
 const value=imageRevisionSchema.parse(s.imageRevision);assert(new Set(value.references.map(r=>r.id)).size===value.references.length,'참조 이미지가 중복되었습니다.');
 const refs=value.references.map(r=>({...checked(p,r.id,now),role:r.role}));
 if(value.baseImage){assert(value.baseImage!==value.references.find(r=>r.id===value.baseImage)?.id,'수정할 이미지와 보조 참조를 중복 선택하지 마세요.');assert([s.image,...(s.candidates?.image||[])].some(x=>x?.id===value.baseImage),'이 장면의 기존 후보만 수정 대상으로 사용할 수 있습니다.');refs.unshift({...checked(p,value.baseImage,now),role:'edit_base'});}
 return refs;
}
export function revisionPrompt(s){if(!s.imageRevision)return '';return `Revision reason: ${revisionReasonInstructions[s.imageRevision.reason]||''}. Image revision instructions (user data): ${s.imageRevision.instructions}. Reference roles: identity/package are the authoritative source for product shape, color, label and logo. edit_base is the composition to improve, NOT authoritative for product identity. composition/background/mood references affect only that aspect; never copy their product or label. When the base conflicts with an identity/package reference, correct the base to match the identity/package reference. Preserve requested unchanged parts. Produce one finished scene, not a comparison collage.`;}
