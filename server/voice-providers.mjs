import {assert} from './db.mjs';
import {defaultVoice,voiceSchema} from './project-profiles.mjs';
const base='https://api.elevenlabs.io';
const configuredVoices=()=> (process.env.GEMINI_TTS_VOICES||process.env.GEMINI_TTS_VOICE||'Sulafat').split(',').map(x=>x.trim()).filter(Boolean);
async function eleven(path,options={}){
 assert(process.env.ELEVENLABS_API_KEY,'ElevenLabs API 키 설정이 필요합니다.',503);
 const r=await fetch(base+path,{...options,headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,...options.headers},redirect:'error',signal:AbortSignal.timeout(180000)});
 if(!r.ok){const e=new Error(`ElevenLabs 요청 실패 (${r.status}). API 키·사용 한도·목소리 권한을 확인해 주세요.`);e.definitive=r.status>=400&&r.status<500;e.status=r.status===429?503:400;throw e;}return r;
}
export async function voiceCatalog(provider='gemini'){
 if(provider==='gemini')return {provider,configured:!!process.env.GEMINI_API_KEY,voices:configuredVoices().map(id=>({id,name:id})),models:[defaultVoice().model]};
 assert(provider==='elevenlabs','잘못된 음성 공급자입니다.');
 if(!process.env.ELEVENLABS_API_KEY)return {provider,configured:false,voices:[],models:[process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2']};
 const data=await (await eleven('/v2/voices?page_size=100')).json();return {provider,configured:true,voices:(data.voices||[]).map(v=>({id:v.voice_id,name:v.name})),models:[process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2']};
}
export async function validateVoice(input){const v=voiceSchema.parse(input);const catalog=await voiceCatalog(v.provider);assert(catalog.configured,'선택한 음성 공급자의 API 연결이 필요합니다.',503);assert(catalog.models.includes(v.model),'운영 설정에서 지원하는 음성 모델을 선택해 주세요.');assert(catalog.voices.some(x=>x.id===v.voiceId),'사용 가능한 목소리를 선택해 주세요.');if(v.provider==='elevenlabs')assert(!v.instructions,'ElevenLabs의 자유 말투 지침은 지원하지 않습니다. 안정성·유사도·속도를 사용해 주세요.');return v;}
export async function elevenSpeech(p,s){
 const v=voiceSchema.parse(p.voiceProfile),index=p.scenes.findIndex(x=>x.id===s.id);
 const body={text:s.narration,model_id:v.model,voice_settings:{stability:v.stability,similarity_boost:v.similarity,speed:v.speed},previous_text:p.scenes[index-1]?.narration,next_text:p.scenes[index+1]?.narration};
 const r=await eleven(`/v1/text-to-speech/${encodeURIComponent(v.voiceId)}?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const buf=Buffer.from(await r.arrayBuffer());assert(buf.length>0&&buf.length<=20*1024*1024,'음성 응답 크기가 올바르지 않습니다.');return {data:buf,mime_type:'audio/mpeg',providerId:r.headers.get('request-id')||null};
}
