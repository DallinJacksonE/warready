import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, request, expect, type APIRequestContext } from '@playwright/test';
import { EMPTY_METRICS, type BootstrapData, type ProfileInput, type SessionData } from '../shared/contracts.js';

/** Real-browser acceptance checks against a running app; removes only its own unique fixtures. */
const baseURL = process.env.E2E_URL ?? 'http://localhost:8080';
const origin = new URL(baseURL).origin;
const marker = `E2E-${Date.now()}`;
const contexts: APIRequestContext[] = [];
async function actor(index: 1 | 2) {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: origin } });
  contexts.push(api);
  const response = await api.post('/api/login', { data: { username: process.env[`ADMIN${index}_USERNAME`], password: process.env[`ADMIN${index}_PASSWORD`] } });
  assert.equal(response.status(), 200, 'API login succeeds');
  const session: SessionData = await response.json();
  return { api, session, headers: { 'x-csrf-token': session.csrfToken } };
}
const first = await actor(1);
const second = await actor(2);
const original = first.session.user!;
const profile: ProfileInput = { displayName: original.displayName, bio: original.bio, targets: original.targets };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  const guest = await request.newContext({ baseURL });
  contexts.push(guest);
  assert.equal((await guest.post('/api/journals', { data: {} })).status(), 401);
  assert.equal((await first.api.put('/api/profile', { data: profile })).status(), 403, 'CSRF required');
  assert.equal((await first.api.put('/api/profile', { headers: { ...first.headers, Origin: 'https://attacker.invalid' }, data: profile })).status(), 403);

  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Username', { exact: true }).fill(process.env.ADMIN1_USERNAME!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN1_PASSWORD!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${baseURL}/journal`);
  await page.getByRole('button', { name: '+ New entry', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${marker} journal`);
  const importedText = 'A real acceptance-test fixture, removed after verification. <script>window.bad = true</script>';
  await page.locator('input[type="file"]').setInputFiles({ name: 'workout.txt', mimeType: 'text/plain', buffer: Buffer.from(importedText) });
  await expect(page.getByRole('textbox', { name: 'Journal text', exact: true })).toHaveValue(importedText);
  await page.getByText('Record metrics', { exact: false }).first().click();
  await page.getByLabel('Squat', { exact: false }).fill('315');
  await page.getByLabel('Bench press', { exact: false }).fill('225');
  await page.getByLabel('Deadlift', { exact: false }).fill('405');
  await page.getByLabel('Pull-ups', { exact: false }).fill('23');
  await page.getByLabel('Plank', { exact: false }).fill('225');
  await page.getByLabel('3-mile run', { exact: false }).fill('1080');
  await page.getByRole('button', { name: /Save public entry/ }).click();
  await expect(page.getByRole('heading', { name: `${marker} journal`, exact: true })).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  const data: BootstrapData = await (await guest.get('/api/bootstrap')).json();
  const journal = data.journals.find(item => item.title === `${marker} journal`)!;
  assert.ok(journal);
  assert.deepEqual(journal.metrics, { ...EMPTY_METRICS, squat: 315, bench: 225, deadlift: 405, pullups: 23, plankSeconds: 225, runSeconds: 1080 });
  assert.ok(!JSON.stringify(data).includes('passwordHash'));
  assert.equal(await page.evaluate(() => 'bad' in window), false, 'journal HTML is inert text');
  for (const method of ['put', 'delete'] as const) {
    const response = await second.api[method](`/api/journals/${journal.id}`, { headers: second.headers, ...(method === 'put' ? { data: { title: 'Not yours', body: '', date: journal.date, metrics: EMPTY_METRICS } } : {}) });
    assert.equal(response.status(), 404, 'other account cannot mutate journal');
  }
  await page.getByRole('button', { name: 'Edit entry', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${marker} updated`);
  await page.getByRole('button', { name: /Save public entry/ }).click();
  await expect(page.getByRole('heading', { name: `${marker} updated`, exact: true })).toBeVisible();
  await page.goto(`${baseURL}/profiles/${original.id}`);
  await expect(page.getByRole('progressbar', { name: 'Fitness readiness', exact: true })).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('progressbar', { name: '1,000 lb club', exact: true })).toHaveAttribute('aria-valuenow', '95');
  await page.getByRole('button', { name: 'Edit profile & targets', exact: true }).click();
  await page.getByLabel('Bio', { exact: true }).fill(`${marker} bio`);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText(`${marker} bio`, { exact: true })).toBeVisible();
  await page.getByLabel('Look back through date').locator('input').count().then(async count => {
    if (count) await page.getByLabel('Look back through date').locator('input').fill('2000-01-01');
    else await page.getByLabel('Look back through date').fill('2000-01-01');
  });
  await expect(page.getByRole('progressbar', { name: '1,000 lb club', exact: true })).toHaveAttribute('aria-valuenow', '0');

  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: '+ Plan an event', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill(`${marker} workout`);
  await page.getByLabel('Notes', { exact: true }).fill('Temporary browser verification');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${marker} workout`, exact: true })).toBeVisible();
  const event = ((await (await guest.get('/api/bootstrap')).json()) as BootstrapData).events.find(item => item.title === `${marker} workout`)!;
  assert.ok(event);
  assert.equal((await second.api.delete(`/api/events/${event.id}`, { headers: second.headers })).status(), 404);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel(/Type/).selectOption('milestone');
  await page.getByLabel('Mark completed', { exact: true }).check();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  const updated = ((await (await guest.get('/api/bootstrap')).json()) as BootstrapData).events.find(item => item.id === event.id)!;
  assert.equal(updated.kind, 'milestone');
  assert.equal(updated.completed, true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/calendar-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: /Athlete login/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.goto(`${baseURL}/`);
  await expect(page.getByRole('heading', { name: `${marker} updated`, exact: true })).toBeVisible();
  for (const path of ['/', '/calendar', `/profiles/${original.id}`, '/login']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL + path);
    await expect(page.getByRole('main')).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no mobile overflow on ${path}`);
  }
  await page.screenshot({ path: '.local/screenshots/login-mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'no browser JS or console errors');
  console.log('PASS: browser login, journal create/update/import-safe rendering, metrics, lookback, profile edit, event create/update, cookie persistence, logout, public reads, owner/CSRF/origin protection, mobile layouts.');
} finally {
  const data: BootstrapData = await (await first.api.get('/api/bootstrap')).json();
  for (const entry of data.journals.filter(item => item.title.startsWith(marker) && item.userId === original.id)) await first.api.delete(`/api/journals/${entry.id}`, { headers: first.headers });
  for (const entry of data.events.filter(item => item.title.startsWith(marker) && item.userId === original.id)) await first.api.delete(`/api/events/${entry.id}`, { headers: first.headers });
  await first.api.put('/api/profile', { headers: first.headers, data: profile });
  await first.api.post('/api/logout', { headers: first.headers });
  await second.api.post('/api/logout', { headers: second.headers });
  await browser.close();
  await Promise.all(contexts.map(context => context.dispose()));
  console.log('Acceptance-test fixtures cleaned up.');
}
