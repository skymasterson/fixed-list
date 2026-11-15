import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, logOut, useAuthState } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Units } from './pages/Units';
import { Contractors } from './pages/Contractors';
import { TaskNew } from './pages/TaskNew';
import { TaskDetail } from './pages/TaskDetail';
import { TaskLink } from './pages/public/TaskLink';
import { MyJobsPage } from './pages/public/MyJobs';

function Admin() {
  const state = useAuthState();
  if (state.status === 'loading') return <p className="center muted">Loading…</p>;
  if (state.status === 'signedOut') return <Login />;
  if (state.status === 'denied') {
    return (
      <main className="narrow center">
        <h1>Not authorized</h1>
        <p>
          {state.user.email} isn't set up as a property manager on Fixed List. Sign in with a different Google
          account.
        </p>
        <button onClick={logOut}>Sign out</button>
      </main>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/units" element={<Units />} />
        <Route path="/contractors" element={<Contractors />} />
        <Route path="/tasks/new" element={<TaskNew />} />
        <Route path="/tasks/:taskId" element={<TaskDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      {/* Contractor pages: no sign-in, no admin chrome. */}
      <Route path="/t/:token" element={<TaskLink />} />
      <Route path="/c/:listToken" element={<MyJobsPage />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <Admin />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
