import {assert} from './db.mjs';
export function outputProfile(p){const resolution=p.outputResolution??'1080p';assert(['720p','1080p'].includes(resolution),'최종 출력 해상도는 720p 또는 1080p를 선택해 주세요.');return {resolution,width:resolution==='1080p'?1080:720,height:resolution==='1080p'?1920:1280,fps:30,scaler:'lanczos',crf:18};}
export function outputScale(p){const {width,height}=outputProfile(p);return `scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=30`;}
