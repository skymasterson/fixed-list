import { useState, type ReactNode } from 'react';
import { STATUS_LABEL, type TaskStatus } from '@shared/types';
import { formatDay, todayYmd } from '@shared/copy';

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`pill s-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function UrgentTag() {
  return <span className="pill urgent">Urgent</span>;
}

/** Desired date, flagged when it has passed and the work isn't done. */
export function DueDate({ ymd, done }: { ymd: string | null; done?: boolean }) {
  if (!ymd) return <span className="muted">No date set</span>;
  const overdue = !done && ymd < todayYmd();
  return (
    <span className={overdue ? 'overdue' : undefined}>
      {overdue ? 'Overdue · ' : 'By '}
      {formatDay(ymd)}
    </span>
  );
}

export function CopyButton({
  text,
  children,
  onCopied,
  className,
}: {
  text: string;
  children: ReactNode;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied' : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
