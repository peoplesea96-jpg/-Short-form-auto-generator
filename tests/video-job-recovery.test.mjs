import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {legacyTerminalVideoError,terminalVideoFailure,recoverTerminalVideoJobs} from '../server/video-job-recovery.mjs';
test('confirmed terminal statuses unlock editing without declaring unverified charges zero',()=>{
 for(const status of ['failed','nsfw','canceled','cancelled']){const r=terminalVideoFailure(status,3,5);assert.equal(r.status,'failed');assert.equal(r.actual,null);assert.match(r.error,/3\/5/);assert.match(r.error,new RegExp(status));}
 assert.throws(()=>terminalVideoFailure('in_progress',0,5));
});
test('legacy migration unlocks only proven terminal videos and preserves all financial/provider/result records',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE jobs(kind TEXT,status TEXT,updated INTEGER,error TEXT,provider_id TEXT,result TEXT,reserved INTEGER,actual INTEGER)');
 const put=db.prepare('INSERT INTO jobs VALUES(?,?,0,?,?,?,2000,NULL)');
 put.run('video','unknown',legacyTerminalVideoError,'provider','[{"id":"saved-video"}]');
 put.run('video','unknown','요청 결과가 불명확합니다.','provider','[]');
 put.run('video','running',legacyTerminalVideoError,'provider','[]');
 put.run('marketing-image','unknown',legacyTerminalVideoError,'provider','[]');
 const before=db.prepare('SELECT * FROM jobs').all();assert.equal(recoverTerminalVideoJobs(db),1);
 const after=db.prepare('SELECT * FROM jobs').all();assert.equal(after[0].status,'failed');for(const k of ['provider_id','result','reserved','actual'])assert.equal(after[0][k],before[0][k]);assert.deepEqual(after.slice(1),before.slice(1));assert.equal(recoverTerminalVideoJobs(db),0);db.close();
});
