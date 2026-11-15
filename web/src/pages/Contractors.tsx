import { useState, type FormEvent } from 'react';
import { addDoc, updateDoc } from 'firebase/firestore';
import { usePm } from '../auth';
import { jobsLink, pmCollection, pmDoc, useContractors, type WithId } from '../data';
import { CopyButton, Field } from '../components/bits';
import { newToken } from '@shared/copy';
import type { Contractor, ContractorSource } from '@shared/types';

const SOURCE_LABEL: Record<ContractorSource, string> = {
  directory: 'My directory',
  thumbtack: 'Thumbtack',
  taskrabbit: 'TaskRabbit',
  self: 'Signed up from a job link',
};

type Form = Omit<Contractor, 'listToken'>;
const blank: Form = { name: '', phone: '', email: '', source: 'directory', notes: '', active: true, weeklyDigest: false };

export function Contractors() {
  const { pmId } = usePm();
  const contractors = useContractors(pmId);
  const [editing, setEditing] = useState<WithId<Contractor> | 'new' | null>(null);

  async function rotate(c: WithId<Contractor>) {
    if (!confirm(`Replace ${c.name}'s My Jobs link? The old link will stop working.`)) return;
    await updateDoc(pmDoc(pmId, 'contractors', c.id), { listToken: newToken() });
  }

  return (
    <>
      <div className="page-head">
        <h1>Contractors</h1>
        {!editing && (
          <button className="primary" onClick={() => setEditing('new')}>
            Add contractor
          </button>
        )}
      </div>
      {editing && (
        <ContractorForm
          pmId={pmId}
          contractor={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {contractors?.length === 0 && !editing && (
        <p className="empty">No contractors yet. Add one, or send a job link to someone new and they'll appear here.</p>
      )}
      <ul className="cards">
        {contractors?.map((c) => (
          <li key={c.id} className={c.active ? 'card' : 'card inactive'}>
            <div className="card-main">
              <strong>{c.name}</strong>
              {!c.active && <span className="pill">Inactive</span>}
              <div className="muted">{[c.phone, c.email, SOURCE_LABEL[c.source]].filter(Boolean).join(' · ')}</div>
              {c.notes && <div className="muted">{c.notes}</div>}
              <div className="inline-actions">
                <CopyButton className="link" text={jobsLink(c.listToken)}>
                  Copy My Jobs link
                </CopyButton>
                <button className="link" onClick={() => rotate(c)}>
                  Replace link
                </button>
              </div>
            </div>
            <button onClick={() => setEditing(c)}>Edit</button>
          </li>
        ))}
      </ul>
    </>
  );
}

function ContractorForm({
  pmId,
  contractor,
  onDone,
}: {
  pmId: string;
  contractor: WithId<Contractor> | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Form>(contractor ? { ...blank, ...contractor } : blank);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data: Form = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: form.source,
      notes: form.notes.trim(),
      active: form.active,
      weeklyDigest: form.weeklyDigest,
    };
    if (contractor) await updateDoc(pmDoc(pmId, 'contractors', contractor.id), data);
    else await addDoc(pmCollection(pmId, 'contractors'), { ...data, listToken: newToken() });
    onDone();
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{contractor ? 'Edit contractor' : 'New contractor'}</h2>
      <Field label="Name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
      </Field>
      <div className="row">
        <Field label="Mobile phone" hint="Job texts go to this number.">
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </div>
      <Field label="Found through">
        <select value={form.source} onChange={(e) => set('source', e.target.value as ContractorSource)}>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={form.weeklyDigest} onChange={(e) => set('weeklyDigest', e.target.checked)} />
        Send a weekly text summarising their open jobs
      </label>
      <label className="check">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        Active
      </label>
      <div className="actions">
        <button className="primary" disabled={saving}>
          Save contractor
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
