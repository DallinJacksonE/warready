import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainingPresenter } from '../frontend/src/presenter/TrainingPresenter.js';
import type { TrainingService } from '../frontend/src/service/TrainingService.js';
import { EMPTY_METRICS } from '../shared/contracts.js';

const user = {
  id: 'a',
  username: 'alpha',
  displayName: 'Alpha',
  bio: '',
  targets: { pullups: 23, plankSeconds: 225, runSeconds: 1080 },
};
function setup() {
  const calls: string[] = [];
  const service = {
    bootstrap: async () => ({ users: [user], journals: [], events: [] }),
    session: async () => ({ user, csrfToken: 'token' }),
    login: async () => ({ user, csrfToken: 'new' }),
    logout: async () => {
      calls.push('logout');
    },
    saveJournal: async (input: any, id?: string) => {
      calls.push(id ?? 'create');
      return { ...input, id: id ?? 'j', userId: 'a' };
    },
    deleteJournal: async (id: string) => {
      calls.push(`delete:${id}`);
    },
  } as unknown as TrainingService;
  const presenter = new TrainingPresenter(service);
  return { presenter, calls, service };
}
test('loads public data and cookie session into observable state', async () => {
  const { presenter } = setup();
  let changes = 0;
  presenter.subscribe(() => changes++);
  await presenter.load();
  assert.equal(presenter.state.session?.user?.id, 'a');
  assert.equal(presenter.state.data?.users.length, 1);
  assert.equal(presenter.state.loading, false);
  assert.ok(changes >= 2);
});
