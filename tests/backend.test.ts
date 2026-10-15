import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryRepository } from '../backend/adapters/memory.js';
import { createApp } from '../backend/app.js';

test('public health checks repository and bootstrap starts empty', async () => {
  const repository = new MemoryRepository();
  const app = createApp({ repository });
  assert.deepEqual((await request(app).get('/api/health').expect(200)).body, { status: 'ok' });
  assert.deepEqual((await request(app).get('/api/bootstrap').expect(200)).body, { users: [], journals: [], events: [] });
  assert.deepEqual((await request(app).get('/api/session').expect(200)).body, { user: null, csrfToken: '' });
});
test('serves frontend assets and deep SPA routes but never leaks API catchalls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'warready-'));
 try{
  await writeFile(join(dir,'index.html'),'<!doctype html><h1>War Ready</h1>');await writeFile(join(dir,'app.js'),'console.log("ready")');
  const app=createApp({repository:new MemoryRepository(),staticDirectory:dir});
  assert.match((await request(app).get('/calendar/2026').expect(200)).text,/War Ready/);
  assert.match((await request(app).get('/app.js').expect(200)).text,/console.log/);
  assert.deepEqual((await request(app).get('/api/missing').expect(404)).body,{error:'Not found'});
  await request(app).get('/missing.js').expect(404);
 }finally{await rm(dir,{recursive:true});}
});
test('database outages, malformed JSON and unknown APIs return nonleaking JSON',async()=>{
 const repository=new MemoryRepository();repository.health=async()=>{throw new Error('private sql password');};const app=createApp({repository});
 assert.deepEqual((await request(app).get('/api/health').expect(503)).body,{error:'Database unavailable'});
 assert.deepEqual((await request(app).post('/api/login').type('json').send('{bad').expect(400)).body,{error:'Invalid JSON'});
 assert.deepEqual((await request(app).post('/api/nope').expect(404)).body,{error:'Not found'});
});
