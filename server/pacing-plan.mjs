export function pacingPlan(duration,averageSceneSeconds=2){
 if(!Number.isInteger(duration)||duration<15||duration>180)throw Error('전체 길이는 15~180초 정수여야 합니다.');
 if(!Number.isFinite(averageSceneSeconds)||averageSceneSeconds<1||averageSceneSeconds>5)throw Error('평균 씬 길이는 1~5초여야 합니다.');
 const count=Math.max(3,Math.min(180,Math.ceil(duration/averageSceneSeconds))),frames=duration*30,base=Math.floor(frames/count),extra=frames%count;
 return {duration,averageSceneSeconds,count,actualAverage:duration/count,seconds:Array.from({length:count},(_,i)=>(base+(i<extra?1:0))/30)};
}
export const pacedProject=p=>({...p,duration:p.pacing?.targetDuration||p.duration,pacing:{averageSceneSeconds:p.pacing?.averageSceneSeconds??2,targetDuration:p.pacing?.targetDuration||p.duration}});
export function pacingPrompt(p){const plan=pacingPlan(p.duration,p.pacing?.averageSceneSeconds??2);return `편집 템포: 총 ${plan.duration}초, 평균 목표 ${plan.averageSceneSeconds}초, 정확히 ${plan.count}개 씬. 씬별 배정 시간(초): ${JSON.stringify(plan.seconds)}. 각 씬의 대사는 해당 시간 안에 읽을 아주 짧은 구어절로 쓰고, 설명을 억지로 몰아넣거나 음성을 빠르게 읽게 하지 않는다. 필요하면 의도적인 무발화 컷을 섞는다. 씬은 1~15초, 장면 수와 합계를 지킨다. 짧은 컷에서는 많은 샷이나 동작을 넣지 않는다. 이 속도는 화면 전환 템포이며 재생 배속이 아니다.`;}
