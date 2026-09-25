import Link from 'next/link';
import { all } from '@/lib/db';
import { consultants } from '@/lib/queries';
import { CANDIDATE_STATUS } from '@/lib/constants';
import { ago, moneyK } from '@/lib/format';
import { Badge, Empty, Options, PageHead } from '@/components/ui';

export const metadata = { title: 'Candidates' };
export const dynamic = 'force-dynamic';

type Row = {
  id: number; first_name: string; last_name: string; current_title: string | null; current_employer: string | null;
  location: string | null; status: string; seeking: string; salary_expectation: number | null; day_rate: number | null;
  skills: string | null; owner: string | null; last_contacted_at: string | null; live: number; consent_at: string | null;
};

export default async function Candidates({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push(`(c.first_name || ' ' || c.last_name || ' ' || COALESCE(c.current_title,'') || ' ' || COALESCE(c.skills,'') || ' ' || COALESCE(c.email,'') || ' ' || COALESCE(c.current_employer,'')) LIKE ?`);
    params.push(`%${q}%`);
  }
  if (sp.status) { where.push('c.status = ?'); params.push(sp.status); }
  if (sp.seeking) { where.push(`(c.seeking = ? OR c.seeking = 'either')`); params.push(sp.seeking); }
  if (sp.owner) { where.push('c.owner_id = ?'); params.push(Number(sp.owner)); }

  const rows = all<Row>(
    `SELECT c.*, o.name owner,
       (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = c.id AND a.stage NOT IN ('rejected','withdrawn','placed')) live
     FROM candidates c LEFT JOIN consultants o ON o.id = c.owner_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.last_contacted_at DESC NULLS LAST LIMIT 500`,
    ...params,
  );
  const team = consultants();

  return (
    <>
      <PageHead title="Candidates" sub={`${rows.length} shown`}>
        <Link href="/candidates/new" className="btn primary">Add candidate</Link>
      </PageHead>
      {sp.erased ? <div className="notice">Candidate record and all linked history permanently erased.</div> : null}
      <form className="filters">
        <input type="search" name="q" placeholder="Search name, title, skills, employer…" defaultValue={q} />
        <select name="status" defaultValue={sp.status ?? ''}><Options values={CANDIDATE_STATUS} blank="Any status" /></select>
        <select name="seeking" defaultValue={sp.seeking ?? ''}><Options values={['perm', 'contract']} blank="Perm or contract" /></select>
        <select name="owner" defaultValue={sp.owner ?? ''}>
          <option value="">Any owner</option>
          {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn">Filter</button>
        {Object.keys(sp).length ? <Link href="/candidates" className="btn ghost">Clear</Link> : null}
      </form>
      <div className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Current role</th><th>Location</th><th>Seeking</th><th className="right">Expectation</th><th>Status</th><th className="right">Live</th><th>Owner</th><th>Last contact</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="link" href={`/candidates/${c.id}`}><strong>{c.first_name} {c.last_name}</strong></Link>
                      {!c.consent_at ? <span className="badge warn" style={{ marginLeft: 6 }} title="No consent recorded">No consent</span> : null}
                    </td>
                    <td>{c.current_title}<div className="small faint">{c.current_employer}</div></td>
                    <td className="muted">{c.location}</td>
                    <td><Badge value={c.seeking} tone="" /></td>
                    <td className="right num">{c.seeking === 'contract' ? (c.day_rate ? `${moneyK(c.day_rate)}/d` : '—') : moneyK(c.salary_expectation)}</td>
                    <td><Badge value={c.status} /></td>
                    <td className="right num">{c.live || ''}</td>
                    <td className="muted">{c.owner}</td>
                    <td className="muted">{ago(c.last_contacted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No candidates match.</Empty>}
      </div>
    </>
  );
}
