import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { fixture } from './backend-auth.test.js';
const metrics={squat:100,bench:null,deadlift:null,pullups:5,plankSeconds:60,runSeconds:1200};
for(const collection of ['journals','events'] as const){
 test(`${collection}: public reads, owner-only validated CRUD and CSRF`,async()=>{
  const {app,login}=await fixture();const a=await login(),b=await login('bravo');
  const input=collection==='journals'?{title:'Session',body:'Public notes',date:'2026-10-14',metrics}:{title:'Session',notes:'Notes',date:'2026-10-14',kind:'workout',completed:false};
  const url=`/api/${collection}`;
  await request(app).post(url).send(input).expect(401);
  await request(app).post(url).set('Cookie',a.cookie).send(input).expect(403);
  await request(app).post(url).set('Cookie',a.cookie).set('x-csrf-token',b.csrf).send(input).expect(403);
  await request(app).post(url).set('Cookie',a.cookie).set('x-csrf-token',a.csrf).set('Origin','https://evil.test').send(input).expect(403);
  const write=()=>request(app).post(url).set('Cookie',a.cookie).set('x-csrf-token',a.csrf);
  await write().send({...input,date:'2026-02-30'}).expect(400);
  await write().send({...input,userId:b.user.id}).expect(400);
  await write().send({...input,title:''}).expect(400);
  if(collection==='journals')await write().send({...input,metrics:{...metrics,squat:-1}}).expect(400);
  const created=(await write().send(input).expect(201)).body;
  assert.equal(created.userId,a.user.id);assert.equal(created.title,'Session');
  for(const method of ['put','delete'] as const)await request(app)[method](`${url}/${created.id}`).set('Cookie',b.cookie).set('x-csrf-token',b.csrf).send(input).expect(404);
  const updated=(await request(app).put(`${url}/${created.id}`).set('Cookie',a.cookie).set('x-csrf-token',a.csrf).send({...input,title:'Edited'}).expect(200)).body;
  assert.equal(updated.title,'Edited');assert.equal(updated.createdAt,created.createdAt);
  await write().send({...input,date:'2026-10-15'}).expect(201);
  const records=(await request(app).get('/api/bootstrap')).body[collection];assert.equal(records.length,2);assert.equal(records[0].date,'2026-10-15');
  await request(app).delete(`${url}/${created.id}`).set('Cookie',a.cookie).set('x-csrf-token',a.csrf).expect(204);
  await request(app).delete(`${url}/${created.id}`).set('Cookie',a.cookie).set('x-csrf-token',a.csrf).expect(404);
 });
}
test('profile updates only the authenticated user, validates strict bounded fields',async()=>{
 const {app,login}=await fixture();const a=await login();const input={displayName:'New Name',bio:'Biography',targets:{pullups:24,plankSeconds:240,runSeconds:1000}};
 const write=()=>request(app).put('/api/profile').set('Cookie',a.cookie).set('x-csrf-token',a.csrf);
 await write().send({...input,id:'someone-else'}).expect(400);
 await write().send({...input,targets:{...input.targets,runSeconds:0}}).expect(400);
 const changed=(await write().send(input).expect(200)).body;assert.equal(changed.id,a.user.id);assert.equal(changed.displayName,'New Name');assert.equal('passwordHash' in changed,false);
});
