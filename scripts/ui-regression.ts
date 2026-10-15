import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import type { BootstrapData } from '../shared/contracts.js';
const baseURL = process.env.E2E_URL ?? 'http://localhost:8080';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true });
const page = await browser.newPage();
try {
  const data: BootstrapData = await (await page.request.get(`${baseURL}/api/bootstrap`)).json();
  const own = data.users.find(user => user.username === process.env.ADMIN1_USERNAME)!;
  const other = data.users.find(user => user.id !== own.id)!;
  assert.ok(own && other);
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Username', { exact: true }).fill(process.env.ADMIN1_USERNAME!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN1_PASSWORD!);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(`${baseURL}/journal`);
  await page.goto(`${baseURL}/profiles/${own.id}`);
  await page.getByRole('button', { name: 'Edit profile & targets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit profile & targets', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: other.displayName, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit profile & targets', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: own.displayName, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit profile & targets', exact: true })).toHaveCount(0);
  console.log('PASS: profile editors cannot leak across athlete routes.');
} finally {
  const session = await (await page.request.get(`${baseURL}/api/session`)).json();
  if (session.user) await page.request.post(`${baseURL}/api/logout`, { headers: { Origin: new URL(baseURL).origin, 'x-csrf-token': session.csrfToken } });
  await browser.close();
}
