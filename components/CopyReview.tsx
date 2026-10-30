"use client";
import {reviewCopy,copySources} from '../server/copy-guidance.mjs';
type Any=Record<string,any>;
export default function CopyReview({project,scene,checked,disabled,onCheck,onCopyChange}:{project:Any,scene:Any,checked:boolean,disabled:boolean,onCheck:(value:boolean)=>void,onCopyChange:(value:Any)=>void}){
 const issues=reviewCopy(project,scene),sources=copySources(project);
 if(!scene.copy&&!issues.length)return null;
 return <section className="panel" aria-label="광고 카피 검수"><h4>광고 카피 검수</h4><p>문구 검사는 보조 기능입니다. 근거의 진위·효능·게시 적합성을 자동 보증하지 않습니다. 실제 음성 길이는 음성 생성 후 확인합니다.</p>
 {issues.map((x:Any,i:number)=><p key={i} role={x.severity==='block'?'alert':'status'}><strong>{x.severity==='block'?'승인 전 수정':'검토 필요'} · {x.rule}</strong> {x.message}<br/>{x.suggestion}</p>)}
 {scene.copy&&<><p>이 씬의 역할: {scene.copy.role}</p>{scene.copy.reviewNotes.map((n:string,i:number)=><p key={i}>{n}</p>)}
 <details><summary>사용한 출처 원문·자료 확인</summary>{scene.copy.sourceIds.filter((id:string)=>!sources.some((source:Any)=>source.id===id)).map((id:string)=><label className="check" key={id}><input type="checkbox" checked disabled={disabled} onChange={()=>onCopyChange({...scene.copy,sourceIds:scene.copy.sourceIds.filter((x:string)=>x!==id)})}/>{id} · 존재하지 않는 연결 (해제 후 올바른 출처 선택)</label>)}{sources.map((source:Any)=><div key={source.id}><label className="check"><input type="checkbox" disabled={disabled} checked={scene.copy.sourceIds.includes(source.id)} onChange={e=>onCopyChange({...scene.copy,sourceIds:e.target.checked?[...scene.copy.sourceIds,source.id]:scene.copy.sourceIds.filter((id:string)=>id!==source.id)})}/>{source.id} · {source.location}</label><p style={{whiteSpace:'pre-wrap'}}>{source.text}</p></div>)}{!sources.length&&<p>확인할 원문 자료가 없습니다. 제품 주장 없이 가능한 초안인지 검토하세요.</p>}</details>
 <p>누락 정보를 해결했다면 아래 목록을 수정하고 변경사항을 저장하세요. 확인하지 않은 정보를 삭제해 완성본으로 취급하지 마세요.</p>
 <label>확인해야 할 정보<textarea aria-label="확인해야 할 정보" disabled={disabled} value={scene.copy.missingInformation.join('\n')} onChange={e=>onCopyChange({...scene.copy,missingInformation:e.target.value.split('\n').filter(Boolean)})}/></label>
 <label className="check"><input type="checkbox" disabled={disabled||issues.some((x:Any)=>x.severity==='block')} checked={checked} onChange={e=>onCheck(e.target.checked)}/>상품명·옵션과 사용한 주장·사용법·화면 효과의 원문 및 조건을 확인했습니다. 미확인 내용은 주장하지 않는 초안이며, 허구 연출 여부와 별개로 검토했습니다.</label>
 <p>이 확인은 제작용 대본 검토입니다. 외부 광고 게시 적합성 승인을 뜻하지 않습니다.</p></>}
 </section>;
}
