import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {dataDir,assert} from './db.mjs';
import {filePath} from './media.mjs';
import {validateTimeline,FPS} from './timeline.mjs';
export function run(bin,args,cwd){return new Promise((resolve,reject)=>{const p=spawn(bin,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err=(err+d).slice(-4000));const timeout=setTimeout(()=>p.kill(),10*60*1000);p.on('error',e=>{clearTimeout(timeout);reject(e);});p.on('close',c=>{clearTimeout(timeout);c===0?resolve(out):reject(new Error('미디어 처리 실패: '+err.slice(-800)));});});}
export async function duration(fid,kind){let n;if(process.env.FFPROBE_PATH){n=Number(await run(process.env.FFPROBE_PATH,['-v','error',...(kind?['-select_streams',kind==='video'?'v:0':'a:0']:[]),'-show_entries',kind?'stream=duration':'format=duration','-of','csv=p=0',filePath(fid)]));}else{const output=await run(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-i',filePath(fid),...(kind?['-map',kind==='video'?'0:v:0':'0:a:0']:[]),'-f','null','-','-progress','pipe:1']);n=Math.max(...[...String(output).matchAll(/out_time_us=(\d+)/g)].map(m=>Number(m[1])/1e6));}assert(Number.isFinite(n)&&n>0,'미디어 길이를 확인하지 못했습니다.');return n;}
const assText=s=>s.replace(/[{}\\\r]/g,'').replace(/\n/g,'\\N').replace(/(.{20})/g,'$1\\N');
const time=s=>`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;
export async function merge(p){
 const tmp=await mkdtemp(path.join(dataDir,'render-'));
 try{
  await mkdir(path.join(tmp,'fonts'));
  if(process.env.FONT_PATH)await copyFile(process.env.FONT_PATH,path.join(tmp,'fonts','korean.ttf'));
  const target=Number(p.duration)||30;
  validateTimeline(p);
  const measured={...p,scenes:[]};
  for(const scene of p.scenes){
   assert(scene.video?.id&&scene.audio?.id,'영상과 음성이 모두 필요합니다.');
   measured.scenes.push({...scene,video:{...scene.video,duration:await duration(scene.video.id,'video')},audio:{...scene.audio,duration:await duration(scene.audio.id,'audio')}});
  }
  const frames=validateTimeline(measured,true);
  const sceneDurations=frames.map(n=>n/FPS);
  let start=0,events=[];
  for(let i=0;i<p.scenes.length;i++){
   const s=p.scenes[i],seconds=sceneDurations[i];
   assert(s.video?.id&&s.audio?.id,'영상과 음성이 모두 필요합니다.');
   const args=['-y','-i',filePath(s.video.id),'-i',filePath(s.audio.id)];
   const filter='[0:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30'+(p.freezeShortClips?',tpad=stop_mode=clone:stop_duration='+seconds:'')+',trim=duration='+seconds+',setpts=PTS-STARTPTS[v]';
   args.push('-filter_complex',filter,'-map','[v]','-map','1:a:0','-af','asetpts=PTS-STARTPTS,apad','-t',String(seconds),'-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',`scene-${i}.mp4`);
   await run(process.env.FFMPEG_PATH||'ffmpeg',args,tmp);
   events.push(`Dialogue: 0,${time(start)},${time(start+seconds)},Default,,0,0,0,,${assText(s.narration)}`);
   start+=seconds;
  }
  const files=p.scenes.map((_,i)=>`file 'scene-${i}.mp4'\nduration ${sceneDurations[i]}`);
  if(p.brief.cta){const ctaStart=Math.max(0,target-3);events.push(`Dialogue: 1,${time(ctaStart)},${time(target)},CTA,,0,0,0,,${assText(p.brief.cta)}`);}
  await writeFile(path.join(tmp,'list.txt'),files.join('\n'));
  const font=process.env.FONT_NAME||'Noto Sans CJK KR';
  await writeFile(path.join(tmp,'captions.ass'),`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,${font},54,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,80,80,280,1\nStyle: CTA,${font},68,&H00FFFFFF,&H00FFFFFF,&H00101010,&H70000000,1,0,0,0,100,100,0,0,3,14,0,5,120,120,0,1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${events.join('\n')}`);
  const args=['-y','-f','concat','-safe','1','-i','list.txt'];
  if(p.bgm==='ambient')args.push('-f','lavfi','-i',`aevalsrc=0.08*(sin(2*PI*220*t)+0.6*sin(2*PI*277.18*t)+0.4*sin(2*PI*329.63*t))*(0.65+0.35*sin(2*PI*0.08*t)):s=48000:d=${target}`);
  args.push('-vf','ass=captions.ass:fontsdir=fonts');
  if(p.bgm==='ambient')args.push('-filter_complex',`[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[voice];[1:a]volume=${p.bgmVolume*.08}[music];[voice][music]amix=inputs=2:duration=first:normalize=0[a]`,'-map','0:v','-map','[a]');
  else args.push('-af','loudnorm=I=-16:TP=-1.5:LRA=11');
  args.push('-t',String(target),'-r','30','-c:v','libx264','-preset','fast','-c:a','aac','-movflags','+faststart','final.mp4');
  await run(process.env.FFMPEG_PATH||'ffmpeg',args,tmp);
  const check=await run(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-i','final.mp4','-map','0:v:0','-f','null','-','-progress','pipe:1'],tmp);
  const count=Math.max(...[...check.matchAll(/frame=(\d+)/g)].map(m=>Number(m[1])));
  assert(Math.abs(count-target*FPS)<=1,'합성 영상 길이가 목표와 다릅니다. 결과를 저장하지 않았습니다.');
  return await readFile(path.join(tmp,'final.mp4'));
 }finally{await rm(tmp,{recursive:true,force:true});}
}
