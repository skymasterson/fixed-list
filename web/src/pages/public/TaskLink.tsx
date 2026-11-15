import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../firebase';
import { formatDateTime } from '../../data';
import { DueDate, Field, UrgentTag } from '../../components/bits';
import { formatMoney } from '@shared/copy';
import { MIN_ENTRY_NOTICE_MS, STATUS_LABEL, type PublicTask } from '@shared/types';

/** Value for a datetime-local input, in the device's timezone. */
function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function TaskLink() {
  const { token = '' } = useParams();
  const [task, setTask] = useState<PublicTask>();
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.getTask({ token }).then(setTask, (e) => setLoadError(errorMessage(e)));
  }, [token]);

  if (loadError) {
    return (
      <main className="narrow center">
        <h1>Link not available</h1>
        <p>{loadError}</p>
        <p className="muted">If you think this is a mistake, contact the property manager who sent it.</p>
      </main>
    );
  }
  if (!task) return <p className="center muted">Loading…</p>;

  return (
    <main className="narrow public">
      <p className="eyebrow">Job from {task.pmName}</p>
      <h1>
        {task.title} {task.urgent && <UrgentTag />}
      </h1>
      <section className="panel">
        <dl className="facts">
          <dt>Where</dt>
          <dd>{task.address}</dd>
          <dt>Budget</dt>
          <dd>
            Up to {formatMoney(task.budgetCents)}
            <div className="muted">
              Check with {task.pmName} before going over by {formatMoney(task.overrunThresholdCents)} or more.
            </div>
          </dd>
          <dt>Needed</dt>
          <dd>
            <DueDate ymd={task.desiredDate} done={task.status === 'completed'} />
          </dd>
          {task.description && (
            <>
              <dt>Details</dt>
              <dd className="pre">{task.description}</dd>
            </>
          )}
        </dl>
      </section>

      {task.status === 'sent' ? (
        <Respond token={token} task={task} onDone={setTask} />
      ) : (
        <section className="panel">
          <h2>{task.status === 'declined' ? 'You declined this job' : STATUS_LABEL[task.status]}</h2>
          {task.status === 'declined' && <p>Thanks for letting us know.</p>}
          {task.estimatedAt && task.status !== 'declined' && (
            <p>
              You're booked to arrive <strong>{formatDateTime(task.estimatedAt)}</strong>. The tenant will be told
              to expect you, and you'll get an access code here before you go.
            </p>
          )}
          {task.tenant && (task.tenant.name || task.tenant.phone) && (
            <p>
              Tenant: {task.tenant.name}{' '}
              {task.tenant.phone && <a href={`tel:${task.tenant.phone}`}>{task.tenant.phone}</a>}
            </p>
          )}
        </section>
      )}

      {task.listToken && (
        <p className="center">
          <Link className="button" to={`/c/${task.listToken}`}>
            See all my open jobs
          </Link>
        </p>
      )}
    </main>
  );
}

function Respond({ token, task, onDone }: { token: string; task: PublicTask; onDone: (t: PublicTask) => void }) {
  const earliest = Date.now() + (task.allowShortNotice ? 0 : MIN_ENTRY_NOTICE_MS);
  const [when, setWhen] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e: FormEvent, action: 'accept' | 'decline') {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(
        await api.respond({
          token,
          action,
          estimatedAt: action === 'accept' ? new Date(when).getTime() : undefined,
          declineReason: reason,
          contact: { name, phone, email },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (declining) {
    return (
      <form className="panel form" onSubmit={(e) => send(e, 'decline')}>
        <h2>Decline this job</h2>
        <Field label="Reason (optional)">
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="primary" disabled={busy}>
            Confirm decline
          </button>
          <button type="button" onClick={() => setDeclining(false)}>
            Back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="panel form" onSubmit={(e) => send(e, 'accept')}>
      <h2>{task.contractorName ? `${task.contractorName}, can you do it?` : 'Can you do it?'}</h2>
      {task.needsContact && (
        <>
          <Field label="Your name">
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </Field>
          <div className="row">
            <Field label="Mobile phone">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
          </div>
        </>
      )}
      <Field
        label="When will you arrive?"
        hint={
          task.allowShortNotice
            ? undefined
            : 'The tenant must get 24 hours notice, so the earliest is this time tomorrow.'
        }
      >
        <input
          type="datetime-local"
          value={when}
          min={toLocalInput(earliest)}
          onChange={(e) => setWhen(e.target.value)}
          required
        />
      </Field>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={busy}>
          Yes, I'll do it
        </button>
        <button type="button" onClick={() => setDeclining(true)}>
          I can't
        </button>
      </div>
    </form>
  );
}
