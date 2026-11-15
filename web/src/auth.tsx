import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, useEmulators } from './firebase';

type State =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'denied'; user: User }
  | { status: 'ready'; user: User; pmId: string };

const Ctx = createContext<State>({ status: 'loading' });

/** Creates the PM's profile on first sign-in. Fails if the account is not on the allow-list. */
async function ensureProfile(user: User) {
  const ref = doc(db, 'propertyManagers', user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, {
    name: user.displayName ?? user.email ?? 'Property manager',
    email: user.email ?? '',
    createdAt: serverTimestamp(),
    plan: 'free',
    fcmTokens: [],
    notificationPrefs: { push: true, emailFallbackMinutes: 120 },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setState({ status: 'signedOut' });
        try {
          await ensureProfile(user);
          setState({ status: 'ready', user, pmId: user.uid });
        } catch {
          setState({ status: 'denied', user });
        }
      }),
    [],
  );

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuthState = () => useContext(Ctx);

/** For pages behind the sign-in gate. */
export function usePm(): { user: User; pmId: string } {
  const s = useContext(Ctx);
  if (s.status !== 'ready') throw new Error('usePm outside the signed-in area');
  return s;
}

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logOut = () => signOut(auth);

// Emulator only: sign in as a fake Google account without the popup, for automated
// tests. The Auth emulator accepts unsigned tokens; the real service rejects them.
if (useEmulators) {
  (window as unknown as Record<string, unknown>).__devSignIn = (email: string, name = email) =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })),
    );
}
