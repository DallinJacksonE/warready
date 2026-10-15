import { z } from 'zod';
import { MAX_JOURNAL_LENGTH } from '../shared/contracts.js';
const text=(max:number)=>z.string().trim().min(1).max(max);
const observation=z.number().finite().min(0).max(100000).nullable();
/** A calendar-valid date-only value; prevents JS rollover of impossible dates. */
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(`${value}T00:00:00.000Z`);return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2100-12-31';});
export const profileSchema=z.object({displayName:text(80),bio:z.string().max(2000),targets:z.object({pullups:z.number().int().min(1).max(1000),plankSeconds:z.number().int().min(1).max(86400),runSeconds:z.number().int().min(1).max(86400)}).strict()}).strict();
export const journalSchema=z.object({title:text(160),body:z.string().max(MAX_JOURNAL_LENGTH),date,metrics:z.object({squat:observation,bench:observation,deadlift:observation,pullups:z.number().int().min(0).max(10000).nullable(),plankSeconds:observation,runSeconds:z.number().finite().positive().max(100000).nullable()}).strict()}).strict();
export const eventSchema=z.object({title:text(160),notes:z.string().max(10000),date,kind:z.enum(['workout','milestone']),completed:z.boolean()}).strict();
