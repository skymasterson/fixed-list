import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { usePm } from '../auth';
import { dollarsToCents, pmCollection, useContractors, useUnits } from '../data';
import { Field } from '../components/bits';
import { newToken } from '@shared/copy';
import { DEFAULT_OVERRUN_THRESHOLD_CENTS, type Task } from '@shared/types';

export function TaskNew() {
  const { pmId } = usePm();
  const navigate = useNavigate();
  const units = useUnits(pmId)?.filter((u) => u.active);
  const contractors = useContractors(pmId)?.filter((c) => c.active);

  const [unitId, setUnitId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [threshold, setThreshold] = useState(String(DEFAULT_OVERRUN_THRESHOLD_CENTS / 100));
  const [urgent, setUrgent] = useState(false);
  const [desiredDate, setDesiredDate] = useState('');
  const [allowShortNotice, setAllowShortNotice] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const unit = units?.find((u) => u.id === unitId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const budgetCents = dollarsToCents(budget);
    const overrunThresholdCents = dollarsToCents(threshold);
    if (!unit) return setError('Choose a unit.');
    if (budgetCents === null) return setError('Enter the budget as a dollar amount.');
    if (overrunThresholdCents === null) return setError('Enter the overrun limit as a dollar amount.');
    setSaving(true);
    const task: Omit<Task, 'createdAt' | 'updatedAt'> = {
      unitId: unit.id,
      unitAddress: unit.address,
      unitLabel: unit.label,
      contractorId: contractorId || null,
      token: newToken(),
      status: 'draft',
      title: title.trim(),
      description: description.trim(),
      budgetCents,
      overrunThresholdCents,
      urgent,
      desiredDate: desiredDate || null,
      allowShortNotice,
      problemPhotos: [],
      estimatedDate: null,
      acceptedAt: null,
      declinedAt: null,
      declineReason: null,
      sendMode: null,
      assignmentHistory: [],
      closedAt: null,
    };
    const ref = await addDoc(pmCollection(pmId, 'tasks'), {
      ...task,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/tasks/${ref.id}`, { replace: true });
  }

  if (units && units.length === 0) {
    return (
      <p className="empty">
        Add a unit before creating a task. <Link to="/units">Go to Units</Link>
      </p>
    );
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h1>New task</h1>
      <Field label="Unit">
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
          <option value="">Choose a unit…</option>
          {units?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>
      {unit && (
        <p className="autofill">
          {unit.address}
          <br />
          <span className="muted">
            Tenant: {[unit.tenantName || 'none on file', unit.tenantPhone, unit.tenantEmail].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
      <Field label="Task">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Fix leaking kitchen tap"
          maxLength={80}
          required
        />
      </Field>
      <Field label="Details for the contractor">
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="row">
        <Field label="Budget ceiling ($)">
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} required />
        </Field>
        <Field label="Ask me before going over by ($)">
          <input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
        </Field>
      </div>
      <div className="row">
        <Field label="Desired completion date">
          <input type="date" value={desiredDate} onChange={(e) => setDesiredDate(e.target.value)} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          Urgent
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={allowShortNotice} onChange={(e) => setAllowShortNotice(e.target.checked)} />
        Allow entry with less than 24 hours notice (tenant has agreed, unit is vacant, or it's an emergency)
      </label>
      <Field
        label="Contractor"
        hint="Leave unassigned to paste the link to someone new, e.g. in a Thumbtack or TaskRabbit chat."
      >
        <select value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
          <option value="">Not in my directory yet</option>
          {contractors?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={saving}>
          Create task and get link
        </button>
        <Link className="button" to="/">
          Cancel
        </Link>
      </div>
    </form>
  );
}
