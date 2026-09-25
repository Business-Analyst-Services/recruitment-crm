import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { addToPipeline } from '@/lib/actions';
import { activitiesFor, boardCards } from '@/lib/queries';
import { date, daysSince, money, salaryRange } from '@/lib/format';
import { ActivityFeed, ActivityForm } from '@/components/Activity';
import KanbanBoard from '@/components/KanbanBoard';
import { Badge, Card, PageHead, Tags } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Job = {
  id: number; title: string; company_id: number; company: string; contact: string | null; contact_email: string | null; job_type: string;
  engagement: string; location: string | null; work_mode: string | null; salary_min: number | null; salary_max: number | null;
  day_rate: number | null; fee_pct: number | null; openings: number; status: string; priority: string; description: string | null;
  owner: string | null; opened_at: string; closed_at: string | null;
};

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const j = get<Job>(
    `SELECT j.*, c.name company, ct.name contact, ct.email contact_email, o.name owner FROM jobs j
     JOIN companies c ON c.id = j.company_id LEFT JOIN contacts ct ON ct.id = j.contact_id LEFT JOIN consultants o ON o.id = j.owner_id
     WHERE j.id = ?`, id);
  if (!j) notFound();

  const cards = boardCards({ job: id });
  const inPipeline = new Set(cards.map((c) => c.candidate_id));
  // Simple matching: rank candidates by overlap between their title/skills and the job title/description.
  const words = `${j.title} ${j.description ?? ''}`.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2);
  const pool = all<{ id: number; name: string; current_title: string | null; skills: string | null; status: string }>(
    `SELECT id, first_name || ' ' || last_name name, current_title, skills, status FROM candidates
     WHERE status IN ('active','passive') AND consent_at IS NOT NULL`);
  const suggestions = pool
    .filter((c) => !inPipeline.has(c.id))
    .map((c) => {
      const hay = `${c.current_title ?? ''} ${c.skills ?? ''}`.toLowerCase();
      return { ...c, score: words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const allCands = pool.filter((c) => !inPipeline.has(c.id));
  const fee = j.job_type === 'perm' && j.fee_pct && j.salary_max ? Math.round(((j.salary_min ?? j.salary_max) + j.salary_max) / 2 * j.fee_pct / 100) : null;

  return (
    <>
      <PageHead
        title={<span className="row" style={{ gap: 10 }}>{j.title} <Badge value={j.status} /> <Badge value={j.priority} /></span>}
        sub={<><Link className="link" href={`/clients/${j.company_id}`}>{j.company}</Link> · {j.location ?? '—'} · opened {date(j.opened_at)} ({daysSince(j.opened_at)}d)</>}
      >
        <Link href={`/jobs/${id}/edit`} className="btn">Edit job</Link>
      </PageHead>

      <Card title="Pipeline">
        <KanbanBoard cards={cards} showJob={false} />
      </Card>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack">
          <Card title="Add candidates">
            {suggestions.length ? (
              <>
                <h3 style={{ marginBottom: 8 }}>Suggested matches</h3>
                <div className="stack" style={{ gap: 6, marginBottom: 16 }}>
                  {suggestions.map((s) => (
                    <form key={s.id} action={addToPipeline} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <input type="hidden" name="candidate_id" value={s.id} />
                      <input type="hidden" name="job_id" value={id} />
                      <div style={{ minWidth: 0 }}>
                        <Link className="link" href={`/candidates/${s.id}`}><strong>{s.name}</strong></Link> <span className="muted">· {s.current_title}</span>
                        <div className="small"><Tags csv={s.skills} /></div>
                      </div>
                      <button className="btn sm">+ Add</button>
                    </form>
                  ))}
                </div>
              </>
            ) : null}
            <form action={addToPipeline} className="row">
              <input type="hidden" name="job_id" value={id} />
              <select name="candidate_id" required style={{ flex: 1, minWidth: 220 }}>
                <option value="">Any candidate…</option>
                {allCands.map((c) => <option key={c.id} value={c.id}>{c.name}{c.current_title ? ` — ${c.current_title}` : ''}</option>)}
              </select>
              <button className="btn primary">Add to pipeline</button>
            </form>
            <p className="small faint" style={{ marginBottom: 0 }}>Only candidates with recorded consent and not marked do-not-contact are listed.</p>
          </Card>
          <Card title="Log activity"><ActivityForm jobId={id} companyId={j.company_id} returnTo={`/jobs/${id}`} /></Card>
          <Card title="History" tight><ActivityFeed items={activitiesFor({ job: id })} /></Card>
        </div>
        <div className="stack">
          <Card title="Brief">
            <dl className="dl">
              <dt>Type</dt><dd><Badge value={j.job_type} tone="" /> <Badge value={j.engagement} /></dd>
              <dt>Work mode</dt><dd>{j.work_mode ?? '—'}</dd>
              <dt>Package</dt><dd>{j.job_type === 'perm' ? salaryRange(j.salary_min, j.salary_max) + ' base' : j.day_rate ? `${money(j.day_rate)}/day charge` : '—'}</dd>
              {j.job_type === 'perm' ? <><dt>Fee</dt><dd>{j.fee_pct ? `${j.fee_pct}%` : '—'}{fee ? <span className="muted"> · est. {money(fee)}</span> : null}</dd></> : null}
              <dt>Openings</dt><dd>{j.openings}</dd>
              <dt>Hiring manager</dt><dd>{j.contact ?? '—'}{j.contact_email ? <div className="small"><a className="link" href={`mailto:${j.contact_email}`}>{j.contact_email}</a></div> : null}</dd>
              <dt>Owner</dt><dd>{j.owner ?? '—'}</dd>
              {j.closed_at ? <><dt>Closed</dt><dd>{date(j.closed_at)}</dd></> : null}
            </dl>
            {j.description ? <p className="muted" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{j.description}</p> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
