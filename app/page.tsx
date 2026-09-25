import Link from 'next/link';
import { all, get } from '@/lib/db';
import { openTasks, recentActivity } from '@/lib/queries';
import { PIPELINE_STAGES, STAGE_LABEL } from '@/lib/constants';
import { money, moneyK, date } from '@/lib/format';
import { ActivityFeed, TaskList } from '@/components/Activity';
import { Badge, Card, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const n = (sql: string) => get<{ n: number }>(sql)?.n ?? 0;

  const openJobs = n(`SELECT COUNT(*) n FROM jobs WHERE status = 'open'`);
  const activeCands = n(`SELECT COUNT(*) n FROM candidates WHERE status IN ('active','passive')`);
  const interviews = n(`SELECT COUNT(*) n FROM activities WHERE kind = 'interview' AND done_at IS NULL
                        AND date(due_at) BETWEEN date('now') AND date('now', '+7 days')`);
  const inFlight = n(`SELECT COUNT(*) n FROM applications a JOIN jobs j ON j.id = a.job_id
                      WHERE j.status = 'open' AND a.stage IN ('submitted','interview','offer')`);
  // Australian financial year starts 1 July.
  const fyStart = (() => {
    const d = new Date();
    const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-07-01`;
  })();
  const fees = get<{ billed: number; placements: number }>(
    `SELECT COALESCE(SUM(fee_amount),0) billed, COUNT(*) placements FROM placements WHERE date(created_at) >= ?`, fyStart)!;
  const unbilled = n(`SELECT COALESCE(SUM(fee_amount),0) n FROM placements WHERE invoice_status = 'not_invoiced'`);

  const funnel = all<{ stage: string; n: number }>(
    `SELECT a.stage, COUNT(*) n FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE j.status IN ('open','on_hold') GROUP BY a.stage`);
  const funnelMap = Object.fromEntries(funnel.map((f) => [f.stage, f.n]));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));

  const hotJobs = all<{ id: number; title: string; company: string; priority: string; opened_at: string; pipeline: number; submitted: number; engagement: string }>(
    `SELECT j.id, j.title, c.name company, j.priority, j.opened_at, j.engagement,
       (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage NOT IN ('rejected','withdrawn')) pipeline,
       (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.stage IN ('submitted','interview','offer')) submitted
     FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'open'
     ORDER BY CASE j.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, j.opened_at LIMIT 8`);

  const tasks = openTasks(8);
  const recent = recentActivity(8);

  return (
    <>
      <PageHead title="Dashboard" sub={`Financial year from ${date(fyStart)}`}>
        <Link href="/candidates/new" className="btn">Add candidate</Link>
        <Link href="/jobs/new" className="btn primary">New job</Link>
      </PageHead>

      <div className="kpis">
        <div className="card kpi"><div className="kpi-label">Open jobs</div><div className="kpi-value">{openJobs}</div><div className="kpi-sub">{inFlight} candidates with clients</div></div>
        <div className="card kpi"><div className="kpi-label">Active candidates</div><div className="kpi-value">{activeCands}</div><div className="kpi-sub">active + passive</div></div>
        <div className="card kpi"><div className="kpi-label">Interviews next 7 days</div><div className="kpi-value">{interviews}</div><div className="kpi-sub">scheduled with clients</div></div>
        <div className="card kpi"><div className="kpi-label">Placements this FY</div><div className="kpi-value">{fees.placements}</div><div className="kpi-sub">{money(fees.billed)} perm fees</div></div>
        <div className="card kpi"><div className="kpi-label">Fees to invoice</div><div className="kpi-value">{moneyK(unbilled)}</div><div className="kpi-sub"><Link className="link" href="/placements">Review placements</Link></div></div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <Card title="Priority jobs" action={<Link href="/jobs" className="link small">All jobs</Link>} tight>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Role</th><th>Client</th><th>Priority</th><th className="right">Pipeline</th><th className="right">With client</th><th>Opened</th></tr></thead>
                <tbody>
                  {hotJobs.map((j) => (
                    <tr key={j.id}>
                      <td><Link className="link" href={`/jobs/${j.id}`}>{j.title}</Link> {j.engagement !== 'contingent' ? <Badge value={j.engagement} /> : null}</td>
                      <td>{j.company}</td>
                      <td><Badge value={j.priority} /></td>
                      <td className="right num">{j.pipeline}</td>
                      <td className="right num">{j.submitted}</td>
                      <td className="muted nowrap">{date(j.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Live pipeline (open jobs)" action={<Link href="/pipeline" className="link small">Open board</Link>}>
            <div className="funnel">
              {PIPELINE_STAGES.map((s) => (
                <div className="funnel-row" key={s}>
                  <span>{STAGE_LABEL[s]}</span>
                  <div className="funnel-bar"><span style={{ width: `${((funnelMap[s] ?? 0) / funnelMax) * 100}%` }} /></div>
                  <span className="num right">{funnelMap[s] ?? 0}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Due soon" action={<Link href="/activities" className="link small">All tasks</Link>} tight>
            <TaskList items={tasks} />
          </Card>
          <Card title="Recent activity" tight>
            <ActivityFeed items={recent} />
          </Card>
        </div>
      </div>
    </>
  );
}
