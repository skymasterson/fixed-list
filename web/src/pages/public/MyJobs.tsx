import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../firebase';
import { DueDate, StatusPill, UrgentTag } from '../../components/bits';
import type { MyJobs } from '@shared/types';

export function MyJobsPage() {
  const { listToken = '' } = useParams();
  const [data, setData] = useState<MyJobs>();
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyJobs({ listToken }).then(setData, (e) => setError(errorMessage(e)));
  }, [listToken]);

  if (error) {
    return (
      <main className="narrow center">
        <h1>Link not available</h1>
        <p>{error}</p>
        <p className="muted">Ask your property manager for a new My Jobs link.</p>
      </main>
    );
  }
  if (!data) return <p className="center muted">Loading…</p>;

  const urgent = data.jobs.filter((j) => j.urgent).length;
  return (
    <main className="narrow public">
      <p className="eyebrow">
        {data.contractorName} · jobs from {data.pmName}
      </p>
      <h1>My jobs</h1>
      <p className="muted">
        {data.jobs.length === 0
          ? 'No open jobs right now.'
          : `${data.jobs.length} open${urgent ? `, ${urgent} urgent` : ''}. Bookmark this page to come back any time.`}
      </p>
      <ul className="cards">
        {data.jobs.map((j) => (
          <li key={j.token}>
            <Link className="card link-card" to={`/t/${j.token}`}>
              <div className="card-main">
                <strong>{j.title}</strong>
                {j.urgent && <UrgentTag />}
                <div>{j.address}</div>
                <div className="muted">
                  <DueDate ymd={j.desiredDate} done={j.status === 'completed'} />
                </div>
              </div>
              <StatusPill status={j.status} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
