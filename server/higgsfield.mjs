import {assertSpeechSupported} from './production-direction.mjs';
import {assert} from './db.mjs';
import {readFile,filePath,download} from './media.mjs';
const origin='https://api.higgsfield.ai';
export function apiUrl(value){const u=new URL(value,origin);assert(u.origin===origin&&!u.username&&!u.password&&!u.hash,'잘못된 Higgsfield 작업 주소입니다.');return u.href;}
export async function request(url,{method='GET',body,idem}={}){
 const r=await fetch(apiUrl(url),{method,headers:{Authorization:`Key ${process.env.HIGGSFIELD_API_KEY}`,...(body?{'Content-Type':'application/json'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok){const message=r.status===401?'Higgsfield API 인증에 실패했습니다 (401). 연결된 API 키를 확인해 주세요.':r.status===402||r.status===403?`Higgsfield가 ${method==='GET'?'조회':'생성'} 요청을 거절했습니다 (${r.status}). API 잔액 부족 또는 계정 사용 제한을 확인해 주세요. 웹사이트 구독 크레딧과 API 잔액은 별개입니다.`:`Higgsfield ${method==='GET'?'조회':'요청'} 오류 (${r.status}). 계정 잔액·모델 권한·요율을 확인해 주세요.`;const e=new Error(message);e.definitive=r.status>=400&&r.status<500;e.retryable=method==='GET'&&(r.status===429||r.status>=500);throw e;}return r.json();
}
export function videoPayload(snapshot,imageUrl,scene){assertSpeechSupported(scene);const common={image_url:imageUrl,prompt:`Animate this reference as one continuous product-commercial shot. Preserve product shape, package, color and label. ${scene.visual}. ${scene.motion||''} ${snapshot.visualDirection||''} No dialogue, narration, captions or music.`,duration:snapshot.requestedSeconds};
 if(snapshot.model==='seedance')return {...common,resolution:snapshot.resolution,output_format:'mp4',generate_audio:false};
 if(snapshot.model==='kling')return {...common,sound:'off',multi_shots:false,cfg_scale:.5};
 assert(snapshot.model==='minimax','지원하지 않는 Higgsfield 모델입니다.');return {...common,prompt_optimizer:false};
}
export async function submitHiggsfield(snapshot,scene,idem,onSubmit){
 assertSpeechSupported(scene);
 const upload=await request('/files/generate-upload-url',{method:'POST',body:{content_type:scene.image.mime}});
 const u=new URL(upload.upload_url);const allowed=(process.env.HIGGSFIELD_UPLOAD_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean);
 assert(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&allowed.includes(u.hostname),'HIGGSFIELD_UPLOAD_HOSTS에 공식 업로드 호스트를 등록해 주세요.');
 const headers=upload.upload_headers||{};assert(!Object.keys(headers).some(k=>['authorization','cookie','proxy-authorization'].includes(k.toLowerCase())),'업로드 헤더를 확인해 주세요.');
 const put=await fetch(u,{method:'PUT',headers,body:await readFile(filePath(scene.image.id)),redirect:'error',signal:AbortSignal.timeout(90000)});assert(put.ok,'참고 이미지 업로드에 실패했습니다.');
 const publicUrl=new URL(upload.public_url);assert(publicUrl.protocol==='https:','공개 이미지 주소가 올바르지 않습니다.');
 onSubmit(); // Persist submitting before the only paid POST. Upload failures do not reserve unknown charges.
 const r=await request('/'+snapshot.version,{method:'POST',body:videoPayload(snapshot,publicUrl.href,scene),idem});
 assert(typeof r.request_id==='string'&&r.request_id.length<200&&typeof r.status_url==='string','Higgsfield 작업 ID가 없습니다.');
 return {provider:'higgsfield',id:r.request_id,statusUrl:apiUrl(r.status_url),submitted:Date.now(),nextPoll:Date.now()+2000,attempt:0};
}
export async function pollHiggsfield(state){assert(state.provider==='higgsfield','잘못된 공급자 작업입니다.');return request(state.statusUrl);}
export async function downloadHiggsfield(result){assert(result.video?.url,'Higgsfield 영상 결과 주소가 없습니다.');return download(result.video.url);}
