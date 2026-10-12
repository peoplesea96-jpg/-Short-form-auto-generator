import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import sharp from 'sharp';
const dir=mkdtempSync(path.join(tmpdir(),'frame-url-'));process.env.DATA_DIR=dir;
Object.assign(process.env,{OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock',OPENAI_INPUT_KRW_PER_MILLION:'100',OPENAI_OUTPUT_KRW_PER_MILLION:'400',RATES_REVIEWED_AT:'test'});
const {db}=await import('../server/db.mjs');
const {publicAddress,pageUrl,fetchPublic,parseProductPage}=await import('../server/public-page.mjs');
const {newDraft,draft,analysisQuote,analyzeDetails}=await import('../server/detail-analysis.mjs');
const {importDetailUrl}=await import('../server/detail-url-import.mjs');
const owner='url@example.test',url='https://shop.example/product/1';
const html='<title>상품</title><script type="application/ld+json">{"@type":"Product","name":"온유 차","description":"원본에 기재된 향긋한 차 500mL입니다.","image":"/product.png"}</script><main><p>상품 상세 정보입니다. 원산지와 구성은 원본을 확인하세요.</p><img data-src="/detail.png"><img class="logo" src="/logo.png"></main>';
const response=(body,type='text/html',address=url)=>({headers:{'content-type':type},buffer:Buffer.from(body),url:address});
test('only public HTTPS addresses, including mapped IPv6, are accepted',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 for(const value of ['http://shop.example','file:///tmp/a','https://user:pw@shop.example','https://shop.example:8443'])assert.throws(()=>pageUrl(value));
});
test('product metadata and relative lazy images are extracted without scripts or logos',()=>{
 const parsed=parseProductPage(html,url);assert.equal(parsed.title,'온유 차');assert.match(parsed.text,/500mL/);assert.doesNotMatch(parsed.text,/@type/);assert.deepEqual(parsed.imageUrls,['https://shop.example/product.png','https://shop.example/detail.png']);
});
test('DNS pinning, mixed private answers, redirect validation and body limits',async()=>{
 let requests=0,pinned=false;
 const request=(_url,options,callback)=>{requests++;options.lookup('shop.example',{},(_e,ip)=>{assert.equal(ip,'8.8.8.8');pinned=true;});const req=new EventEmitter();req.destroy=e=>{if(e)req.emit('error',e);req.emit('close');};req.end=()=>queueMicrotask(()=>{const res=Readable.from([Buffer.from('hello')]);res.statusCode=200;res.headers={};callback(res);res.on('end',()=>req.emit('close'));});return req;};
 const resolve=async()=>[{address:'8.8.8.8',family:4}];
 assert.equal((await fetchPublic(url,{resolve,request})).buffer.toString(),'hello');assert.ok(pinned);
 await assert.rejects(()=>fetchPublic(url,{resolve:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],request}),/공개 인터넷/);assert.equal(requests,1);
 await assert.rejects(()=>fetchPublic(url,{resolve,request,maxBytes:2}),/용량/);
 const redirect=(_u,_options,callback)=>{const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const res=Readable.from([]);res.statusCode=302;res.headers={location:'http://127.0.0.1/'};callback(res);req.emit('close');});return req;};
 await assert.rejects(()=>fetchPublic(url,{resolve,request:redirect}),/HTTPS/);
});
test('single URL import preserves uploads and enforces ownership, rights, revision and one-link limit',async()=>{
 const d=newDraft(owner),image=await sharp({create:{width:300,height:600,channels:3,background:'#eee'}}).png().toBuffer();
 const fetchPage=async address=>address===url?response(html):response(image,'image/png',address);
 await assert.rejects(()=>importDetailUrl('other',d.id,{url,revision:d.revision,rights:true},{fetchPage}));
 await assert.rejects(()=>importDetailUrl(owner,d.id,{url,revision:d.revision,rights:false},{fetchPage}),/동의/);
 const out=await importDetailUrl(owner,d.id,{url,revision:d.revision,rights:true},{fetchPage});assert.equal(out.images.length,2);assert.equal(out.urlImport.title,'온유 차');assert.equal(out.revision,d.revision+1);assert.equal(db.prepare('SELECT expires FROM files WHERE id=?').get(out.images[0].id).expires,out.expires);
 await assert.rejects(()=>importDetailUrl(owner,d.id,{url,revision:out.revision,rights:true},{fetchPage}),/하나/);
 const second=newDraft(owner);await assert.rejects(()=>importDetailUrl(owner,second.id,{url,revision:99,rights:true},{fetchPage}),/변경/);
 await assert.rejects(()=>importDetailUrl(owner,second.id,{url,revision:second.revision,rights:true},{fetchPage:async()=>{throw Error('network');}}),/network/);assert.equal(draft(owner,second.id).revision,second.revision);
});
test('text-only imported page can be quoted and analyzed with a cited original source',async()=>{
 let d=newDraft(owner);d=await importDetailUrl(owner,d.id,{url,revision:d.revision,rights:true},{fetchPage:async()=>response('<title>상품</title><main>향긋한 차 500mL 제품입니다. 원본에 기재된 상품 구성과 용량을 확인하세요.</main>')});assert.equal(d.images.length,0);assert.ok(analysisQuote(owner,d.id).amount>0);
 const previous=globalThis.fetch;globalThis.fetch=async(_url,options)=>{const payload=JSON.parse(options.body);assert.ok(payload.input[0].content.some(c=>c.text?.includes('500mL')));assert.equal(payload.input[0].content.filter(c=>c.type==='input_image').length,0);return new Response(JSON.stringify({id:'mock',status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({products:[{name:'차',title:'한 잔',description:'향긋한 차입니다.',audience:'차를 즐기는 사람',cta:'지금 만나세요',claims:[{text:'500mL',status:'source',sources:[1]}]}],warnings:[]})}]}]}));};
 try{const out=await analyzeDetails({draft:d,model:'mock',rates:{input:1,output:1}});assert.equal(out.result.sources[0].kind,'text');assert.equal(out.result.sources[0].url,url);}finally{globalThis.fetch=previous;}
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
