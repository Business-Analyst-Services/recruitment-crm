import { label } from '@/lib/constants';

const TONE: Record<string, string> = {
  // candidate
  active: 'ok', passive: '', placed: 'accent', do_not_contact: 'danger',
  // company
  prospect: 'info', dormant: '',
  // job
  open: 'ok', on_hold: 'warn', filled: 'accent', closed: '',
  high: 'danger', medium: 'warn', low: '',
  // pipeline
  sourced: '', screened: 'info', submitted: 'info', interview: 'warn', offer: 'warn', rejected: 'danger', withdrawn: '',
  // invoice
  not_invoiced: 'warn', invoiced: 'info', paid: 'ok',
  // engagement
  retained: 'accent', exclusive: 'info', contingent: '',
};

export function Badge({ value, tone }: { value: string | null | undefined; tone?: string }) {
  if (!value) return <span className="faint">—</span>;
  return <span className={`badge ${tone ?? TONE[value] ?? ''}`}>{label(value)}</span>;
}

export function PageHead({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="row">{children}</div> : null}
    </div>
  );
}

export function Card({ title, action, children, tight }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; tight?: boolean }) {
  return (
    <section className="card">
      {title ? (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={`card-body${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Tags({ csv }: { csv: string | null | undefined }) {
  if (!csv) return <span className="faint">—</span>;
  return (
    <span>
      {csv.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
        <span key={t} className="tag">{t}</span>
      ))}
    </span>
  );
}

export function Options({ values, blank }: { values: readonly string[]; blank?: string }) {
  return (
    <>
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {values.map((v) => (
        <option key={v} value={v}>{label(v)}</option>
      ))}
    </>
  );
}
