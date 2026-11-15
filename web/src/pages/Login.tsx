import { useState } from 'react';
import { signIn } from '../auth';

export function Login() {
  const [error, setError] = useState('');
  return (
    <main className="narrow center login">
      <img src="/icon.svg" alt="" width={72} height={72} />
      <h1>Fixed List</h1>
      <p className="muted">Maintenance jobs for your rental units, from request to paid invoice.</p>
      <button
        className="primary"
        onClick={() => signIn().catch(() => setError('Sign-in was cancelled or failed. Try again.'))}
      >
        Sign in with Google
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
