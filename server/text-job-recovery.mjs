// Text requests have no resumable provider operation. Terminal errors must not lock editing.
export const textJobKinds=['script','strategy','narration','storyboard-rewrite'];
export const isTextJob=job=>textJobKinds.includes(job.kind);
export function textJobFailure(job,error){
 const cost=Number.isFinite(error?.generationCost)?Math.ceil(error.generationCost):(error?.definitive===true?0:null);
 let reason=error?.name==='TimeoutError'?'대본 응답 제한 시간을 초과했습니다.':error?.name==='ZodError'?'생성 결과 형식이 맞지 않습니다: '+error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join(';'):String(error?.message||'대본 처리 오류');
 reason=reason.replace(/Bearer\s+\S+|sk-[\w-]+/gi,'[redacted]').slice(0,350);
 return {status:'failed',actual:cost,error:reason+' 기존 구성은 유지됩니다. 자동 재요청하지 않았습니다.'+(cost===null?' 비용 미확인으로 예약 금액을 유지합니다.':'')};
}
export function recoverTextJobs(db,now=Date.now()){
 return db.prepare(`UPDATE jobs SET status='failed',updated=?,error=COALESCE(error,'대본 요청이 중단되었습니다.') || ' 대본 작업은 종료 처리했습니다. 기존 구성과 비용 기록을 유지하며 자동 재요청하지 않습니다.' WHERE kind IN ('script','strategy','narration','storyboard-rewrite') AND status='unknown' AND provider_id IS NULL`).run(now).changes;
}
