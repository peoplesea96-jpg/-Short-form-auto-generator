import nodemailer from 'nodemailer';
import {assert} from './db.mjs';

let testTransport;
let smtpTransport;

function smtpSettings(){
 const user=String(process.env.SMTP_USER||'').trim();
 const pass=String(process.env.SMTP_APP_PASSWORD||'').replace(/\s/g,'');
 assert(user&&pass&&process.env.APP_URL,'Gmail SMTP 발송 설정이 필요합니다.',503);
 return {user,pass};
}

export function mailReady(){smtpSettings();}

export function setMailTransportForTests(transport){testTransport=transport;}

function transport(){
 if(testTransport)return testTransport;
 if(!smtpTransport){
  const {user,pass}=smtpSettings();
  smtpTransport=nodemailer.createTransport({
   host:'smtp.gmail.com',port:465,secure:true,
   auth:{user,pass},
   connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000
  });
 }
 return smtpTransport;
}

export async function sendMail(to,subject,text){
 const {user}=smtpSettings();
 try{
  await transport().sendMail({from:`Frame <${user}>`,to,subject,text});
 }catch(error){
  console.error('Gmail SMTP send failed',{code:error?.code,responseCode:error?.responseCode,command:error?.command});
  assert(false,'이메일 발송에 실패했습니다. Gmail SMTP 설정을 확인해 주세요.',502);
 }
}
