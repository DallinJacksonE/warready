import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, dateKey, moveMonth } from '../frontend/src/presenter/calendar.js';
test('calendar uses local date keys and Monday-first complete weeks', () => {
  const date = new Date(2026, 9, 14);
  assert.equal(dateKey(date), '2026-10-14');
  const days = calendarDays(date);
  assert.equal(days[0]?.getDay(), 1);
  assert.equal(days.length % 7, 0);
  assert.ok(days.some((d) => dateKey(d) === '2026-10-31'));
  assert.equal(dateKey(moveMonth(new Date(2026, 0, 31), 1)), '2026-02-01');
});
