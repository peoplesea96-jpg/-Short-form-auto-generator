export const FPS=30;
export function validateTimeline(p, media=false){
 const target=Number(p.duration??30);
 if(!Number.isInteger(target)||target<15||target>180)throw Error('목표 길이는 15~180초의 정수여야 합니다.');
 if(p.scenes.length<2||p.scenes.length>90)throw Error('씬은 2~90개여야 합니다.');
 const frames=p.scenes.map(s=>Math.round(Number(s.seconds)*FPS));
 if(frames.some(f=>!Number.isFinite(f)||f<60||f>450))throw Error('각 씬은 2~15초여야 합니다.');
 if(frames.reduce((a,b)=>a+b,0)!==target*FPS)throw Error('씬 길이 합계가 목표 길이와 다릅니다. 스토리보드에서 길이를 조정해 주세요.');
 if(media)p.scenes.forEach((s,i)=>{
  const seconds=frames[i]/FPS;
  if(!Number.isFinite(s.video?.duration)||!Number.isFinite(s.audio?.duration))throw Error(`씬 ${i+1}: 미디어 길이를 확인하지 못했습니다.`);
  if(s.audio.duration>seconds+1/FPS)throw Error(`씬 ${i+1}: 음성이 ${(s.audio.duration-seconds).toFixed(1)}초 넘칩니다. 대사 또는 씬 길이를 조정해 주세요.`);
  if(s.video.duration+1/FPS<seconds&&!p.freezeShortClips)throw Error(`씬 ${i+1}: 영상이 ${(seconds-s.video.duration).toFixed(1)}초 부족합니다. 영상을 다시 생성하거나 마지막 화면 유지 설정을 선택해 주세요.`);
 });
 return frames;
}
export const scriptSceneCount=p=>Math.max(3,Math.ceil((Number(p.duration)||30)/6));
export const scriptTokenLimit=p=>Math.max(2400,scriptSceneCount(p)*500);
