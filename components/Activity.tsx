import Link from 'next/link';
import { addActivity, completeActivity } from '@/lib/actions';
import type { Activity } from '@/lib/queries';
import { ACTIVITY_KINDS } from '@/lib/constants';
import { ago, dateTime, nowLocal } from '@/lib/format';
import { Empty, Options } from './ui';

const KIND_ICON: Record<string, string> = { note: '✎', call: '☎', email: '✉', meeting: '◷', interview: '★', task: '☐' };

export function ActivityFeed({ items, showLinks = true }: { items: Activity[]; showLinks?: boolean }) {
  if (!items.length) return <Empty>No activity yet.</Empty>;
  return (
    <ul className="feed">
      {items.map((a) => {
        const pending = !a.done_at && a.due_at;
        return (
          <li key={a.id}>
            <span className="icon" title={a.kind}>{KIND_ICON[a.kind] ?? '•'}</span>
            <div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{a.subject}</strong>
                <span className="meta">{pending ? `Due ${dateTime(a.due_at)}` : ago(a.done_at ?? a.created_at)}</span>
              </div>
              {a.body ? <p>{a.body}</p> : null}
              <div className="meta">
                {a.consultant_name}
                {showLinks && a.candidate_id ? <> · <Link className="link" href={`/candidates/${a.candidate_id}`}>{a.candidate_name}</Link></> : null}
                {showLinks && a.company_id ? <> · <Link className="link" href={`/clients/${a.company_id}`}>{a.company_name}</Link></> : null}
                {showLinks && a.job_id ? <> · <Link className="link" href={`/jobs/${a.job_id}`}>{a.job_title}</Link></> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TaskList({ items }: { items: Activity[] }) {
  if (!items.length) return <Empty>Nothing due. Nice.</Empty>;
  const now = nowLocal().replace('T', ' ');
  return (
    <div>
      {items.map((t) => (
        <div className="task-row" key={t.id}>
          <form action={completeActivity.bind(null, t.id)}>
            <button className="btn sm" title="Mark done" aria-label="Mark done">✓</button>
          </form>
          <div className="grow">
            <div><strong>{t.subject}</strong></div>
            <div className="small muted">
              <span className={t.due_at! < now ? 'overdue' : ''}>{t.due_at! < now ? 'Overdue · ' : ''}{dateTime(t.due_at)}</span>
              {' · '}{t.kind}
              {t.candidate_id ? <> · <Link className="link" href={`/candidates/${t.candidate_id}`}>{t.candidate_name}</Link></> : null}
              {t.job_id ? <> · <Link className="link" href={`/jobs/${t.job_id}`}>{t.job_title}</Link></> : t.company_id ? <> · <Link className="link" href={`/clients/${t.company_id}`}>{t.company_name}</Link></> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Log a call / note / task against any combination of candidate, client, job. */
export function ActivityForm({ candidateId, companyId, jobId, returnTo }: { candidateId?: number; companyId?: number; jobId?: number; returnTo: string }) {
  return (
    <form action={addActivity} className="form-grid" style={{ gridTemplateColumns: '200px 1fr' }}>
      {candidateId ? <input type="hidden" name="candidate_id" value={candidateId} /> : null}
      {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
      {jobId ? <input type="hidden" name="job_id" value={jobId} /> : null}
      <input type="hidden" name="return_to" value={returnTo} />
      <select name="kind" defaultValue="note" aria-label="Type"><Options values={ACTIVITY_KINDS} /></select>
      <input name="subject" placeholder="Subject — e.g. Screening call, chase feedback" required />
      <textarea name="body" placeholder="Notes (optional)" className="span-all" style={{ minHeight: 60 }} />
      <label className="field">Due (tasks / interviews)<input type="datetime-local" name="due_at" /></label>
      <div style={{ alignSelf: 'end', justifySelf: 'end' }}><button className="btn primary">Log activity</button></div>
    </form>
  );
}
