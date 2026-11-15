import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import type { Contractor, Task, Unit } from '@shared/types';

export type WithId<T> = T & { id: string };

/** Live collection under the signed-in PM. `undefined` while loading. */
function usePmCollection<T>(pmId: string, name: string, sortField: string, dir: 'asc' | 'desc' = 'asc') {
  const [rows, setRows] = useState<WithId<T>[]>();
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'propertyManagers', pmId, name), orderBy(sortField, dir)), (snap) =>
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
      ),
    [pmId, name, sortField, dir],
  );
  return rows;
}

export const useUnits = (pmId: string) => usePmCollection<Unit>(pmId, 'units', 'label');
export const useContractors = (pmId: string) => usePmCollection<Contractor>(pmId, 'contractors', 'name');
export const useTasks = (pmId: string) => usePmCollection<Task>(pmId, 'tasks', 'createdAt', 'desc');

/** Live single document. `undefined` while loading, `null` if missing. */
export function usePmDoc<T = DocumentData>(pmId: string, name: string, id: string | undefined) {
  const [row, setRow] = useState<WithId<T> | null>();
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'propertyManagers', pmId, name, id), (snap) =>
      setRow(snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null),
    );
  }, [pmId, name, id]);
  return row;
}

export const pmCollection = (pmId: string, name: string) => collection(db, 'propertyManagers', pmId, name);
export const pmDoc = (pmId: string, name: string, id: string) => doc(db, 'propertyManagers', pmId, name, id);

export const taskLink = (token: string) => `${location.origin}/t/${token}`;
export const jobsLink = (listToken: string) => `${location.origin}/c/${listToken}`;

export function dollarsToCents(input: string): number | null {
  const n = Number(input.replace(/[$,\s]/g, ''));
  return input.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
