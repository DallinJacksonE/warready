import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DEFAULT_TARGETS } from '../shared/contracts.js';
import type { Repository } from './repository.js';
const derive=promisify(scrypt);
/** Salted scrypt hash, with parameters fixed by this versioned encoding. */
export async function hashPassword(password:string):Promise<string> {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
/** Constant-time comparison; malformed stored hashes never authenticate. */
export async function verifyPassword(password:string,stored:string):Promise<boolean> {
  const [algorithm,salt,hex]=stored.split('$');
  if(algorithm!=='scrypt'||!salt||!hex||!/^[a-f0-9]{128}$/.test(hex)) return false;
  const key=await derive(password,salt,64) as Buffer;
  return timingSafeEqual(key,Buffer.from(hex,'hex'));
}
/** One-way lookup key means a database leak cannot replay the browser token. */
export function hashToken(token:string):string { return createHash('sha256').update(token).digest('hex'); }
export function opaqueToken():string { return randomBytes(32).toString('base64url'); }
/** Validate all missing bootstrap accounts before writing; never replace existing credentials. */
export async function seedAccounts(repository:Repository,env:Record<string,string|undefined>):Promise<void> {
  const existing=(await repository.bootstrap()).users;
  if(existing.length===2) return;
  const seeds=[];
  for(const index of [1,2]) {
    const username=env[`ADMIN${index}_USERNAME`]?.trim().toLowerCase();
    const displayName=env[`ADMIN${index}_NAME`]?.trim();
    const password=env[`ADMIN${index}_PASSWORD`];
    if(!username||!displayName) throw new Error(`ADMIN${index}_USERNAME and ADMIN${index}_NAME required`);
    if(existing.some(u=>u.username===username)) continue;
    if(!/^[a-z0-9_-]{1,64}$/.test(username)||displayName.length>80||!password||password.length<12||password.length>256) throw new Error(`ADMIN${index}: valid name and password of 12–256 characters required`);
    seeds.push({username,displayName,password});
  }
  if(new Set([...existing.map(u=>u.username),...seeds.map(u=>u.username)]).size!==2) throw new Error('Exactly two distinct bootstrap accounts required');
  for(const seed of seeds) await repository.createAccount({id:randomUUID(),username:seed.username,displayName:seed.displayName,passwordHash:await hashPassword(seed.password),bio:'',targets:{...DEFAULT_TARGETS}});
}
