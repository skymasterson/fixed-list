import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { MyJobs, PublicTask, RespondRequest } from '@shared/types';

const env = import.meta.env;
export const useEmulators = env.VITE_USE_EMULATORS === '1';

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-fixedlist',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app);

if (useEmulators) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}

const call = <Req, Res>(name: string) => {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req) => (await fn(data)).data;
};

export const api = {
  getTask: call<{ token: string }, PublicTask>('getTaskByToken'),
  respond: call<RespondRequest, PublicTask>('respondToTaskByToken'),
  getMyJobs: call<{ listToken: string }, MyJobs>('getMyJobsByToken'),
};

/** The message a callable threw, without the "functions/…" prefix noise. */
export function errorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'functions/internal' || !e?.message) return 'Something went wrong. Please try again.';
  return e.message;
}
