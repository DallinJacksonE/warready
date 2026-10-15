import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const baseURL = process.env.E2E_URL ?? 'http://localhost:8080';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
try {
  const data = await (await page.request.get(`${baseURL}/api/bootstrap`)).json();
  for (const path of ['/', '/calendar', '/login', `/profiles/${data.users[0].id}`]) {
    await page.goto(baseURL + path);
    await page.locator('h1').waitFor();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const violations = result.violations.map(issue => ({ id: issue.id, impact: issue.impact, help: issue.help, elements: issue.nodes.map(node => node.target) }));
    assert.deepEqual(violations, [], `Accessibility violations on ${path}: ${JSON.stringify(violations)}`);
    console.log(`PASS: automated WCAG accessibility checks on ${path}`);
  }
} finally { await browser.close(); }
