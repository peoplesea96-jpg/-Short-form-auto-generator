import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import sharp from 'sharp';
import {db,tx,id,hash,assert,getProject,saveProject,budget,month,audit} from './db.mjs';
import {active} from './domain.mjs';
import {findUnit} from './creative-structure.mjs';
import {inputFingerprint} from './generation-models.mjs';
import {request,apiUrl} from './higgsfield.mjs';
import {signedUrl} from './media.mjs';
import {fetchPublic,pageUrl} from './public-page.mjs';

export const marketingEndpoint='marketing-studio/image/flare';
const requestSchema=z.object({unit:z.string().min(1).max(100),asset:z.uuid(),preset:z.uuid(),prompt:z.string().trim().min(1).max(1500),resolution:z.enum(['1k','2k','4k']),quality:z.enum(['low','medium','high','xhigh','max']),count:z.number().int().min(1).max(3),reservePerImage:z.number().int().min(1).max(10000)}).strict();
let cached=null;
function credentialReady(){assert(/^[^\s:]+:[^\s:]+$/.test(process.env.HIGGSFIELD_API_KEY||''),'Higgsfield API 키 설정이 필요합니다.',503);}
function signingKey(){assert((process.env.SESSION_SECRET||'').length>=32,'서명 키 설정이 필요합니다.',503);return process.env.SESSION_SECRET;}
const sign=q=>createHmac('sha256',signingKey()).update('marketing-quote:'+JSON.stringify(q)).digest('hex');
function previewUrl(value){try{const u=pageUrl(value);return u.href;}catch{return null;}}
export function normalizePreset(p){
 if(!p||!z.uuid().safeParse(p.id).success||typeof p.name!=='string'||p.type&&p.type!=='ads')return null;
 const image=p.preview_url||p.thumbnail_url||p.image_url||p.preview_image_url||p.cover_image_url||(typeof p.thumbnail==='string'?p.thumbnail:p.thumbnail?.url)||(typeof p.image==='string'?p.image:p.image?.url)||(typeof p.preview==='string'?p.preview:p.preview?.url);
 return {id:p.id,name:p.name.slice(0,160),description:typeof p.description==='string'?p.description.slice(0,500):'',preview:typeof image==='string'?previewUrl(image):null};
}
export async function marketingCatalog({force=false,call=request,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 credentialReady();const account=hash(process.env.HIGGSFIELD_API_KEY);if(call===request&&!force&&cached?.account===account&&cached.expires>Date.now())return cached.data;
 const items=[],seen=new Set(),cursors=new Set();let cursor=null,total=0;
 for(let page=0;page<20;page++){
  let r;for(let attempt=0;attempt<3;attempt++){try{r=await call('/marketing-studio/image/presets?size=50'+(cursor!==null?'&cursor='+encodeURIComponent(cursor):''));break;}catch(e){if(attempt===2||!e.retryable)throw e;await pause(1000*2**attempt);}}
  assert(Array.isArray(r.items),'프리셋 목록 응답을 확인할 수 없습니다.',502);
  if(Number.isFinite(r.total))total=r.total;
  for(const raw of r.items){const p=normalizePreset(raw);if(p&&!seen.has(p.id)){items.push(p);seen.add(p.id);}}
  cursor=r.cursor;if(cursor===null||cursor===undefined||cursor==='')break;
  assert(typeof cursor==='string'||Number.isSafeInteger(cursor)&&cursor>=0,'프리셋 cursor 형식을 확인할 수 없습니다.',502);cursor=String(cursor);
  assert(cursor.length<4096&&!cursors.has(cursor)&&page<19,'프리셋 목록 페이지를 확인할 수 없습니다.',502);cursors.add(cursor);
 }
 const data={items,total,checkedAt:Date.now(),generationVerified:false};if(call===request)cached={data,account,expires:Date.now()+60000};return data;
}
function planMarketing(owner,pid,value,preset){
 credentialReady();signingKey();pageUrl(process.env.APP_URL||'');
 const r=requestSchema.parse(value),p=getProject(pid,owner),found=findUnit(p,r.unit);
 assert(found&&!(found.target===found.scene&&found.scene.shots?.length),'이미지를 만들 씬 또는 샷을 선택해 주세요.');
 assert(found.scene.scriptApproved,'대본을 먼저 승인해 주세요.');
 assert(!p.productSheet||p.productSheet.approved,'상품 시트를 먼저 승인해 주세요.');
 assert(p.brief.rights===true,'상품 이미지 사용 권한을 확인해 주세요.');
 assert(preset?.id===r.preset,'사용할 수 있는 프리셋을 다시 선택해 주세요.',409);
 const asset=p.assets.find(a=>a.id===r.asset),file=db.prepare('SELECT * FROM files WHERE id=?').get(r.asset);
 assert(asset&&file?.owner===owner&&file?.project===pid&&file.expires>Date.now()&&['image/png','image/jpeg','image/webp'].includes(file.mime),'유효한 상품 참고 이미지를 선택해 주세요.');
 return {project:p,unit:found.unit,request:r,preset:{id:preset.id,name:preset.name},amount:r.count*r.reservePerImage,fingerprint:inputFingerprint(p,found.unit,'image')};
}
export async function quoteMarketing(owner,pid,value){
 getProject(pid,owner);value=requestSchema.parse(value);const catalog=await marketingCatalog();const plan=planMarketing(owner,pid,value,catalog.items.find(p=>p.id===value.preset));
 assert(!active(plan.project),'진행 중인 작업을 먼저 확인해 주세요.',409);
 const q={kind:'marketing-image',project:pid,revision:plan.project.revision,request:plan.request,preset:plan.preset,amount:plan.amount,fingerprint:plan.fingerprint,expires:Date.now()+600000,costType:'reservation'};
 return {...q,signature:sign(q),budget:budget(owner,pid)};
}
export function settleMarketing(jid,actual){return tx(()=>{
 const j=db.prepare('SELECT * FROM jobs WHERE id=?').get(jid);
 assert(j?.kind==='marketing-image'&&(['failed','unknown'].includes(j.status)||j.status==='done'&&j.actual===null),'정산할 광고 이미지 작업이 없습니다.');
 assert(Number.isInteger(actual)&&actual>=0,'확인된 실제 청구액을 입력해 주세요.');
 const results=JSON.parse(j.result||'[]'),ids=new Set(results.map(r=>r.id));
 const apply=c=>{if(c&&ids.has(c.id))Object.assign(c,{costType:'confirmed-job-total',jobCost:actual,jobCandidateCount:results.length});};
 const row=db.prepare('SELECT body,deleted FROM projects WHERE id=?').get(j.project);
 if(row&&!row.deleted){const p=getProject(j.project,j.owner);for(const scenes of [p.scenes,...(p.versions||[]).map(v=>v.scenes)])for(const s of scenes||[])for(const u of [s,...(s.shots||[])]){apply(u.image);for(const c of u.candidates?.image||[])apply(c);}p.revision++;saveProject(p);}
 results.forEach(apply);db.prepare("UPDATE jobs SET result=?,actual=?,status=CASE WHEN status='done' THEN 'done' ELSE 'failed' END,error='운영자 정산 완료',updated=? WHERE id=?").run(JSON.stringify(results),actual,Date.now(),jid);
 });}
export async function enqueueMarketing(owner,pid,q,idem){
 assert(typeof idem==='string'&&idem.length>=16&&idem.length<100,'요청 ID가 필요합니다.');getProject(pid,owner);
 const prior=db.prepare('SELECT * FROM jobs WHERE idem=?').get(idem);if(prior){assert(prior.owner===owner&&prior.project===pid&&prior.kind==='marketing-image','잘못된 요청 ID입니다.');return {id:prior.id,status:prior.status};}
 const {signature,budget:ignored,...signed}=q||{};
 assert(typeof signature==='string'&&/^[a-f0-9]{64}$/.test(signature)&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(signed))),'비용 확인 정보가 유효하지 않습니다.');
 assert(signed.project===pid&&signed.kind==='marketing-image'&&signed.expires>Date.now(),'비용을 다시 확인해 주세요.',409);
 const catalog=await marketingCatalog({force:true});
 return tx(()=>{
  const duplicate=db.prepare('SELECT * FROM jobs WHERE idem=?').get(idem);if(duplicate){assert(duplicate.owner===owner&&duplicate.project===pid&&duplicate.kind==='marketing-image','잘못된 요청 ID입니다.');return {id:duplicate.id,status:duplicate.status};}
  const plan=planMarketing(owner,pid,signed.request,catalog.items.find(p=>p.id===signed.request.preset));
  assert(plan.project.revision===signed.revision&&plan.fingerprint===signed.fingerprint&&plan.amount===signed.amount&&plan.preset.name===signed.preset.name,'내용이 변경되었습니다. 비용을 다시 확인해 주세요.',409);
  assert(!active(plan.project),'이미 진행 중인 작업이 있습니다.',409);
  const b=budget(owner,pid);assert(b.project+plan.amount<=10000&&b.month+plan.amount<=100000,'프로젝트 또는 월간 예약 예산 한도를 초과합니다.');
  const jid=id(),now=Date.now();const input={project:plan.project,selected:[plan.unit],marketing:{...plan.request,preset:plan.preset,fingerprint:plan.fingerprint}};
  db.prepare('INSERT INTO jobs(id,project,owner,kind,scene,revision,input,status,reserved,month,created,updated,idem) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(jid,pid,owner,'marketing-image',plan.unit.id,plan.project.revision,JSON.stringify(input),'queued',plan.amount,month(),now,now,idem);
  audit(owner,'enqueue.marketing-image',pid);return {id:jid,status:'queued'};
 });
}
export function marketingPayload(input,imageUrl){
 const m=input.marketing,s=input.selected[0];pageUrl(imageUrl);
 return {prompt:`Create a product advertisement. Preserve the product's actual packaging, shape, color and label from the reference. Do not invent product claims. Do not add a person. Avoid new text overlays. Product context: ${input.project.brief.description.slice(0,1800)}. Scene: ${s.visual}. Creative direction: ${m.prompt}`,image_urls:[imageUrl],preset_id:m.preset.id,resolution:m.resolution,quality:m.quality,aspect_ratio:'9:16',enhance_prompt:true};
}
export async function submitMarketing(input,owner,idem,onSubmit,{call=request}={}){
 const file=db.prepare('SELECT * FROM files WHERE id=?').get(input.marketing.asset);
 assert(file?.owner===owner&&file.project===input.project.id&&file.expires>Date.now(),'상품 참고 이미지가 만료되었습니다.');
 const body=marketingPayload(input,signedUrl(file.id));onSubmit();
 const r=await call('/'+marketingEndpoint,{method:'POST',body,idem});
 assert(typeof r.request_id==='string'&&r.request_id.length>0&&r.request_id.length<200&&typeof r.status_url==='string','공급자 작업 응답을 확인해 주세요. 자동 재생성하지 않습니다.');
 return {provider:'higgsfield',category:'marketing-image',id:r.request_id,statusUrl:apiUrl(r.status_url),submitted:Date.now(),nextPoll:Date.now()+2000,attempt:0};
}
export async function downloadMarketing(result,{download=fetchPublic}={}){
 const url=result.images?.[0]?.url;assert(typeof url==='string','광고 이미지 결과가 없습니다.');pageUrl(url);
 const r=await download(url,{maxBytes:30*1024*1024,deadline:Date.now()+60000});
 const image=sharp(r.buffer,{limitInputPixels:50000000,animated:false}),meta=await image.metadata();
 assert(['jpeg','png','webp'].includes(meta.format)&&meta.width&&meta.height,'광고 이미지 형식을 확인해 주세요.');
 return image.rotate().resize(1080,1920,{fit:'contain',background:'#ffffff'}).png().toBuffer();
}
