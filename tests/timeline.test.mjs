import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTimeline,scriptSceneCount,scriptTokenLimit} from '../server/timeline.mjs';
const make=duration=>{const count=scriptSceneCount({duration}),base=Math.floor(duration/count*10)/10;return {duration,scenes:Array.from({length:count},(_,i)=>({seconds:i===count-1?Number((duration-base*(count-1)).toFixed(1)):base}))};};
for(const n of [15,30,47,90,180])test(`${n}s allocates complete timeline`,()=>{const p=make(n);assert.equal(validateTimeline(p).reduce((a,b)=>a+b),n*30);assert.ok(p.scenes.length>=3);});
test('invalid bounds and fractional duration rejected',()=>{for(const n of [14,181,30.5,NaN])assert.throws(()=>validateTimeline({...make(30),duration:n}));});
test('25 seconds cannot silently become 30',()=>{assert.throws(()=>validateTimeline({duration:30,scenes:Array.from({length:5},()=>({seconds:5}))}),/합계/);});
test('short clips need explicit freeze, long narration always blocks',()=>{const p={duration:30,scenes:Array.from({length:5},()=>({seconds:6,video:{duration:5},audio:{duration:4}}))};assert.throws(()=>validateTimeline(p,true),/부족/);assert.equal(validateTimeline({...p,freezeShortClips:true},true).length,5);p.scenes[0].audio.duration=7;assert.throws(()=>validateTimeline({...p,freezeShortClips:true},true),/음성/);});
test('180s reserves a larger script token budget',()=>assert.ok(scriptTokenLimit({duration:180})>scriptTokenLimit({duration:30})));
