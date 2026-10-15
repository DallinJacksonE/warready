import { createPool, type Pool, type PoolOptions, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import type { BootstrapData, ProfileInput, User, Journal, TrainingEvent } from '../../shared/contracts.js';
import { publicUser, type Account, type Collection, type Entry, type Repository, type StoredSession } from '../repository.js';
/** Read validated deployment configuration without logging connection secrets. */
export function mysqlConfig(env:Record<string,string|undefined>):PoolOptions {
  if(!env.MYSQL_PASSWORD)throw new Error('MYSQL_PASSWORD is required');
  const port=Number(env.MYSQL_PORT??3306);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid MYSQL_PORT');
  return {host:env.MYSQL_HOST??'mysql',port,user:env.MYSQL_USER??'warready',password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE??'warready',connectionLimit:10,charset:'utf8mb4'};
}
function decode<T>(value:unknown):T {return (typeof value==='string'?JSON.parse(value):value) as T;}
function account(row:RowDataPacket):Account {return {...decode<User>(row.profile),passwordHash:row.password_hash};}
/** MySQL persistence. SQL and row serialization are confined to this adapter. */
export class MySqlRepository implements Repository {
  private pool:Pool;
  constructor(config:PoolOptions){this.pool=createPool(config);}
  /** Idempotently create schema; no destructive migration or data reset. */
  async initialize():Promise<void>{
    await this.pool.execute(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
      password_hash VARCHAR(256) NOT NULL, profile JSON NOT NULL
    ) ENGINE=InnoDB`);
    await this.pool.execute(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      csrf_token VARCHAR(64) NOT NULL, expires_at BIGINT NOT NULL,
      INDEX sessions_expiry (expires_at), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    for(const table of ['journals','events'])await this.pool.execute(`CREATE TABLE IF NOT EXISTS ${table} (
      id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      user_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      entry_date CHAR(10) NOT NULL, document JSON NOT NULL,
      INDEX entry_order (entry_date,id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await this.pool.execute('DELETE FROM sessions WHERE expires_at <= ?',[Date.now()]);
  }
  /** Release all database sockets during shutdown. */
  async close():Promise<void>{await this.pool.end();}
  /** Real readiness query rather than a process-only heartbeat. */
  async health():Promise<void>{await this.pool.execute('SELECT 1');}
  /** Public projections and deterministic calendar-descending ordering. */
  async bootstrap():Promise<BootstrapData>{
    const [users]=await this.pool.execute<RowDataPacket[]>('SELECT profile FROM users ORDER BY username');
    const [journals]=await this.pool.execute<RowDataPacket[]>('SELECT document FROM journals ORDER BY entry_date DESC,id');
    const [events]=await this.pool.execute<RowDataPacket[]>('SELECT document FROM events ORDER BY entry_date DESC,id');
    return {users:users.map(row=>decode<User>(row.profile)),journals:journals.map(row=>decode<Journal>(row.document)),events:events.map(row=>decode<TrainingEvent>(row.document))};
  }
  /** Normalized login lookup; credentials never enter public projections. */
  async findAccount(username:string):Promise<Account|null>{const [rows]=await this.pool.execute<RowDataPacket[]>('SELECT profile,password_hash FROM users WHERE username=?',[username.toLowerCase()]);return rows[0]?account(rows[0]):null;}
  async getUser(id:string):Promise<User|null>{const [rows]=await this.pool.execute<RowDataPacket[]>('SELECT profile FROM users WHERE id=?',[id]);return rows[0]?decode<User>(rows[0].profile):null;}
  async createAccount(value:Account):Promise<void>{const normalized={...value,username:value.username.toLowerCase()};await this.pool.execute('INSERT INTO users (id,username,password_hash,profile) VALUES (?,?,?,?)',[value.id,normalized.username,value.passwordHash,JSON.stringify(publicUser(normalized))]);}
  async updateProfile(id:string,input:ProfileInput):Promise<User|null>{
    const current=await this.getUser(id);if(!current)return null;
    const user={...current,...input};await this.pool.execute('UPDATE users SET profile=? WHERE id=?',[JSON.stringify(user),id]);return user;
  }
  /** Session tokens themselves never reach SQL. */
  async saveSession(session:StoredSession):Promise<void>{await this.pool.execute('INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)',[session.tokenHash,session.userId,session.csrfToken,session.expiresAt]);}
  async getSession(hash:string):Promise<StoredSession|null>{const [rows]=await this.pool.execute<RowDataPacket[]>('SELECT token_hash,user_id,csrf_token,expires_at FROM sessions WHERE token_hash=?',[hash]);const row=rows[0];return row?{tokenHash:row.token_hash,userId:row.user_id,csrfToken:row.csrf_token,expiresAt:Number(row.expires_at)}:null;}
  async deleteSession(hash:string):Promise<void>{await this.pool.execute('DELETE FROM sessions WHERE token_hash=?',[hash]);}
  /** Collection names are fixed trusted identifiers, never raw route input. */
  private table(collection:Collection):string{if(collection!=='journals'&&collection!=='events')throw new Error('Invalid collection');return collection;}
  async createEntry(collection:Collection,entry:Entry):Promise<void>{await this.pool.execute(`INSERT INTO ${this.table(collection)} (id,user_id,entry_date,document) VALUES (?,?,?,?)`,[entry.id,entry.userId,entry.date,JSON.stringify(entry)]);}
  /** SQL owner predicates remain authoritative even if a route check races. */
  async updateEntry(collection:Collection,entry:Entry,owner:string):Promise<boolean>{if(entry.userId!==owner)return false;const [result]=await this.pool.execute<ResultSetHeader>(`UPDATE ${this.table(collection)} SET entry_date=?,document=? WHERE id=? AND user_id=?`,[entry.date,JSON.stringify(entry),entry.id,owner]);return result.affectedRows>0;}
  async deleteEntry(collection:Collection,id:string,owner:string):Promise<boolean>{const [result]=await this.pool.execute<ResultSetHeader>(`DELETE FROM ${this.table(collection)} WHERE id=? AND user_id=?`,[id,owner]);return result.affectedRows>0;}
}
