import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fixedlist-rules',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/access'), { pmEmails: ['andy@example.com'] });
    await setDoc(doc(db, 'propertyManagers/andy/tasks/t1'), { token: 'secret', title: 'x' });
  });
});

const andy = () =>
  env.authenticatedContext('andy', { email: 'andy@example.com', email_verified: true }).firestore();

describe('firestore.rules', () => {
  it('lets an allowed PM read and write their own data', async () => {
    await assertSucceeds(getDoc(doc(andy(), 'propertyManagers/andy/tasks/t1')));
    await assertSucceeds(setDoc(doc(andy(), 'propertyManagers/andy/units/u1'), { address: 'a' }));
    await assertSucceeds(setDoc(doc(andy(), 'propertyManagers/andy'), { name: 'Andy' }));
  });

  it("keeps a PM out of another PM's data", async () => {
    await assertFails(getDoc(doc(andy(), 'propertyManagers/other/tasks/t1')));
    await assertFails(setDoc(doc(andy(), 'propertyManagers/other/units/u1'), { address: 'a' }));
  });

  it('refuses Google accounts that are not on the allow-list', async () => {
    const stranger = env
      .authenticatedContext('eve', { email: 'eve@example.com', email_verified: true })
      .firestore();
    await assertFails(setDoc(doc(stranger, 'propertyManagers/eve'), { name: 'Eve' }));
    const unverified = env
      .authenticatedContext('andy', { email: 'andy@example.com', email_verified: false })
      .firestore();
    await assertFails(getDoc(doc(unverified, 'propertyManagers/andy/tasks/t1')));
  });

  it('gives the public no direct access, including the allow-list', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'propertyManagers/andy/tasks/t1')));
    await assertFails(getDoc(doc(anon, 'config/access')));
    await assertFails(setDoc(doc(andy(), 'config/access'), { pmEmails: ['eve@example.com'] }));
  });
});
