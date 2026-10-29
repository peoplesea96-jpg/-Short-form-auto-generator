import {z} from 'zod';
import {assert,hash,id} from './db.mjs';

const text=n=>z.string().trim().max(n);
export const sheetSchema=z.object({name:text(100).min(1),brand:text(100),option:text(200),features:text(2000),locked:text(2000),facts:text(6000),source:z.union([z.literal(''),z.url()]),references:z.array(z.object({id:z.string().uuid(),role:z.enum(['identity','package','use','mood']),option:text(200)})).max(10)});
export function defaultSheet(p){return {id:id(),version:1,approved:false,name:p.brief.title,brand:'',option:'',features:p.brief.description,locked:'',facts:p.brief.facts,source:p.brief.source,references:p.assets.map(a=>({id:a.id,role:'identity',option:''}))};}
export function validateSheet(p,input){const sheet=sheetSchema.parse(input);assert(new Set(sheet.references.map(r=>r.id)).size===sheet.references.length,'참고 이미지가 중복되었습니다.');for(const r of sheet.references)assert(p.assets.some(a=>a.id===r.id&&a.expires>Date.now()),'프로젝트의 유효한 원본 이미지만 지정할 수 있습니다.');return sheet;}
export function resolvedReferences(p,s,now=Date.now()){
 const mode=s.referenceMode|| (p.productSheet?'inherit':s.asset?'manual':'none');
 if(mode==='none')return [];
 if(mode==='manual'){const a=p.assets.find(a=>a.id===s.asset);assert(a&&a.expires>now,'직접 지정한 참고 이미지가 없거나 만료되었습니다.');return [{...a,role:'identity'}];}
 const sheet=p.productSheet;assert(sheet?.approved,'상품 시트를 먼저 검토하고 승인해 주세요.');
 const refs=sheet.references.filter(r=>!r.option||r.option===sheet.option);
 assert(!sheet.references.length||refs.length,'선택한 상품 옵션의 참고 이미지를 지정해 주세요.');
 return refs.map(r=>{const a=p.assets.find(a=>a.id===r.id);assert(a&&a.expires>now,'상품 시트 원본 이미지가 만료되었습니다. 다시 업로드해 주세요.');return {...a,role:r.role};}).sort((a,b)=>(a.role==='mood'?1:0)-(b.role==='mood'?1:0)).slice(0,6);
}
export function defaultVoice(){return {provider:'gemini',voiceId:process.env.GEMINI_TTS_VOICE||'Sulafat',model:process.env.GEMINI_TTS_MODEL||'gemini-3.1-flash-tts-preview',instructions:'자연스럽고 따뜻하며 명확한 한국어 광고 내레이션',stability:0.65,similarity:0.8,speed:1};}
export const voiceSchema=z.object({provider:z.enum(['gemini','elevenlabs']),voiceId:z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),model:z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),instructions:text(1000),stability:z.number().min(0).max(1),similarity:z.number().min(0).max(1),speed:z.number().min(.7).max(1.2)});
export function voiceHash(profile){return hash(JSON.stringify(voiceSchema.parse(profile)));}
export function audioMatches(p,s){return s.audio?.external?s.audio.narrationHash===hash(s.narration):!p.voiceProfile||s.audio?.profileHash===voiceHash(p.voiceProfile);}
export function narrationComposition(p){return p.scenes.map(s=>({scene:s.id,audio:s.audio?.id||null,seconds:s.seconds,narrationHash:hash(s.narration),profileHash:s.audio?.profileHash||null}));}
