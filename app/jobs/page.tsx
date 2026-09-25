import Link from 'next/link';
import { all } from '@/lib/db';
import { consultants } from '@/lib/queries';
import { JOB_STATUS, JOB_TYPES } from '@/lib/constants';
import { date, daysSince, money, salaryRange } from '@/lib/format';
import { Badge, Empty, Options, PageHead } from '@/components/ui';

export const metadata = { title: 'Jobs' };
export const dynamic = 'force-dynamic';

export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'open';
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status !== 'all') { where.push('j.status = ?'); params.push(status); }
  if (sp.type) { where.push('j.job_type = ?'); params.push(sp.type); }
  if (sp.owner) { where.push('j.owner_id = ?'); params.push(Number(sp.owner)); }
  if (sp.q) { where.push('(j.title LIKE ? OR c.name LIKE ?)'); params.push(`%${sp.q}%`, `%${sp.q}%`); }

  const rows = all<{ id: number; title: string; company: string; company_id: number; job_type: string; engagement: string; status: string; priority: string;
    salary_min: number | null; salary_max: number | null; day_rate: number | null; location: string | null; opened_at: string; owner: string | null;
    active: number; submitted: number; interviews: number }>(
    `SELECT j.*, c.name company, o.name owner,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage NOT IN ('rejected','withdrawn')) active,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage IN ('submitted','interview','offer','placed')) submitted,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage IN ('interview','offer','placed')) interviews
     FROM jobs j JOIN companies c ON c.id = j.company_id LEFT JOIN consultants o ON o.id = j.owner_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE j.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, j.opened_at DESC`, ...params);

  return (
    <>
      <PageHead title="Jobs" sub="Vacancies you're working, with pipeline health at a glance.">
        <Link href="/jobs/new" className="btn primary">New job</Link>
      </PageHead>
      <form className="filters">
        <input type="search" name="q" placeholder="Search role or client…" defaultValue={sp.q ?? ''} />
        <select name="status" defaultValue={status}><Options values={JOB_STATUS} /><option value="all">All statuses</option></select>
        <select name="type" defaultValue={sp.type ?? ''}><Options values={JOB_TYPES} blank="Any type" /></select>
        <select name="owner" defaultValue={sp.owner ?? ''}>
          <option value="">Any owner</option>
          {consultants().map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn">Filter</button>
      </form>
      <div className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Role</th><th>Client</th><th>Type</th><th>Package</th><th>Priority</th><th>Status</th><th className="right">Active</th><th className="right">Sent</th><th className="right">Interviewed</th><th>Owner</th><th>Age</th></tr></thead>
              <tbody>
                {rows.map((j) => {
                  const age = daysSince(j.opened_at) ?? 0;
                  return (
                    <tr key={j.id}>
                      <td><Link className="link" href={`/jobs/${j.id}`}><strong>{j.title}</strong></Link><div className="small faint">{j.location}</div></td>
                      <td><Link className="link" href={`/clients/${j.company_id}`}>{j.company}</Link></td>
                      <td><Badge value={j.job_type} tone="" /> {j.engagement !== 'contingent' ? <Badge value={j.engagement} /> : null}</td>
                      <td className="num">{j.job_type === 'perm' ? salaryRange(j.salary_min, j.salary_max) : j.day_rate ? `${money(j.day_rate)}/d` : '—'}</td>
                      <td><Badge value={j.priority} /></td>
                      <td><Badge value={j.status} /></td>
                      <td className="right num">{j.active}</td>
                      <td className="right num">{j.submitted}</td>
                      <td className="right num">{j.interviews}</td>
                      <td className="muted">{j.owner}</td>
                      <td className={`num ${j.status === 'open' && age > 45 ? 'stale' : 'muted'}`} title={`Opened ${date(j.opened_at)}`}>{age}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No jobs match.</Empty>}
      </div>
    </>
  );
}
