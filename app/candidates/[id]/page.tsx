import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { addToPipeline, eraseCandidate, moveStageForm } from '@/lib/actions';
import { activitiesFor, openJobOptions } from '@/lib/queries';
import { ALL_STAGES } from '@/lib/constants';
import { ago, date, dateTime, initials, money } from '@/lib/format';
import { ActivityFeed, ActivityForm } from '@/components/Activity';
import { Badge, Card, Empty, Options, PageHead, Tags } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Candidate = {
  id: number; first_name: string; last_name: string; email: string | null; phone: string | null; location: string | null;
  current_title: string | null; current_employer: string | null; skills: string | null; seeking: string;
  salary_expectation: number | null; day_rate: number | null; notice_period: string | null; work_rights: string | null;
  source: string | null; status: string; owner: string | null; consent_at: string | null; consent_source: string | null;
  last_contacted_at: string | null; notes: string | null; created_at: string;
};

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = get<Candidate>(
    `SELECT c.*, o.name owner FROM candidates c LEFT JOIN consultants o ON o.id = c.owner_id WHERE c.id = ?`, id);
  if (!c) notFound();
  const name = `${c.first_name} ${c.last_name}`;

  const apps = all<{ id: number; stage: string; job_id: number; title: string; company: string; company_id: number; updated_at: string; rejection_reason: string | null }>(
    `SELECT a.id, a.stage, a.job_id, j.title, co.name company, co.id company_id, a.updated_at, a.rejection_reason
     FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies co ON co.id = j.company_id
     WHERE a.candidate_id = ? ORDER BY a.updated_at DESC`, id);
  const jobs = openJobOptions().filter((j) => !apps.some((a) => a.job_id === j.id));
  const dnc = c.status === 'do_not_contact';

  return (
    <>
      <PageHead
        title={<span className="row" style={{ gap: 12 }}><span className="avatar">{initials(name)}</span>{name} <Badge value={c.status} /></span>}
        sub={[c.current_title, c.current_employer].filter(Boolean).join(' at ') || undefined}
      >
        <Link href={`/candidates/${id}/edit`} className="btn">Edit</Link>
        <a href={`/api/candidates/${id}/export`} className="btn" title="Export everything we hold (APP 12 access request)">Export data</a>
      </PageHead>

      {dnc ? <div className="notice warn">Do not contact — this candidate has asked not to be approached.</div> : null}
      {!c.consent_at ? <div className="notice warn">No collection notice / consent recorded. Confirm before submitting this candidate to any client.</div> : null}

      <div className="grid-2">
        <div className="stack">
          <Card title="Applications" tight>
            {apps.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Job</th><th>Client</th><th>Stage</th><th>Updated</th><th>Move to</th></tr></thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id}>
                        <td><Link className="link" href={`/jobs/${a.job_id}`}>{a.title}</Link></td>
                        <td><Link className="link" href={`/clients/${a.company_id}`}>{a.company}</Link></td>
                        <td><Badge value={a.stage} />{a.rejection_reason ? <div className="small faint">{a.rejection_reason}</div> : null}</td>
                        <td className="muted">{ago(a.updated_at)}</td>
                        <td>
                          <form action={moveStageForm} className="row" style={{ flexWrap: 'nowrap' }}>
                            <input type="hidden" name="application_id" value={a.id} />
                            <select name="stage" defaultValue={a.stage} style={{ width: 'auto' }}><Options values={ALL_STAGES} /></select>
                            <button className="btn sm">Save</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>Not in any pipeline yet.</Empty>}
            {!dnc && jobs.length ? (
              <form action={addToPipeline} className="row" style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                <input type="hidden" name="candidate_id" value={id} />
                <select name="job_id" required style={{ flex: 1, minWidth: 220 }}>
                  <option value="">Add to a job…</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
                <button className="btn primary">Add to pipeline</button>
              </form>
            ) : null}
          </Card>

          <Card title="Log activity">
            <ActivityForm candidateId={id} returnTo={`/candidates/${id}`} />
          </Card>
          <Card title="History" tight>
            <ActivityFeed items={activitiesFor({ candidate: id })} />
          </Card>
        </div>

        <div className="stack">
          <Card title="Profile">
            <dl className="dl">
              <dt>Email</dt><dd>{c.email ? <a className="link" href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
              <dt>Mobile</dt><dd>{c.phone ? <a className="link" href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '—'}</dd>
              <dt>Location</dt><dd>{c.location ?? '—'}</dd>
              <dt>Work rights</dt><dd>{c.work_rights ?? '—'}</dd>
              <dt>Seeking</dt><dd><Badge value={c.seeking} tone="" /></dd>
              <dt>Salary expectation</dt><dd>{money(c.salary_expectation)}</dd>
              <dt>Day rate</dt><dd>{c.day_rate ? `${money(c.day_rate)}/day` : '—'}</dd>
              <dt>Notice</dt><dd>{c.notice_period ?? '—'}</dd>
              <dt>Skills</dt><dd><Tags csv={c.skills} /></dd>
              <dt>Source</dt><dd>{c.source ?? '—'}</dd>
              <dt>Owner</dt><dd>{c.owner ?? '—'}</dd>
              <dt>Last contact</dt><dd>{ago(c.last_contacted_at)}</dd>
              <dt>Registered</dt><dd>{date(c.created_at)}</dd>
            </dl>
            {c.notes ? <p className="muted" style={{ marginBottom: 0 }}>{c.notes}</p> : null}
          </Card>

          <Card title="Privacy">
            <dl className="dl">
              <dt>Consent</dt><dd>{c.consent_at ? <>{dateTime(c.consent_at)}<div className="small faint">{c.consent_source}</div></> : <Badge value="Not recorded" tone="warn" />}</dd>
            </dl>
            <details className="inline" style={{ marginTop: 12 }}>
              <summary className="btn danger sm">Erase candidate…</summary>
              <p className="small muted">
                Permanently deletes this candidate, their applications, placements and activity history. Use when a candidate
                asks to be removed or when the record is past your retention period (APP 11.2). This cannot be undone.
              </p>
              <form action={eraseCandidate.bind(null, id)}>
                <button className="btn danger">Yes, permanently erase {name}</button>
              </form>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
