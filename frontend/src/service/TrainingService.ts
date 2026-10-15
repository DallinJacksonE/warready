import type {
  BootstrapData,
  SessionData,
  JournalInput,
  Journal,
  EventInput,
  TrainingEvent,
  ProfileInput,
  User,
} from '../../../shared/contracts.js';
export interface TrainingService {
  bootstrap(): Promise<BootstrapData>;
  session(): Promise<SessionData>;
  login(username: string, password: string): Promise<SessionData>;
  logout(): Promise<void>;
  saveJournal(input: JournalInput, id?: string): Promise<Journal>;
  deleteJournal(id: string): Promise<void>;
  saveEvent(input: EventInput, id?: string): Promise<TrainingEvent>;
  deleteEvent(id: string): Promise<void>;
  saveProfile(input: ProfileInput): Promise<User>;
}
export class HttpTrainingService implements TrainingService {
  private csrf = '';
  private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method !== 'GET' && path !== '/login' ? { 'x-csrf-token': this.csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? `Request failed (${response.status}). Please try again.`);
    }
    return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
  }
  bootstrap() {
    return this.request<BootstrapData>('/bootstrap');
  }
  async session() {
    const result = await this.request<SessionData>('/session');
    this.csrf = result.csrfToken;
    return result;
  }
  async login(username: string, password: string) {
    const result = await this.request<SessionData>('/login', 'POST', { username, password });
    this.csrf = result.csrfToken;
    return result;
  }
  async logout() {
    await this.request<void>('/logout', 'POST');
    this.csrf = '';
  }
  saveJournal(input: JournalInput, id?: string) {
    return this.request<Journal>(
      id ? `/journals/${encodeURIComponent(id)}` : '/journals',
      id ? 'PUT' : 'POST',
      input,
    );
  }
  deleteJournal(id: string) {
    return this.request<void>(`/journals/${encodeURIComponent(id)}`, 'DELETE');
  }
  saveEvent(input: EventInput, id?: string) {
    return this.request<TrainingEvent>(
      id ? `/events/${encodeURIComponent(id)}` : '/events',
      id ? 'PUT' : 'POST',
      input,
    );
  }
  deleteEvent(id: string) {
    return this.request<void>(`/events/${encodeURIComponent(id)}`, 'DELETE');
  }
  saveProfile(input: ProfileInput) {
    return this.request<User>('/profile', 'PUT', input);
  }
}
