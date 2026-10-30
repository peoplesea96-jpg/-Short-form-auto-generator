import {z} from 'zod';
export const copySchema=z.object({role:z.string().max(200),sourceIds:z.array(z.string().max(100)).max(12),missingInformation:z.array(z.string().max(300)).max(12),reviewNotes:z.array(z.string().max(600)).max(12)});
const list={type:'array',items:{type:'string'}};
export const copyJsonSchema={type:'object',properties:{role:{type:'string'},sourceIds:list,missingInformation:list,reviewNotes:list},required:['role','sourceIds','missingInformation','reviewNotes'],additionalProperties:false};
