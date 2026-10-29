import {usesPresenter,avatarPrompt} from './avatars.mjs';
import {visualDirection,assertSpeechSupported} from './production-direction.mjs';
import {z} from 'zod';
import {assert,hash} from './db.mjs';

// Only documented, explicit API versions. Web/MCP model names are not API endpoints.
export const MODELS=[
 {id:'marketing-flare',kind:'image',label:'Higgsfield Marketing Studio · 광고 이미지',provider:'higgsfield-marketing',key:'HIGGSFIELD_API_KEY',version:()=> 'marketing-studio/image/flare',resolutions:['1k','2k','4k'],workflow:'marketing-image'},
 {id:'nano-banana',kind:'image',label:'Nano Banana · 기존 Gemini 연결',provider:'gemini',key:'GEMINI_API_KEY',version:()=>process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-lite-image',resolutions:['1K'],rate:'GEMINI_IMAGE_USD_PER_IMAGE'},
 {id:'gpt-image',kind:'image',label:'GPT Image 2.5 Sunburst',provider:'openai',key:'OPENAI_API_KEY',version:()=> 'gpt-image-2.5-sunburst',resolutions:['1024x1536'],rate:'GPT_IMAGE_RESERVE_USD_PER_IMAGE'},
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
 if(kind==='video')assertSpeechSupported(s);
 const c=resolvedChoice(p,s,kind),m=MODELS.find(m=>m.id===c.model);
 assert(m.workflow!=='marketing-image','Higgsfield 광고 이미지는 프리셋 선택 화면에서 상품 이미지·예산을 확인한 뒤 생성해 주세요.',409);
 assert(m.provider!=='higgsfield'||process.env.HIGGSFIELD_ENABLED==='true','Higgsfield 영상 연결 설정이 필요합니다. 기존 Gemini 영상 연결을 선택해 주세요.',503);
 assert(process.env[m.key],`${m.label}: ${m.key} 연결이 필요합니다.`,503);
 if(m.provider==='higgsfield')assert(process.env.HIGGSFIELD_UPLOAD_HOSTS&&process.env.MEDIA_HOSTS,'Higgsfield 업로드·결과 파일 허용 호스트를 운영자가 설정해 주세요.',503);
 assert(process.env.RATES_REVIEWED_AT,'계정별 요율 검토일 설정이 필요합니다.',503);
 let seconds=kind==='video'?Math.ceil(s.seconds):0;
 if(m.durations){seconds=m.durations.find(n=>n>=seconds);assert(seconds,'MiniMax는 최대 10초입니다. 씬을 나누거나 다른 모델을 선택해 주세요.');}
 else if(m.min){seconds=Math.max(m.min,seconds);assert(seconds<=m.max,'선택한 모델의 최대 생성 길이를 초과했습니다.');}
 else if(kind==='video')seconds=Math.max(seconds,positive('GEMINI_VIDEO_RESERVE_SECONDS'));
 const rateName=m.id==='seedance'?`${m.rate}_${c.resolution.toUpperCase()}_USD_PER_SECOND`:m.id==='minimax'?`${m.rate}_${seconds}S_USD_PER_CLIP`:m.rate;
 const usd=positive(rateName),fx=positive('USD_TO_KRW');
 return {visualDirection:visualDirection(p,s)+' '+avatarPrompt(p,s),speechMode:s.speechMode||'voiceover',lipSyncSupported:false,model:m.id,label:m.label,provider:m.provider,version:m.version(),resolution:c.resolution,requestedSeconds:seconds,sceneSeconds:s.seconds,unitUsd:usd,rateName,fx,amount:Math.ceil(Number((usd*(kind==='image'||m.durations?1:seconds)*fx).toFixed(8))),rateDate:process.env.RATES_REVIEWED_AT,credentialRef:{owner:'operator',provider:m.provider},costType:'estimate'};
}
export function generationCatalog(){return MODELS.map(m=>{
 if(m.workflow==='marketing-image'){const keyReady=/^[^\s:]+:[^\s:]+$/.test(process.env[m.key]||''),filesReady=/^https:\/\//.test(process.env.APP_URL||'')&&(process.env.SESSION_SECRET||'').length>=32;return {id:m.id,kind:m.kind,label:m.label,provider:m.provider,version:m.version(),resolutions:m.resolutions,workflow:m.workflow,enabled:true,keyReady,ready:keyReady&&filesReady,documentVerified:true,accountVerified:false,generationVerified:false,reason:!keyReady?'Higgsfield API 키 연결 필요':!filesReady?'상품 이미지 전달 설정 필요':'API 키 설정됨 · 프리셋 선택 후 광고 이미지 생성'};}
 const keyReady=!!process.env[m.key],rateNames=m.id==='seedance'?m.resolutions.map(r=>`${m.rate}_${r.toUpperCase()}_USD_PER_SECOND`):m.id==='minimax'?m.durations.map(s=>`${m.rate}_${s}S_USD_PER_CLIP`):[m.rate];
 const ratesReady=!!process.env.RATES_REVIEWED_AT&&Number(process.env.USD_TO_KRW)>0&&rateNames.every(n=>Number(process.env[n])>0);
 const filesReady=m.provider!=='higgsfield'||!!(process.env.HIGGSFIELD_UPLOAD_HOSTS&&process.env.MEDIA_HOSTS),enabled=m.provider!=='higgsfield'||process.env.HIGGSFIELD_ENABLED==='true';
 return {documentVerified:!['nano-banana','gemini-legacy'].includes(m.id),accountVerified:false,generationVerified:false,checkedAt:m.id==='gpt-image'?'2026-10-19':'2026-10-12',id:m.id,kind:m.kind,label:m.label,provider:m.provider,version:m.version(),resolutions:m.resolutions,min:m.min,max:m.max,durations:m.durations,keyReady,ratesReady,filesReady,enabled,ready:keyReady&&ratesReady&&filesReady&&enabled,reason:!keyReady?'운영자 API 연결 필요':m.provider==='higgsfield'&&(!ratesReady||!filesReady)?'영상 연결 설정 필요 · '+[!ratesReady?'모델별 요율':'',!filesReady?'파일 전송':''].filter(Boolean).join('·')+' 설정 미완료':!enabled?'운영자 영상 연결 활성화 필요':!ratesReady?'운영자 요율 검토 필요':'연결 설정됨 · 계정별 모델 권한은 생성 시 확인'};
 });}
export const generationFingerprint=x=>hash(JSON.stringify(x||{}));
export function inputFingerprint(p,s,kind){return generationFingerprint({kind,...(usesPresenter(s)?{presenter:p.cast?.presenter?{id:p.cast.presenter.id,version:p.cast.presenter.version,reference:p.cast.presenter.reference.id}:null}:{}),...(p.productionDirection?{productionDirection:p.productionDirection}:{}),...(s.visualRole?{visualRole:s.visualRole}:{}),...(s.presentation?{presentation:s.presentation}:{}),...(s.speechMode?{speechMode:s.speechMode}:{}),visual:s.visual,referenceMode:s.referenceMode,asset:s.asset,sheet:p.productSheet?.version,brief:{description:p.brief.description,audience:p.brief.audience},assets:p.assets.map(a=>a.id),...(kind==='video'?{image:s.image?.id,seconds:s.seconds}:{} )});}
