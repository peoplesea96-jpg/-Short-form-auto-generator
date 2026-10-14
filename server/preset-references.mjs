import {z} from 'zod';
import sharp from 'sharp';
import {db,tx,assert,audit} from './db.mjs';

db.exec('CREATE TABLE IF NOT EXISTS preset_references(preset TEXT PRIMARY KEY,revision INTEGER NOT NULL,body TEXT NOT NULL,image BLOB,updated INTEGER NOT NULL)');
export const presetCategories=['미분류','미니멀','생활 연출','비교형','상품 강조','그래픽'];
const schema=z.object({titleKo:z.string().trim().max(160),description:z.string().trim().max(1000),usage:z.string().trim().max(400),category:z.enum(presetCategories),sourceUrl:z.url().max(2048),useRegisteredImage:z.boolean(),rightsConfirmed:z.literal(true),verified:z.literal(true)}).strict();
const admin=actor=>assert(actor&&actor===process.env.ADMIN_EMAIL?.trim().toLowerCase(),'운영자만 예시를 등록할 수 있습니다.',403);
function officialSource(value){const u=new URL(value);assert(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='higgsfield.ai'||u.hostname.endsWith('.higgsfield.ai')),'공식 Higgsfield 예시의 HTTPS 출처 주소를 입력해 주세요.');u.hash='';return u.href;}
export function enrichPresetCatalog(catalog){
 const rows=new Map(db.prepare('SELECT preset,revision,body,image IS NOT NULL AS hasImage,updated FROM preset_references').all().map(r=>[r.preset,r]));
 return {...catalog,items:catalog.items.map(p=>{const r=rows.get(p.id);if(!r)return {...p,category:'미분류',reference:null};const data=JSON.parse(r.body),registered=r.hasImage?`/api/marketing-preview/${p.id}?v=${r.revision}`:null,prefer=registered&&(data.useRegisteredImage||!p.preview);return {...p,titleKo:data.titleKo,description:data.description||p.description,usage:data.usage,category:data.category,preview:prefer?registered:p.preview,previewFallback:prefer?p.preview:registered,previewFallbackSource:prefer?'provider':'operator',previewSource:prefer?'operator':p.previewSource,reference:{revision:r.revision,updated:r.updated,sourceUrl:data.sourceUrl,hasImage:!!r.hasImage,useRegisteredImage:data.useRegisteredImage}};})};
}
export async function savePresetReference(actor,preset,revision,value,file){
 admin(actor);assert(z.uuid().safeParse(preset?.id).success,'유효한 현재 프리셋을 선택해 주세요.');
 const data=schema.parse(value);data.sourceUrl=officialSource(data.sourceUrl);assert(Number.isInteger(revision)&&revision>=0,'등록 버전을 확인해 주세요.');
 let image;
 if(file){assert(file.size>0&&file.size<=10*1024*1024,'예시 이미지는 10MB 이하만 가능합니다.');const input=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40000000,animated:false}),meta=await input.metadata();assert(['jpeg','png','webp'].includes(meta.format),'JPEG·PNG·WebP 예시 이미지를 사용해 주세요.');image=await input.rotate().resize(1280,1280,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();assert(image.length<=3*1024*1024,'저장할 예시 이미지가 너무 큽니다.');}
 return tx(()=>{const old=db.prepare('SELECT revision,image FROM preset_references WHERE preset=?').get(preset.id);assert((old?.revision||0)===revision,'다른 운영자가 수정했습니다. 목록을 새로 불러와 주세요.',409);db.prepare('INSERT OR REPLACE INTO preset_references VALUES(?,?,?,?,?)').run(preset.id,revision+1,JSON.stringify(data),image??old?.image??null,Date.now());audit(actor,'preset.reference.save',preset.id);return {ok:true,revision:revision+1};});
}
export function deletePresetReference(actor,preset,revision){admin(actor);return tx(()=>{const row=db.prepare('SELECT revision FROM preset_references WHERE preset=?').get(preset);assert(row&&row.revision===revision,'등록 정보가 변경되었습니다. 목록을 새로 불러와 주세요.',409);db.prepare('DELETE FROM preset_references WHERE preset=?').run(preset);audit(actor,'preset.reference.delete',preset);return {ok:true};});}
export function presetPreview(preset){assert(z.uuid().safeParse(preset).success,'잘못된 프리셋입니다.');const row=db.prepare('SELECT image FROM preset_references WHERE preset=?').get(preset);assert(row?.image,'등록한 예시 이미지가 없습니다.',404);return Buffer.from(row.image);}
