// Terminal provider failures must not be confused with an unknown submission.
export const legacyTerminalVideoError='Higgsfield 작업이 종료되었습니다. 과금 여부를 운영자가 확인해야 합니다.';
export const terminalVideoStatuses=['failed','nsfw','canceled','cancelled'];
export function terminalVideoFailure(status,completed,total){
 if(!terminalVideoStatuses.includes(status))throw new Error('Not a confirmed terminal video status');
 return {status:'failed',actual:null,error:`영상 ${completed}/${total}개 완료 후 다음 장면이 Higgsfield에서 종료되었습니다 (${status}). 완료 영상은 보존했습니다. 미생성 씬 일괄 생성으로 남은 장면을 요청할 수 있습니다. 종료 요청의 과금은 미확인이며 예약 금액을 유지합니다.`};
}
export function recoverTerminalVideoJobs(db,now=Date.now()){
 // Only this exact legacy message proves that polling returned a terminal status.
 // Never unlock timeouts, ambiguous POSTs, or jobs still running at the provider.
 return db.prepare("UPDATE jobs SET status='failed',updated=?,error=? WHERE kind='video' AND status='unknown' AND error=?").run(now,'공급자가 종료한 영상 작업의 잠금을 해제했습니다. 완료 영상은 보존했습니다. 미생성 씬 일괄 생성으로 남은 장면을 요청하세요. 이전 종료 상태의 세부 사유는 기록되지 않았습니다. 과금 미확인으로 예약 금액을 유지합니다.',legacyTerminalVideoError).changes;
}
