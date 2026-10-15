import type {
  BootstrapData,
  SessionData,
  JournalInput,
  EventInput,
  ProfileInput,
} from '../../../shared/contracts.js';
import { MAX_JOURNAL_LENGTH } from '../../../shared/contracts.js';
import type { TrainingService } from '../service/TrainingService.js';
export interface TrainingState {
  data: BootstrapData | null;
  session: SessionData | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
}
export async function importJournalText(file: {
  name: string;
  size: number;
  text: () => Promise<string>;
}): Promise<string> {
  if (!/\.(txt|md)$/i.test(file.name)) throw Error('Choose a .txt or .md plain text file.');
  if (file.size > 100 * 1024) throw Error('File must be 100 KB or smaller.');
  const text = await file.text();
  if (text.length > MAX_JOURNAL_LENGTH) throw Error('Journal text must be 50,000 characters or fewer.');
  return text;
}
export class TrainingPresenter {
  state: TrainingState = {
    data: null,
    session: null,
    loading: true,
    busy: false,
    error: '',
    notice: '',
  };
  private listeners = new Set<() => void>();
  constructor(private service: TrainingService) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<TrainingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async load() {
    this.update({ loading: true, error: '' });
    try {
      const [data, session] = await Promise.all([this.service.bootstrap(), this.service.session()]);
      this.update({ data, session });
    } catch (error) {
      this.update({
        error: error instanceof Error ? error.message : 'Unable to load training data.',
      });
    } finally {
      this.update({ loading: false });
    }
  }
  private async action(task: () => Promise<void>, notice: string) {
    if (this.state.busy) return false;
    this.update({ busy: true, error: '', notice: '' });
    try {
      await task();
      this.update({ notice });
      return true;
    } catch (error) {
      this.update({
        error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
      return false;
    } finally {
      this.update({ busy: false });
    }
  }
  private requireOwner(collection: 'journals' | 'events', id?: string) {
    const user = this.state.session?.user;
    if (!user) throw Error('Sign in to save your training.');
    if (
      id &&
      !this.state.data?.[collection].some((item) => item.id === id && item.userId === user.id)
    )
      throw Error('You can only edit your own entries.');
  }
  login(username: string, password: string) {
    return this.action(async () => {
      if (!username.trim() || !password) throw Error('Enter your username and password.');
      this.update({ session: await this.service.login(username.trim(), password) });
    }, 'Signed in. Your training desk is ready.');
  }
  logout() {
    return this.action(async () => {
      await this.service.logout();
      this.update({ session: { user: null, csrfToken: '' } });
    }, 'Signed out. Public training remains available.');
  }
  saveJournal(input: JournalInput, id?: string) {
    return this.action(async () => {
      this.requireOwner('journals', id);
      if (!input.title.trim() || !input.body.trim())
        throw Error('A title and journal text are required.');
      if (input.body.length > 50000) throw Error('Journal text must be 50,000 characters or fewer. Shorten your imported text before saving.');
      const item = await this.service.saveJournal(input, id);
      this.update({
        data: {
          ...this.state.data!,
          journals: [item, ...this.state.data!.journals.filter((j) => j.id !== item.id)],
        },
      });
    }, 'Journal saved. Your entry is public.');
  }
  deleteJournal(id: string, confirm: () => boolean) {
    if (!confirm()) return Promise.resolve(false);
    return this.action(async () => {
      this.requireOwner('journals', id);
      await this.service.deleteJournal(id);
      this.update({
        data: {
          ...this.state.data!,
          journals: this.state.data!.journals.filter((j) => j.id !== id),
        },
      });
    }, 'Journal deleted. Progress recalculated.');
  }
  saveEvent(input: EventInput, id?: string) {
    return this.action(async () => {
      this.requireOwner('events', id);
      if (!input.title.trim()) throw Error('Give this event a title.');
      const item = await this.service.saveEvent(input, id);
      this.update({
        data: {
          ...this.state.data!,
          events: [item, ...this.state.data!.events.filter((e) => e.id !== item.id)],
        },
      });
    }, 'Event saved to the shared calendar.');
  }
  deleteEvent(id: string, confirm: () => boolean) {
    if (!confirm()) return Promise.resolve(false);
    return this.action(async () => {
      this.requireOwner('events', id);
      await this.service.deleteEvent(id);
      this.update({
        data: { ...this.state.data!, events: this.state.data!.events.filter((e) => e.id !== id) },
      });
    }, 'Event deleted.');
  }
  saveProfile(input: ProfileInput) {
    return this.action(async () => {
      if (!this.state.session?.user) throw Error('Sign in to edit your profile.');
      if (!input.displayName.trim()) throw Error('Display name is required.');
      const user = await this.service.saveProfile(input);
      this.update({
        session: { ...this.state.session, user },
        data: {
          ...this.state.data!,
          users: this.state.data!.users.map((u) => (u.id === user.id ? user : u)),
        },
      });
    }, 'Profile and training targets updated.');
  }
}
