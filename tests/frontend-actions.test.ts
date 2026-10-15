import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TrainingPresenter,
  importJournalText,
} from '../frontend/src/presenter/TrainingPresenter.js';
import type { TrainingService } from '../frontend/src/service/TrainingService.js';
import { EMPTY_METRICS } from '../shared/contracts.js';
const user = {
  id: 'a',
  username: 'a',
  displayName: 'Alpha',
  bio: '',
  targets: { pullups: 23, plankSeconds: 225, runSeconds: 1080 },
};
const journal = {
  id: 'j',
  userId: 'a',
  title: 'Day one',
  body: 'Training',
  date: '2026-10-14',
  metrics: EMPTY_METRICS,
  createdAt: '',
  updatedAt: '',
};
function setup(fail = false) {
  const calls: string[] = [];
  const service = {
    bootstrap: async () => ({ users: [user], journals: [journal], events: [] }),
    session: async () => ({ user, csrfToken: 't' }),
    login: async () => ({ user, csrfToken: 't' }),
    logout: async () => {},
    saveJournal: async (input: unknown) => {
      calls.push('save');
      if (fail) throw Error('Offline');
      return { ...journal, ...(input as object) };
    },
    deleteJournal: async () => {
      calls.push('delete');
    },
    saveEvent: async (input: unknown) => ({ ...(input as object), id: 'e', userId: 'a' }),
    deleteEvent: async () => {},
    saveProfile: async (input: unknown) => ({ ...user, ...(input as object) }),
  } as unknown as TrainingService;
  return { p: new TrainingPresenter(service), calls };
}
test('successful save returns true and replaces data without duplicate records', async () => {
  const { p, calls } = setup();
  await p.load();
  assert.equal(await p.saveJournal({ ...journal, title: 'Changed' }, 'j'), true);
  assert.deepEqual(calls, ['save']);
  assert.equal(p.state.data?.journals.length, 1);
  assert.equal(p.state.data?.journals[0]?.title, 'Changed');
});
test('failed save keeps data and returns false so editors retain draft', async () => {
  const { p } = setup(true);
  await p.load();
  assert.equal(await p.saveJournal(journal, 'j'), false);
  assert.equal(p.state.error, 'Offline');
  assert.equal(p.state.data?.journals[0]?.title, 'Day one');
  assert.equal(p.state.busy, false);
});
test('foreign entry mutation is rejected before service call', async () => {
  const { p, calls } = setup();
  await p.load();
  p.state.data!.journals[0] = { ...journal, userId: 'b' };
  assert.equal(await p.saveJournal(journal, 'j'), false);
  assert.deepEqual(calls, []);
  assert.match(p.state.error, /own/);
});
test('deletion respects confirmation and updates list', async () => {
  const { p, calls } = setup();
  await p.load();
  assert.equal(await p.deleteJournal('j', () => false), false);
  assert.equal(calls.length, 0);
  assert.equal(await p.deleteJournal('j', () => true), true);
  assert.equal(p.state.data?.journals.length, 0);
});
test('login validates blank credentials and logout clears owner', async () => {
  const { p } = setup();
  await p.load();
  assert.equal(await p.login('', ''), false);
  assert.equal(await p.login('a', 'password'), true);
  assert.equal(await p.logout(), true);
  assert.equal(p.state.session?.user, null);
});
test('profile and events update shared public data', async () => {
  const { p } = setup();
  await p.load();
  assert.equal(
    await p.saveEvent({
      title: 'Lift',
      date: '2026-10-14',
      notes: '',
      kind: 'workout',
      completed: false,
    }),
    true,
  );
  assert.equal(p.state.data?.events.length, 1);
  assert.equal(await p.saveProfile({ ...user, displayName: 'New' }), true);
  assert.equal(p.state.session?.user?.displayName, 'New');
  assert.equal(await p.deleteEvent('e', () => true), true);
  assert.equal(p.state.data?.events.length, 0);
});
test('oversized journal body is rejected without calling API', async () => { const {p,calls}=setup(); await p.load(); assert.equal(await p.saveJournal({...journal,body:'a'.repeat(50001)}),false); assert.deepEqual(calls,[]); assert.match(p.state.error,/50,000/); });

test('text imports are plain text and reject oversized and unsupported files before reading', async () => {
  assert.equal(
    await importJournalText({ name: 'log.md', size: 8, text: async () => '<b>x</b>' }),
    '<b>x</b>',
  );
  await assert.rejects(
    () => importJournalText({ name: 'a.txt', size: 102401, text: async () => '' }),
    /100/,
  );
  await assert.rejects(
    () => importJournalText({ name: 'a.html', size: 1, text: async () => '' }),
    /txt/,
  );
});
