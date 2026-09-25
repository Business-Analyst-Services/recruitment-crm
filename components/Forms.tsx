import { CANDIDATE_STATUS, COMPANY_STATUS, ENGAGEMENTS, JOB_STATUS, JOB_TYPES, PRIORITIES, SOURCES } from '@/lib/constants';
import type { Consultant, Option } from '@/lib/queries';
import { Options } from './ui';

type Row = Record<string, string | number | null | undefined>;
type Action = (fd: FormData) => void | Promise<void>;

const v = (r: Row | undefined, k: string) => (r?.[k] ?? '') as string | number;

function OwnerSelect({ consultants, value }: { consultants: Consultant[]; value?: string | number | null }) {
  return (
    <label className="field">Owner
      <select name="owner_id" defaultValue={value ?? consultants[0]?.id}>
        {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}

export function CandidateForm({ action, row, consultants, submit }: { action: Action; row?: Row; consultants: Consultant[]; submit: string }) {
  return (
    <form action={action} className="form-grid">
      <div className="form-section">Person</div>
      <label className="field">First name *<input name="first_name" required defaultValue={v(row, 'first_name')} /></label>
      <label className="field">Last name *<input name="last_name" required defaultValue={v(row, 'last_name')} /></label>
      <label className="field">Email<input type="email" name="email" defaultValue={v(row, 'email')} /></label>
      <label className="field">Mobile<input name="phone" placeholder="04xx xxx xxx" defaultValue={v(row, 'phone')} /></label>
      <label className="field">Location<input name="location" placeholder="Sydney NSW" defaultValue={v(row, 'location')} /></label>
      <label className="field">Work rights<input name="work_rights" placeholder="e.g. Full work rights" defaultValue={v(row, 'work_rights')} /></label>

      <div className="form-section">Career</div>
      <label className="field">Current title<input name="current_title" defaultValue={v(row, 'current_title')} /></label>
      <label className="field">Current employer<input name="current_employer" defaultValue={v(row, 'current_employer')} /></label>
      <label className="field span-all">Skills (comma-separated)<input name="skills" placeholder="Business Analysis, Jira, SQL" defaultValue={v(row, 'skills')} /></label>
      <label className="field">Seeking
        <select name="seeking" defaultValue={v(row, 'seeking') || 'perm'}><Options values={['perm', 'contract', 'either']} /></select>
      </label>
      <label className="field">Salary expectation (AUD base)<input name="salary_expectation" inputMode="numeric" defaultValue={v(row, 'salary_expectation')} /></label>
      <label className="field">Day rate (AUD)<input name="day_rate" inputMode="numeric" defaultValue={v(row, 'day_rate')} /></label>
      <label className="field">Notice period<input name="notice_period" placeholder="4 weeks" defaultValue={v(row, 'notice_period')} /></label>

      <div className="form-section">Relationship</div>
      <label className="field">Status
        <select name="status" defaultValue={v(row, 'status') || 'active'}><Options values={CANDIDATE_STATUS} /></select>
      </label>
      <label className="field">Source
        <select name="source" defaultValue={v(row, 'source')}><Options values={SOURCES} blank="—" /></select>
      </label>
      <OwnerSelect consultants={consultants} value={row?.owner_id} />
      <label className="field span-all">Notes<textarea name="notes" defaultValue={v(row, 'notes')} /></label>
      <label className="check span-all">
        <input type="checkbox" name="consent" defaultChecked={!!row?.consent_at} disabled={!!row?.consent_at} />
        Candidate has been given our collection notice and consents to us holding their details (APP 5)
      </label>
      <div className="span-all row"><button className="btn primary">{submit}</button></div>
    </form>
  );
}

export function CompanyForm({ action, row, consultants, submit }: { action: Action; row?: Row; consultants: Consultant[]; submit: string }) {
  return (
    <form action={action} className="form-grid">
      <label className="field">Company name *<input name="name" required defaultValue={v(row, 'name')} /></label>
      <label className="field">Industry<input name="industry" defaultValue={v(row, 'industry')} /></label>
      <label className="field">ABN<input name="abn" placeholder="11 222 333 444" defaultValue={v(row, 'abn')} /></label>
      <label className="field">Website<input name="website" defaultValue={v(row, 'website')} /></label>
      <label className="field">Location<input name="location" defaultValue={v(row, 'location')} /></label>
      <label className="field">Status
        <select name="status" defaultValue={v(row, 'status') || 'prospect'}><Options values={COMPANY_STATUS} /></select>
      </label>
      <label className="field">Standard perm fee %<input name="default_fee_pct" inputMode="decimal" placeholder="18" defaultValue={v(row, 'default_fee_pct')} /></label>
      <OwnerSelect consultants={consultants} value={row?.owner_id} />
      <label className="check span-all"><input type="checkbox" name="terms_signed" defaultChecked={!!row?.terms_signed} /> Signed terms of business on file</label>
      <label className="field span-all">Notes<textarea name="notes" defaultValue={v(row, 'notes')} /></label>
      <div className="span-all row"><button className="btn primary">{submit}</button></div>
    </form>
  );
}

export function JobForm({ action, row, consultants, companies, contacts, submit }: {
  action: Action; row?: Row; consultants: Consultant[]; companies: Option[]; contacts: (Option & { company_id: number })[]; submit: string;
}) {
  return (
    <form action={action} className="form-grid">
      <label className="field">Job title *<input name="title" required defaultValue={v(row, 'title')} /></label>
      <label className="field">Client *
        <select name="company_id" required defaultValue={v(row, 'company_id')}>
          <option value="">Select…</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="field">Hiring manager
        <select name="contact_id" defaultValue={v(row, 'contact_id')}>
          <option value="">—</option>
          {companies.map((co) => {
            const cs = contacts.filter((c) => c.company_id === co.id);
            return cs.length ? (
              <optgroup key={co.id} label={co.name}>
                {cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <label className="field">Type<select name="job_type" defaultValue={v(row, 'job_type') || 'perm'}><Options values={JOB_TYPES} /></select></label>
      <label className="field">Engagement<select name="engagement" defaultValue={v(row, 'engagement') || 'contingent'}><Options values={ENGAGEMENTS} /></select></label>
      <label className="field">Location<input name="location" defaultValue={v(row, 'location')} /></label>
      <label className="field">Work mode<select name="work_mode" defaultValue={v(row, 'work_mode')}><Options values={['onsite', 'hybrid', 'remote']} blank="—" /></select></label>
      <label className="field">Salary min (AUD)<input name="salary_min" inputMode="numeric" defaultValue={v(row, 'salary_min')} /></label>
      <label className="field">Salary max (AUD)<input name="salary_max" inputMode="numeric" defaultValue={v(row, 'salary_max')} /></label>
      <label className="field">Charge rate / day (contract)<input name="day_rate" inputMode="numeric" defaultValue={v(row, 'day_rate')} /></label>
      <label className="field">Fee % (perm, blank = client default)<input name="fee_pct" inputMode="decimal" defaultValue={v(row, 'fee_pct')} /></label>
      <label className="field">Openings<input name="openings" type="number" min={1} defaultValue={v(row, 'openings') || 1} /></label>
      <label className="field">Status<select name="status" defaultValue={v(row, 'status') || 'open'}><Options values={JOB_STATUS} /></select></label>
      <label className="field">Priority<select name="priority" defaultValue={v(row, 'priority') || 'medium'}><Options values={PRIORITIES} /></select></label>
      <OwnerSelect consultants={consultants} value={row?.owner_id} />
      <label className="field span-all">Description / brief<textarea name="description" style={{ minHeight: 120 }} defaultValue={v(row, 'description')} /></label>
      <div className="span-all row"><button className="btn primary">{submit}</button></div>
    </form>
  );
}
