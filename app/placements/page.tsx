import Link from 'next/link';
import { all } from '@/lib/db';
import { updatePlacement } from '@/lib/actions';
import { INVOICE_STATUS } from '@/lib/constants';
import { date, money } from '@/lib/format';
import { Badge, Card, Empty, Options, PageHead } from '@/components/ui';

export const metadata = { title: 'Placements' };
export const dynamic = 'force-dynamic';

type P = {
  id: number; start_date: string | null; base_salary: number | null; fee_pct: number | null; fee_amount: number | null;
  pay_rate: number | null; charge_rate: number | null; end_date: string | null; guarantee_days: number; invoice_status: string;
  created_at: string; candidate_id: number; candidate: string; job_id: number; title: string; job_type: string; company: string; company_id: number;
};

export default function Placements() {
  const rows = all<P>(
    `SELECT p.*, ca.id candidate_id, ca.first_name || ' ' || ca.last_name candidate, j.id job_id, j.title, j.job_type, co.name company, co.id company_id
     FROM placements p JOIN applications a ON a.id = p.application_id JOIN candidates ca ON ca.id = a.candidate_id
     JOIN jobs j ON j.id = a.job_id JOIN companies co ON co.id = j.company_id ORDER BY p.created_at DESC`);

  const perm = rows.filter((r) => r.job_type === 'perm');
  const contract = rows.filter((r) => r.job_type !== 'perm');
  const total = (s: string) => perm.filter((r) => r.invoice_status === s).reduce((a, r) => a + (r.fee_amount ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const inGuarantee = (r: P) => {
    if (!r.start_date) return false;
    const end = new Date(new Date(r.start_date).getTime() + r.guarantee_days * 86400000).toISOString().slice(0, 10);
    return r.start_date <= today && today <= end;
  };
  const weeklyMargin = contract.reduce((a, r) => a + ((r.charge_rate ?? 0) - (r.pay_rate ?? 0)) * 5, 0);

  return (
    <>
      <PageHead title="Placements" sub="Revenue from perm fees and contractor margin. Amounts ex GST." />
      <div className="kpis">
        <div className="card kpi"><div className="kpi-label">To invoice</div><div className="kpi-value">{money(total('not_invoiced'))}</div></div>
        <div className="card kpi"><div className="kpi-label">Invoiced, unpaid</div><div className="kpi-value">{money(total('invoiced'))}</div></div>
        <div className="card kpi"><div className="kpi-label">Paid</div><div className="kpi-value">{money(total('paid'))}</div></div>
        <div className="card kpi"><div className="kpi-label">Contractor margin / week</div><div className="kpi-value">{money(weeklyMargin)}</div><div className="kpi-sub">{contract.length} contractors</div></div>
      </div>

      <div className="stack">
        <Card title="Permanent placements" tight>
          {perm.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Candidate</th><th>Role · Client</th><th>Start</th><th className="right">Base</th><th className="right">Fee %</th><th className="right">Fee</th><th>Invoice</th><th>Guarantee</th><th /></tr></thead>
                <tbody>
                  {perm.map((r) => (
                    <tr key={r.id}>
                      <td><Link className="link" href={`/candidates/${r.candidate_id}`}>{r.candidate}</Link></td>
                      <td><Link className="link" href={`/jobs/${r.job_id}`}>{r.title}</Link><div className="small faint">{r.company}</div></td>
                      <td>{date(r.start_date)}</td>
                      <td className="right num">{money(r.base_salary)}</td>
                      <td className="right num">{r.fee_pct ?? '—'}</td>
                      <td className="right num"><strong>{money(r.fee_amount)}</strong></td>
                      <td><Badge value={r.invoice_status} /></td>
                      <td>{inGuarantee(r) ? <span className="badge warn">{r.guarantee_days}d active</span> : <span className="faint small">{r.guarantee_days}d</span>}</td>
                      <td><EditPlacement r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No perm placements yet.</Empty>}
        </Card>

        <Card title="Contractors on assignment" tight>
          {contract.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Contractor</th><th>Role · Client</th><th>Start</th><th>End</th><th className="right">Pay / day</th><th className="right">Charge / day</th><th className="right">Margin</th><th>Invoice</th><th /></tr></thead>
                <tbody>
                  {contract.map((r) => {
                    const margin = (r.charge_rate ?? 0) - (r.pay_rate ?? 0);
                    return (
                      <tr key={r.id}>
                        <td><Link className="link" href={`/candidates/${r.candidate_id}`}>{r.candidate}</Link></td>
                        <td><Link className="link" href={`/jobs/${r.job_id}`}>{r.title}</Link><div className="small faint">{r.company}</div></td>
                        <td>{date(r.start_date)}</td>
                        <td>{date(r.end_date)}</td>
                        <td className="right num">{money(r.pay_rate)}</td>
                        <td className="right num">{money(r.charge_rate)}</td>
                        <td className="right num"><strong>{money(margin)}</strong>{r.charge_rate ? <div className="small faint">{Math.round((margin / r.charge_rate) * 100)}%</div> : null}</td>
                        <td><Badge value={r.invoice_status} /></td>
                        <td><EditPlacement r={r} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty>No contractors on assignment.</Empty>}
        </Card>
      </div>
    </>
  );
}

function EditPlacement({ r }: { r: P }) {
  const perm = r.job_type === 'perm';
  return (
    <details className="inline">
      <summary className="btn sm">Edit</summary>
      <form action={updatePlacement.bind(null, r.id)} className="stack" style={{ gap: 8, minWidth: 220 }}>
        <label className="field">Start date<input type="date" name="start_date" defaultValue={r.start_date ?? ''} /></label>
        {perm ? (
          <>
            <label className="field">Base salary<input name="base_salary" inputMode="numeric" defaultValue={r.base_salary ?? ''} /></label>
            <label className="field">Fee %<input name="fee_pct" inputMode="decimal" defaultValue={r.fee_pct ?? ''} /></label>
            <label className="field">Fee (blank = base × %)<input name="fee_amount" inputMode="numeric" defaultValue={r.fee_amount ?? ''} /></label>
          </>
        ) : (
          <>
            <label className="field">Pay rate / day<input name="pay_rate" inputMode="numeric" defaultValue={r.pay_rate ?? ''} /></label>
            <label className="field">Charge rate / day<input name="charge_rate" inputMode="numeric" defaultValue={r.charge_rate ?? ''} /></label>
            <label className="field">End date<input type="date" name="end_date" defaultValue={r.end_date ?? ''} /></label>
          </>
        )}
        <label className="field">Guarantee (days)<input name="guarantee_days" type="number" defaultValue={r.guarantee_days} /></label>
        <label className="field">Invoice status<select name="invoice_status" defaultValue={r.invoice_status}><Options values={INVOICE_STATUS} /></select></label>
        <button className="btn primary sm">Save</button>
      </form>
    </details>
  );
}
