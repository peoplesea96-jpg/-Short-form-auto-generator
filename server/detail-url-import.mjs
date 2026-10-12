import sharp from 'sharp';
import {unlink} from 'node:fs/promises';
import {db,tx,assert,audit,rateLimit} from './db.mjs';
import {draft,splitRegions} from './detail-analysis.mjs';
import {fetchPublic,parseProductPage,pageUrl} from './public-page.mjs';
import {storeFile,filePath} from './media.mjs';
const locked=did=>db.prepare("SELECT id FROM jobs WHERE project=? AND status IN ('queued','running','submitting','unknown')").get(did);
export async function importDetailUrl(owner,did,body,{fetchPage=fetchPublic}={}){
 const d=draft(owner,did);assert(body.rights===true,'자료 사용 권한과 분석 서비스 전달에 동의해 주세요.');assert(body.revision===d.revision,'자료가 변경되었습니다. 새로고침해 주세요.',409);assert(!locked(did),'분석 작업을 먼저 확인해 주세요.');assert(!d.urlImport,'한 자료에는 상품 링크 하나만 가져올 수 있습니다. 새 자료로 시작해 주세요.');
 const inputUrl=pageUrl(String(body.url||'')).href;assert(rateLimit('detail-url:'+owner,10,3600000),'링크 가져오기가 너무 잦습니다. 잠시 후 다시 시도해 주세요.',429);
 const deadline=Date.now()+30000,html=await fetchPage(inputUrl,{deadline});assert(/text\/html|application\/xhtml\+xml/i.test(String(html.headers['content-type'])),'상품 상세페이지 HTML 주소를 입력해 주세요.');
 const charset=String(html.headers['content-type']).match(/charset=["']?([^;\s"']+)/i)?.[1]||html.buffer.subarray(0,2048).toString().match(/charset=["']?([^;\s"'>]+)/i)?.[1]||'utf-8';let text;try{text=new TextDecoder(charset).decode(html.buffer);}catch{text=html.buffer.toString('utf8');}
 const parsed=parseProductPage(text,html.url),stored=[],warnings=[...parsed.warnings];let bytes=0,tiles=d.images.reduce((n,i)=>n+i.segments.length,0);
 try{
  for(const url of parsed.imageUrls){
   if(stored.length+d.images.length>=10||tiles>=32||Date.now()>=deadline){warnings.push('수집 한도에 도달해 일부 이미지는 생략했습니다. 필요한 이미지는 직접 추가해 주세요.');break;}
   try{
    const image=await fetchPage(url,{maxBytes:10*1024*1024,deadline});bytes+=image.buffer.length;assert(bytes<=24*1024*1024,'전체 이미지 용량 한도에 도달했습니다.');
    const normalizer=sharp(image.buffer,{limitInputPixels:40000000}),meta=await normalizer.metadata();assert(['jpeg','png','webp'].includes(meta.format)&&(meta.pages||1)===1,'지원하지 않는 이미지 형식입니다.');if(meta.width<150||meta.height<150)continue;
    const normalized=await normalizer.rotate().webp({quality:95}).toBuffer({resolveWithObject:true}),segments=splitRegions(normalized.info.width,normalized.info.height);assert(tiles+segments.length<=32,'이미지가 너무 길어 생략했습니다. 필요한 부분을 잘라 업로드해 주세요.');
    const file=await storeFile(did,owner,normalized.data,'image/webp',`링크 상세 이미지 ${stored.length+1}`);stored.push({...file,width:normalized.info.width,height:normalized.info.height,segments,sourceUrl:image.url});tiles+=segments.length;
   }catch{warnings.push('가져오지 못한 이미지가 있습니다. 필요한 상세 이미지는 직접 업로드해 주세요.');if(bytes>24*1024*1024)break;}
  }
  assert(parsed.text.length>=30||stored.length,'읽을 수 있는 상품 정보를 찾지 못했습니다. 상세페이지 이미지를 직접 업로드해 주세요.');
  if(!stored.length)warnings.push('이미지를 가져오지 못해 페이지 문구만 저장했습니다. 이미지에만 있는 상품 정보는 직접 업로드해 주세요.');
  warnings.push('자바스크립트 실행·로그인·상세정보 펼치기가 필요한 내용은 수집되지 않을 수 있습니다. 원본과 대조해 주세요.');
  return tx(()=>{const current=draft(owner,did);assert(current.revision===d.revision&&!locked(did),'다른 변경사항이 있습니다. 다시 가져와 주세요.',409);current.images.push(...stored);current.urlImport={inputUrl,url:html.url,title:parsed.title,text:parsed.text,importedAt:Date.now(),imageCount:stored.length,warnings:[...new Set(warnings)]};current.result=null;current.review=null;current.revision++;db.prepare('UPDATE detail_drafts SET body=?,revision=? WHERE id=?').run(JSON.stringify(current),current.revision,did);for(const f of stored)db.prepare('UPDATE files SET expires=? WHERE id=?').run(current.expires,f.id);audit(owner,'detail.url-import',did);return current;});
 }catch(e){for(const f of stored){await unlink(filePath(f.id)).catch(()=>{});db.prepare('DELETE FROM files WHERE id=?').run(f.id);}throw e;}
}
