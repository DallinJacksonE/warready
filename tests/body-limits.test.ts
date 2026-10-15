import test from 'node:test';
import request from 'supertest';
import { createApp } from '../backend/app.js';
import { MemoryRepository } from '../backend/adapters/memory.js';
import { hashPassword } from '../backend/security.js';
import { DEFAULT_TARGETS, EMPTY_METRICS, MAX_JOURNAL_LENGTH } from '../shared/contracts.js';

test('API accepts maximum-length UTF-8 and JSON-escaped journal text while bounding wire size', async () => {
  const repository = new MemoryRepository();
  await repository.createAccount({id:'test',username:'tester',displayName:'Tester',bio:'',targets:DEFAULT_TARGETS,passwordHash:await hashPassword('password-for-test')});
  const app = createApp({repository});
  const login = await request(app).post('/api/login').send({username:'tester',password:'password-for-test'}).expect(200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const input = { title:'Unicode training log', date:'2026-10-14',metrics:EMPTY_METRICS };
  for (const body of ['界'.repeat(MAX_JOURNAL_LENGTH), '\u0001'.repeat(MAX_JOURNAL_LENGTH)]) {
    await request(app).post('/api/journals').set('Cookie',cookie).set('x-csrf-token',login.body.csrfToken).send({...input,body}).expect(201);
  }
  await request(app).post('/api/journals').set('Cookie',cookie).set('x-csrf-token',login.body.csrfToken).send({...input,body:'a'.repeat(600000)}).expect(413);
});
