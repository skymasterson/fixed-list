/** Types shared by the web app and Cloud Functions. Mirrors the Firestore schema in the PRD (§8). */

/** Satisfied by both the client and admin SDK `Timestamp`. */
export interface Ts {
  toMillis(): number;
}

export const TASK_STATUSES = [
  'draft',
  'sent',
  'declined',
  'accepted',
  'scheduled',
  'access_granted',
  'in_progress',
  'overrun_pending',
  'completed',
  'paid',
  'closed',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: 'Draft',
  sent: 'Sent — awaiting reply',
  declined: 'Declined',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  access_granted: 'Access granted',
  in_progress: 'In progress',
  overrun_pending: 'Overrun requested',
  completed: 'Completed — unpaid',
  paid: 'Paid',
  closed: 'Closed',
};

/** Statuses that appear on a contractor's My Jobs list. */
export const CONTRACTOR_OPEN_STATUSES: TaskStatus[] = [
  'sent',
  'accepted',
  'scheduled',
  'access_granted',
  'in_progress',
  'overrun_pending',
  'completed',
];

/** Statuses the PM dashboard treats as open. */
export const PM_OPEN_STATUSES: TaskStatus[] = ['draft', 'declined', ...CONTRACTOR_OPEN_STATUSES, 'paid'];

/** Statuses in which the contractor can see tenant contact details. */
export const TENANT_VISIBLE_STATUSES: TaskStatus[] = [
  'accepted',
  'scheduled',
  'access_granted',
  'in_progress',
  'overrun_pending',
];

export const DEFAULT_OVERRUN_THRESHOLD_CENTS = 100_00;
export const MIN_ENTRY_NOTICE_MS = 24 * 60 * 60 * 1000;

export interface PropertyManager {
  name: string;
  email: string;
  phone?: string;
  createdAt: Ts;
  plan: 'free' | 'starter' | 'pro';
  fcmTokens: string[];
  notificationPrefs: { push: boolean; emailFallbackMinutes: number };
}

export interface Unit {
  address: string;
  label: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  iglooLockId?: string;
  notes: string;
  active: boolean;
}

export type ContractorSource = 'directory' | 'thumbtack' | 'taskrabbit' | 'self';

export interface Contractor {
  name: string;
  email: string;
  phone: string;
  source: ContractorSource;
  notes: string;
  active: boolean;
  /** Long-lived, rotatable token for the My Jobs page (/c/{listToken}). */
  listToken: string;
  weeklyDigest: boolean;
}

export interface Assignment {
  contractorId: string | null;
  sentAt: Ts;
  outcome: 'pending' | 'accepted' | 'declined' | 'reassigned';
}

export interface Task {
  unitId: string;
  /** Denormalised from the unit at creation so history survives unit edits. */
  unitAddress: string;
  unitLabel: string;
  contractorId: string | null;
  /** Magic-link token (/t/{token}). Rotated on reassignment. */
  token: string;
  status: TaskStatus;
  title: string;
  description: string;
  budgetCents: number;
  /** Overruns at or above this amount need PM approval. */
  overrunThresholdCents: number;
  urgent: boolean;
  /** YYYY-MM-DD */
  desiredDate: string | null;
  /** PM has confirmed entry with under 24h notice is OK (tenant agreed, vacant unit, emergency). */
  allowShortNotice: boolean;
  problemPhotos: string[];
  estimatedDate: Ts | null;
  acceptedAt: Ts | null;
  declinedAt: Ts | null;
  declineReason: string | null;
  sendMode: 'twilio' | 'manual' | null;
  assignmentHistory: Assignment[];
  createdAt: Ts;
  updatedAt: Ts;
  closedAt: Ts | null;
}

/* ---------- Public (magic-link) API ---------- */

export interface PublicTask {
  title: string;
  description: string;
  address: string;
  unitLabel: string;
  budgetCents: number;
  overrunThresholdCents: number;
  urgent: boolean;
  desiredDate: string | null;
  allowShortNotice: boolean;
  status: TaskStatus;
  pmName: string;
  contractorName: string | null;
  /** True when the link was sent to someone not yet in the directory. */
  needsContact: boolean;
  estimatedAt: number | null;
  /** Only present while the job is accepted and active. */
  tenant: { name: string; phone: string } | null;
  /** My Jobs token, once the contractor is known. */
  listToken: string | null;
}

export interface RespondRequest {
  token: string;
  action: 'accept' | 'decline';
  /** Epoch millis of planned arrival; required for accept. */
  estimatedAt?: number;
  declineReason?: string;
  contact?: { name?: string; email?: string; phone?: string };
}

export interface MyJobsRow {
  token: string;
  address: string;
  title: string;
  urgent: boolean;
  desiredDate: string | null;
  status: TaskStatus;
}

export interface MyJobs {
  pmName: string;
  contractorName: string;
  jobs: MyJobsRow[];
}
