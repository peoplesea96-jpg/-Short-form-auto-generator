import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'frame-duration-'));process.env.DATA_DIR=dir;
const {frameHashDuration}=await import('../server/render.mjs');
const {db}=await import('../server/db.mjs');
test('duration includes final video frame and accounts for nonzero start',()=>{
 assert.equal(frameHashDuration('#tb 0: 1/24\n0,0,0,1,10,x\n0,71,71,1,10,x'),3);
 assert.equal(frameHashDuration('#tb 0: 1/30\n0,90,90,1,10,x\n0,179,179,1,10,x'),3);
});
test('duration includes final audio sample block',()=>{
 assert.equal(frameHashDuration('#tb 0: 1/24000\n0,0,0,2048,10,x\n0,71680,71680,320,10,x'),3);
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
