import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
process.env.DATA_DIR=await mkdtemp(path.join(tmpdir(),'frame-duration-'));
process.env.FFMPEG_PATH=process.env.FFMPEG_PATH||path.resolve('test-results/tools/ffmpeg.exe');
process.env.FONT_NAME='Malgun Gothic';
const {run,merge,duration}=await import('../server/render.mjs');
const {storeFile}=await import('../server/media.mjs');const {db}=await import('../server/db.mjs');
const {scriptSceneCount}=await import('../server/timeline.mjs');
const {default:sharp}=await import('sharp');
await run(process.env.FFMPEG_PATH,['-y','-f','lavfi','-i','color=c=0x9185b3:s=360x640:r=30:d=5','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','source.mp4'],process.env.DATA_DIR);
await run(process.env.FFMPEG_PATH,['-y','-i','source.mp4','-vn','-t','2','audio.wav'],process.env.DATA_DIR);
const video=await storeFile('fixture','fixture',await readFile(path.join(process.env.DATA_DIR,'source.mp4')),'video/mp4','source.mp4');
const audio=await storeFile('fixture','fixture',await readFile(path.join(process.env.DATA_DIR,'audio.wav')),'audio/wav','audio.wav');
for(const target of (process.argv.length>2?process.argv.slice(2).map(Number):[15,30,47,90,180])){
 const count=scriptSceneCount({duration:target}),base=Math.floor(target/count*10)/10;
 const p={duration:target,brief:{cta:'마지막 메시지'},bgm:'none',bgmVolume:0,freezeShortClips:true,scenes:Array.from({length:count},(_,i)=>({seconds:i===count-1?Number((target-base*(count-1)).toFixed(1)):base,narration:'테스트 장면',video,audio}))};
 if(target===30)await assert.rejects(()=>merge({...p,freezeShortClips:false}),/부족/);
 const begin=Date.now(),buf=await merge(p);const f=await storeFile('fixture','fixture',buf,'video/mp4','final.mp4');const seconds=await duration(f.id);assert.ok(Math.abs(seconds-target)<=.1,`container ${seconds}`);
 const out=path.join(process.env.DATA_DIR,`final-${target}.mp4`);await writeFile(out,buf);
 await run(process.env.FFMPEG_PATH,['-y','-ss',String(target-.1),'-i',out,'-frames:v','1','last.png'],process.env.DATA_DIR);
 const stats=await sharp(path.join(process.env.DATA_DIR,'last.png')).stats();assert.ok(stats.channels.slice(0,3).some(c=>c.mean>20),'black tail');
 console.log(JSON.stringify({target,seconds,scenes:count,bytes:buf.length,elapsedSeconds:(Date.now()-begin)/1000,tail:'visible'}));
}
console.log('Artifacts: '+process.env.DATA_DIR);db.close();
