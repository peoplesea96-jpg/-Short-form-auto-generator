// Test-only interception: both authenticated API and public-media transport are isolated.
import {appendFileSync,readFileSync} from 'node:fs';
import https from 'node:https';
import dns from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
if(process.env.NODE_ENV!=='test')throw Error('Test-only provider');
let polls=0,paid=0;
dns.lookup=async host=>{if(host!=='cdn.example.test')throw Error('Unexpected DNS');return [{address:'93.184.216.34',family:4}];};
https.request=(url,options,cb)=>{if(new URL(url).hostname!=='cdn.example.test')throw Error('Unexpected media host');const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const res=Readable.from([readFileSync(process.env.MARKETING_MOCK_PNG)]);res.statusCode=200;res.headers={'content-type':'image/png'};cb(res);res.once('end',()=>req.emit('close'));});req.destroy=e=>{if(e)req.emit('error',e);req.emit('close');};return req;};
syncBuiltinESMExports();
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url);if(u.hostname!=='api.higgsfield.ai')throw Error('Unexpected provider');
 appendFileSync(process.env.MARKETING_MOCK_LOG,JSON.stringify({method:options.method||'GET',path:u.pathname})+'\n');
 if(options.method==='POST'){
  paid++;if(process.env.MARKETING_MOCK_MODE==='ambiguous')throw new TypeError('Disconnected paid POST');
  if(process.env.MARKETING_MOCK_MODE==='forbidden')return new Response('private provider error',{status:403});
  if(process.env.MARKETING_MOCK_MODE==='rejected')return new Response('rejected',{status:400});
  if(process.env.MARKETING_MOCK_MODE==='partial'&&paid===2)return new Response('rejected',{status:400});
  return Response.json({request_id:'mock-'+paid,status_url:'https://api.higgsfield.ai/requests/mock-'+paid+'/status'});
 }
 polls++;if(polls===1)return new Response('busy',{status:503});
 return Response.json({status:'completed',images:[{url:'https://cdn.example.test/ad.png'}]});
};
