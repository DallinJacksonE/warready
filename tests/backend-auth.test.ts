import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MemoryRepository } from '../backend/adapters/memory.js';
import { createApp } from '../backend/app.js';
import { seedAccounts, hashPassword, verifyPassword, hashToken } from '../backend/security.js';
const env = { ADMIN1_USERNAME:'alpha', ADMIN1_NAME:'Alpha', ADMIN1_PASSWORD:'alpha-password-123', ADMIN2_USERNAME:'bravo', ADMIN2_NAME:'Bravo', ADMIN2_PASSWORD:'bravo-password-123' };
export async function fixture(options = {}) {
  const repository = new MemoryRepository(); await seedAccounts(repository, env);
  const app = createApp({repository, appOrigin:'http://localhost:8080', ...options});
  const login = async (username='alpha') => {
    const response = await request(app).post('/api/login').send({username,password:env[username === 'alpha' ? 'ADMIN1_PASSWORD':'ADMIN2_PASSWORD']}).expect(200);
    return { cookie:response.headers['set-cookie'][0].split(';')[0], csrf:response.body.csrfToken, user:response.body.user, response };
  };
  return {repository,app,login};
}
test('seed requires two explicit secrets, is idempotent, and never exposes password hashes', async () => {
  const repository = new MemoryRepository();
  await assert.rejects(seedAccounts(repository, {}));
  assert.equal((await repository.bootstrap()).users.length,0);
  await seedAccounts(repository,env); await seedAccounts(repository,{});
  const account = await repository.findAccount('ALPHA'); assert.ok(account);
  assert.notEqual(account.passwordHash,env.ADMIN1_PASSWORD);
  assert.equal(await verifyPassword(env.ADMIN1_PASSWORD,account.passwordHash),true);
  assert.equal(await verifyPassword('bad',account.passwordHash),false);
  assert.notEqual(await hashPassword('same'),await hashPassword('same'));
  assert.equal((await repository.bootstrap()).users.length,2);
  assert.equal('passwordHash' in (await repository.bootstrap()).users[0],false);
});
test('login rotates opaque persistent sessions with expiring safe cookies; logout revokes',async()=>{
  const {app,repository,login} = await fixture(); const session = await login();
  const cookie = session.response.headers['set-cookie'][0];
  assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Lax/); assert.match(cookie,/Expires=/); assert.match(cookie,/Max-Age=/);
  const token=decodeURIComponent(session.cookie.split('=')[1]);
  assert.equal(await repository.getSession(token),null);
  assert.ok(await repository.getSession(hashToken(token)));
  assert.equal((await request(app).get('/api/session').set('Cookie',session.cookie)).body.user.username,'alpha');
  const restarted=createApp({repository});
  assert.equal((await request(restarted).get('/api/session').set('Cookie',session.cookie)).body.user.username,'alpha');
  await request(app).post('/api/logout').set('Cookie',session.cookie).expect(403);
  const out=await request(app).post('/api/logout').set('Cookie',session.cookie).set('x-csrf-token',session.csrf).expect(204);
  assert.match(out.headers['set-cookie'][0],/Max-Age=0/);
  assert.equal((await request(app).get('/api/session').set('Cookie',session.cookie)).body.user,null);
});
test('session expires server-side and anonymous writes are denied',async()=>{
  let time=10000; const {app,login}=await fixture({now:()=>time,sessionTtlMs:1000}); const s=await login(); time+=1001;
  assert.equal((await request(app).get('/api/session').set('Cookie',s.cookie)).body.user,null);
  await request(app).put('/api/profile').set('Cookie',s.cookie).set('x-csrf-token',s.csrf).send({}).expect(401);
  await request(app).post('/api/logout').expect(401);
});
test('login requires JSON, exact configured origin and throttles failures',async()=>{
  const {app}=await fixture({loginLimit:3});
  await request(app).post('/api/login').type('form').send('username=alpha&password=anything').expect(415);
  await request(app).post('/api/login').set('Origin','https://evil.test').send({username:'alpha',password:'bad'}).expect(403);
  await request(app).post('/api/login').set('Origin','http://localhost:8080.evil.test').send({username:'alpha',password:'bad'}).expect(403);
  for(let i=0;i<3;i++) await request(app).post('/api/login').set('Origin','http://localhost:8080').send({username:'alpha',password:'wrong'}).expect(401);
  const limit=await request(app).post('/api/login').send({username:'alpha',password:'wrong'}).expect(429); assert.equal(typeof limit.body.error,'string');
});
