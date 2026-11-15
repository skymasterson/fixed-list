import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { usePm } from '../auth';
import { formatDateTime, pmDoc, taskLink, useContractors, usePmDoc, type WithId } from '../data';
import { CopyButton, DueDate, Field, StatusPill, UrgentTag } from '../components/bits';
import { formatMoney, newToken, taskSmsBody } from '@shared/copy';
import type { Assignment, Task } from '@shared/types';

const OUTCOME_LABEL: Record<Assignment['outcome'], string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  declined: 'Declined',
  reassigned: 'Withdrawn',
};

export function TaskDetail() {
  const { pmId } = usePm();
  const { taskId } = useParams();
  const task = usePmDoc<Task>(pmId, 'tasks', taskId);
  const contractors = useContractors(pmId);

  if (task === undefined) return <p className="muted">Loading…</p>;
  if (task === null) return <p className="empty">This task doesn't exist.</p>;

  const ref = pmDoc(pmId, 'tasks', task.id);
  const save = (data: Partial<Task> | Record<string, unknown>) =>
    updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  const nameOf = (id: string | null) =>
    id ? (contractors?.find((c) => c.id === id)?.name ?? 'Unknown contractor') : 'New contractor (open link)';
  const done = ['completed', 'paid', 'closed'].includes(task.status);

  return (
    <>
      <p>
        <Link to="/">← All tasks</Link>
      </p>
      <div className="page-head">
        <h1>
          {task.title} {task.urgent && <UrgentTag />}
        </h1>
        <StatusPill status={task.status} />
      </div>

      <section className="panel">
        <dl className="facts">
          <dt>Unit</dt>
          <dd>
            {task.unitLabel}
            <div className="muted">{task.unitAddress}</div>
          </dd>
          <dt>Contractor</dt>
          <dd>{nameOf(task.contractorId)}</dd>
          <dt>Budget</dt>
          <dd>
            {formatMoney(task.budgetCents)}
            <div className="muted">Approval needed to go over by {formatMoney(task.overrunThresholdCents)} or more</div>
          </dd>
          <dt>Wanted</dt>
          <dd>
            <DueDate ymd={task.desiredDate} done={done} />
          </dd>
          {task.estimatedDate && (
            <>
              <dt>Arriving</dt>
              <dd>{formatDateTime(task.estimatedDate.toMillis())}</dd>
            </>
          )}
          {task.description && (
            <>
              <dt>Details</dt>
              <dd className="pre">{task.description}</dd>
            </>
          )}
        </dl>
        {task.status !== 'closed' && (
          <div className="row tight">
            <Field label="Desired completion date">
              <input
                type="date"
                value={task.desiredDate ?? ''}
                onChange={(e) => save({ desiredDate: e.target.value || null })}
              />
            </Field>
            <label className="check">
              <input type="checkbox" checked={task.urgent} onChange={(e) => save({ urgent: e.target.checked })} />
              Urgent
            </label>
          </div>
        )}
      </section>

      {task.status === 'declined' && (
        <section className="panel alert">
          <h2>{nameOf(task.contractorId)} declined</h2>
          {task.declineReason && <p>“{task.declineReason}”</p>}
          <p className="muted">Pick someone else below to send it again.</p>
        </section>
      )}

      {(task.status === 'draft' || task.status === 'sent') && <SendPanel task={task} save={save} />}

      {['draft', 'sent', 'declined'].includes(task.status) && (
        <Reassign task={task} save={save} contractors={contractors ?? []} />
      )}

      {task.assignmentHistory.length > 0 && (
        <section className="panel">
          <h2>Assignment history</h2>
          <ul className="history">
            {task.assignmentHistory.map((a, i) => (
              <li key={i}>
                <span>{nameOf(a.contractorId)}</span>
                <span className="muted">
                  Sent {formatDateTime(a.sentAt.toMillis())} · {OUTCOME_LABEL[a.outcome]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {task.status !== 'closed' && (
        <p>
          <button
            className="link danger"
            onClick={() => {
              if (confirm('Close this task? The contractor link will stop working.')) {
                void save({ status: 'closed', closedAt: serverTimestamp() });
              }
            }}
          >
            Close task
          </button>
        </p>
      )}
    </>
  );
}

type Save = (data: Record<string, unknown>) => Promise<void>;

function SendPanel({ task, save }: { task: WithId<Task>; save: Save }) {
  const link = taskLink(task.token);
  const message = taskSmsBody({ ...task, address: task.unitAddress, link });

  // Copying is how a manual send happens, so it moves a draft to Sent.
  const markSent = () => {
    if (task.status !== 'draft') return;
    void save({
      status: 'sent',
      sendMode: 'manual',
      assignmentHistory: [
        ...task.assignmentHistory,
        { contractorId: task.contractorId, sentAt: Timestamp.now(), outcome: 'pending' },
      ],
    });
  };

  return (
    <section className="panel">
      <h2>{task.status === 'draft' ? 'Send to contractor' : 'Send again'}</h2>
      <p className="message">{message}</p>
      <div className="actions">
        <CopyButton className="primary" text={message} onCopied={markSent}>
          Copy message
        </CopyButton>
        <CopyButton text={link} onCopied={markSent}>
          Copy link only
        </CopyButton>
      </div>
      {task.status === 'draft' && (
        <p className="muted">Paste it into a text or chat. Copying marks the task as sent.</p>
      )}
    </section>
  );
}

function Reassign({
  task,
  save,
  contractors,
}: {
  task: WithId<Task>;
  save: Save;
  contractors: { id: string; name: string; active: boolean }[];
}) {
  const [next, setNext] = useState(task.contractorId ?? '');
  const changed = next !== (task.contractorId ?? '');
  const mustChange = task.status === 'declined';

  async function reassign() {
    // A new token kills the previous contractor's link.
    const history = task.assignmentHistory.map((a, i, all) =>
      i === all.length - 1 && a.outcome === 'pending' ? { ...a, outcome: 'reassigned' as const } : a,
    );
    await save({
      contractorId: next || null,
      token: newToken(),
      status: 'draft',
      declinedAt: null,
      declineReason: null,
      assignmentHistory: history,
    });
  }

  return (
    <section className="panel">
      <h2>{mustChange ? 'Send to someone else' : 'Change contractor'}</h2>
      <div className="row tight">
        <Field label="Contractor">
          <select value={next} onChange={(e) => setNext(e.target.value)}>
            <option value="">Not in my directory yet</option>
            {contractors
              .filter((c) => c.active || c.id === task.contractorId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <button disabled={!changed && !mustChange} onClick={reassign}>
          {task.status === 'sent' ? 'Withdraw and reassign' : 'Reassign'}
        </button>
      </div>
      {task.status === 'sent' && <p className="muted">The link already sent will stop working.</p>}
    </section>
  );
}
