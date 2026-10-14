import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
process.env.DATA_DIR=path.resolve('test-results/music-levels');
const {run}=await import('../server/render.mjs');
const {musicMix}=await import('../server/music.mjs');
const {db}=await import('../server/db.mjs');
const dir=process.env.DATA_DIR,ffmpeg=path.resolve('test-results/tools/ffmpeg.exe');await mkdir(dir,{recursive:true});
try{
 await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-af','apad=whole_dur=6','-t','6','voice.wav'],dir);
 await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=3000:sample_rate=48000:duration=6','music.wav'],dir);
 await run(ffmpeg,['-y','-i','voice.wav','-i','music.wav','-filter_complex',musicMix({bgmVolume:.12},6),'-map','[a]','-t','6','-ac','1','-ar','48000','-f','s16le','mixed.pcm'],dir);
 let data=await readFile(path.join(dir,'mixed.pcm'));
 assert.ok(Math.abs(data.length/2/48000-6)<.01,'Mixed audio must cover the entire video');
 function toneRms(start,frequency){const count=48000;let real=0,imag=0;for(let i=0;i<count;i++){const sample=data.readInt16LE((start*48000+i)*2)/32768,angle=2*Math.PI*frequency*i/48000;real+=sample*Math.cos(angle);imag+=sample*Math.sin(angle);}return Math.SQRT2*Math.hypot(real,imag)/count;}
 const musicUnderVoice=toneRms(1,3000),musicAlone=toneRms(4,3000),voice=toneRms(1,440);console.log(JSON.stringify({musicUnderVoice,musicAlone,voice,relativeDb:20*Math.log10(musicUnderVoice/voice)}));
 assert.ok(musicUnderVoice>=.005,'Music is effectively inaudible under narration');assert.ok(musicAlone>=.012,'Music is too quiet between narration');assert.ok(musicUnderVoice<musicAlone,'Ducking should reduce music during narration');assert.ok(voice>musicUnderVoice,'Narration should remain louder than music');
 await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6','voice-full.wav'],dir);
 await run(ffmpeg,['-y','-i','voice-full.wav','-i','music.wav','-filter_complex',musicMix({bgmVolume:.12},6),'-map','[a]','-t','6','-ac','1','-ar','48000','-f','s16le','full.pcm'],dir);data=await readFile(path.join(dir,'full.pcm'));
 assert.ok(toneRms(4,440)>.05,'Late narration must not be cut off');assert.ok(toneRms(4,3000)>.003,'Late background music must still be present');
}finally{db.close();}
