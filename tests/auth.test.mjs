import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const dir=mkdtempSync(path.join(tmpdir(),'frame-auth-'));
process.env.DATA_DIR=dir;
Object.assign(process.env,{APP_URL:'https://frame.example.test',CLIENT_EMAIL:'client@example.test',ADMIN_EMAIL:'admin@example.test',ALLOW_PUBLIC_SIGNUP:'false',SMTP_USER:'sender@gmail.com',SMTP_APP_PASSWORD:'abcdefghijklmnop'});
const sent=[];
const {setMailTransportForTests}=await import('../server/mail.mjs');
setMailTransportForTests({sendMail:async message=>{sent.push(message);return {messageId:'test'};}});
const {db}=await import('../server/db.mjs');
const {register,verifyRegistration,login,findId,requestPasswordReset,resetPassword}=await import('../server/auth.mjs');

test('complete password account lifecycle',async()=>{
 await assert.rejects(()=>register({id:'stranger',email:'stranger@example.test',password:'SecurePass123'}),/초대/);
 await register({id:'client-id',email:'client@example.test',password:'SecurePass123'});
 const account=db.prepare('SELECT * FROM accounts WHERE email=?').get('client@example.test');
 assert.equal(account.verified,0);
 assert.equal(account.password.includes('SecurePass123'),false);
 const verifyUrl=new URL(sent.at(-1).text.match(/https:\/\/\S+/)[0]);
 assert.ok(verifyRegistration(verifyUrl.searchParams.get('token')));
 assert.ok(login('client-id','SecurePass123'));
 assert.ok(login('client@example.test','SecurePass123'));
 await findId('client@example.test');
 assert.match(sent.at(-1).text,/client-id/);
 await requestPasswordReset('client-id');
 const resetUrl=new URL(sent.at(-1).text.match(/https:\/\/\S+/)[0]);
 assert.ok(resetPassword(resetUrl.searchParams.get('token'),'ChangedPass456'));
 assert.throws(()=>login('client-id','SecurePass123'),/올바르지/);
 assert.ok(login('client-id','ChangedPass456'));
});

test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
