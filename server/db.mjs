import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export const dataDir=path.resolve(process.env.DATA_DIR||'./data');
mkdirSync(dataDir,{recursive:true});
export const db=new DatabaseSync(path.join(dataDir,'studio.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT NOT NULL,body TEXT NOT NULL,deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project TEXT NOT NULL,owner TEXT NOT NULL,kind TEXT NOT NULL,scene TEXT,revision INTEGER NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL,reserved INTEGER NOT NULL,actual INTEGER,month TEXT NOT NULL,provider_id TEXT,result TEXT,error TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,idem TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT,event TEXT,project TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,project TEXT NOT NULL,owner TEXT NOT NULL,mime TEXT NOT NULL,expires INTEGER NOT NULL,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS worker_lock(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS heartbeat(id INTEGER PRIMARY KEY,updated INTEGER);
CREATE INDEX IF NOT EXISTS jobs_owner_month ON jobs(owner,month);`);
export const id=()=>randomUUID();
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function assert(ok,message,status=400){if(!ok){const e=new Error(message);e.status=status;throw e;}}
export function audit(actor,event,project=''){db.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').run(id(),actor,event,project,Date.now());}
export function getProject(pid,owner){const row=db.prepare('SELECT * FROM projects WHERE id=? AND deleted=0').get(pid);assert(row && row.owner===owner,'프로젝트를 찾을 수 없습니다.',404);return JSON.parse(row.body);}
export function saveProject(p){p.updated=Date.now();db.prepare('UPDATE projects SET body=? WHERE id=?').run(JSON.stringify(p),p.id);}
export function month(now=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(now);}
export function budget(owner,pid){const rows=db.prepare('SELECT * FROM jobs WHERE owner=?').all(owner);const sum=xs=>xs.reduce((n,j)=>n+(j.actual??j.reserved),0);return {project:sum(rows.filter(j=>j.project===pid)),month:sum(rows.filter(j=>j.month===month())),projectLimit:10000,monthLimit:100000};}
export function rateLimit(key,max=5,ms=900000){return tx(()=>{let r=db.prepare('SELECT * FROM limits WHERE key=?').get(key);if(!r||r.expires<Date.now()){db.prepare('INSERT OR REPLACE INTO limits VALUES(?,1,?)').run(key,Date.now()+ms);return true;}if(r.count>=max)return false;db.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key);return true;});}
export function listProjects(owner){return db.prepare('SELECT body FROM projects WHERE owner=? AND deleted=0').all(owner).map(r=>JSON.parse(r.body)).sort((a,b)=>b.updated-a.updated);}
