import test from 'node:test';
import assert from 'node:assert/strict';
import { bestMetrics, strengthTotal, strengthProgress, fitnessProgress, progressTimeline, formatDuration } from '../shared/progress.js';
import { DEFAULT_TARGETS, EMPTY_METRICS, type Journal } from '../shared/contracts.js';
const entry = (id: string, date: string, metrics: Partial<Journal['metrics']>): Journal => ({id, date, title:'Training', body:'Work', userId:'one', createdAt: date+'T12:00:00Z', updatedAt:date+'T12:00:00Z', metrics:{...EMPTY_METRICS,...metrics}});
test('empty history has unknown records and zero progress, not fabricated performance', () => {
 assert.deepEqual(bestMetrics([]), EMPTY_METRICS);
 assert.equal(strengthTotal(EMPTY_METRICS),0);
 assert.equal(fitnessProgress(EMPTY_METRICS, DEFAULT_TARGETS),0);
});
test('personal bests combine max lifts and reps with minimum positive run time', () => {
 const best = bestMetrics([entry('a','2026-10-14',{squat:315,bench:225,deadlift:405,pullups:15,plankSeconds:120,runSeconds:1300}),entry('b','2026-10-15',{squat:300,bench:250,runSeconds:1200})]);
 assert.deepEqual(best,{squat:315,bench:250,deadlift:405,pullups:15,plankSeconds:120,runSeconds:1200});
 assert.equal(strengthTotal(best),970);
 assert.equal(strengthProgress(best),97);
});
test('fitness averages capped personal target fractions and missing events count zero', () => {
 assert.equal(fitnessProgress({...EMPTY_METRICS,pullups:23,plankSeconds:225,runSeconds:1080},DEFAULT_TARGETS),100);
 assert.equal(fitnessProgress({...EMPTY_METRICS,pullups:46},DEFAULT_TARGETS),100/3);
 assert.equal(fitnessProgress({...EMPTY_METRICS,pullups:0,runSeconds:2160},DEFAULT_TARGETS),50/3);
 assert.equal(strengthProgress({...EMPTY_METRICS,squat:1100}),100);
});
test('timeline sorts days and merges same-day observations without mutating source', () => {
 const journals=[entry('b','2026-10-16',{bench:225}),entry('a','2026-10-14',{squat:315}),entry('c','2026-10-16',{deadlift:405})];
 const timeline=progressTimeline(journals,DEFAULT_TARGETS);
 assert.deepEqual(timeline.map(p=>[p.date,p.strength]),[['2026-10-14',315],['2026-10-16',945]]);
 assert.equal(timeline[0].metrics.bench,null);
 assert.equal(timeline[1].metrics.deadlift,405);
 assert.equal(journals[0].id,'b');
 assert.equal(progressTimeline(journals.filter(j=>j.id!=='a'),DEFAULT_TARGETS)[0].strength,630);
});
test('duration formats explicit unknown and minute-second values', () => {
 assert.equal(formatDuration(null),'—');
 assert.equal(formatDuration(1080),'18:00');
 assert.equal(formatDuration(225),'3:45');
 assert.equal(formatDuration(0),'0:00');
});
