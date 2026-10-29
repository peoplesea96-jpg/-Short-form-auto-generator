import {findUnit,refreshSceneApprovals} from './creative-structure.mjs';
import {assert,tx,getProject,saveProject,audit} from './db.mjs';
import {validateSettings,validateChoice,inputFingerprint} from './generation-models.mjs';
import {imageRevisionSchema} from './image-revision.mjs';
import {resolvedReferences} from './project-profiles.mjs';
export function saveImageRevision(owner,pid,b,active){return tx(()=>{
 const p=getProject(pid,owner);assert(p.revision===b.revision,'내용이 변경되었습니다. 다시 불러와 주세요.',409);assert(!active(p),'진행 중인 작업이 끝난 뒤 수정해 주세요.');
 const found=findUnit(p,b.unit);assert(found&&!(found.target===found.scene&&found.scene.shots?.length),'수정할 씬 또는 샷을 선택해 주세요.');
 const value=b.imageRevision===null?null:imageRevisionSchema.parse(b.imageRevision);
 const model=validateChoice('image',b.model);assert(['nano-banana','gpt-image'].includes(model.model),'수정 재생성은 GPT Image 또는 Gemini 이미지 모델을 선택해 주세요.');
 found.target.imageRevision=value;found.target.generationSettings={...found.target.generationSettings,image:model};
 if(value)resolvedReferences(p,findUnit(p,b.unit).unit);
 found.target.revision=(found.target.revision||0)+1;found.target.imageApproved=false;found.target.videoApproved=false;found.scene.imageApproved=false;found.scene.videoApproved=false;
 p.previewReview=null;p.revision++;saveProject(p);audit(owner,'image.revision-settings',pid);return p;
});}
// A caller supplies the same active-job gate used by other project mutations.
export function saveGenerationSettings(owner,pid,revision,value,sceneId,kind,active){return tx(()=>{
 const p=getProject(pid,owner);assert(p.revision===revision,'내용이 변경되었습니다. 새로고침해 주세요.',409);assert(!active(p),'진행 중인 작업을 먼저 확인해 주세요.');
 if(sceneId){const s=findUnit(p,sceneId)?.target;assert(s&&['image','video'].includes(kind),'씬과 생성 단계를 확인해 주세요.');s.generationSettings={...s.generationSettings};if(value===null)delete s.generationSettings[kind];else s.generationSettings[kind]=validateChoice(kind,value);}
 else p.generationSettings=validateSettings(value);
 p.revision++;saveProject(p);audit(owner,'generation.settings',pid);return p;
 });}
export function addCandidate(p,s,kind,item){
 s.candidates={...s.candidates};const list=s.candidates[kind]||[];
 if(s[kind]&&!list.some(x=>x.id===s[kind].id))list.push({...s[kind],inputFingerprint:s[kind].inputFingerprint||(s[kind+'Approved']?inputFingerprint(p,s,kind):null)});
 if(!list.some(x=>x.id===item.id))list.push(item);
 s.candidates[kind]=list;
 // Additional candidates never replace the selected output or its approval.
 if(!s[kind]){s[kind]=item;s[kind+'Approved']=false;if(kind==='image')s.videoApproved=false;}
}
export function selectCandidate(owner,pid,revision,sceneId,kind,fileId,active){return tx(()=>{
 const p=getProject(pid,owner);assert(p.revision===revision,'내용이 변경되었습니다. 새로고침해 주세요.',409);assert(!active(p),'진행 중인 작업을 먼저 확인해 주세요.');assert(['image','video'].includes(kind),'잘못된 후보 종류입니다.');const s=findUnit(p,sceneId)?.target;const item=s?.candidates?.[kind]?.find(x=>x.id===fileId);
 assert(item&&item.expires>Date.now()&&item.inputFingerprint===inputFingerprint(p,findUnit(p,sceneId).unit,kind),'현재 장면·참고 자료와 일치하는 유효한 후보만 선택할 수 있습니다.');
 if(s[kind]?.id!==item.id){s[kind]=item;s[kind+'Approved']=false;if(kind==='image'){s.video=null;s.videoApproved=false;s.audioApproved=false;}p.scenes.forEach(refreshSceneApprovals);p.revision++;saveProject(p);audit(owner,'candidate.select',pid);}return p;
 });}
