import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { createContact } from '@/lib/actions';
import { activitiesFor } from '@/lib/queries';
import { date, initials, money, salaryRange } from '@/lib/format';
import { ActivityFeed, ActivityForm } from '@/components/Activity';
import { Badge, Card, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = get<{ id: number; name: string; industry: string | null; abn: string | null; website: string | null; location: string | null;
    status: string; terms_signed: number; default_fee_pct: number | null; owner: string | null; notes: string | null; created_at: string }>(
    'SELECT c.*, o.name owner FROM companies c LEFT JOIN consultants o ON o.id = c.owner_id WHERE c.id = ?', id);
  if (!c) notFound();

  const contacts = all<{ id: number; name: string; title: string | null; email: string | null; phone: string | null; is_hiring_manager: number }>(
    'SELECT * FROM contacts WHERE company_id = ? ORDER BY is_hiring_manager DESC, name', id);
  const jobs = all<{ id: number; title: string; status: string; job_type: string; salary_min: number | null; salary_max: number | null; day_rate: number | null; opened_at: string; pipeline: number }>(
    `SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage NOT IN ('rejected','withdrawn')) pipeline
     FROM jobs j WHERE j.company_id = ? ORDER BY CASE j.status WHEN 'open' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END, j.opened_at DESC`, id);
  const fees = get<{ n: number; total: number }>(
    `SELECT COUNT(*) n, COALESCE(SUM(p.fee_amount),0) total FROM placements p JOIN applications a ON a.id = p.application_id
     JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?`, id)!;

  return (
    <>
      <PageHead
        title={<span className="row" style={{ gap: 12 }}><span className="avatar">{initials(c.name)}</span>{c.name} <Badge value={c.status} /></span>}
        sub={[c.industry, c.location].filter(Boolean).join(' · ')}
      >
        <Link href={`/clients/${id}/edit`} className="btn">Edit</Link>
        <Link href={`/jobs/new?company=${id}`} className="btn primary">New job</Link>
      </PageHead>
      {!c.terms_signed ? <div className="notice warn">No signed terms of business on file — get terms signed before submitting candidates.</div> : null}

      <div className="grid-2">
        <div className="stack">
          <Card title="Jobs" tight>
            {jobs.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Role</th><th>Type</th><th>Package</th><th>Status</th><th className="right">Pipeline</th><th>Opened</th></tr></thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td><Link className="link" href={`/jobs/${j.id}`}>{j.title}</Link></td>
                        <td><Badge value={j.job_type} tone="" /></td>
                        <td className="num">{j.job_type === 'perm' ? salaryRange(j.salary_min, j.salary_max) : j.day_rate ? `${money(j.day_rate)}/d` : '—'}</td>
                        <td><Badge value={j.status} /></td>
                        <td className="right num">{j.pipeline}</td>
                        <td className="muted nowrap">{date(j.opened_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>No jobs yet.</Empty>}
          </Card>
          <Card title="Log activity"><ActivityForm companyId={id} returnTo={`/clients/${id}`} /></Card>
          <Card title="History" tight><ActivityFeed items={activitiesFor({ company: id })} /></Card>
        </div>

        <div className="stack">
          <Card title="Account">
            <dl className="dl">
              <dt>ABN</dt><dd>{c.abn ?? '—'}</dd>
              <dt>Website</dt><dd>{c.website ? <a className="link" href={c.website} target="_blank" rel="noreferrer">{c.website.replace(/^https?:\/\//, '')}</a> : '—'}</dd>
              <dt>Standard fee</dt><dd>{c.default_fee_pct ? `${c.default_fee_pct}% of base` : '—'}</dd>
              <dt>Placements</dt><dd>{fees.n} · {money(fees.total)} perm fees</dd>
              <dt>Owner</dt><dd>{c.owner ?? '—'}</dd>
              <dt>Client since</dt><dd>{date(c.created_at)}</dd>
            </dl>
            {c.notes ? <p className="muted" style={{ marginBottom: 0 }}>{c.notes}</p> : null}
          </Card>

          <Card title="Contacts" tight>
            {contacts.length ? (
              <ul className="feed">
                {contacts.map((p) => (
                  <li key={p.id}>
                    <span className="avatar sm">{initials(p.name)}</span>
                    <div>
                      <strong>{p.name}</strong> {p.is_hiring_manager ? <span className="badge accent">Hiring manager</span> : null}
                      <div className="small muted">{p.title}</div>
                      <div className="small">
                        {p.email ? <a className="link" href={`mailto:${p.email}`}>{p.email}</a> : null}
                        {p.phone ? <> · {p.phone}</> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty>No contacts yet.</Empty>}
            <details className="inline" style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
              <summary className="btn sm">+ Add contact</summary>
              <form action={createContact.bind(null, id)} className="stack" style={{ gap: 8 }}>
                <input name="name" placeholder="Full name" required />
                <input name="title" placeholder="Job title" />
                <input name="email" type="email" placeholder="Email" />
                <input name="phone" placeholder="Phone" />
                <label className="check"><input type="checkbox" name="is_hiring_manager" /> Hiring manager</label>
                <div><button className="btn primary sm">Save contact</button></div>
              </form>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
