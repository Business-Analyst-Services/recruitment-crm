// Page renderers. Each returns an HTML string for #app.
import * as S from './store.js';
import {
  esc, money, moneyK, salaryRange, date, dateTime, ago, daysSince, initials, badge, link, empty, tags, pageHead, card, options, label,
  PIPELINE_STAGES, CLOSED_STAGES, ALL_STAGES, STAGE_LABEL, CANDIDATE_STATUS, COMPANY_STATUS, JOB_STATUS, JOB_TYPES, ENGAGEMENTS,
  PRIORITIES, ACTIVITY_KINDS, INVOICE_STATUS, SOURCES,
} from './ui.js';
import { localDateTime } from './store.js';

const STALE_DAYS = 7;
const liveStages = (a) => !['rejected', 'withdrawn'].includes(a.stage);
const byPriority = (a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]);
const consultantOpts = (sel) => options(S.all('consultants').map((c) => [c.id, c.name]), sel ?? 1);

// ---------------------------------------------------------------------------
// Activity feed, tasks, and the log form (shared by several pages)

const KIND_ICON = { note: '✎', call: '☎', email: '✉', meeting: '◷', interview: '★', task: '☐' };

function activityFeed(items, showLinks = true) {
  if (!items.length) return empty('No activity yet.');
  return `<ul class="feed">${items.map((a) => {
    const pending = !a.done_at && a.due_at;
    const c = a.candidate_id && S.candidate(a.candidate_id);
    const co = a.company_id && S.company(a.company_id);
    const j = a.job_id && S.job(a.job_id);
    const who = S.consultant(a.consultant_id);
    const links = showLinks ? [
      c ? link(`#/candidates/${c.id}`, S.fullName(c)) : '', co ? link(`#/clients/${co.id}`, co.name) : '', j ? link(`#/jobs/${j.id}`, j.title) : '',
    ].filter(Boolean).map((l) => ` · ${l}`).join('') : '';
    return `<li><span class="icon" title="${esc(a.kind)}">${KIND_ICON[a.kind] ?? '•'}</span><div>
      <div class="row" style="justify-content:space-between"><strong>${esc(a.subject)}</strong>
      <span class="meta">${pending ? `Due ${esc(dateTime(a.due_at))}` : esc(ago(a.done_at ?? a.created_at))}</span></div>
      ${a.body ? `<p>${esc(a.body)}</p>` : ''}
      <div class="meta">${esc(who?.name ?? '')}${links}</div></div></li>`;
  }).join('')}</ul>`;
}

function taskList(items) {
  if (!items.length) return empty('Nothing due. Nice.');
  const now = localDateTime();
  return items.map((t) => {
    const c = t.candidate_id && S.candidate(t.candidate_id);
    const co = t.company_id && S.company(t.company_id);
    const j = t.job_id && S.job(t.job_id);
    const overdue = t.due_at < now;
    return `<div class="task-row">
      <button class="btn sm" data-action="complete-activity" data-id="${t.id}" title="Mark done" aria-label="Mark done">✓</button>
      <div class="grow"><div><strong>${esc(t.subject)}</strong></div>
        <div class="small muted"><span class="${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${esc(dateTime(t.due_at))}</span> · ${esc(t.kind)}
        ${c ? ` · ${link(`#/candidates/${c.id}`, S.fullName(c))}` : ''}
        ${j ? ` · ${link(`#/jobs/${j.id}`, j.title)}` : co ? ` · ${link(`#/clients/${co.id}`, co.name)}` : ''}</div></div></div>`;
  }).join('');
}

function activityForm({ candidateId, companyId, jobId } = {}) {
  return `<form data-form="activity" class="form-grid" style="grid-template-columns:200px 1fr">
    ${candidateId ? `<input type="hidden" name="candidate_id" value="${candidateId}">` : ''}
    ${companyId ? `<input type="hidden" name="company_id" value="${companyId}">` : ''}
    ${jobId ? `<input type="hidden" name="job_id" value="${jobId}">` : ''}
    <select name="kind" aria-label="Type">${options(ACTIVITY_KINDS, 'note')}</select>
    <input name="subject" placeholder="Subject — e.g. Screening call, chase feedback" required>
    <textarea name="body" placeholder="Notes (optional)" class="span-all" style="min-height:60px"></textarea>
    <label class="field">Due (tasks / interviews)<input type="datetime-local" name="due_at"></label>
    <div style="align-self:end;justify-self:end"><button class="btn primary">Log activity</button></div>
  </form>`;
}

// ---------------------------------------------------------------------------
// Kanban board

function boardCards(filter = {}) {
  return S.all('applications')
    .filter((a) => {
      const j = S.job(a.job_id);
      if (!j) return false;
      if (filter.job) return a.job_id === filter.job;
      if (!['open', 'on_hold'].includes(j.status)) return false;
      if (filter.owner && j.owner_id !== filter.owner) return false;
      return true;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function kanban(apps, showJob = true) {
  const closedCount = apps.filter((a) => CLOSED_STAGES.includes(a.stage)).length;
  const col = (stage, hidden) => {
    const items = apps.filter((a) => a.stage === stage);
    return `<div class="col${hidden ? ' closed-col' : ''}" data-stage="${stage}"${hidden ? ' hidden' : ''}>
      <div class="col-head"><span>${esc(STAGE_LABEL[stage])}</span><span class="badge">${items.length}</span></div>
      <div class="col-body">${items.map((a) => {
        const c = S.candidate(a.candidate_id);
        const j = S.job(a.job_id);
        const co = S.company(j.company_id);
        const days = daysSince(a.updated_at) ?? 0;
        const stale = days >= STALE_DAYS && !['placed', 'rejected', 'withdrawn'].includes(a.stage);
        return `<article class="kcard" draggable="true" data-app="${a.id}">
          <a href="#/candidates/${c.id}" class="kname" draggable="false">${esc(S.fullName(c))}</a>
          <div class="ksub">${esc(c.current_title ?? '—')}</div>
          ${showJob ? `<div class="ksub" style="margin-top:4px">${link(`#/jobs/${j.id}`, j.title)} · ${esc(co.name)}</div>` : ''}
          <div class="kfoot"><span title="Days in this stage" style="white-space:nowrap" class="${stale ? 'stale' : ''}">${days === 0 ? 'Today' : `${days}d`}</span>
            <select aria-label="Move to stage" data-action="move-stage" data-app="${a.id}">${options(ALL_STAGES.map((s) => [s, STAGE_LABEL[s]]), a.stage)}</select></div>
        </article>`;
      }).join('')}</div></div>`;
  };
  return `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="small muted">Drag cards between columns, or use the stage menu on each card. Moving to <strong>Placed</strong> creates a placement record.</span>
      <label class="check small"><input type="checkbox" data-action="toggle-closed"> Show rejected &amp; withdrawn (${closedCount})</label>
    </div>
    <div class="board">${PIPELINE_STAGES.map((s) => col(s, false)).join('')}${CLOSED_STAGES.map((s) => col(s, true)).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Dashboard

export function dashboard() {
  const jobs = S.all('jobs');
  const apps = S.all('applications');
  const openJobs = jobs.filter((j) => j.status === 'open');
  const activeCands = S.all('candidates').filter((c) => ['active', 'passive'].includes(c.status)).length;
  const inFlight = apps.filter((a) => S.job(a.job_id)?.status === 'open' && ['submitted', 'interview', 'offer'].includes(a.stage)).length;
  const today = localDateTime().slice(0, 10);
  const in7 = localDateTime(new Date(Date.now() + 7 * 86400000)).slice(0, 10);
  const interviews = S.all('activities').filter((a) => a.kind === 'interview' && !a.done_at && a.due_at && a.due_at.slice(0, 10) >= today && a.due_at.slice(0, 10) <= in7).length;
  const now = new Date();
  const fyStart = `${now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1}-07-01`; // Australian FY starts 1 July
  const fyPlacements = S.all('placements').filter((p) => p.created_at.slice(0, 10) >= fyStart);
  const billed = fyPlacements.reduce((s, p) => s + (p.fee_amount ?? 0), 0);
  const unbilled = S.all('placements').filter((p) => p.invoice_status === 'not_invoiced').reduce((s, p) => s + (p.fee_amount ?? 0), 0);

  const liveApps = apps.filter((a) => ['open', 'on_hold'].includes(S.job(a.job_id)?.status));
  const funnel = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, liveApps.filter((a) => a.stage === s).length]));
  const funnelMax = Math.max(1, ...Object.values(funnel));

  const hot = [...openJobs].sort((a, b) => byPriority(a, b) || a.opened_at.localeCompare(b.opened_at)).slice(0, 8);
  const kpi = (l, v, sub) => `<div class="card kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${sub}</div></div>`;

  return pageHead('Dashboard', `Financial year from ${esc(date(fyStart))}`,
    `<a href="#/candidates/new" class="btn">Add candidate</a><a href="#/jobs/new" class="btn primary">New job</a>`) +
    `<div class="kpis">
      ${kpi('Open jobs', openJobs.length, `${inFlight} candidates with clients`)}
      ${kpi('Active candidates', activeCands, 'active + passive')}
      ${kpi('Interviews next 7 days', interviews, 'scheduled with clients')}
      ${kpi('Placements this FY', fyPlacements.length, `${money(billed)} perm fees`)}
      ${kpi('Fees to invoice', moneyK(unbilled), link('#/placements', 'Review placements'))}
    </div>
    <div class="grid-2"><div class="stack">
      ${card('Priority jobs', `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Client</th><th>Priority</th><th class="right">Pipeline</th><th class="right">With client</th><th>Opened</th></tr></thead><tbody>
        ${hot.map((j) => {
          const ja = S.applicationsForJob(j.id);
          return `<tr><td>${link(`#/jobs/${j.id}`, j.title)} ${j.engagement !== 'contingent' ? badge(j.engagement) : ''}</td>
            <td>${esc(S.company(j.company_id)?.name)}</td><td>${badge(j.priority)}</td>
            <td class="right num">${ja.filter(liveStages).length}</td>
            <td class="right num">${ja.filter((a) => ['submitted', 'interview', 'offer'].includes(a.stage)).length}</td>
            <td class="muted nowrap">${esc(date(j.opened_at))}</td></tr>`;
        }).join('')}</tbody></table></div>`, { action: link('#/jobs', 'All jobs', 'link small'), tight: true })}
      ${card('Live pipeline (open jobs)', `<div class="funnel">${PIPELINE_STAGES.map((s) => `<div class="funnel-row"><span>${esc(STAGE_LABEL[s])}</span>
        <div class="funnel-bar"><span style="width:${(funnel[s] / funnelMax) * 100}%"></span></div><span class="num right">${funnel[s]}</span></div>`).join('')}</div>`,
        { action: link('#/pipeline', 'Open board', 'link small') })}
    </div><div class="stack">
      ${card('Due soon', taskList(S.openTasks().slice(0, 8)), { action: link('#/activities', 'All tasks', 'link small'), tight: true })}
      ${card('Recent activity', activityFeed(S.recentActivity(8)), { tight: true })}
    </div></div>`;
}

// ---------------------------------------------------------------------------
// Pipeline

export function pipeline(q) {
  const owner = q.get('owner') ? Number(q.get('owner')) : undefined;
  return pageHead('Pipeline', 'Every candidate across all open and on-hold jobs.',
    `<form data-filter="#/pipeline" class="row"><select name="owner" style="width:auto">${options(S.all('consultants').map((c) => [c.id, c.name]), owner, "All consultants' jobs")}</select><button class="btn">Apply</button></form>`) +
    kanban(boardCards({ owner }));
}

// ---------------------------------------------------------------------------
// Jobs

export function jobsList(q) {
  const status = q.get('status') || 'open';
  const text = (q.get('q') || '').toLowerCase();
  const rows = S.all('jobs').filter((j) => {
    if (status !== 'all' && j.status !== status) return false;
    if (q.get('type') && j.job_type !== q.get('type')) return false;
    if (q.get('owner') && j.owner_id !== Number(q.get('owner'))) return false;
    if (text && !`${j.title} ${S.company(j.company_id)?.name}`.toLowerCase().includes(text)) return false;
    return true;
  }).sort((a, b) => byPriority(a, b) || b.opened_at.localeCompare(a.opened_at));

  return pageHead('Jobs', "Vacancies you're working, with pipeline health at a glance.", '<a href="#/jobs/new" class="btn primary">New job</a>') +
    `<form class="filters" data-filter="#/jobs">
      <input type="search" name="q" placeholder="Search role or client…" value="${esc(q.get('q') || '')}">
      <select name="status">${options([...JOB_STATUS, ['all', 'All statuses']], status)}</select>
      <select name="type">${options(JOB_TYPES, q.get('type'), 'Any type')}</select>
      <select name="owner">${options(S.all('consultants').map((c) => [c.id, c.name]), q.get('owner'), 'Any owner')}</select>
      <button class="btn">Filter</button></form>` +
    `<div class="card">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Client</th><th>Type</th><th>Package</th><th>Priority</th><th>Status</th><th class="right">Active</th><th class="right">Sent</th><th class="right">Interviewed</th><th>Owner</th><th>Age</th></tr></thead><tbody>
      ${rows.map((j) => {
        const ja = S.applicationsForJob(j.id);
        const age = daysSince(j.opened_at) ?? 0;
        const co = S.company(j.company_id);
        return `<tr><td>${link(`#/jobs/${j.id}`, j.title, 'link strong')}<div class="small faint">${esc(j.location)}</div></td>
          <td>${link(`#/clients/${co.id}`, co.name)}</td>
          <td>${badge(j.job_type, '')} ${j.engagement !== 'contingent' ? badge(j.engagement) : ''}</td>
          <td class="num">${j.job_type === 'perm' ? salaryRange(j.salary_min, j.salary_max) : j.day_rate ? `${money(j.day_rate)}/d` : '—'}</td>
          <td>${badge(j.priority)}</td><td>${badge(j.status)}</td>
          <td class="right num">${ja.filter(liveStages).length}</td>
          <td class="right num">${ja.filter((a) => ['submitted', 'interview', 'offer', 'placed'].includes(a.stage)).length}</td>
          <td class="right num">${ja.filter((a) => ['interview', 'offer', 'placed'].includes(a.stage)).length}</td>
          <td class="muted">${esc(S.consultant(j.owner_id)?.name)}</td>
          <td class="num ${j.status === 'open' && age > 45 ? 'stale' : 'muted'}" title="Opened ${esc(date(j.opened_at))}">${age}d</td></tr>`;
      }).join('')}</tbody></table></div>` : empty('No jobs match.')}</div>`;
}

export function jobDetail(id) {
  const j = S.job(id);
  if (!j) return notFound();
  const co = S.company(j.company_id);
  const ct = j.contact_id && S.contact(j.contact_id);
  const apps = boardCards({ job: j.id });
  const inPipeline = new Set(apps.map((a) => a.candidate_id));
  // Simple matching: exact title match, then shared skill phrases, then shared distinctive title words.
  const STOP = new Set(['senior', 'junior', 'lead', 'officer', 'analyst', 'manager', 'the', 'and', 'for', 'with']);
  const jobSkills = (j.description?.split(/key skills:/i)[1] ?? '').split(',').map((x) => x.trim().replace(/\.$/, '').toLowerCase()).filter(Boolean);
  const titleWords = j.title.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  const pool = S.all('candidates').filter((c) => ['active', 'passive'].includes(c.status) && c.consent_at && !inPipeline.has(c.id));
  const suggestions = pool.map((c) => {
    const title = (c.current_title ?? '').toLowerCase();
    const skills = (c.skills ?? '').toLowerCase().split(',').map((x) => x.trim());
    const score = (title === j.title.toLowerCase() ? 6 : 0) + skills.filter((sk) => jobSkills.includes(sk)).length * 2 + titleWords.filter((w) => title.includes(w)).length;
    return { c, score };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 6);
  const fee = j.job_type === 'perm' && j.fee_pct && j.salary_max ? Math.round((((j.salary_min ?? j.salary_max) + j.salary_max) / 2) * j.fee_pct / 100) : null;

  return pageHead(`<span class="row" style="gap:10px">${esc(j.title)} ${badge(j.status)} ${badge(j.priority)}</span>`,
    `${link(`#/clients/${co.id}`, co.name)} · ${esc(j.location ?? '—')} · opened ${esc(date(j.opened_at))} (${daysSince(j.opened_at)}d)`,
    `<a href="#/jobs/${j.id}/edit" class="btn">Edit job</a>`) +
    card('Pipeline', kanban(apps, false)) +
    `<div class="grid-2" style="margin-top:16px"><div class="stack">
      ${card('Add candidates', `${suggestions.length ? `<h3 style="margin-bottom:8px">Suggested matches</h3><div class="stack" style="gap:6px;margin-bottom:16px">
        ${suggestions.map(({ c }) => `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0">
          ${link(`#/candidates/${c.id}`, S.fullName(c), 'link strong')} <span class="muted">· ${esc(c.current_title)}</span><div class="small">${tags(c.skills)}</div></div>
          <button class="btn sm" data-action="add-to-pipeline" data-candidate="${c.id}" data-job="${j.id}">+ Add</button></div>`).join('')}</div>` : ''}
        <form data-form="pipeline" class="row"><input type="hidden" name="job_id" value="${j.id}">
          <select name="candidate_id" required style="flex:1;min-width:220px">${options(pool.map((c) => [c.id, `${S.fullName(c)}${c.current_title ? ` — ${c.current_title}` : ''}`]), null, 'Any candidate…')}</select>
          <button class="btn primary">Add to pipeline</button></form>
        <p class="small faint" style="margin-bottom:0">Only candidates with recorded consent and not marked do-not-contact are listed.</p>`)}
      ${card('Log activity', activityForm({ jobId: j.id, companyId: co.id }))}
      ${card('History', activityFeed(S.activitiesFor({ job: j.id })), { tight: true })}
    </div><div class="stack">
      ${card('Brief', `<dl class="dl">
        <dt>Type</dt><dd>${badge(j.job_type, '')} ${badge(j.engagement)}</dd>
        <dt>Work mode</dt><dd>${esc(j.work_mode ?? '—')}</dd>
        <dt>Package</dt><dd>${j.job_type === 'perm' ? `${salaryRange(j.salary_min, j.salary_max)} base` : j.day_rate ? `${money(j.day_rate)}/day charge` : '—'}</dd>
        ${j.job_type === 'perm' ? `<dt>Fee</dt><dd>${j.fee_pct ? `${j.fee_pct}%` : '—'}${fee ? `<span class="muted"> · est. ${money(fee)}</span>` : ''}</dd>` : ''}
        <dt>Openings</dt><dd>${esc(j.openings)}</dd>
        <dt>Hiring manager</dt><dd>${ct ? `${esc(ct.name)}${ct.email ? `<div class="small"><a class="link" href="mailto:${esc(ct.email)}">${esc(ct.email)}</a></div>` : ''}` : '—'}</dd>
        <dt>Owner</dt><dd>${esc(S.consultant(j.owner_id)?.name ?? '—')}</dd>
        ${j.closed_at ? `<dt>Closed</dt><dd>${esc(date(j.closed_at))}</dd>` : ''}
      </dl>${j.description ? `<p class="muted" style="white-space:pre-wrap;margin-bottom:0">${esc(j.description)}</p>` : ''}`)}
    </div></div>`;
}

export function jobForm(id, q) {
  const j = id ? S.job(id) : { company_id: q.get('company') ? Number(q.get('company')) : null };
  if (id && !j) return notFound();
  const v = (k) => esc(j?.[k] ?? '');
  const companies = [...S.all('companies')].sort((a, b) => a.name.localeCompare(b.name));
  const contactsOpts = companies.map((co) => {
    const cs = S.all('contacts').filter((c) => c.company_id === co.id);
    return cs.length ? `<optgroup label="${esc(co.name)}">${cs.map((c) => `<option value="${c.id}"${c.id === j.contact_id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return pageHead(id ? `Edit ${esc(j.title)}` : 'New job', id ? '' : 'Take a brief and open a vacancy.') + card('', `
    <form data-form="job" data-id="${id ?? ''}" class="form-grid">
      <label class="field">Job title *<input name="title" required value="${v('title')}"></label>
      <label class="field">Client *<select name="company_id" required>${options(companies.map((c) => [c.id, c.name]), j.company_id, 'Select…')}</select></label>
      <label class="field">Hiring manager<select name="contact_id"><option value="">—</option>${contactsOpts}</select></label>
      <label class="field">Type<select name="job_type">${options(JOB_TYPES, j.job_type || 'perm')}</select></label>
      <label class="field">Engagement<select name="engagement">${options(ENGAGEMENTS, j.engagement || 'contingent')}</select></label>
      <label class="field">Location<input name="location" value="${v('location')}"></label>
      <label class="field">Work mode<select name="work_mode">${options(['onsite', 'hybrid', 'remote'], j.work_mode, '—')}</select></label>
      <label class="field">Salary min (AUD)<input name="salary_min" inputmode="numeric" value="${v('salary_min')}"></label>
      <label class="field">Salary max (AUD)<input name="salary_max" inputmode="numeric" value="${v('salary_max')}"></label>
      <label class="field">Charge rate / day (contract)<input name="day_rate" inputmode="numeric" value="${v('day_rate')}"></label>
      <label class="field">Fee % (perm, blank = client default)<input name="fee_pct" inputmode="decimal" value="${v('fee_pct')}"></label>
      <label class="field">Openings<input name="openings" type="number" min="1" value="${esc(j.openings ?? 1)}"></label>
      <label class="field">Status<select name="status">${options(JOB_STATUS, j.status || 'open')}</select></label>
      <label class="field">Priority<select name="priority">${options(PRIORITIES, j.priority || 'medium')}</select></label>
      <label class="field">Owner<select name="owner_id">${consultantOpts(j.owner_id)}</select></label>
      <label class="field span-all">Description / brief<textarea name="description" style="min-height:120px">${v('description')}</textarea></label>
      <div class="span-all row"><button class="btn primary">${id ? 'Save changes' : 'Create job'}</button>${id ? `<a class="btn ghost" href="#/jobs/${id}">Cancel</a>` : ''}</div>
    </form>`);
}

// ---------------------------------------------------------------------------
// Candidates

export function candidatesList(q) {
  const text = (q.get('q') || '').toLowerCase();
  const rows = S.all('candidates').filter((c) => {
    if (text && !`${c.first_name} ${c.last_name} ${c.current_title ?? ''} ${c.skills ?? ''} ${c.email ?? ''} ${c.current_employer ?? ''}`.toLowerCase().includes(text)) return false;
    if (q.get('status') && c.status !== q.get('status')) return false;
    if (q.get('seeking') && c.seeking !== q.get('seeking') && c.seeking !== 'either') return false;
    if (q.get('owner') && c.owner_id !== Number(q.get('owner'))) return false;
    return true;
  }).sort((a, b) => (b.last_contacted_at ?? '').localeCompare(a.last_contacted_at ?? ''));

  return pageHead('Candidates', `${rows.length} shown`, '<a href="#/candidates/new" class="btn primary">Add candidate</a>') +
    (q.get('erased') ? '<div class="notice">Candidate record and all linked history permanently erased.</div>' : '') +
    `<form class="filters" data-filter="#/candidates">
      <input type="search" name="q" placeholder="Search name, title, skills, employer…" value="${esc(q.get('q') || '')}">
      <select name="status">${options(CANDIDATE_STATUS, q.get('status'), 'Any status')}</select>
      <select name="seeking">${options(['perm', 'contract'], q.get('seeking'), 'Perm or contract')}</select>
      <select name="owner">${options(S.all('consultants').map((c) => [c.id, c.name]), q.get('owner'), 'Any owner')}</select>
      <button class="btn">Filter</button>${[...q.keys()].length ? '<a href="#/candidates" class="btn ghost">Clear</a>' : ''}</form>` +
    `<div class="card">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Current role</th><th>Location</th><th>Seeking</th><th class="right">Expectation</th><th>Status</th><th class="right">Live</th><th>Owner</th><th>Last contact</th></tr></thead><tbody>
      ${rows.map((c) => {
        const live = S.applicationsForCandidate(c.id).filter((a) => !['rejected', 'withdrawn', 'placed'].includes(a.stage)).length;
        return `<tr><td>${link(`#/candidates/${c.id}`, S.fullName(c), 'link strong')}${!c.consent_at ? ' <span class="badge warn" title="No consent recorded">No consent</span>' : ''}</td>
          <td>${esc(c.current_title)}<div class="small faint">${esc(c.current_employer)}</div></td>
          <td class="muted">${esc(c.location)}</td><td>${badge(c.seeking, '')}</td>
          <td class="right num">${c.seeking === 'contract' ? (c.day_rate ? `${moneyK(c.day_rate)}/d` : '—') : moneyK(c.salary_expectation)}</td>
          <td>${badge(c.status)}</td><td class="right num">${live || ''}</td>
          <td class="muted">${esc(S.consultant(c.owner_id)?.name)}</td><td class="muted">${esc(ago(c.last_contacted_at))}</td></tr>`;
      }).join('')}</tbody></table></div>` : empty('No candidates match.')}</div>`;
}

export function candidateDetail(id) {
  const c = S.candidate(id);
  if (!c) return notFound();
  const name = S.fullName(c);
  const apps = S.applicationsForCandidate(c.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const jobs = S.all('jobs').filter((j) => ['open', 'on_hold'].includes(j.status) && !apps.some((a) => a.job_id === j.id))
    .sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  const dnc = c.status === 'do_not_contact';

  return pageHead(`<span class="row" style="gap:12px"><span class="avatar">${esc(initials(name))}</span>${esc(name)} ${badge(c.status)}</span>`,
    esc([c.current_title, c.current_employer].filter(Boolean).join(' at ')),
    `<a href="#/candidates/${c.id}/edit" class="btn">Edit</a><button class="btn" data-action="export-candidate" data-id="${c.id}" title="Export everything we hold (APP 12 access request)">Export data</button>`) +
    (dnc ? '<div class="notice warn">Do not contact — this candidate has asked not to be approached.</div>' : '') +
    (!c.consent_at ? '<div class="notice warn">No collection notice / consent recorded. Confirm before submitting this candidate to any client.</div>' : '') +
    `<div class="grid-2"><div class="stack">
      ${card('Applications', `${apps.length ? `<div class="table-wrap"><table><thead><tr><th>Job</th><th>Client</th><th>Stage</th><th>Updated</th><th>Move to</th></tr></thead><tbody>
        ${apps.map((a) => {
          const j = S.job(a.job_id);
          const co = S.company(j.company_id);
          return `<tr><td>${link(`#/jobs/${j.id}`, j.title)}</td><td>${link(`#/clients/${co.id}`, co.name)}</td>
            <td>${badge(a.stage)}${a.rejection_reason ? `<div class="small faint">${esc(a.rejection_reason)}</div>` : ''}</td>
            <td class="muted">${esc(ago(a.updated_at))}</td>
            <td><select data-action="move-stage" data-app="${a.id}" style="width:auto" aria-label="Move to stage">${options(ALL_STAGES.map((s) => [s, STAGE_LABEL[s]]), a.stage)}</select></td></tr>`;
        }).join('')}</tbody></table></div>` : empty('Not in any pipeline yet.')}
        ${!dnc && jobs.length ? `<form data-form="pipeline" class="row" style="padding:16px;border-top:1px solid var(--border)">
          <input type="hidden" name="candidate_id" value="${c.id}">
          <select name="job_id" required style="flex:1;min-width:220px">${options(jobs.map((j) => [j.id, `${j.title} — ${S.company(j.company_id).name}`]), null, 'Add to a job…')}</select>
          <button class="btn primary">Add to pipeline</button></form>` : ''}`, { tight: true })}
      ${card('Log activity', activityForm({ candidateId: c.id }))}
      ${card('History', activityFeed(S.activitiesFor({ candidate: c.id })), { tight: true })}
    </div><div class="stack">
      ${card('Profile', `<dl class="dl">
        <dt>Email</dt><dd>${c.email ? `<a class="link" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
        <dt>Mobile</dt><dd>${c.phone ? `<a class="link" href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a>` : '—'}</dd>
        <dt>Location</dt><dd>${esc(c.location ?? '—')}</dd>
        <dt>Work rights</dt><dd>${esc(c.work_rights ?? '—')}</dd>
        <dt>Seeking</dt><dd>${badge(c.seeking, '')}</dd>
        <dt>Salary expectation</dt><dd>${money(c.salary_expectation)}</dd>
        <dt>Day rate</dt><dd>${c.day_rate ? `${money(c.day_rate)}/day` : '—'}</dd>
        <dt>Notice</dt><dd>${esc(c.notice_period ?? '—')}</dd>
        <dt>Skills</dt><dd>${tags(c.skills)}</dd>
        <dt>Source</dt><dd>${esc(c.source ?? '—')}</dd>
        <dt>Owner</dt><dd>${esc(S.consultant(c.owner_id)?.name ?? '—')}</dd>
        <dt>Last contact</dt><dd>${esc(ago(c.last_contacted_at))}</dd>
        <dt>Registered</dt><dd>${esc(date(c.created_at))}</dd>
      </dl>${c.notes ? `<p class="muted" style="margin-bottom:0">${esc(c.notes)}</p>` : ''}`)}
      ${card('Privacy', `<dl class="dl"><dt>Consent</dt><dd>${c.consent_at ? `${esc(dateTime(c.consent_at))}<div class="small faint">${esc(c.consent_source)}</div>` : badge('Not recorded', 'warn')}</dd></dl>
        <details class="inline" style="margin-top:12px"><summary class="btn danger sm">Erase candidate…</summary>
          <p class="small muted">Permanently deletes this candidate, their applications, placements and activity history. Use when a candidate asks to be removed or when the record is past your retention period (APP 11.2). This cannot be undone.</p>
          <button class="btn danger" data-action="erase-candidate" data-id="${c.id}">Yes, permanently erase ${esc(name)}</button></details>`)}
    </div></div>`;
}

export function candidateForm(id) {
  const c = id ? S.candidate(id) : {};
  if (id && !c) return notFound();
  const v = (k) => esc(c?.[k] ?? '');
  return pageHead(id ? `Edit ${esc(S.fullName(c))}` : 'Add candidate', id ? '' : 'Register a new candidate in the talent pool.') + card('', `
    <form data-form="candidate" data-id="${id ?? ''}" class="form-grid">
      <div class="form-section">Person</div>
      <label class="field">First name *<input name="first_name" required value="${v('first_name')}"></label>
      <label class="field">Last name *<input name="last_name" required value="${v('last_name')}"></label>
      <label class="field">Email<input type="email" name="email" value="${v('email')}"></label>
      <label class="field">Mobile<input name="phone" placeholder="04xx xxx xxx" value="${v('phone')}"></label>
      <label class="field">Location<input name="location" placeholder="Sydney NSW" value="${v('location')}"></label>
      <label class="field">Work rights<input name="work_rights" placeholder="e.g. Full work rights" value="${v('work_rights')}"></label>
      <div class="form-section">Career</div>
      <label class="field">Current title<input name="current_title" value="${v('current_title')}"></label>
      <label class="field">Current employer<input name="current_employer" value="${v('current_employer')}"></label>
      <label class="field span-all">Skills (comma-separated)<input name="skills" placeholder="Business Analysis, Jira, SQL" value="${v('skills')}"></label>
      <label class="field">Seeking<select name="seeking">${options(['perm', 'contract', 'either'], c.seeking || 'perm')}</select></label>
      <label class="field">Salary expectation (AUD base)<input name="salary_expectation" inputmode="numeric" value="${v('salary_expectation')}"></label>
      <label class="field">Day rate (AUD)<input name="day_rate" inputmode="numeric" value="${v('day_rate')}"></label>
      <label class="field">Notice period<input name="notice_period" placeholder="4 weeks" value="${v('notice_period')}"></label>
      <div class="form-section">Relationship</div>
      <label class="field">Status<select name="status">${options(CANDIDATE_STATUS, c.status || 'active')}</select></label>
      <label class="field">Source<select name="source">${options(SOURCES, c.source, '—')}</select></label>
      <label class="field">Owner<select name="owner_id">${consultantOpts(c.owner_id)}</select></label>
      <label class="field span-all">Notes<textarea name="notes">${v('notes')}</textarea></label>
      <label class="check span-all"><input type="checkbox" name="consent"${c.consent_at ? ' checked disabled' : ''}>
        Candidate has been given our collection notice and consents to us holding their details (APP 5)</label>
      <div class="span-all row"><button class="btn primary">${id ? 'Save changes' : 'Create candidate'}</button>${id ? `<a class="btn ghost" href="#/candidates/${id}">Cancel</a>` : ''}</div>
    </form>`);
}

// ---------------------------------------------------------------------------
// Clients

const placementsForCompany = (coId) => S.all('placements').filter((p) => {
  const a = S.byId('applications', p.application_id);
  return a && S.job(a.job_id)?.company_id === coId;
});

export function clientsList(q) {
  const text = (q.get('q') || '').toLowerCase();
  const rows = S.all('companies').filter((c) => (!text || `${c.name} ${c.industry ?? ''}`.toLowerCase().includes(text)) && (!q.get('status') || c.status === q.get('status')))
    .map((c) => {
      const acts = S.all('activities').filter((a) => a.company_id === c.id);
      return {
        c, open: S.all('jobs').filter((j) => j.company_id === c.id && j.status === 'open').length,
        contacts: S.all('contacts').filter((x) => x.company_id === c.id).length,
        fees: placementsForCompany(c.id).reduce((s, p) => s + (p.fee_amount ?? 0), 0),
        last: acts.map((a) => a.done_at ?? a.created_at).sort().pop(),
      };
    }).sort((a, b) => b.open - a.open || a.c.name.localeCompare(b.c.name));

  return pageHead('Clients', "Companies you recruit for, and prospects you're working on.", '<a href="#/clients/new" class="btn primary">Add client</a>') +
    `<form class="filters" data-filter="#/clients"><input type="search" name="q" placeholder="Search company or industry…" value="${esc(q.get('q') || '')}">
      <select name="status">${options(COMPANY_STATUS, q.get('status'), 'Any status')}</select><button class="btn">Filter</button></form>` +
    `<div class="card">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Industry</th><th>Status</th><th>Terms</th><th class="right">Fee %</th><th class="right">Open jobs</th><th class="right">Contacts</th><th class="right">Lifetime fees</th><th>Owner</th><th>Last touch</th></tr></thead><tbody>
      ${rows.map(({ c, open, contacts, fees, last }) => `<tr><td>${link(`#/clients/${c.id}`, c.name, 'link strong')}<div class="small faint">${esc(c.location)}</div></td>
        <td class="muted">${esc(c.industry)}</td><td>${badge(c.status)}</td>
        <td>${c.terms_signed ? '<span class="badge ok">Signed</span>' : '<span class="badge warn">None</span>'}</td>
        <td class="right num">${esc(c.default_fee_pct ?? '—')}</td><td class="right num">${open || ''}</td><td class="right num">${contacts}</td>
        <td class="right num">${fees ? money(fees) : '—'}</td><td class="muted">${esc(S.consultant(c.owner_id)?.name)}</td><td class="muted">${esc(ago(last))}</td></tr>`).join('')}
      </tbody></table></div>` : empty('No clients match.')}</div>`;
}

export function clientDetail(id) {
  const c = S.company(id);
  if (!c) return notFound();
  const contacts = S.all('contacts').filter((x) => x.company_id === c.id).sort((a, b) => b.is_hiring_manager - a.is_hiring_manager || a.name.localeCompare(b.name));
  const order = { open: 0, on_hold: 1 };
  const jobs = S.all('jobs').filter((j) => j.company_id === c.id).sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2) || b.opened_at.localeCompare(a.opened_at));
  const pls = placementsForCompany(c.id);

  return pageHead(`<span class="row" style="gap:12px"><span class="avatar">${esc(initials(c.name))}</span>${esc(c.name)} ${badge(c.status)}</span>`,
    esc([c.industry, c.location].filter(Boolean).join(' · ')),
    `<a href="#/clients/${c.id}/edit" class="btn">Edit</a><a href="#/jobs/new?company=${c.id}" class="btn primary">New job</a>`) +
    (!c.terms_signed ? '<div class="notice warn">No signed terms of business on file — get terms signed before submitting candidates.</div>' : '') +
    `<div class="grid-2"><div class="stack">
      ${card('Jobs', jobs.length ? `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Type</th><th>Package</th><th>Status</th><th class="right">Pipeline</th><th>Opened</th></tr></thead><tbody>
        ${jobs.map((j) => `<tr><td>${link(`#/jobs/${j.id}`, j.title)}</td><td>${badge(j.job_type, '')}</td>
          <td class="num">${j.job_type === 'perm' ? salaryRange(j.salary_min, j.salary_max) : j.day_rate ? `${money(j.day_rate)}/d` : '—'}</td>
          <td>${badge(j.status)}</td><td class="right num">${S.applicationsForJob(j.id).filter(liveStages).length}</td>
          <td class="muted nowrap">${esc(date(j.opened_at))}</td></tr>`).join('')}</tbody></table></div>` : empty('No jobs yet.'), { tight: true })}
      ${card('Log activity', activityForm({ companyId: c.id }))}
      ${card('History', activityFeed(S.activitiesFor({ company: c.id })), { tight: true })}
    </div><div class="stack">
      ${card('Account', `<dl class="dl">
        <dt>ABN</dt><dd>${esc(c.abn ?? '—')}</dd>
        <dt>Website</dt><dd>${c.website ? `<a class="link" href="${esc(c.website)}" target="_blank" rel="noreferrer">${esc(c.website.replace(/^https?:\/\//, ''))}</a>` : '—'}</dd>
        <dt>Standard fee</dt><dd>${c.default_fee_pct ? `${esc(c.default_fee_pct)}% of base` : '—'}</dd>
        <dt>Placements</dt><dd>${pls.length} · ${money(pls.reduce((s, p) => s + (p.fee_amount ?? 0), 0))} perm fees</dd>
        <dt>Owner</dt><dd>${esc(S.consultant(c.owner_id)?.name ?? '—')}</dd>
        <dt>Client since</dt><dd>${esc(date(c.created_at))}</dd></dl>${c.notes ? `<p class="muted" style="margin-bottom:0">${esc(c.notes)}</p>` : ''}`)}
      ${card('Contacts', `${contacts.length ? `<ul class="feed">${contacts.map((p) => `<li><span class="avatar sm">${esc(initials(p.name))}</span><div>
          <strong>${esc(p.name)}</strong> ${p.is_hiring_manager ? '<span class="badge accent">Hiring manager</span>' : ''}
          <div class="small muted">${esc(p.title)}</div>
          <div class="small">${p.email ? `<a class="link" href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}${p.phone ? ` · ${esc(p.phone)}` : ''}</div></div></li>`).join('')}</ul>` : empty('No contacts yet.')}
        <details class="inline" style="padding:16px;border-top:1px solid var(--border)"><summary class="btn sm">+ Add contact</summary>
          <form data-form="contact" data-id="${c.id}" class="stack" style="gap:8px">
            <input name="name" placeholder="Full name" required><input name="title" placeholder="Job title">
            <input name="email" type="email" placeholder="Email"><input name="phone" placeholder="Phone">
            <label class="check"><input type="checkbox" name="is_hiring_manager"> Hiring manager</label>
            <div><button class="btn primary sm">Save contact</button></div></form></details>`, { tight: true })}
    </div></div>`;
}

export function clientForm(id) {
  const c = id ? S.company(id) : {};
  if (id && !c) return notFound();
  const v = (k) => esc(c?.[k] ?? '');
  return pageHead(id ? `Edit ${esc(c.name)}` : 'Add client') + card('', `
    <form data-form="company" data-id="${id ?? ''}" class="form-grid">
      <label class="field">Company name *<input name="name" required value="${v('name')}"></label>
      <label class="field">Industry<input name="industry" value="${v('industry')}"></label>
      <label class="field">ABN<input name="abn" placeholder="11 222 333 444" value="${v('abn')}"></label>
      <label class="field">Website<input name="website" value="${v('website')}"></label>
      <label class="field">Location<input name="location" value="${v('location')}"></label>
      <label class="field">Status<select name="status">${options(COMPANY_STATUS, c.status || 'prospect')}</select></label>
      <label class="field">Standard perm fee %<input name="default_fee_pct" inputmode="decimal" placeholder="18" value="${v('default_fee_pct')}"></label>
      <label class="field">Owner<select name="owner_id">${consultantOpts(c.owner_id)}</select></label>
      <label class="check span-all"><input type="checkbox" name="terms_signed"${c.terms_signed ? ' checked' : ''}> Signed terms of business on file</label>
      <label class="field span-all">Notes<textarea name="notes">${v('notes')}</textarea></label>
      <div class="span-all row"><button class="btn primary">${id ? 'Save changes' : 'Create client'}</button>${id ? `<a class="btn ghost" href="#/clients/${id}">Cancel</a>` : ''}</div>
    </form>`);
}

// ---------------------------------------------------------------------------
// Placements

export function placements() {
  const rows = [...S.all('placements')].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => {
    const a = S.byId('applications', p.application_id);
    const j = S.job(a.job_id);
    return { p, c: S.candidate(a.candidate_id), j, co: S.company(j.company_id) };
  });
  const perm = rows.filter((r) => r.j.job_type === 'perm');
  const contract = rows.filter((r) => r.j.job_type !== 'perm');
  const total = (s) => perm.filter((r) => r.p.invoice_status === s).reduce((a, r) => a + (r.p.fee_amount ?? 0), 0);
  const today = localDateTime().slice(0, 10);
  const inGuarantee = (p) => {
    if (!p.start_date) return false;
    const end = new Date(new Date(p.start_date + 'T00:00').getTime() + p.guarantee_days * 86400000);
    return p.start_date <= today && today <= localDateTime(end).slice(0, 10);
  };
  const weekly = contract.reduce((a, r) => a + ((r.p.charge_rate ?? 0) - (r.p.pay_rate ?? 0)) * 5, 0);
  const kpi = (l, v, sub = '') => `<div class="card kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
  const who = (r) => `<td>${link(`#/candidates/${r.c.id}`, S.fullName(r.c))}</td><td>${link(`#/jobs/${r.j.id}`, r.j.title)}<div class="small faint">${esc(r.co.name)}</div></td>`;

  return pageHead('Placements', 'Revenue from perm fees and contractor margin. Amounts ex GST.') +
    `<div class="kpis">${kpi('To invoice', money(total('not_invoiced')))}${kpi('Invoiced, unpaid', money(total('invoiced')))}${kpi('Paid', money(total('paid')))}${kpi('Contractor margin / week', money(weekly), `${contract.length} contractors`)}</div>
    <div class="stack">
      ${card('Permanent placements', perm.length ? `<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Role · Client</th><th>Start</th><th class="right">Base</th><th class="right">Fee %</th><th class="right">Fee</th><th>Invoice</th><th>Guarantee</th><th></th></tr></thead><tbody>
        ${perm.map((r) => `<tr>${who(r)}<td class="nowrap">${esc(date(r.p.start_date))}</td><td class="right num">${money(r.p.base_salary)}</td>
          <td class="right num">${esc(r.p.fee_pct ?? '—')}</td><td class="right num"><strong>${money(r.p.fee_amount)}</strong></td><td>${badge(r.p.invoice_status)}</td>
          <td>${inGuarantee(r.p) ? `<span class="badge warn">${r.p.guarantee_days}d active</span>` : `<span class="faint small">${r.p.guarantee_days}d</span>`}</td>
          <td>${editPlacement(r.p, true)}</td></tr>`).join('')}</tbody></table></div>` : empty('No perm placements yet.'), { tight: true })}
      ${card('Contractors on assignment', contract.length ? `<div class="table-wrap"><table><thead><tr><th>Contractor</th><th>Role · Client</th><th>Start</th><th>End</th><th class="right">Pay / day</th><th class="right">Charge / day</th><th class="right">Margin</th><th>Invoice</th><th></th></tr></thead><tbody>
        ${contract.map((r) => {
          const m = (r.p.charge_rate ?? 0) - (r.p.pay_rate ?? 0);
          return `<tr>${who(r)}<td class="nowrap">${esc(date(r.p.start_date))}</td><td class="nowrap">${esc(date(r.p.end_date))}</td>
            <td class="right num">${money(r.p.pay_rate)}</td><td class="right num">${money(r.p.charge_rate)}</td>
            <td class="right num"><strong>${money(m)}</strong>${r.p.charge_rate ? `<div class="small faint">${Math.round((m / r.p.charge_rate) * 100)}%</div>` : ''}</td>
            <td>${badge(r.p.invoice_status)}</td><td>${editPlacement(r.p, false)}</td></tr>`;
        }).join('')}</tbody></table></div>` : empty('No contractors on assignment.'), { tight: true })}
    </div>`;
}

function editPlacement(p, perm) {
  const v = (k) => esc(p[k] ?? '');
  return `<details class="inline"><summary class="btn sm">Edit</summary>
    <form data-form="placement" data-id="${p.id}" class="stack" style="gap:8px;min-width:220px">
      <label class="field">Start date<input type="date" name="start_date" value="${v('start_date')}"></label>
      ${perm ? `<label class="field">Base salary<input name="base_salary" inputmode="numeric" value="${v('base_salary')}"></label>
        <label class="field">Fee %<input name="fee_pct" inputmode="decimal" value="${v('fee_pct')}"></label>
        <label class="field">Fee (blank = base × %)<input name="fee_amount" inputmode="numeric" value="${v('fee_amount')}"></label>`
      : `<label class="field">Pay rate / day<input name="pay_rate" inputmode="numeric" value="${v('pay_rate')}"></label>
        <label class="field">Charge rate / day<input name="charge_rate" inputmode="numeric" value="${v('charge_rate')}"></label>
        <label class="field">End date<input type="date" name="end_date" value="${v('end_date')}"></label>`}
      <label class="field">Guarantee (days)<input name="guarantee_days" type="number" value="${v('guarantee_days')}"></label>
      <label class="field">Invoice status<select name="invoice_status">${options(INVOICE_STATUS, p.invoice_status)}</select></label>
      <button class="btn primary sm">Save</button></form></details>`;
}

// ---------------------------------------------------------------------------
// Activities & data

export function activities() {
  return pageHead('Tasks & activity', 'Follow-ups, scheduled interviews, and everything the team has logged.') +
    `<div class="grid-halves"><div class="stack">
      ${card('Open tasks & upcoming interviews', taskList(S.openTasks()), { tight: true })}
      ${card('New task or note', activityForm())}
    </div>${card('Team activity', activityFeed(S.recentActivity(60)), { tight: true })}</div>`;
}

export function dataPage(q) {
  const counts = ['candidates', 'companies', 'contacts', 'jobs', 'applications', 'placements', 'activities'].map((t) => `<dt>${label(t)}</dt><dd class="num">${S.all(t).length}</dd>`).join('');
  return pageHead('Your data', 'Where TalentLedger keeps its records, and how to back them up or start again.') +
    (q.get('imported') ? '<div class="notice">Import complete.</div>' : '') + (q.get('reset') ? '<div class="notice">Demo data restored.</div>' : '') +
    (!S.storageAvailable() ? '<div class="notice warn">This browser is blocking storage (private window or strict settings), so changes will be lost when you close the page.</div>' : '') +
    `<div class="grid-halves">
      ${card('How storage works', `<p style="margin-top:0">This is a static site hosted on GitHub Pages. There is no server: everything you add is saved <strong>in this browser only</strong> (localStorage).</p>
        <ul class="muted" style="padding-left:18px;margin-bottom:0"><li>Other people who open the link see their own copy, starting from the demo data.</li>
        <li>Clearing your browser data deletes your records. Export regularly if you care about them.</li>
        <li>Use Export / Import to move your data to another computer or browser.</li>
        <li>Don't enter real candidate personal information here. See <a class="link" href="docs/privacy.md" target="_blank">docs/privacy.md</a>.</li></ul>`)}
      ${card('Records in this browser', `<dl class="dl">${counts}</dl>`)}
      ${card('Back up & restore', `<div class="stack" style="gap:10px">
        <div><button class="btn primary" data-action="export-all">Export all data (JSON)</button></div>
        <label class="field">Import from a TalentLedger export<input type="file" accept="application/json,.json" data-action="import-all"></label>
        <p class="small faint" style="margin:0">Importing replaces everything currently stored in this browser.</p></div>`)}
      ${card('Start again', `<p class="muted" style="margin-top:0">Replace everything in this browser with the original fictional demo data.</p>
        <details class="inline"><summary class="btn danger sm">Reset to demo data…</summary><button class="btn danger" data-action="reset-demo">Yes, wipe my changes and reset</button></details>`)}
    </div>`;
}

export function notFound() {
  return `<div class="empty"><h1>Not found</h1><p>That record doesn't exist or was erased.</p><a class="btn" href="#/">Back to dashboard</a></div>`;
}
