import { Link } from 'react-router-dom';
import { usePm } from '../auth';
import { useContractors, useTasks, type WithId } from '../data';
import { DueDate, UrgentTag } from '../components/bits';
import { PM_OPEN_STATUSES, STATUS_LABEL, type Task, type TaskStatus } from '@shared/types';

/** Order groups by how soon they need the PM. */
const GROUP_ORDER: TaskStatus[] = [
  'declined',
  'overrun_pending',
  'draft',
  'sent',
  'completed',
  'accepted',
  'scheduled',
  'access_granted',
  'in_progress',
  'paid',
];

const byUrgency = (a: Task, b: Task) =>
  Number(b.urgent) - Number(a.urgent) || (a.desiredDate ?? '9999').localeCompare(b.desiredDate ?? '9999');

export function Dashboard() {
  const { pmId } = usePm();
  const tasks = useTasks(pmId);
  const contractors = useContractors(pmId);
  const nameOf = (id: string | null) => contractors?.find((c) => c.id === id)?.name;
  const open = tasks?.filter((t) => PM_OPEN_STATUSES.includes(t.status)) ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Open tasks</h1>
        <Link className="button primary" to="/tasks/new">
          New task
        </Link>
      </div>
      {tasks && open.length === 0 && <p className="empty">Nothing open. Create a task to send a job to a contractor.</p>}
      {GROUP_ORDER.map((status) => {
        const group = open.filter((t) => t.status === status).sort(byUrgency);
        if (group.length === 0) return null;
        return (
          <section key={status} className="group">
            <h2>
              {STATUS_LABEL[status]} <span className="count">{group.length}</span>
            </h2>
            <ul className="cards">
              {group.map((t) => (
                <TaskRow key={t.id} task={t} contractor={nameOf(t.contractorId)} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function TaskRow({ task, contractor }: { task: WithId<Task>; contractor?: string }) {
  return (
    <li>
      <Link className="card link-card" to={`/tasks/${task.id}`}>
        <div className="card-main">
          <strong>{task.title}</strong>
          {task.urgent && <UrgentTag />}
          <div>{task.unitLabel}</div>
          <div className="muted">
            {contractor ?? 'No contractor yet'} · <DueDate ymd={task.desiredDate} done={task.status === 'completed' || task.status === 'paid'} />
          </div>
        </div>
      </Link>
    </li>
  );
}
