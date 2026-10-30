import {z} from 'zod';

export const directionSchema=z.object({enabled:z.boolean().default(true),minProductRatio:z.number().min(.5).max(1).default(.8),maxPresenterRatio:z.number().min(0).max(1).default(.4),captionMode:z.enum(['none','narration']).default('none')}).strict();
export const visualRoles=['product','presenter_product','presenter','context'];
export const visualFields={visualRole:z.enum(visualRoles).optional(),presentation:z.enum(['scene','photo_card']).optional()};
export const speechField=z.enum(['voiceover','none','lipsync']).optional();
export const captionsEnabled=p=>p.productionDirection?.captionMode!=='none';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function assertSpeechSupported(scene){
 check(scene.speechMode!=='lipsync','현재 앱 영상 연결은 립싱크를 지원하지 않습니다. 인물 직접 발화를 무음 영상으로 대체하지 않습니다. 내레이션을 선택하거나 립싱크 연결 구현 후 진행해 주세요.');
 check(scene.speechMode!=='none'||!scene.narration?.trim(),'무발화 씬의 대사를 비워 주세요.');
}
export function directionReport(p){
 const units=p.scenes.flatMap(s=>s.shots?.length?s.shots.map(x=>({...x,referenceMode:s.referenceMode})):[s]);
 const total=units.reduce((n,s)=>n+Math.round(s.seconds*30),0);
 const product=units.filter(s=>['product','presenter_product'].includes(s.visualRole)).reduce((n,s)=>n+Math.round(s.seconds*30),0);
 const presenter=units.filter(s=>['presenter','presenter_product'].includes(s.visualRole)).reduce((n,s)=>n+Math.round(s.seconds*30),0);
 return {units,total,productRatio:total?product/total:0,presenterRatio:total?presenter/total:0};
}
export function validateDirection(p){
 p.scenes.forEach(assertSpeechSupported);
 if(!p.productionDirection?.enabled)return;
 const d=directionSchema.parse(p.productionDirection),r=directionReport(p);
 check(r.units.length&&r.units.every(s=>s.visualRole&&s.presentation),'각 화면의 상품·인물 역할과 표현 방식을 지정해 주세요.');
 check(r.units.every(s=>s.presentation==='scene'),'원본 사진 카드를 제거하고 공간 안의 상품 시연·근접 영상으로 구성해 주세요.');
 check(r.units.every(s=>!['product','presenter_product'].includes(s.visualRole)||s.referenceMode!=='none'||s.imageRevision?.references?.some(r=>['identity','package'].includes(r.role))),'상품 노출 화면에는 상품 없는 장면 참조 모드를 사용할 수 없습니다.');
 check(['product','presenter_product'].includes(r.units[0].visualRole),'첫 화면부터 상품 또는 완제품을 보여 주세요. 인물 등장 시 함께 들거나 시연해야 합니다.');
 check(r.units.every(s=>s.visualRole!=='presenter'),'인물 단독 화면 대신 상품을 함께 보여 주세요.');
 check(r.productRatio+1e-6>=d.minProductRatio,`상품 노출을 전체 길이의 ${Math.round(d.minProductRatio*100)}% 이상으로 구성해 주세요.`);
 check(r.presenterRatio<=d.maxPresenterRatio+1e-6,`인물 등장 비중을 ${Math.round(d.maxPresenterRatio*100)}% 이하로 조정해 주세요.`);
 check(!p.finishing?.endCard?.enabled,'사진 카드 대신 마지막 상품 영상 위에서 마무리해 주세요. 기존 마무리 화면을 꺼 주세요.');
}
export function directionPrompt(p){
 if(!p.productionDirection?.enabled)return '';
 const d=directionSchema.parse(p.productionDirection);
 return `상품 중심 광고 규칙: 첫 화면부터 상품 또는 완제품 노출. 인물을 사용할 때는 상품을 들거나 사용 중인 presenter_product로 지정하고 인물 단독 presenter 금지. 상품 노출 시간 최소 ${d.minProductRatio*100}%, 인물 포함 시간 최대 ${d.maxPresenterRatio*100}%. 인물이 반드시 필요한 것은 아니다. 나머지는 상품 질감·기능·사용 장면 중심. 원본은 참조 자료이며 여백 위 사진 카드/슬라이드/카탈로그로 출력하지 않는다. presentation=scene만 사용. 음식 외 카테고리도 해당 제품의 사용 시연·결과에 적용. 얼굴·의상·공간 배치와 상품 크기·재질·형태를 샷 사이 유지. 추측한 상품 특성 금지. speechMode는 voiceover 또는 none만 사용. 현재 앱은 립싱크 미지원이므로 인물이 말하는 연기를 지시하지 않는다. 마지막에도 상품 영상을 유지한다. 확인된 고유 상품명이 있을 때만 이름을 자연스럽게 발화하고 광고 제목을 상품명으로 읽지 않는다. 화면 노출 지시는 visual에만 적용하며 내레이션으로 읽지 않는다. ${d.captionMode==='none'?'자막·강조 문구·화면 CTA 없음.':''}`;
}
export function visualDirection(p,s){
 if(!p.productionDirection?.enabled)return '';
 return `Fill the frame with a real advertising scene, never an inset source photo, catalog card, collage, borders or blank padding. Preserve reference product identity and proportions; do not invent food texture or packaging. Keep the same presenter identity, outfit and environment across shots. ${s.visualRole==='presenter_product'?'Show the presenter holding or using the actual reference product or its prepared result prominently from the first frame.':''} ${s.visualRole==='product'?'Focus on product detail or use, without a presenter face.':''} ${s.visualRole==='context'?'Show the planned context.':''} The presenter is silent; audio is voiceover, not lip-synced dialogue.`;
}
