// Read-only probe. Never returns credentials, headers, provider error bodies or signed URLs.
export async function checkMarketingConnection({credential=process.env.HIGGSFIELD_API_KEY,request=fetch}={}){
 const checkedAt=new Date().toISOString();
 if(!credential)return {status:'not_configured',checkedAt};
 if(!/^[^\s:]+:[^\s:]+$/.test(credential))return {status:'invalid_credential_format',checkedAt};
 try{
  const r=await request('https://api.higgsfield.ai/marketing-studio/image/presets?size=50',{method:'GET',headers:{Authorization:`Key ${credential}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok)return {status:r.status===401?'authentication_failed':r.status===403?'access_denied':r.status===404?'endpoint_unavailable':r.status===429?'rate_limited':'provider_error',httpStatus:r.status,checkedAt};
  const d=await r.json();if(!Array.isArray(d.items))return {status:'unexpected_response',httpStatus:r.status,checkedAt};
  return {status:'catalog_access_verified',httpStatus:r.status,visiblePresetCount:d.items.length,total:Number.isFinite(d.total)?d.total:null,hasMore:!!d.cursor,generationVerified:false,checkedAt};
 }catch{return {status:'connection_failed',checkedAt};}
}
