import test from 'node:test';
import assert from 'node:assert/strict';
import { importJournalText } from '../frontend/src/presenter/TrainingPresenter.js';

test('text import rejects content beyond the API journal character limit before replacing a draft', async () => {
  await assert.rejects(importJournalText({ name: 'too-long.txt', size: 60000, text: async () => 'a'.repeat(60000) }), /50,000/);
  const accepted = 'a'.repeat(50000);
  assert.equal(await importJournalText({ name: 'accepted.md', size: 50000, text: async () => accepted }), accepted);
});
