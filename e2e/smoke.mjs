// End-to-end smoke test against the local emulators.
//   1. npm run emulators   2. npm run seed   3. npm run dev   4. node e2e/smoke.mjs
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// require() so a globally installed Playwright is found too.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const pmCtx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await pmCtx.grantPermissions(['clipboard-read', 'clipboard-write']);
const pm = await pmCtx.newPage();
pm.on('dialog', (d) => d.accept());
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

// --- Sign in as a fake Google account (emulator-only hook in web/src/auth.tsx)
await pm.goto(BASE);
await pm.waitForSelector('text=Sign in with Google');
await pm.evaluate(() => window.__devSignIn('pm@example.com', 'Andy'));
await pm.waitForSelector('text=Open tasks');

// --- Directory
await pm.click('nav >> text=Units');
await pm.click('text=Add unit');
await pm.fill('label:has-text("Address") input', '12 Oak St, Berkeley, CA');
await pm.fill('label:has-text("Short name") input', 'Oak St #2');
await pm.fill('label:has-text("Tenant name") input', 'Tess Tenant');
await pm.fill('label:has-text("Tenant phone") input', '510-555-0100');
await pm.fill('label:has-text("Tenant email") input', 'tess@example.com');
await pm.click('text=Save unit');
await pm.waitForSelector('.card >> text=Oak St #2');

await pm.click('nav >> text=Contractors');
await pm.click('text=Add contractor');
await pm.fill('label:has-text("Name") input', 'Pat Plumber');
await pm.fill('label:has-text("Mobile phone") input', '510-555-0199');
await pm.click('text=Save contractor');
await pm.waitForSelector('.card >> text=Pat Plumber');
await shot(pm, '01-contractors');

// --- Create and send a task
async function createTask({ title, contractor, urgent }) {
  await pm.goto(`${BASE}/tasks/new`);
  await pm.selectOption('label:has-text("Unit") select', { label: 'Oak St #2' });
  await pm.fill('label:has-text("Task") input', title);
  await pm.fill('textarea', 'Drips constantly; washer probably gone.');
  await pm.fill('label:has-text("Budget ceiling") input', '250');
  await pm.fill('input[type=date]', '2026-12-01');
  if (urgent) await pm.check('label:has-text("Urgent") input');
  if (contractor) await pm.selectOption('label:has-text("Contractor") select', { label: contractor });
  await pm.click('text=Create task and get link');
  await pm.waitForSelector('text=Send to contractor');
  await pm.click('text=Copy link only');
  await pm.waitForSelector('.pill >> text=Sent');
  return pm.evaluate(() => navigator.clipboard.readText());
}

const link1 = await createTask({ title: 'Fix leaking kitchen tap', contractor: 'Pat Plumber', urgent: true });
assert.match(link1, /\/t\/[\w-]{40,}$/);
await shot(pm, '02-task-sent');

// --- Contractor (phone, signed out) accepts
const phoneCtx = await browser.newContext({ ...devices['Pixel 7'] });
const phone = await phoneCtx.newPage();
await phone.goto(link1);
await phone.waitForSelector('text=Pat Plumber, can you do it?');
assert.equal(await phone.locator('text=Tess Tenant').count(), 0, 'tenant hidden before acceptance');
await shot(phone, '03-contractor-task');

const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
// Too soon: bypass the input's min to prove the server enforces 24h notice.
await phone.$eval('input[type=datetime-local]', (el) => el.removeAttribute('min'));
await phone.fill('input[type=datetime-local]', local(Date.now() + 3 * 3600_000));
await phone.click("text=Yes, I'll do it");
await phone.waitForSelector('.error >> text=24 hours notice');
await phone.fill('input[type=datetime-local]', local(Date.now() + 48 * 3600_000));
await phone.click("text=Yes, I'll do it");
await phone.waitForSelector("text=You're booked to arrive");
await phone.waitForSelector('text=Tess Tenant');
await shot(phone, '04-contractor-accepted');

await pm.waitForSelector('.pill >> text=Accepted'); // live update on the PM side
await pm.waitForSelector('text=Arriving');
await shot(pm, '05-task-accepted');

// --- Open link to a new contractor, who declines; PM reassigns
const link2 = await createTask({ title: 'Replace hallway light', contractor: null });
await phone.goto(link2);
await phone.waitForSelector('text=Can you do it?');
await phone.click("text=I can't");
await phone.fill('textarea', 'Booked solid this month');
await phone.click('text=Confirm decline');
await phone.waitForSelector('text=You declined this job');
await pm.waitForSelector('text=Booked solid this month');
await pm.selectOption('label:has-text("Contractor") select', { label: 'Pat Plumber' });
await pm.click('button:has-text("Reassign")');
await pm.waitForSelector('text=Send to contractor');
await shot(pm, '06-task-reassigned');
await phone.goto(link2);
await phone.waitForSelector('text=Link not available'); // old link is dead
await pm.click('text=Copy link only');
await pm.waitForSelector('.pill >> text=Sent');

// --- My Jobs
await phone.goto(link1);
await phone.click('text=See all my open jobs');
await phone.waitForSelector('h1 >> text=My jobs');
const titles = await phone.locator('.card strong').allTextContents();
assert.deepEqual(titles, ['Fix leaking kitchen tap', 'Replace hallway light']);
await shot(phone, '07-my-jobs');

await pm.goto(BASE);
await pm.waitForSelector('.group');
await shot(pm, '08-dashboard');

// --- A Google account that isn't on the allow-list is refused
const strangerCtx = await browser.newContext();
const stranger = await strangerCtx.newPage();
await stranger.goto(BASE);
await stranger.waitForSelector('text=Sign in with Google');
await stranger.evaluate(() => window.__devSignIn('eve@example.com'));
await stranger.waitForSelector('text=Not authorized');

await browser.close();
console.log('smoke test passed');
