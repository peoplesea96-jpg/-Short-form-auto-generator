import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {load} from 'cheerio';
import ipaddr from 'ipaddr.js';
import {assert} from './db.mjs';

export function publicAddress(address){try{let ip=ipaddr.parse(address);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();return ip.range()==='unicast';}catch{return false;}}
export function pageUrl(value){let u;try{u=new URL(value);}catch{assert(false,'올바른 HTTPS 상품 주소를 입력해 주세요.');}assert(value.length<=2048&&u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443'),'로그인이 필요 없는 HTTPS 상품 주소를 입력해 주세요.');u.hash='';return u;}
// Resolve every redirect and pin its public DNS answer to the actual connection.
export async function fetchPublic(value,{maxBytes=2*1024*1024,deadline=Date.now()+30000,resolve=lookup,request=https.request}={}){
 let u=pageUrl(value);
 for(let redirects=0;redirects<=3;redirects++){
  assert(Date.now()<deadline,'가져오기 시간이 초과되었습니다. 이미지를 직접 업로드해 주세요.');
  const host=u.hostname.replace(/^\[|\]$/g,'');
  const records=await Promise.race([resolve(host,{all:true,verbatim:true}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('주소 확인 시간이 초과되었습니다.')),3000);t.unref();})]);
  assert(records.length&&records.every(r=>publicAddress(r.address)),'공개 인터넷의 상품 페이지만 가져올 수 있습니다.');
  const record=records[0];
  const response=await new Promise((resolveResponse,reject)=>{
   const req=request(u,{agent:false,headers:{'User-Agent':'FrameProductImporter/1.0','Accept':'text/html,image/jpeg,image/png,image/webp;q=0.9','Accept-Encoding':'identity'},lookup:(_host,options,done)=>options.all?done(null,[record]):done(null,record.address,record.family)},res=>{
    const chunks=[];let bytes=0;
    if([301,302,303,307,308].includes(res.statusCode)){resolveResponse({status:res.statusCode,headers:res.headers,buffer:Buffer.alloc(0)});res.destroy();return;}
    res.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){req.destroy(Error('페이지 또는 이미지 용량이 너무 큽니다.'));return;}chunks.push(chunk);});
    res.once('error',reject);res.once('end',()=>resolveResponse({status:res.statusCode,headers:res.headers,buffer:Buffer.concat(chunks)}));
   });
   const timer=setTimeout(()=>req.destroy(Error('가져오기 시간이 초과되었습니다.')),Math.max(1,Math.min(8000,deadline-Date.now())));
   req.once('error',reject);req.once('close',()=>clearTimeout(timer));req.end();
  });
  if([301,302,303,307,308].includes(response.status)){assert(redirects<3&&response.headers.location,'주소 이동이 너무 많습니다. 최종 상품 주소를 입력해 주세요.');u=pageUrl(new URL(response.headers.location,u).href);continue;}
  assert(response.status===200,'페이지에 접근할 수 없습니다. 로그인·접근 제한을 확인하거나 이미지를 직접 업로드해 주세요.');
  assert(!response.headers['content-encoding']||response.headers['content-encoding']==='identity','지원하지 않는 페이지 압축 방식입니다.');return {...response,url:u.href};
 }
}
const clean=text=>String(text||'').replace(/\s+/g,' ').trim();
export function parseProductPage(html,url){
 const $=load(html),products=[];const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){if([].concat(value['@type']||[]).includes('Product'))products.push(value);if(value['@graph'])visit(value['@graph']);}};
 $('script[type="application/ld+json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()));}catch{}});
 const product=products[0],title=clean(product?.name||$('meta[property="og:title"]').attr('content')||$('title').text()).slice(0,300);
 const images=[];const add=value=>{if(typeof value!=='string')return;try{const u=pageUrl(new URL(value,url).href);if(!images.includes(u.href))images.push(u.href);}catch{}};
 for(const value of [].concat(product?.image||[]))add(typeof value==='string'?value:value?.url||value?.contentUrl);
 const detail=$('#prdDetail, #productDetail, #product_detail, .product-detail, .product_detail, .detail-content, [itemprop="description"]');
 const selected=detail.length?detail:$('main, article').first();
 (selected.length?selected:$('body')).find('img').each((_,el)=>{const img=$(el);if(/logo|icon|banner|sprite|avatar/i.test((img.attr('class')||'')+' '+(img.attr('alt')||'')))return;const width=Number(img.attr('width'));if(width&&width<150)return;add(img.attr('data-src')||img.attr('data-original')||img.attr('data-lazy-src')||img.attr('src'));});
 add($('meta[property="og:image"]').attr('content'));
 $('script,style,noscript,nav,header,footer,form,iframe').remove();
 const body=clean((selected.length?selected:$('body')).text());
 const description=clean(product?.description||$('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content'));
 const text=[title,description,body].filter(Boolean).join('\n').slice(0,20000);
 return {title,text,imageUrls:images.slice(0,20),warnings:[...(products.length>1?['여러 상품이 감지되었습니다. 사용할 상품과 옵션을 분석 결과에서 확인해 주세요.']:[]),...(images.length>10?['이미지가 많아 일부만 가져옵니다. 필요한 상세 이미지를 추가 업로드할 수 있습니다.']:[])]};
}
