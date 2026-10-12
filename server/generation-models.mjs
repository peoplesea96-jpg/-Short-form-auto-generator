import {z} from 'zod';
import {assert,hash} from './db.mjs';

// Only documented, explicit API versions. Web/MCP model names are not API endpoints.
export const MODELS=[
 {id:'nano-banana',kind:'image',label:'Nano Banana · 기존 Gemini 연결',provider:'gemini',key:'GEMINI_API_KEY',version:()=>process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-lite-image',resolutions:['1K'],rate:'GEMINI_IMAGE_USD_PER_IMAGE'},
 {id:'gpt-image',kind:'image',label:'GPT Image 1.5',provider:'openai',key:'OPENAI_API_KEY',version:()=> 'gpt-image-1.5',resolutions:['1024x1536'],rate:'GPT_IMAGE_RESERVE_USD_PER_IMAGE'},
 {id:'seedance',kind:'video',label:'Seedance 2.5',provider:'higgsfield',key:'HIGGSFIELD_API_KEY',version:()=> 'bytedance/seedance-2.5/image-to-video',resolutions:['480p','720p','1080p'],min:4,max:30,rate:'HIGGSFIELD_SEEDANCE'},
 {id:'kling',kind:'video',label:'Kling 3.0 Standard',provider:'higgsfield',key:'HIGGSFIELD_API_KEY',version:()=> 'kling-video/v3.0/std/image-to-video',resolutions:['standard'],min:3,max:15,rate:'HIGGSFIELD_KLING_USD_PER_SECOND'},
 {id:'minimax',kind:'video',label:'MiniMax Hailuo 2.3 Standard',provider:'higgsfield',key:'HIGGSFIELD_API_KEY',version:()=> 'minimax/hailuo-2.3/standard/image-to-video',resolutions:['standard'],durations:[6,10],rate:'HIGGSFIELD_MINIMAX'},
 {id:'gemini-legacy',kind:'video',label:'기존 Gemini 영상 연결',provider:'gemini',key:'GEMINI_API_KEY',version:()=>process.env.GEMINI_VIDEO_MODEL||'gemini-omni-1.1-flash',resolutions:['720p'],rate:'GEMINI_VIDEO_USD_PER_SECOND'},
];
const choice=z.object({model:z.string(),resolution:z.string()}).strict();
export const settingsSchema=z.object({image:choice,video:choice}).strict();
export const defaultSettings=()=>({image:{model:'nano-banana',resolution:'1K'},video:{model:'gemini-legacy',resolution:'720p'}});
export function validateChoice(kind,c){const value=choice.parse(c),m=MODELS.find(m=>m.id===value.model&&m.kind===kind);assert(m&&m.resolutions.includes(value.resolution),'지원하는 모델·출력 규격을 선택해 주세요.');return value;}
export function validateSettings(value){const v=settingsSchema.parse(value);return {image:validateChoice('image',v.image),video:validateChoice('video',v.video)};}
export function resolvedChoice(p,s,kind){return validateChoice(kind,s.generationSettings?.[kind]||p.generationSettings?.[kind]||defaultSettings()[kind]);}
export function positive(name){const n=Number(process.env[name]);assert(Number.isFinite(n)&&n>0,`${name} 요율 설정이 필요합니다.`,503);return n;}
export function modelSnapshot(p,s,kind){
 const c=resolvedChoice(p,s,kind),m=MODELS.find(m=>m.id===c.model);
 assert(m.provider!=='higgsfield'||process.env.HIGGSFIELD_ENABLED==='true','Higgsfield 도입은 보류 중입니다. 기존 Gemini 영상 연결을 선택해 주세요.',503);
 assert(process.env[m.key],`${m.label}: ${m.key} 연결이 필요합니다.`,503);
 if(m.provider==='higgsfield')assert(process.env.HIGGSFIELD_UPLOAD_HOSTS&&process.env.MEDIA_HOSTS,'Higgsfield 업로드·결과 파일 허용 호스트를 운영자가 설정해 주세요.',503);
 assert(process.env.RATES_REVIEWED_AT,'계정별 요율 검토일 설정이 필요합니다.',503);
 let seconds=kind==='video'?Math.ceil(s.seconds):0;
 if(m.durations){seconds=m.durations.find(n=>n>=seconds);assert(seconds,'MiniMax는 최대 10초입니다. 씬을 나누거나 다른 모델을 선택해 주세요.');}
 else if(m.min){seconds=Math.max(m.min,seconds);assert(seconds<=m.max,'선택한 모델의 최대 생성 길이를 초과했습니다.');}
 else if(kind==='video')seconds=Math.max(seconds,positive('GEMINI_VIDEO_RESERVE_SECONDS'));
 const rateName=m.id==='seedance'?`${m.rate}_${c.resolution.toUpperCase()}_USD_PER_SECOND`:m.id==='minimax'?`${m.rate}_${seconds}S_USD_PER_CLIP`:m.rate;
 const usd=positive(rateName),fx=positive('USD_TO_KRW');
 return {model:m.id,label:m.label,provider:m.provider,version:m.version(),resolution:c.resolution,requestedSeconds:seconds,sceneSeconds:s.seconds,unitUsd:usd,rateName,fx,amount:Math.ceil(Number((usd*(kind==='image'||m.durations?1:seconds)*fx).toFixed(8))),rateDate:process.env.RATES_REVIEWED_AT,credentialRef:{owner:'operator',provider:m.provider},costType:'estimate'};
}
export function generationCatalog(){return MODELS.map(m=>{
 const keyReady=!!process.env[m.key],rateNames=m.id==='seedance'?m.resolutions.map(r=>`${m.rate}_${r.toUpperCase()}_USD_PER_SECOND`):m.id==='minimax'?m.durations.map(s=>`${m.rate}_${s}S_USD_PER_CLIP`):[m.rate];
 const ratesReady=!!process.env.RATES_REVIEWED_AT&&Number(process.env.USD_TO_KRW)>0&&rateNames.every(n=>Number(process.env[n])>0);
 return {documentVerified:!['nano-banana','gemini-legacy'].includes(m.id),accountVerified:false,generationVerified:false,checkedAt:'2026-10-12',id:m.id,kind:m.kind,label:m.label,provider:m.provider,version:m.version(),resolutions:m.resolutions,min:m.min,max:m.max,durations:m.durations,keyReady,ratesReady,enabled:m.provider!=='higgsfield'||process.env.HIGGSFIELD_ENABLED==='true',ready:keyReady&&ratesReady&&(m.provider!=='higgsfield'||process.env.HIGGSFIELD_ENABLED==='true'),reason:m.provider==='higgsfield'&&process.env.HIGGSFIELD_ENABLED!=='true'?'도입 보류 · 기존 영상 연결 사용':!keyReady?'운영자 API 연결 필요':!ratesReady?'운영자 요율 검토 필요':'연결 설정됨 · 계정별 모델 권한은 생성 시 확인'};
 });}
export const generationFingerprint=x=>hash(JSON.stringify(x||{}));
export function inputFingerprint(p,s,kind){return generationFingerprint({kind,visual:s.visual,referenceMode:s.referenceMode,asset:s.asset,sheet:p.productSheet?.version,brief:{description:p.brief.description,audience:p.brief.audience},assets:p.assets.map(a=>a.id),...(kind==='video'?{image:s.image?.id,seconds:s.seconds}:{} )});}
