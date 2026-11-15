import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { logOut, usePm } from '../auth';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = usePm();
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          Fixed List
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Tasks
          </NavLink>
          <NavLink to="/units">Units</NavLink>
          <NavLink to="/contractors">Contractors</NavLink>
        </nav>
        <button className="link" onClick={logOut} title={user.email ?? ''}>
          Sign out
        </button>
      </header>
      <main>{children}</main>
    </>
  );
}
