'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { get, run, tx } from './db';
import { ALL_STAGES } from './constants';

// Until authentication is added, all actions are attributed to consultant #1.
const CURRENT_CONSULTANT_ID = 1;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const need = (v: string | null, field: string) => {
  if (!v) throw new Error(`${field} is required`);
  return v;
};
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// Candidates ------------------------------------------------------------------

const candidateFields = (fd: FormData) =>
  [
    need(str(fd, 'first_name'), 'First name'),
    need(str(fd, 'last_name'), 'Last name'),
    str(fd, 'email'),
    str(fd, 'phone'),
    str(fd, 'location'),
    str(fd, 'current_title'),
    str(fd, 'current_employer'),
    str(fd, 'skills'),
    str(fd, 'seeking') ?? 'perm',
    num(fd, 'salary_expectation'),
    num(fd, 'day_rate'),
    str(fd, 'notice_period'),
    str(fd, 'work_rights'),
    str(fd, 'source'),
    str(fd, 'status') ?? 'active',
    num(fd, 'owner_id'),
    str(fd, 'notes'),
  ] as const;

export async function createCandidate(fd: FormData) {
  const consent = fd.get('consent') === 'on';
  const { id } = run(
    `INSERT INTO candidates (first_name, last_name, email, phone, location, current_title, current_employer, skills,
      seeking, salary_expectation, day_rate, notice_period, work_rights, source, status, owner_id, notes, consent_at, consent_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...candidateFields(fd),
    consent ? now() : null,
    consent ? 'Recorded by consultant' : null,
  );
  revalidatePath('/candidates');
  redirect(`/candidates/${id}`);
}

export async function updateCandidate(id: number, fd: FormData) {
  run(
    `UPDATE candidates SET first_name=?, last_name=?, email=?, phone=?, location=?, current_title=?, current_employer=?,
      skills=?, seeking=?, salary_expectation=?, day_rate=?, notice_period=?, work_rights=?, source=?, status=?, owner_id=?, notes=?
     WHERE id=?`,
    ...candidateFields(fd),
    id,
  );
  if (fd.get('consent') === 'on') {
    run(`UPDATE candidates SET consent_at = COALESCE(consent_at, ?), consent_source = COALESCE(consent_source, 'Recorded by consultant') WHERE id = ?`, now(), id);
  }
  revalidatePath(`/candidates/${id}`);
  redirect(`/candidates/${id}`);
}

/** Privacy: permanently remove a candidate and everything linked to them. */
export async function eraseCandidate(id: number) {
  run('DELETE FROM candidates WHERE id = ?', id);
  revalidatePath('/candidates');
  redirect('/candidates?erased=1');
}

// Companies & contacts -----------------------------------------------------------

const companyFields = (fd: FormData) =>
  [
    need(str(fd, 'name'), 'Company name'),
    str(fd, 'industry'),
    str(fd, 'abn'),
    str(fd, 'website'),
    str(fd, 'location'),
    str(fd, 'status') ?? 'prospect',
    fd.get('terms_signed') === 'on' ? 1 : 0,
    num(fd, 'default_fee_pct'),
    num(fd, 'owner_id'),
    str(fd, 'notes'),
  ] as const;

export async function createCompany(fd: FormData) {
  const { id } = run(
    `INSERT INTO companies (name, industry, abn, website, location, status, terms_signed, default_fee_pct, owner_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...companyFields(fd),
  );
  revalidatePath('/clients');
  redirect(`/clients/${id}`);
}

export async function updateCompany(id: number, fd: FormData) {
  run(
    `UPDATE companies SET name=?, industry=?, abn=?, website=?, location=?, status=?, terms_signed=?, default_fee_pct=?, owner_id=?, notes=?
     WHERE id=?`,
    ...companyFields(fd),
    id,
  );
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function createContact(companyId: number, fd: FormData) {
  run(
    `INSERT INTO contacts (company_id, name, title, email, phone, is_hiring_manager) VALUES (?, ?, ?, ?, ?, ?)`,
    companyId,
    need(str(fd, 'name'), 'Name'),
    str(fd, 'title'),
    str(fd, 'email'),
    str(fd, 'phone'),
    fd.get('is_hiring_manager') === 'on' ? 1 : 0,
  );
  revalidatePath(`/clients/${companyId}`);
}

// Jobs -------------------------------------------------------------------------

const jobFields = (fd: FormData) =>
  [
    num(fd, 'company_id'),
    num(fd, 'contact_id'),
    need(str(fd, 'title'), 'Job title'),
    str(fd, 'job_type') ?? 'perm',
    str(fd, 'engagement') ?? 'contingent',
    str(fd, 'location'),
    str(fd, 'work_mode'),
    num(fd, 'salary_min'),
    num(fd, 'salary_max'),
    num(fd, 'day_rate'),
    num(fd, 'fee_pct'),
    num(fd, 'openings') ?? 1,
    str(fd, 'status') ?? 'open',
    str(fd, 'priority') ?? 'medium',
    str(fd, 'description'),
    num(fd, 'owner_id'),
  ] as const;

export async function createJob(fd: FormData) {
  const fields = jobFields(fd);
  if (!fields[0]) throw new Error('Client is required');
  // Default the fee to the client's standard rate.
  const fee = fields[10] ?? get<{ f: number | null }>('SELECT default_fee_pct AS f FROM companies WHERE id = ?', fields[0])?.f ?? null;
  const values = [...fields];
  values[10] = fee;
  const { id } = run(
    `INSERT INTO jobs (company_id, contact_id, title, job_type, engagement, location, work_mode, salary_min, salary_max,
      day_rate, fee_pct, openings, status, priority, description, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...values,
  );
  revalidatePath('/jobs');
  redirect(`/jobs/${id}`);
}

export async function updateJob(id: number, fd: FormData) {
  const status = str(fd, 'status');
  run(
    `UPDATE jobs SET company_id=?, contact_id=?, title=?, job_type=?, engagement=?, location=?, work_mode=?, salary_min=?,
      salary_max=?, day_rate=?, fee_pct=?, openings=?, status=?, priority=?, description=?, owner_id=?,
      closed_at = CASE WHEN ? IN ('filled','closed') THEN COALESCE(closed_at, date('now')) ELSE NULL END
     WHERE id=?`,
    ...jobFields(fd),
    status,
    id,
  );
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}`);
}

// Pipeline ----------------------------------------------------------------------

export async function addToPipeline(fd: FormData) {
  const candidateId = num(fd, 'candidate_id');
  const jobId = num(fd, 'job_id');
  if (!candidateId || !jobId) throw new Error('Candidate and job are required');
  tx(() => {
    const r = run('INSERT OR IGNORE INTO applications (candidate_id, job_id, stage) VALUES (?, ?, ?)', candidateId, jobId, 'sourced');
    if (r.changes) run('INSERT INTO stage_history (application_id, from_stage, to_stage) VALUES (?, NULL, ?)', r.id, 'sourced');
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath('/pipeline');
}

/**
 * Move an application to a new stage. Moving to "placed" creates a placement
 * (fee pre-calculated from the job) and marks the candidate as placed.
 */
export async function moveStage(applicationId: number, stage: string, reason?: string) {
  if (!(ALL_STAGES as readonly string[]).includes(stage)) throw new Error(`Unknown stage ${stage}`);
  const app = get<{ stage: string; candidate_id: number; job_id: number }>(
    'SELECT stage, candidate_id, job_id FROM applications WHERE id = ?',
    applicationId,
  );
  if (!app || app.stage === stage) return;

  tx(() => {
    run(
      `UPDATE applications SET stage = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`,
      stage,
      stage === 'rejected' || stage === 'withdrawn' ? reason ?? null : null,
      applicationId,
    );
    run('INSERT INTO stage_history (application_id, from_stage, to_stage) VALUES (?, ?, ?)', applicationId, app.stage, stage);

    if (stage === 'placed') {
      const job = get<{ job_type: string; salary_min: number | null; salary_max: number | null; fee_pct: number | null; day_rate: number | null; title: string }>(
        'SELECT job_type, salary_min, salary_max, fee_pct, day_rate, title FROM jobs WHERE id = ?',
        app.job_id,
      )!;
      const cand = get<{ salary_expectation: number | null; day_rate: number | null }>(
        'SELECT salary_expectation, day_rate FROM candidates WHERE id = ?',
        app.candidate_id,
      )!;
      const start = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
      if (job.job_type === 'perm') {
        const base = cand.salary_expectation ?? (job.salary_min && job.salary_max ? Math.round((job.salary_min + job.salary_max) / 2) : job.salary_max ?? job.salary_min);
        const fee = base && job.fee_pct ? Math.round((base * job.fee_pct) / 100) : null;
        run(
          `INSERT OR IGNORE INTO placements (application_id, start_date, base_salary, fee_pct, fee_amount) VALUES (?, ?, ?, ?, ?)`,
          applicationId, start, base ?? null, job.fee_pct, fee,
        );
      } else {
        const end = new Date(Date.now() + (28 + 182) * 86400000).toISOString().slice(0, 10);
        run(
          `INSERT OR IGNORE INTO placements (application_id, start_date, pay_rate, charge_rate, end_date) VALUES (?, ?, ?, ?, ?)`,
          applicationId, start, cand.day_rate ?? null, job.day_rate ?? null, end,
        );
      }
      run(`UPDATE candidates SET status = 'placed' WHERE id = ?`, app.candidate_id);
      run(
        `INSERT INTO activities (kind, subject, candidate_id, job_id, consultant_id, done_at) VALUES ('note', ?, ?, ?, ?, datetime('now'))`,
        `Placed — ${job.title}`, app.candidate_id, app.job_id, CURRENT_CONSULTANT_ID,
      );
    } else {
      // Moving back out of "placed" removes the provisional placement.
      if (app.stage === 'placed') run('DELETE FROM placements WHERE application_id = ?', applicationId);
    }
  });

  revalidatePath('/pipeline');
  revalidatePath(`/jobs/${app.job_id}`);
  revalidatePath(`/candidates/${app.candidate_id}`);
  revalidatePath('/placements');
  revalidatePath('/');
}

export async function moveStageForm(fd: FormData) {
  await moveStage(num(fd, 'application_id')!, str(fd, 'stage')!, str(fd, 'reason') ?? undefined);
}

// Activities ------------------------------------------------------------------

export async function addActivity(fd: FormData) {
  const kind = str(fd, 'kind') ?? 'note';
  const due = str(fd, 'due_at');
  const isScheduled = kind === 'task' || (kind === 'interview' && due);
  const candidateId = num(fd, 'candidate_id');
  run(
    `INSERT INTO activities (kind, subject, body, candidate_id, company_id, contact_id, job_id, consultant_id, due_at, done_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    kind,
    need(str(fd, 'subject'), 'Subject'),
    str(fd, 'body'),
    candidateId,
    num(fd, 'company_id'),
    num(fd, 'contact_id'),
    num(fd, 'job_id'),
    CURRENT_CONSULTANT_ID,
    due ? due.replace('T', ' ') : null,
    isScheduled ? null : now(),
  );
  if (candidateId && ['call', 'email', 'meeting'].includes(kind)) {
    run(`UPDATE candidates SET last_contacted_at = datetime('now') WHERE id = ?`, candidateId);
  }
  const back = str(fd, 'return_to');
  if (back) revalidatePath(back);
  revalidatePath('/');
  revalidatePath('/activities');
}

export async function completeActivity(id: number) {
  run(`UPDATE activities SET done_at = datetime('now') WHERE id = ?`, id);
  revalidatePath('/');
  revalidatePath('/activities');
}

// Placements -----------------------------------------------------------------

export async function updatePlacement(id: number, fd: FormData) {
  const base = num(fd, 'base_salary');
  const pct = num(fd, 'fee_pct');
  const feeInput = num(fd, 'fee_amount');
  const fee = feeInput ?? (base && pct ? Math.round((base * pct) / 100) : null);
  run(
    `UPDATE placements SET start_date=?, base_salary=?, fee_pct=?, fee_amount=?, pay_rate=?, charge_rate=?, end_date=?,
      guarantee_days=?, invoice_status=? WHERE id=?`,
    str(fd, 'start_date'),
    base,
    pct,
    fee,
    num(fd, 'pay_rate'),
    num(fd, 'charge_rate'),
    str(fd, 'end_date'),
    num(fd, 'guarantee_days') ?? 90,
    str(fd, 'invoice_status') ?? 'not_invoiced',
    id,
  );
  revalidatePath('/placements');
  revalidatePath('/');
}
