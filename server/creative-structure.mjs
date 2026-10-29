import {visualFields} from './production-direction.mjs';
import {z} from 'zod';
import {assert,tx,id,getProject,saveProject,audit} from './db.mjs';
import {validateTimeline} from './timeline.mjs';
import {audioMatches,voiceHash} from './project-profiles.mjs';
import {inputFingerprint} from './generation-models.mjs';
const clone=x=>structuredClone(x);
export const shotSchema=z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(100),visual:z.string().trim().min(1).max(600),motion:z.string().max(400).default(''),purpose:z.string().max(600).default(''),soundCue:z.string().max(600).default(''),framing:z.enum(['wide','medium','close','detail']).default('medium'),seconds:z.number().min(.5).max(15),...visualFields}).strict();
export const conceptSchema=z.object({idea:z.string().max(600),problem:z.string().max(600),promise:z.string().max(600),tone:z.string().max(200)}).strict();
export function findUnit(p,uid){for(const scene of p.scenes){if(scene.id===uid)return {scene,target:scene,unit:scene};const shot=scene.shots?.find(s=>s.id===uid);if(shot)return {scene,target:shot,unit:shotUnit(scene,shot)};}return null;}
export function shotUnit(scene,shot){return {...scene,...shot,parentScene:scene.id,narration:scene.narration,scriptApproved:scene.scriptApproved,audio:scene.audio,audioApproved:scene.audioApproved,asset:scene.asset,referenceMode:scene.referenceMode,generationSettings:{...scene.generationSettings,...shot.generationSettings},imageVisual:`${scene.visual}\nShot: ${shot.visual}\nFraming: ${shot.framing}.`,visual:`${scene.visual}\nShot: ${shot.visual}\nFraming: ${shot.framing}. Movement: ${shot.motion||'natural subtle motion'}.`,image:shot.image||null,video:shot.video||null,imageApproved:!!shot.imageApproved,videoApproved:!!shot.videoApproved};}
export const visualUnits=p=>p.scenes.flatMap(s=>s.shots?.length?s.shots.map(shot=>shotUnit(s,shot)):[s]);
export function refreshSceneApprovals(scene){if(scene.shots?.length){scene.imageApproved=scene.shots.every(s=>s.imageApproved);scene.videoApproved=scene.shots.every(s=>s.videoApproved);}}
export function validateShots(scene){if(!scene.shots?.length)return;assert(scene.shots.length<=12,'씬당 샷은 최대 12개입니다.');const frames=scene.shots.map(s=>Math.round(s.seconds*30));assert(frames.every(n=>n>=15&&n<=450),'샷 길이는 0.5~15초여야 합니다.');assert(frames.reduce((a,b)=>a+b,0)===Math.round(scene.seconds*30),'샷 길이 합계가 씬 길이와 다릅니다.');}
const guard=(p,revision,active)=>{assert(p.revision===revision,'내용이 변경되었습니다. 새로고침해 주세요.',409);assert(!active(p),'진행 중인 작업을 먼저 확인해 주세요.');};
export function saveCreative(owner,pid,b,active){return tx(()=>{
 const p=getProject(pid,owner);guard(p,b.revision,active);
 if(b.concept)p.concept=conceptSchema.parse(b.concept);
 if(b.scene){const s=p.scenes.find(s=>s.id===b.scene);assert(s,'씬을 찾을 수 없습니다.');const shots=z.array(shotSchema).min(1).max(12).parse(b.shots);assert(new Set(shots.map(s=>s.id)).size===shots.length,'샷 ID가 중복되었습니다.');assert(shots.every(shot=>!p.scenes.some(other=>other.id===shot.id||other.id!==s.id&&other.shots?.some(x=>x.id===shot.id))),'다른 씬과 중복된 샷 ID입니다.');validateShots({...s,shots});
 s.shots=shots.map(shot=>{const old=s.shots?.find(x=>x.id===shot.id);if(old&&JSON.stringify(shotSchema.parse(Object.fromEntries(Object.keys(shotSchema.shape).map(k=>[k,old[k]]))))===JSON.stringify(shot))return old;return {...shot,revision:(old?.revision||0)+1,generationSettings:old?.generationSettings,candidates:old?.candidates,image:null,video:null,imageApproved:false,videoApproved:false};});refreshSceneApprovals(s);
 }
 p.revision++;saveProject(p);audit(owner,'creative.save',pid);return p;
 });}
function snapshot(p){return {cast:clone(p.cast||null),productionDirection:clone(p.productionDirection||null),adPlanning:clone(p.adPlanning||null),finishing:clone(p.finishing||null),concept:clone(p.concept||null),scenes:clone(p.scenes),duration:p.duration,sheetVersion:p.productSheet?.version||null,voiceHash:p.voiceProfile?voiceHash(p.voiceProfile):null};}
export function manageVersion(owner,pid,b,active){return tx(()=>{
 const p=getProject(pid,owner);guard(p,b.revision,active);assert(p.scenes.length,'스토리보드를 먼저 만들어 주세요.');
 p.versions||=[];if(!p.activeVersionId){const vid=id();p.versions.push({id:vid,name:'원본 버전',hook:'original',created:Date.now(),...snapshot(p)});p.activeVersionId=vid;}
 const current=p.versions.find(v=>v.id===p.activeVersionId);Object.assign(current,snapshot(p));
 if(b.operation==='create'){assert(p.versions.length<12,'소재당 버전은 최대 12개입니다.');const name=z.string().trim().min(1).max(100).parse(b.name),hook=z.enum(['problem','emotion','product','custom']).parse(b.hook);const vid=id();p.versions.push({id:vid,name,hook,baseVersion:p.activeVersionId,created:Date.now(),...snapshot(p)});p.activeVersionId=vid;}
 else if(b.operation==='activate'){const next=p.versions.find(v=>v.id===b.version);assert(next,'영상 버전을 찾을 수 없습니다.');p.scenes=clone(next.scenes);if('cast' in next)p.cast=clone(next.cast);if('productionDirection' in next)p.productionDirection=clone(next.productionDirection);if('adPlanning' in next)p.adPlanning=clone(next.adPlanning);if('finishing' in next)p.finishing=clone(next.finishing);if('concept' in next)p.concept=clone(next.concept);p.duration=next.duration;p.brief.duration=next.duration;p.activeVersionId=next.id;
 for(const s of p.scenes){if(next.sheetVersion!==(p.productSheet?.version||null))s.scriptApproved=false;for(const unit of s.shots?.length?s.shots:[s]){const effective=unit===s?s:shotUnit(s,unit);if(unit.image?.expires<=Date.now())unit.imageApproved=false;if(unit.video?.expires<=Date.now())unit.videoApproved=false;if(!s.scriptApproved||unit.image?.inputFingerprint&&unit.image.inputFingerprint!==inputFingerprint(p,effective,'image'))unit.imageApproved=false;if(!s.scriptApproved||unit.video?.inputFingerprint&&unit.video.inputFingerprint!==inputFingerprint(p,effective,'video'))unit.videoApproved=false;}if(!audioMatches(p,s))s.audioApproved=false;refreshSceneApprovals(s);if(!s.audioApproved)s.videoApproved=false;}
 validateTimeline(p);p.scenes.forEach(validateShots);
 }else assert(false,'버전 작업을 확인해 주세요.');
 p.revision++;saveProject(p);audit(owner,'version.'+b.operation,pid);return p;
 });}

export function resizeShots(shots,seconds){if(!shots?.length)return shots;const target=Math.round(seconds*30),total=shots.reduce((n,s)=>n+Math.round(s.seconds*30),0);assert(target>=shots.length*15,'샷당 최소 0.5초를 확보해 주세요.');let remaining=target-shots.length*15,weight=total-shots.length*15,used=0;return shots.map((s,i)=>{const extra=i===shots.length-1?remaining-used:Math.floor(remaining*(weight?Math.max(0,Math.round(s.seconds*30)-15)/weight:1/shots.length));used+=extra;return {...s,seconds:(15+extra)/30,revision:(s.revision||0)+1,videoApproved:false};});}
