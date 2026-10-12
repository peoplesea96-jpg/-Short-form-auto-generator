// Test preload: no request ever reaches a real provider.
import {appendFileSync,readFileSync} from 'node:fs';
if(process.env.NODE_ENV!=='test')throw Error('Test-only provider');
let polls=0;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url);appendFileSync(process.env.HF_MOCK_LOG,JSON.stringify({host:u.hostname,path:u.pathname,method:options.method||'GET'})+'\n');
 if(u.pathname==='/files/generate-upload-url')return Response.json({upload_url:'https://uploads.example.test/object',public_url:'https://media.example.test/image',upload_headers:{'Content-Type':'image/png'}});
 if(u.hostname==='uploads.example.test')return new Response(null,{status:200});
 if(u.hostname==='media.example.test')return new Response(readFileSync(process.env.HF_MOCK_VIDEO));
 if(u.hostname==='api.higgsfield.ai'&&options.method==='POST'){
  if(process.env.HF_MOCK_MODE==='ambiguous')throw new TypeError('Simulated disconnected POST');
  if(process.env.HF_MOCK_MODE==='rejected')return new Response('invalid request',{status:400});
  return Response.json({request_id:'mock-job',status_url:'https://api.higgsfield.ai/requests/mock-job/status'});
 }
 if(u.hostname==='api.higgsfield.ai'&&u.pathname.includes('/requests/')){polls++;if(polls===1)return new Response('busy',{status:503});return Response.json({status:'completed',video:{url:'https://media.example.test/video'}});}
 throw Error('Unexpected mock request: '+u.origin);
};
