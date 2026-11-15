import { useState, type FormEvent } from 'react';
import { addDoc, updateDoc } from 'firebase/firestore';
import { usePm } from '../auth';
import { pmCollection, pmDoc, useUnits, type WithId } from '../data';
import { Field } from '../components/bits';
import type { Unit } from '@shared/types';

const blank: Unit = {
  label: '',
  address: '',
  tenantName: '',
  tenantPhone: '',
  tenantEmail: '',
  notes: '',
  active: true,
};

export function Units() {
  const { pmId } = usePm();
  const units = useUnits(pmId);
  const [editing, setEditing] = useState<WithId<Unit> | 'new' | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Units</h1>
        {!editing && (
          <button className="primary" onClick={() => setEditing('new')}>
            Add unit
          </button>
        )}
      </div>
      {editing && (
        <UnitForm pmId={pmId} unit={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      )}
      {units?.length === 0 && !editing && <p className="empty">No units yet. Add your first rental unit.</p>}
      <ul className="cards">
        {units?.map((u) => (
          <li key={u.id} className={u.active ? 'card' : 'card inactive'}>
            <div className="card-main">
              <strong>{u.label}</strong>
              {!u.active && <span className="pill">Inactive</span>}
              <div>{u.address}</div>
              <div className="muted">
                {[u.tenantName || 'No tenant on file', u.tenantPhone, u.tenantEmail].filter(Boolean).join(' · ')}
              </div>
              {u.notes && <div className="muted">{u.notes}</div>}
            </div>
            <button onClick={() => setEditing(u)}>Edit</button>
          </li>
        ))}
      </ul>
    </>
  );
}

function UnitForm({ pmId, unit, onDone }: { pmId: string; unit: WithId<Unit> | null; onDone: () => void }) {
  const [form, setForm] = useState<Unit>(unit ? { ...blank, ...unit } : blank);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Unit>(key: K, value: Unit[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { label, address, tenantName, tenantPhone, tenantEmail, notes, active } = form;
    const data = {
      label: label.trim() || address.trim(),
      address: address.trim(),
      tenantName: tenantName.trim(),
      tenantPhone: tenantPhone.trim(),
      tenantEmail: tenantEmail.trim(),
      notes: notes.trim(),
      active,
    };
    if (unit) await updateDoc(pmDoc(pmId, 'units', unit.id), data);
    else await addDoc(pmCollection(pmId, 'units'), data);
    onDone();
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{unit ? 'Edit unit' : 'New unit'}</h2>
      <Field label="Address">
        <input value={form.address} onChange={(e) => set('address', e.target.value)} required autoFocus />
      </Field>
      <Field label="Short name" hint="How you refer to it, e.g. “Oak St #2”. Defaults to the address.">
        <input value={form.label} onChange={(e) => set('label', e.target.value)} />
      </Field>
      <div className="row">
        <Field label="Tenant name">
          <input value={form.tenantName} onChange={(e) => set('tenantName', e.target.value)} />
        </Field>
        <Field label="Tenant phone">
          <input type="tel" value={form.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} />
        </Field>
      </div>
      <Field label="Tenant email" hint="Entry notices are sent here.">
        <input type="email" value={form.tenantEmail} onChange={(e) => set('tenantEmail', e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        Active
      </label>
      <div className="actions">
        <button className="primary" disabled={saving}>
          Save unit
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
