"use client";
import {useEffect,useState} from 'react';
import {pacingPlan} from '../server/pacing-plan.mjs';
type Any=Record<string,any>;
export default function PacingControls({project,disabled,preview,onSave,onGenerate,onApply}:{project:Any,disabled:boolean,preview:boolean,onSave:(pacing:Any)=>Promise<void>,onGenerate:()=>void,onApply:(draft:string,discard:boolean)=>void}){
 const [average,setAverage]=useState(project.pacing?.averageSceneSeconds??2),[duration,setDuration]=useState(project.pacing?.targetDuration||project.duration);
 useEffect(()=>{setAverage(project.pacing?.averageSceneSeconds??2);setDuration(project.pacing?.targetDuration||project.duration);},[project.id,JSON.stringify(project.pacing),project.duration]);
 const valid=Number.isInteger(duration)&&duration>=15&&duration<=180,plan=valid?pacingPlan(duration,average):null,saved=average===(project.pacing?.averageSceneSeconds??2)&&duration===(project.pacing?.targetDuration||project.duration),draft=project.storyboardDraft;
 return <section className="panel" aria-label="영상 길이와 속도감"><h3>영상 길이와 속도감</h3><label>전체 영상 길이 · 초<input aria-label="템포 목표 영상 길이" type="number" min={15} max={180} step={1} disabled={disabled} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>
 <label>평균 씬 길이 · {average.toFixed(1)}초<input aria-label="편집 속도감" type="range" min={1} max={5} step={0.5} disabled={disabled} value={average} onChange={e=>setAverage(Number(e.target.value))}/></label><p>빠르게 · 1초 ← 기본 2초 → 여유롭게 · 5초</p>
 {plan?<p>새 구성: {duration}초 / 약 {plan.count}개 씬 · 실제 평균 {plan.actualAverage.toFixed(2)}초</p>:<p role="alert">전체 길이는 15~180초 정수로 입력하세요.</p>}
 <p>씬 전환 속도를 정합니다. 재생 배속이나 목소리 속도는 바꾸지 않습니다. 짧은 씬은 짧은 대사 또는 무발화로 구성하며, 생성 음성의 실제 길이는 별도 검토합니다. 상품별 추천 속도는 아직 연구 전입니다.</p>
 <button disabled={disabled||!valid||preview||saved&&!!project.pacing} onClick={()=>onSave({averageSceneSeconds:average,targetDuration:duration})}>길이·속도 설정 저장</button>
 {!!project.scenes.length&&<><p>현재 구성: {project.duration}초 / {project.scenes.length}개 씬. 설정 저장만으로 기존 씬은 바뀌지 않습니다. 새 구성안을 적용하면 이미지·음성·영상을 다시 만들어야 합니다. 씬 수가 늘면 생성 비용도 늘 수 있습니다.</p><button disabled={disabled||!valid||!saved||preview} onClick={onGenerate}>이 속도로 새 씬 구성 · 비용 확인</button></>}
 {draft&&<section aria-label="새 씬 구성안"><h4>새 씬 구성안 · {draft.duration}초 / {draft.scenes.length}개 씬</h4>{draft.scenes.map((s:Any,i:number)=><article key={s.id}><strong>씬 {i+1} · {Number(s.seconds).toFixed(2)}초</strong><p>{s.narration||'(무발화)'}</p><p className="muted">{s.visual}</p></article>)}<p>적용하면 기존 씬을 새 구성으로 교체합니다. 이전 씬과 미디어는 기록에 보관하며 기존 완성 영상은 유지됩니다.</p><button disabled={disabled||!saved||preview} onClick={()=>onApply(draft.id,false)}>새 씬 구성 전체 적용</button><button disabled={disabled||preview} onClick={()=>onApply(draft.id,true)}>새 구성 버리기</button></section>}
 </section>;
}
