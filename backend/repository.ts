import type { User, BootstrapData, Journal, TrainingEvent, ProfileInput } from '../shared/contracts.js';
export interface Account extends User { passwordHash: string }
export interface StoredSession { tokenHash: string; userId: string; csrfToken: string; expiresAt: number }
export type Collection = 'journals' | 'events';
export type Entry = Journal | TrainingEvent;
/** Persistence boundary; implementations must return detached values and enforce owner writes. */
export interface Repository {
  health(): Promise<void>;
  bootstrap(): Promise<BootstrapData>;
  findAccount(username: string): Promise<Account | null>;
  getUser(id: string): Promise<User | null>;
  createAccount(account: Account): Promise<void>;
  updateProfile(id: string, input: ProfileInput): Promise<User | null>;
  saveSession(session: StoredSession): Promise<void>;
  getSession(tokenHash: string): Promise<StoredSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
  createEntry(collection: Collection, entry: Entry): Promise<void>;
  updateEntry(collection: Collection, entry: Entry, owner: string): Promise<boolean>;
  deleteEntry(collection: Collection, id: string, owner: string): Promise<boolean>;
}
/** Explicitly exclude credentials from all public projections. */
export function publicUser({ passwordHash: _secret, ...user }: Account): User { return user; }
