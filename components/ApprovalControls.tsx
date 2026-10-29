"use client";
import {useId} from 'react';
type Any=Record<string,any>;
const stages=['','script','image','audio','video'];
const names:Any={script:'대본',image:'이미지',audio:'음성',video:'영상'};
function units(project:Any,stage:string){return project.scenes.flatMap((scene:Any,i:number)=>['image','video'].includes(stage)&&scene.shots?.length?scene.shots.map((shot:Any,j:number)=>({...shot,label:`씬 ${i+1} · 샷 ${j+1}`})):[{...scene,label:`씬 ${i+1}`}]);}
export function BulkApproval({project,step,disabled,onApprove}:{project:Any,step:number,disabled:boolean,onApprove:(stage:string)=>void}){
 const stage=stages[step],targets=units(project,stage),pending=targets.filter((s:Any)=>!s[stage+'Approved']);
 return <button disabled={disabled||!pending.length} onClick={()=>onApprove(stage)} title="현재 선택된 결과를 모두 승인합니다. 미생성·만료·조건 불일치가 있으면 승인하지 않습니다.">{names[stage]} 일괄 승인{pending.length?` (${pending.length})`:''}</button>;
}
export function NextStep({project,step,dirty,busy,onNext}:{project:Any,step:number,dirty:boolean,busy:boolean,onNext:()=>void}){
 const id=useId(),stage=stages[step],reasons:string[]=[];
 if(dirty)reasons.push('변경사항 저장 버튼을 눌러 수정 내용을 저장하세요.');
 if(busy)reasons.push('진행 중인 작업이 끝날 때까지 기다려 주세요.');
 if(!project.scenes.length)reasons.push('스토리보드를 먼저 생성하세요.');
 if(stage)for(const s of units(project,stage)){
  if(!s[stage+'Approved'])reasons.push(`${s.label}: ${names[stage]} ${stage!=='script'&&!s[stage]?'생성 후 승인 필요':stage!=='script'&&s[stage]?.expires<=Date.now()?'만료 — 재생성 후 승인 필요':'승인 필요'}`);
 }
 if(step===5)reasons.push('마지막 단계입니다. 최종 영상 합성을 진행하세요.');
 const blocked=reasons.length>0;
 return <div className="next-step-help" tabIndex={blocked?0:undefined} aria-label={blocked?'다음 단계 진행 조건':undefined} aria-describedby={blocked?id:undefined}>
 <button className="primary" disabled={blocked} aria-describedby={blocked?id:undefined} onClick={onNext}>다음 단계 →</button>
 {blocked&&<div id={id} role="tooltip" className="next-step-tooltip"><strong>다음 단계 전에 확인하세요</strong><ul>{reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>}
 </div>;
}
