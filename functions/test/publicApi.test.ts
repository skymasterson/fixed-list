import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getMyJobs, getTask, respondToTask } from '../src/publicApi';
import type { Contractor, Task, Unit } from '../../shared/src/types';

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 10, 16, 18, 0, 0);
const TOKEN = 'task-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LIST_TOKEN = 'list-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

let db: Firestore;

const unit: Unit = {
  address: '12 Oak St, Berkeley',
  label: 'Oak #2',
  tenantName: 'Tess Tenant',
  tenantPhone: '510-555-0100',
  tenantEmail: 'tess@example.com',
  notes: '',
  active: true,
};
const contractor: Contractor = {
  name: 'Pat Plumber',
  email: '',
  phone: '510-555-0199',
  source: 'directory',
  notes: '',
  active: true,
  listToken: LIST_TOKEN,
  weeklyDigest: false,
};

function task(over: Partial<Task> = {}): Task {
  const ts = Timestamp.fromMillis(NOW - HOUR);
  return {
    unitId: 'u1',
    unitAddress: unit.address,
    unitLabel: unit.label,
    contractorId: 'c1',
    token: TOKEN,
    status: 'sent',
    title: 'Fix leaking tap',
    description: 'Kitchen tap drips',
    budgetCents: 250_00,
    overrunThresholdCents: 100_00,
    urgent: false,
    desiredDate: '2026-11-30',
    allowShortNotice: false,
    problemPhotos: [],
    estimatedDate: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    sendMode: 'manual',
    assignmentHistory: [{ contractorId: 'c1', sentAt: ts, outcome: 'pending' }],
    createdAt: ts,
    updatedAt: ts,
    closedAt: null,
    ...over,
  };
}

async function seed(t: Task, id = 't1') {
  const pm = db.doc('propertyManagers/pm1');
  await pm.set({ name: 'Andy', email: 'andy@example.com' });
  await pm.collection('units').doc('u1').set(unit);
  await pm.collection('contractors').doc('c1').set(contractor);
  await pm.collection('tasks').doc(id).set(t);
}

beforeAll(() => {
  initializeApp({ projectId: 'demo-fixedlist' });
  db = getFirestore();
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('propertyManagers'));
});

describe('getTask', () => {
  it('shows the job but hides the tenant until accepted', async () => {
    await seed(task());
    const view = await getTask(db, TOKEN);
    expect(view).toMatchObject({ title: 'Fix leaking tap', pmName: 'Andy', contractorName: 'Pat Plumber' });
    expect(view.tenant).toBeNull();
    expect(JSON.stringify(view)).not.toContain('tess@example.com');
  });

  it.each(['draft', 'closed'] as const)('rejects a %s task', async (status) => {
    await seed(task({ status }));
    await expect(getTask(db, TOKEN)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects unknown and malformed tokens', async () => {
    await seed(task());
    await expect(getTask(db, 'nope-nope-nope-nope-nope-nope')).rejects.toMatchObject({ code: 'not-found' });
    await expect(getTask(db, undefined)).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('respondToTask', () => {
  it('accepts with a date 24h+ out and reveals the tenant', async () => {
    await seed(task());
    const view = await respondToTask(db, { token: TOKEN, action: 'accept', estimatedAt: NOW + 30 * HOUR }, NOW);
    expect(view.status).toBe('accepted');
    expect(view.estimatedAt).toBe(NOW + 30 * HOUR);
    expect(view.tenant).toEqual({ name: 'Tess Tenant', phone: '510-555-0100' });
    const saved = (await db.doc('propertyManagers/pm1/tasks/t1').get()).data() as Task;
    expect(saved.assignmentHistory[0].outcome).toBe('accepted');
  });

  it('blocks entry inside 24h unless the PM allowed short notice', async () => {
    await seed(task());
    const req = { token: TOKEN, action: 'accept' as const, estimatedAt: NOW + 5 * HOUR };
    await expect(respondToTask(db, req, NOW)).rejects.toMatchObject({ code: 'invalid-argument' });
    await seed(task({ allowShortNotice: true }));
    expect((await respondToTask(db, req, NOW)).status).toBe('accepted');
  });

  it('rejects a missing or past date', async () => {
    await seed(task());
    await expect(respondToTask(db, { token: TOKEN, action: 'accept' }, NOW)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(
      respondToTask(db, { token: TOKEN, action: 'accept', estimatedAt: NOW - HOUR }, NOW),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('declines with a reason and cannot be answered twice', async () => {
    await seed(task());
    const view = await respondToTask(db, { token: TOKEN, action: 'decline', declineReason: 'Booked up' }, NOW);
    expect(view.status).toBe('declined');
    const saved = (await db.doc('propertyManagers/pm1/tasks/t1').get()).data() as Task;
    expect(saved.declineReason).toBe('Booked up');
    expect(saved.assignmentHistory[0].outcome).toBe('declined');
    await expect(
      respondToTask(db, { token: TOKEN, action: 'accept', estimatedAt: NOW + 30 * HOUR }, NOW),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('adds a new contractor to the directory when they accept an open link', async () => {
    await seed(task({ contractorId: null, assignmentHistory: [] }));
    const base = { token: TOKEN, action: 'accept' as const, estimatedAt: NOW + 30 * HOUR };
    await expect(respondToTask(db, base, NOW)).rejects.toMatchObject({ code: 'invalid-argument' });
    const view = await respondToTask(db, { ...base, contact: { name: ' Thea Thumbtack ', phone: '555' } }, NOW);
    expect(view.contractorName).toBe('Thea Thumbtack');
    expect(view.listToken).toBeTruthy();
    const added = await db.collection('propertyManagers/pm1/contractors').where('source', '==', 'self').get();
    expect(added.size).toBe(1);
  });
});

describe('getMyJobs', () => {
  it('lists open jobs, urgent first then by desired date, without private details', async () => {
    await seed(task({ title: 'Later', desiredDate: '2026-12-10' }), 't1');
    const tasks = db.collection('propertyManagers/pm1/tasks');
    await tasks.doc('t2').set(task({ title: 'Sooner', desiredDate: '2026-11-20', token: TOKEN + '2' }));
    await tasks.doc('t3').set(task({ title: 'Urgent', urgent: true, desiredDate: null, token: TOKEN + '3' }));
    await tasks.doc('t4').set(task({ title: 'Closed', status: 'closed', token: TOKEN + '4' }));
    await tasks.doc('t5').set(task({ title: 'Someone else', contractorId: 'c2', token: TOKEN + '5' }));

    const list = await getMyJobs(db, LIST_TOKEN);
    expect(list.contractorName).toBe('Pat Plumber');
    expect(list.jobs.map((j) => j.title)).toEqual(['Urgent', 'Sooner', 'Later']);
    expect(JSON.stringify(list)).not.toContain('Tess');
  });

  it('rejects an unknown list token', async () => {
    await seed(task());
    await expect(getMyJobs(db, 'x'.repeat(40))).rejects.toMatchObject({ code: 'not-found' });
  });
});
