import Link from 'next/link';
import { all } from '@/lib/db';
import { COMPANY_STATUS } from '@/lib/constants';
import { ago, money } from '@/lib/format';
import { Badge, Empty, Options, PageHead } from '@/components/ui';

export const metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function Clients({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const where: string[] = [];
  const params: string[] = [];
  if (sp.q) { where.push('(c.name LIKE ? OR c.industry LIKE ?)'); params.push(`%${sp.q}%`, `%${sp.q}%`); }
  if (sp.status) { where.push('c.status = ?'); params.push(sp.status); }
  const rows = all<{ id: number; name: string; industry: string | null; location: string | null; status: string; terms_signed: number;
    default_fee_pct: number | null; owner: string | null; open_jobs: number; fees: number; last_touch: string | null; contacts: number }>(
    `SELECT c.*, o.name owner,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status = 'open') open_jobs,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) contacts,
      (SELECT COALESCE(SUM(p.fee_amount),0) FROM placements p JOIN applications a ON a.id = p.application_id JOIN jobs j ON j.id = a.job_id WHERE j.company_id = c.id) fees,
      (SELECT MAX(COALESCE(done_at, created_at)) FROM activities WHERE company_id = c.id) last_touch
     FROM companies c LEFT JOIN consultants o ON o.id = c.owner_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY open_jobs DESC, c.name`, ...params);

  return (
    <>
      <PageHead title="Clients" sub="Companies you recruit for, and prospects you're working on.">
        <Link href="/clients/new" className="btn primary">Add client</Link>
      </PageHead>
      <form className="filters">
        <input type="search" name="q" placeholder="Search company or industry…" defaultValue={sp.q ?? ''} />
        <select name="status" defaultValue={sp.status ?? ''}><Options values={COMPANY_STATUS} blank="Any status" /></select>
        <button className="btn">Filter</button>
      </form>
      <div className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Industry</th><th>Status</th><th>Terms</th><th className="right">Fee %</th><th className="right">Open jobs</th><th className="right">Contacts</th><th className="right">Lifetime fees</th><th>Owner</th><th>Last touch</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="link" href={`/clients/${c.id}`}><strong>{c.name}</strong></Link><div className="small faint">{c.location}</div></td>
                    <td className="muted">{c.industry}</td>
                    <td><Badge value={c.status} /></td>
                    <td>{c.terms_signed ? <span className="badge ok">Signed</span> : <span className="badge warn">None</span>}</td>
                    <td className="right num">{c.default_fee_pct ?? '—'}</td>
                    <td className="right num">{c.open_jobs || ''}</td>
                    <td className="right num">{c.contacts}</td>
                    <td className="right num">{c.fees ? money(c.fees) : '—'}</td>
                    <td className="muted">{c.owner}</td>
                    <td className="muted">{ago(c.last_touch)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No clients match.</Empty>}
      </div>
    </>
  );
}
