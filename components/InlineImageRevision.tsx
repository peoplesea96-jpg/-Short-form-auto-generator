"use client";
import ImageRevisionPanel from './ImageRevisionPanel';
type Any=Record<string,any>;
export default function InlineImageRevision({project,unit,disabled,preview,onRefresh}:{project:Any,unit:Any,disabled:boolean,preview:boolean,onRefresh:()=>Promise<void>}){
 return <details className="inline-image-revision"><summary>이미지 수정 · 수정 사유와 레퍼런스 선택</summary><ImageRevisionPanel project={project} unit={unit} disabled={disabled} preview={preview} onRefresh={onRefresh} inline/></details>;
}
