import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MySqlRepository, mysqlConfig } from '../backend/adapters/mysql.js';
import { MemoryRepository } from '../backend/adapters/memory.js';
import { seedAccounts, hashToken } from '../backend/security.js';
import type { Repository } from '../backend/repository.js';
const env={ADMIN1_USERNAME:'alpha',ADMIN1_NAME:'Alpha',ADMIN1_PASSWORD:'alpha-password-123',ADMIN2_USERNAME:'bravo',ADMIN2_NAME:'Bravo',ADMIN2_PASSWORD:'bravo-password-123'};
/** Same behavior contract applies to detached memory storage and an isolated live MySQL DB. */
async function contract(repository:Repository){
 await seedAccounts(repository,env); const user=(await repository.bootstrap()).users[0];
 const copy=await repository.getUser(user.id);assert.ok(copy);copy.displayName='Not saved';
 assert.notEqual((await repository.getUser(user.id))?.displayName,'Not saved');
 const account=await repository.findAccount(user.username.toUpperCase());assert.ok(account);
 await assert.rejects(repository.createAccount({...account,id:'duplicate'}));
 const session={tokenHash:hashToken('token'),csrfToken:'csrf',userId:user.id,expiresAt:Date.now()+10000};
 await repository.saveSession(session);session.csrfToken='changed';assert.equal((await repository.getSession(session.tokenHash))?.csrfToken,'csrf');
 await repository.deleteSession(session.tokenHash);assert.equal(await repository.getSession(session.tokenHash),null);
 const entry={id:'entry',userId:user.id,title:'Entry',body:'Text',date:'2026-10-14',metrics:{squat:null,bench:null,deadlift:null,pullups:null,plankSeconds:null,runSeconds:null},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await repository.createEntry('journals',entry);entry.title='not saved';assert.equal((await repository.bootstrap()).journals[0].title,'Entry');
 assert.equal(await repository.updateEntry('journals',entry,'not-owner'),false);
 assert.equal(await repository.deleteEntry('journals',entry.id,'not-owner'),false);
 assert.equal(await repository.updateEntry('journals',entry,user.id),true);
 assert.equal(await repository.deleteEntry('journals',entry.id,user.id),true);
 await repository.health();
}
test('memory adapter enforces detached records, uniqueness, persistence and owner constraints',async()=>{await contract(new MemoryRepository());});
test('MySQL config requires secret and safely defaults connection parameters',()=>{
 assert.throws(()=>mysqlConfig({}),/MYSQL_PASSWORD/);
 assert.deepEqual(mysqlConfig({MYSQL_PASSWORD:'test'}),{host:'mysql',port:3306,user:'warready',password:'test',database:'warready',connectionLimit:10,charset:'utf8mb4'});
 assert.throws(()=>mysqlConfig({MYSQL_PASSWORD:'test',MYSQL_PORT:'bad'}));
});
test('MySQL live adapter passes identical repository contract and schema bootstraps twice',{skip:!process.env.TEST_MYSQL_DATABASE},async()=>{
 const repository=new MySqlRepository(mysqlConfig({...process.env,MYSQL_DATABASE:process.env.TEST_MYSQL_DATABASE}));
 try{await repository.initialize();await repository.initialize();await contract(repository);}finally{await repository.close();}
});
