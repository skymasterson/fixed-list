/**
 * Logic behind the unauthenticated magic-link routes (/t/{token}, /c/{listToken}).
 * Contractors never touch Firestore directly: every read and write goes through
 * these handlers, which validate the token and decide what may be seen.
 */
import { FieldValue, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import {
  CONTRACTOR_OPEN_STATUSES,
  MIN_ENTRY_NOTICE_MS,
  TENANT_VISIBLE_STATUSES,
  type Assignment,
  type Contractor,
  type MyJobs,
  type PropertyManager,
  type PublicTask,
  type RespondRequest,
  type Task,
  type Unit,
} from '../../shared/src/types';
import { newToken } from '../../shared/src/copy';

export class ApiError extends Error {
  constructor(
    public code: 'invalid-argument' | 'not-found' | 'failed-precondition',
    message: string,
  ) {
    super(message);
  }
}

const LINK_DEAD = 'This link is no longer active.';
/** Slack so a contractor who picks "exactly 24 hours from now" isn't rejected by clock skew. */
const NOTICE_SLACK_MS = 5 * 60 * 1000;

function requireToken(token: unknown): string {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    throw new ApiError('not-found', LINK_DEAD);
  }
  return token;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function findTask(db: Firestore, token: unknown): Promise<DocumentSnapshot> {
  const snap = await db.collectionGroup('tasks').where('token', '==', requireToken(token)).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new ApiError('not-found', LINK_DEAD);
  const status = (doc.data() as Task).status;
  if (status === 'draft' || status === 'closed') throw new ApiError('not-found', LINK_DEAD);
  return doc;
}

export async function getTask(db: Firestore, token: unknown): Promise<PublicTask> {
  const doc = await findTask(db, token);
  const task = doc.data() as Task;
  const pmRef = doc.ref.parent.parent!;
  const [pmSnap, unitSnap, contractorSnap] = await Promise.all([
    pmRef.get(),
    pmRef.collection('units').doc(task.unitId).get(),
    task.contractorId ? pmRef.collection('contractors').doc(task.contractorId).get() : null,
  ]);
  const pm = pmSnap.data() as PropertyManager | undefined;
  const unit = unitSnap.data() as Unit | undefined;
  const contractor = contractorSnap?.data() as Contractor | undefined;
  const showTenant = TENANT_VISIBLE_STATUSES.includes(task.status) && !!unit;

  return {
    title: task.title,
    description: task.description,
    address: task.unitAddress,
    unitLabel: task.unitLabel,
    budgetCents: task.budgetCents,
    overrunThresholdCents: task.overrunThresholdCents,
    urgent: task.urgent,
    desiredDate: task.desiredDate,
    allowShortNotice: task.allowShortNotice,
    status: task.status,
    pmName: pm?.name ?? 'Your property manager',
    contractorName: contractor?.name ?? null,
    needsContact: !task.contractorId,
    estimatedAt: task.estimatedDate ? task.estimatedDate.toMillis() : null,
    tenant: showTenant ? { name: unit!.tenantName, phone: unit!.tenantPhone } : null,
    listToken: contractor?.listToken ?? null,
  };
}

export async function respondToTask(db: Firestore, req: RespondRequest, now = Date.now()): Promise<PublicTask> {
  if (req?.action !== 'accept' && req?.action !== 'decline') {
    throw new ApiError('invalid-argument', 'Unknown response.');
  }
  const found = await findTask(db, req.token);
  const pmRef = found.ref.parent.parent!;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(found.ref);
    const task = snap.data() as Task | undefined;
    // Re-check inside the transaction: the PM may have reassigned (rotating the token) meanwhile.
    if (!task || task.token !== req.token) throw new ApiError('not-found', LINK_DEAD);
    if (task.status !== 'sent') {
      throw new ApiError('failed-precondition', 'This job has already been answered.');
    }

    const history: Assignment[] = [...(task.assignmentHistory ?? [])];
    const last = history[history.length - 1];
    const stamp = Timestamp.fromMillis(now);

    if (req.action === 'decline') {
      if (last) history[history.length - 1] = { ...last, outcome: 'declined' };
      tx.update(found.ref, {
        status: 'declined',
        declinedAt: stamp,
        declineReason: clean(req.declineReason, 500) || null,
        assignmentHistory: history,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const estimatedAt = req.estimatedAt;
    if (typeof estimatedAt !== 'number' || !Number.isFinite(estimatedAt)) {
      throw new ApiError('invalid-argument', 'Pick the date and time you plan to arrive.');
    }
    if (estimatedAt < now) {
      throw new ApiError('invalid-argument', 'That date and time has already passed.');
    }
    if (!task.allowShortNotice && estimatedAt < now + MIN_ENTRY_NOTICE_MS - NOTICE_SLACK_MS) {
      throw new ApiError(
        'invalid-argument',
        'The tenant must get 24 hours notice before entry. Pick a time at least 24 hours from now.',
      );
    }

    let contractorId = task.contractorId;
    if (!contractorId) {
      const name = clean(req.contact?.name, 120);
      if (!name) throw new ApiError('invalid-argument', 'Enter your name so we know who is taking the job.');
      const ref = pmRef.collection('contractors').doc();
      const contractor: Contractor = {
        name,
        email: clean(req.contact?.email, 200),
        phone: clean(req.contact?.phone, 40),
        source: 'self',
        notes: '',
        active: true,
        listToken: newToken(),
        weeklyDigest: false,
      };
      tx.set(ref, contractor);
      contractorId = ref.id;
    }

    if (last) history[history.length - 1] = { ...last, contractorId, outcome: 'accepted' };
    tx.update(found.ref, {
      status: 'accepted',
      contractorId,
      estimatedDate: Timestamp.fromMillis(estimatedAt),
      acceptedAt: stamp,
      assignmentHistory: history,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return getTask(db, req.token);
}

export async function getMyJobs(db: Firestore, listToken: unknown): Promise<MyJobs> {
  const snap = await db
    .collectionGroup('contractors')
    .where('listToken', '==', requireToken(listToken))
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) throw new ApiError('not-found', LINK_DEAD);
  const contractor = doc.data() as Contractor;
  const pmRef = doc.ref.parent.parent!;
  const [pmSnap, tasksSnap] = await Promise.all([
    pmRef.get(),
    pmRef.collection('tasks').where('contractorId', '==', doc.id).get(),
  ]);

  // Address, title, urgency, date and status only — tenant details and access
  // codes stay behind the per-task links.
  const jobs = tasksSnap.docs
    .map((d) => d.data() as Task)
    .filter((t) => CONTRACTOR_OPEN_STATUSES.includes(t.status))
    .map((t) => ({
      token: t.token,
      address: t.unitAddress,
      title: t.title,
      urgent: t.urgent,
      desiredDate: t.desiredDate,
      status: t.status,
    }))
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        (a.desiredDate ?? '9999').localeCompare(b.desiredDate ?? '9999') ||
        a.title.localeCompare(b.title),
    );

  return {
    pmName: (pmSnap.data() as PropertyManager | undefined)?.name ?? 'Your property manager',
    contractorName: contractor.name,
    jobs,
  };
}
