import type { BootstrapData, ProfileInput, User } from '../../shared/contracts.js';
import { publicUser, type Account, type Collection, type Entry, type Repository, type StoredSession } from '../repository.js';
/** Deterministic, detached in-memory implementation of the persistence contract. */
export class MemoryRepository implements Repository {
  private accounts = new Map<string, Account>();
  private sessions = new Map<string, StoredSession>();
  private entries = { journals: new Map<string, Entry>(), events: new Map<string, Entry>() };
  async health(): Promise<void> {}
  async bootstrap(): Promise<BootstrapData> {
    const sorted = (collection: Collection) => [...this.entries[collection].values()].sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    return structuredClone({ users: [...this.accounts.values()].map(publicUser), journals: sorted('journals'), events: sorted('events') }) as BootstrapData;
  }
  async findAccount(username: string) { return structuredClone([...this.accounts.values()].find(u => u.username === username.toLowerCase()) ?? null); }
  async getUser(id: string): Promise<User | null> { const user = this.accounts.get(id); return user ? structuredClone(publicUser(user)) : null; }
  async createAccount(account: Account) {
    if (this.accounts.has(account.id) || await this.findAccount(account.username)) throw new Error('Duplicate account');
    this.accounts.set(account.id, structuredClone({ ...account, username: account.username.toLowerCase() }));
  }
  async updateProfile(id: string, input: ProfileInput) { const user = this.accounts.get(id); if (!user) return null; Object.assign(user, structuredClone(input)); return this.getUser(id); }
  async saveSession(session: StoredSession) { if (!this.accounts.has(session.userId)) throw new Error('Unknown user'); this.sessions.set(session.tokenHash, structuredClone(session)); }
  async getSession(hash: string) { return structuredClone(this.sessions.get(hash) ?? null); }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async createEntry(collection: Collection, entry: Entry) { if (!this.accounts.has(entry.userId) || this.entries[collection].has(entry.id)) throw new Error('Invalid entry'); this.entries[collection].set(entry.id, structuredClone(entry)); }
  async updateEntry(collection: Collection, entry: Entry, owner: string) { const existing = this.entries[collection].get(entry.id); if (!existing || existing.userId !== owner || entry.userId !== owner) return false; this.entries[collection].set(entry.id, structuredClone(entry)); return true; }
  async deleteEntry(collection: Collection, id: string, owner: string) { if (this.entries[collection].get(id)?.userId !== owner) return false; return this.entries[collection].delete(id); }
}
