import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {assert} from './db.mjs';
import {filePath} from './media.mjs';
import {resolvedReferences} from './project-profiles.mjs';
export async function generateOpenaiImage(project,scene,prompt,snapshot){
 const refs=resolvedReferences(project,scene),params={model:snapshot.version,prompt,n:1,size:'1024x1536',quality:'high',output_format:'png'};
 let body,headers={Authorization:`Bearer ${process.env.OPENAI_API_KEY}`};
 if(refs.length){body=new FormData();for(const [k,v] of Object.entries({...params,...(['gpt-image-1','gpt-image-1.5'].includes(snapshot.version)?{input_fidelity:'high'}:{})}))body.set(k,String(v));for(const ref of refs)body.append('image[]',new Blob([await readFile(filePath(ref.id))],{type:ref.mime}),ref.id+'.webp');}
 else{body=JSON.stringify(params);headers['Content-Type']='application/json';}
 const r=await fetch('https://api.openai.com/v1/images/'+(refs.length?'edits':'generations'),{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(180000)});
 if(!r.ok){const e=new Error(`${snapshot.version} 요청 오류 (${r.status}). API 결제·조직 인증·모델 권한을 확인해 주세요.`);e.definitive=r.status>=400&&r.status<500;throw e;}
 const data=await r.json();assert(data.data?.length===1&&data.data[0].b64_json,'GPT Image 결과가 없습니다.');
 // Keep the entire product visible; pad portrait 2:3 to the project's 9:16 canvas.
 const png=await sharp(Buffer.from(data.data[0].b64_json,'base64')).resize(1080,1920,{fit:'contain',background:'#f5f5f5'}).png().toBuffer();
 return {mime_type:'image/png',data:png.toString('base64'),usage:data.usage||null,providerId:r.headers.get('x-request-id')};
}
