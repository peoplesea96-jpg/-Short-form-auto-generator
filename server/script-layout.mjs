import {pacingPlan} from './pacing-plan.mjs';
export function scriptLayout(p){
 const timing=pacingPlan(p.duration,p.pacing?.averageSceneSeconds??2),frames=timing.seconds.map(s=>Math.round(s*30));
 const product=p.brief?.kind!=='story'||p.productionDirection?.enabled;
 const slots=timing.seconds.map((seconds,i)=>({key:`scene_${i+1}`,seconds,visualRole:product?'product':'context',presentation:'scene'}));
 const max=p.productionDirection?.enabled?p.productionDirection.maxPresenterRatio??.4:.4,budget=Math.floor(p.duration*30*max+1e-6);
 if(p.cast?.presenter){let used=0;const target=Math.floor(timing.count*max);const order=[...new Set([0,...Array.from({length:target},(_,i)=>Math.floor(i*timing.count/Math.max(1,target)))])];for(const i of order){if(used+frames[i]<=budget){slots[i].visualRole='presenter_product';used+=frames[i];}}}
 return slots;
}
export function layoutSchema(slots,props){return {type:'object',properties:{scenes:{type:'object',properties:Object.fromEntries(slots.map(s=>[s.key,{type:'object',properties:{...props,visualRole:{type:'string',enum:[s.visualRole]},presentation:{type:'string',enum:[s.presentation]},seconds:{type:'number',enum:[s.seconds]}},required:Object.keys(props),additionalProperties:false}])),required:slots.map(s=>s.key),additionalProperties:false}},required:['scenes'],additionalProperties:false};}
export function readLayout(raw,slots){
 if(!raw||Array.isArray(raw)||Object.keys(raw).length!==slots.length)throw Error('배정된 씬 개수와 대본 결과가 다릅니다.');
 return slots.map(slot=>{const s=raw[slot.key];if(!s||s.visualRole!==slot.visualRole||s.presentation!==slot.presentation||Math.abs(s.seconds-slot.seconds)>1e-6)throw Error(`${slot.key}: 배정된 시간·상품·인물 역할과 결과가 다릅니다.`);return s;});
}
