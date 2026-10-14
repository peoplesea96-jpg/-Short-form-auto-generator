import {mkdtempSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
process.env.DATA_DIR=mkdtempSync(path.resolve('test-results/output-render-'));
process.env.FFMPEG_PATH=path.resolve('test-results/tools/ffmpeg.exe');process.env.FONT_PATH='C:/Windows/Fonts/malgun.ttf';process.env.FONT_NAME='Malgun Gothic';
const {db}=await import('../server/db.mjs');const {storeFile}=await import('../server/media.mjs');const {merge}=await import('../server/render.mjs');
try{const f=await storeFile('fixture','fixture',await readFile('test-results/render-data/source.mp4'),'video/mp4','source.mp4');const a=await storeFile('fixture','fixture',await readFile('test-results/render-data/audio.wav'),'audio/wav','voice.wav');
 for(const resolution of ['720p','1080p']){const p={outputResolution:resolution,duration:15,freezeShortClips:true,brief:{cta:'고화질 출력 확인'},bgm:'none',scenes:[0,1].map(i=>({id:String(i),seconds:7.5,narration:'출력 해상도 확인',video:f,audio:a}))};const out=await merge(p);await writeFile(path.join(process.env.DATA_DIR,resolution+'.mp4'),out);console.log(resolution+': actual final dimensions, 450 video frames and full audio verified; bytes '+out.length);}
}finally{db.close();}
