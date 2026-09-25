// TalentLedger data store.
// All data lives in this browser's localStorage under one key. Nothing is sent anywhere.
// Tables mirror the original SQLite schema (see docs/domain-model.md).

const KEY = 'talentledger:v1';
export const CURRENT_CONSULTANT_ID = 1; // no login yet — everything is attributed to consultant #1

const TABLES = ['consultants', 'companies', 'contacts', 'candidates', 'jobs', 'applications', 'stage_history', 'placements', 'activities'];

let db = null;
let storageOk = true;

// ---------------------------------------------------------------------------
// Time helpers. Timestamps are ISO strings (UTC). Due dates are local wall-clock
// "YYYY-MM-DDTHH:MM". Plain dates are "YYYY-MM-DD".
export const nowIso = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localDateTime = (d = new Date()) => `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();
const dateOffset = (n) => localDate(new Date(Date.now() + n * 86400000));

// ---------------------------------------------------------------------------
// Persistence

function empty() {
  const d = { version: 1, seq: {} };
  TABLES.forEach((t) => { d[t] = []; d.seq[t] = 0; });
  return d;
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { storageOk = false; }
  if (raw) {
    try { db = JSON.parse(raw); } catch { db = null; }
  }
  if (!db || !db.candidates) { db = seed(); save(); }
  return db;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); storageOk = true; } catch { storageOk = false; }
}

export const storageAvailable = () => storageOk;

export function resetDemo() { db = seed(); save(); }

export function exportAll() { return JSON.stringify({ app: 'TalentLedger', exported_at: nowIso(), data: db }, null, 2); }

export function importAll(text) {
  const parsed = JSON.parse(text);
  const data = parsed.data ?? parsed;
  if (!data || !Array.isArray(data.candidates) || !Array.isArray(data.jobs)) throw new Error('This file is not a TalentLedger export.');
  TABLES.forEach((t) => { if (!Array.isArray(data[t])) data[t] = []; });
  data.seq = data.seq || {};
  TABLES.forEach((t) => { data.seq[t] = Math.max(data.seq[t] || 0, ...data[t].map((r) => r.id || 0), 0); });
  db = data;
  save();
}

// ---------------------------------------------------------------------------
// Generic table access

export const all = (t) => db[t];
export const byId = (t, id) => db[t].find((r) => r.id === Number(id));

function insert(t, row) {
  db.seq[t] = (db.seq[t] || 0) + 1;
  const rec = { id: db.seq[t], ...row };
  db[t].push(rec);
  return rec;
}
function update(t, id, patch) {
  const r = byId(t, id);
  if (r) Object.assign(r, patch);
  return r;
}
function remove(t, pred) { db[t] = db[t].filter((r) => !pred(r)); }

// ---------------------------------------------------------------------------
// Lookups used by views

export const consultant = (id) => byId('consultants', id);
export const company = (id) => byId('companies', id);
export const contact = (id) => byId('contacts', id);
export const candidate = (id) => byId('candidates', id);
export const job = (id) => byId('jobs', id);
export const fullName = (c) => (c ? `${c.first_name} ${c.last_name}` : '—');

export const applicationsForJob = (jobId) => db.applications.filter((a) => a.job_id === Number(jobId));
export const applicationsForCandidate = (cid) => db.applications.filter((a) => a.candidate_id === Number(cid));
export const placementForApp = (appId) => db.placements.find((p) => p.application_id === appId);

export function activitiesFor({ candidate: c, company: co, job: j }, limit = 50) {
  return db.activities
    .filter((a) => (c && a.candidate_id === c) || (co && a.company_id === co) || (j && a.job_id === j))
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, limit);
}
const sortKey = (a) => a.done_at || (a.due_at ? new Date(a.due_at).toISOString() : a.created_at);

export const openTasks = () => db.activities.filter((a) => !a.done_at && a.due_at).sort((a, b) => a.due_at.localeCompare(b.due_at));
export const recentActivity = (n = 30) => db.activities.filter((a) => a.done_at).sort((a, b) => b.done_at.localeCompare(a.done_at)).slice(0, n);

// ---------------------------------------------------------------------------
// Mutations (mirror the original Server Actions)

export function saveCandidate(id, f, consent) {
  const fields = {
    first_name: f.first_name, last_name: f.last_name, email: f.email, phone: f.phone, location: f.location,
    current_title: f.current_title, current_employer: f.current_employer, skills: f.skills, seeking: f.seeking || 'perm',
    salary_expectation: f.salary_expectation, day_rate: f.day_rate, notice_period: f.notice_period, work_rights: f.work_rights,
    source: f.source, status: f.status || 'active', owner_id: f.owner_id, notes: f.notes,
  };
  let rec;
  if (id) rec = update('candidates', id, fields);
  else rec = insert('candidates', { ...fields, created_at: nowIso(), last_contacted_at: null, consent_at: null, consent_source: null });
  if (consent && !rec.consent_at) { rec.consent_at = nowIso(); rec.consent_source = 'Recorded by consultant'; }
  save();
  return rec;
}

/** Privacy: permanently remove a candidate and everything linked to them. */
export function eraseCandidate(id) {
  id = Number(id);
  const appIds = new Set(db.applications.filter((a) => a.candidate_id === id).map((a) => a.id));
  remove('placements', (p) => appIds.has(p.application_id));
  remove('stage_history', (h) => appIds.has(h.application_id));
  remove('applications', (a) => a.candidate_id === id);
  remove('activities', (a) => a.candidate_id === id);
  remove('candidates', (c) => c.id === id);
  save();
}

export function saveCompany(id, f) {
  const fields = {
    name: f.name, industry: f.industry, abn: f.abn, website: f.website, location: f.location, status: f.status || 'prospect',
    terms_signed: !!f.terms_signed, default_fee_pct: f.default_fee_pct, owner_id: f.owner_id, notes: f.notes,
  };
  const rec = id ? update('companies', id, fields) : insert('companies', { ...fields, created_at: nowIso() });
  save();
  return rec;
}

export function addContact(companyId, f) {
  insert('contacts', { company_id: Number(companyId), name: f.name, title: f.title, email: f.email, phone: f.phone, is_hiring_manager: !!f.is_hiring_manager, created_at: nowIso() });
  save();
}

export function saveJob(id, f) {
  const co = company(f.company_id);
  const fields = {
    company_id: f.company_id, contact_id: f.contact_id, title: f.title, job_type: f.job_type || 'perm', engagement: f.engagement || 'contingent',
    location: f.location, work_mode: f.work_mode, salary_min: f.salary_min, salary_max: f.salary_max, day_rate: f.day_rate,
    fee_pct: f.fee_pct ?? co?.default_fee_pct ?? null, openings: f.openings || 1, status: f.status || 'open',
    priority: f.priority || 'medium', description: f.description, owner_id: f.owner_id,
  };
  let rec;
  if (id) {
    rec = update('jobs', id, fields);
    rec.closed_at = ['filled', 'closed'].includes(rec.status) ? rec.closed_at || localDate() : null;
  } else rec = insert('jobs', { ...fields, opened_at: localDate(), closed_at: null });
  save();
  return rec;
}

export function addToPipeline(candidateId, jobId) {
  candidateId = Number(candidateId); jobId = Number(jobId);
  if (db.applications.some((a) => a.candidate_id === candidateId && a.job_id === jobId)) return;
  const t = nowIso();
  const app = insert('applications', { candidate_id: candidateId, job_id: jobId, stage: 'sourced', rejection_reason: null, created_at: t, updated_at: t });
  insert('stage_history', { application_id: app.id, from_stage: null, to_stage: 'sourced', changed_at: t });
  save();
}

/**
 * Move an application to a new stage. Moving to "placed" creates a placement
 * (fee pre-calculated from the job) and marks the candidate as placed.
 */
export function moveStage(appId, stage, reason = null) {
  const app = byId('applications', appId);
  if (!app || app.stage === stage) return;
  const from = app.stage;
  const t = nowIso();
  app.stage = stage;
  app.rejection_reason = ['rejected', 'withdrawn'].includes(stage) ? reason : null;
  app.updated_at = t;
  insert('stage_history', { application_id: app.id, from_stage: from, to_stage: stage, changed_at: t });

  if (stage === 'placed') {
    const j = job(app.job_id);
    const c = candidate(app.candidate_id);
    if (!placementForApp(app.id)) {
      const start = dateOffset(28);
      if (j.job_type === 'perm') {
        const base = c.salary_expectation ?? (j.salary_min && j.salary_max ? Math.round((j.salary_min + j.salary_max) / 2) : j.salary_max ?? j.salary_min);
        insert('placements', {
          application_id: app.id, start_date: start, base_salary: base ?? null, fee_pct: j.fee_pct,
          fee_amount: base && j.fee_pct ? Math.round((base * j.fee_pct) / 100) : null, pay_rate: null, charge_rate: null,
          end_date: null, guarantee_days: 90, invoice_status: 'not_invoiced', created_at: t,
        });
      } else {
        insert('placements', {
          application_id: app.id, start_date: start, base_salary: null, fee_pct: null, fee_amount: null, pay_rate: c.day_rate ?? null,
          charge_rate: j.day_rate ?? null, end_date: dateOffset(28 + 182), guarantee_days: 90, invoice_status: 'not_invoiced', created_at: t,
        });
      }
    }
    c.status = 'placed';
    insert('activities', { kind: 'note', subject: `Placed — ${j.title}`, body: null, candidate_id: c.id, company_id: null, contact_id: null, job_id: j.id, consultant_id: CURRENT_CONSULTANT_ID, due_at: null, done_at: t, created_at: t });
  } else if (from === 'placed') {
    remove('placements', (p) => p.application_id === app.id); // moving back out removes the provisional placement
  }
  save();
}

export function addActivity(f) {
  const kind = f.kind || 'note';
  const scheduled = kind === 'task' || (kind === 'interview' && f.due_at);
  const t = nowIso();
  insert('activities', {
    kind, subject: f.subject, body: f.body, candidate_id: f.candidate_id, company_id: f.company_id, contact_id: f.contact_id,
    job_id: f.job_id, consultant_id: CURRENT_CONSULTANT_ID, due_at: f.due_at || null, done_at: scheduled ? null : t, created_at: t,
  });
  if (f.candidate_id && ['call', 'email', 'meeting'].includes(kind)) {
    const c = candidate(f.candidate_id);
    if (c) c.last_contacted_at = t;
  }
  save();
}

export function completeActivity(id) { update('activities', id, { done_at: nowIso() }); save(); }

export function savePlacement(id, f) {
  const fee = f.fee_amount ?? (f.base_salary && f.fee_pct ? Math.round((f.base_salary * f.fee_pct) / 100) : null);
  update('placements', id, {
    start_date: f.start_date, base_salary: f.base_salary, fee_pct: f.fee_pct, fee_amount: fee, pay_rate: f.pay_rate,
    charge_rate: f.charge_rate, end_date: f.end_date, guarantee_days: f.guarantee_days ?? 90, invoice_status: f.invoice_status || 'not_invoiced',
  });
  save();
}

// ---------------------------------------------------------------------------
// Demo data. Deterministic, so every reset looks the same. All companies and people are invented.

function seed() {
  const d = empty();
  const put = (t, row) => { d.seq[t] += 1; const r = { id: d.seq[t], ...row }; d[t].push(r); return r; };

  let s = 42;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => Math.floor(a + rand() * (b - a + 1));

  [['Priya Raman', 'priya@talentledger.example', 'manager'], ['Tom Achterberg', 'tom@talentledger.example', 'consultant'],
   ['Mei Lin', 'mei@talentledger.example', 'consultant'], ['Jack Fenwick', 'jack@talentledger.example', 'resourcer']]
    .forEach(([name, email, role]) => put('consultants', { name, email, role }));
  const cons = [1, 2, 3, 4];

  const companies = [
    ['Harbourline Logistics', 'Transport & Logistics', 'Sydney NSW', 'active', 1, 18],
    ['Southern Cross Health Partners', 'Healthcare', 'Melbourne VIC', 'active', 1, 20],
    ['Kestrel Mining Services', 'Mining & Resources', 'Perth WA', 'active', 1, 17.5],
    ['Bluegum Financial', 'Financial Services', 'Sydney NSW', 'active', 1, 20],
    ['Paddock to Plate Co.', 'FMCG', 'Brisbane QLD', 'prospect', 0, 18],
    ['Riverstone Council', 'Government', 'Parramatta NSW', 'active', 1, 15],
    ['Coralsea Software', 'Technology', 'Brisbane QLD', 'active', 1, 20],
    ['Ironbark Construction', 'Construction', 'Newcastle NSW', 'dormant', 1, 18],
    ['Wattle Energy', 'Energy & Utilities', 'Adelaide SA', 'prospect', 0, 18],
    ['Tidewater Insurance', 'Insurance', 'Melbourne VIC', 'active', 1, 19],
  ];
  companies.forEach((c, i) => {
    const slug = c[0].toLowerCase().replace(/[^a-z]+/g, '');
    put('companies', {
      name: c[0], industry: c[1], location: c[2], status: c[3], terms_signed: !!c[4], default_fee_pct: c[5], owner_id: cons[i % 3],
      website: `https://${slug}.example`, abn: `${int(10, 99)} ${int(100, 999)} ${int(100, 999)} ${int(100, 999)}`,
      notes: c[3] === 'prospect' ? 'Warm lead from industry event. Pitch retained search.' : null, created_at: daysAgoIso(int(200, 900)),
    });
  });

  const contactNames = ['Sarah Mitchell', 'David Nguyen', 'Emma Clarke', "Liam O'Brien", 'Chloe Papadopoulos', 'Raj Patel', 'Olivia Walsh',
    'Noah Kim', 'Grace Thompson', 'Ethan Rossi', 'Isla McDonald', 'Lucas Fernando', 'Ava Sutherland', 'Henry Tran', 'Mia Kowalski',
    'James Whitfield', 'Zoe Hartley', 'William Chen', 'Ruby Anderson', 'Oscar Singh'];
  const contactTitles = ['Head of Talent', 'HR Business Partner', 'CFO', 'Engineering Manager', 'Operations Director', 'Talent Acquisition Lead', 'General Manager', 'CTO'];
  contactNames.forEach((n, i) => put('contacts', {
    company_id: (i % companies.length) + 1, name: n, title: pick(contactTitles),
    email: n.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@example.com',
    phone: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`, is_hiring_manager: i < 10, created_at: daysAgoIso(300),
  }));

  const first = ['Alex', 'Jordan', 'Sam', 'Charlotte', 'Hamish', 'Aisha', 'Ben', 'Freya', 'Kai', 'Lachlan', 'Nadia', 'Oliver', 'Poppy', 'Quinn',
    'Rohan', 'Sienna', 'Tariq', 'Uma', 'Vince', 'Willow', 'Xavier', 'Yasmin', 'Zac', 'Harper', 'Declan', 'Imogen', 'Jasper', 'Keira', 'Matilda',
    'Nikhil', 'Phoebe', 'Riley', 'Saoirse', 'Theo', 'Hugo', 'Leila', 'Marcus', 'Ella', 'Finn', 'Talia'];
  const last = ['Brennan', 'Costa', 'Doyle', 'Evans', 'Fraser', 'Gupta', 'Hughes', 'Ibrahim', 'Jensen', 'Kaur', 'Lawson', 'Morgan', 'Nakamura',
    'Okafor', 'Price', 'Quinlan', 'Reid', 'Sharma', 'Taylor', 'Usman', 'Vu', 'Watson', 'Young', 'Zhang'];
  const profiles = [
    { title: 'Senior Business Analyst', skills: 'Business Analysis, BABOK, Process Mapping, Jira, Stakeholder Management', sal: [130, 165], rate: [850, 1050] },
    { title: 'Product Owner', skills: 'Agile, Scrum, Backlog Management, Jira, Product Discovery', sal: [140, 175], rate: [900, 1100] },
    { title: 'Full Stack Developer', skills: 'TypeScript, React, Node.js, AWS, PostgreSQL', sal: [120, 170], rate: [800, 1000] },
    { title: 'Data Engineer', skills: 'Python, SQL, dbt, Snowflake, Airflow', sal: [135, 180], rate: [900, 1150] },
    { title: 'Payroll Officer', skills: 'Payroll, Award Interpretation, SAP, ADP', sal: [75, 95], rate: [450, 550] },
    { title: 'Financial Accountant', skills: 'CA/CPA, Month-end, IFRS, Xero, NetSuite', sal: [100, 130], rate: [600, 750] },
    { title: 'Registered Nurse', skills: 'AHPRA, ICU, Patient Care, Triage', sal: [85, 110], rate: [500, 650] },
    { title: 'Project Manager', skills: 'PMP, Prince2, Delivery, Budget Management, Risk', sal: [140, 180], rate: [950, 1200] },
    { title: 'Site Supervisor', skills: 'WHS, White Card, Civil Works, Scheduling', sal: [120, 150], rate: [700, 850] },
    { title: 'Supply Chain Analyst', skills: 'Demand Planning, Excel, SAP, Power BI', sal: [90, 115], rate: [550, 700] },
  ];
  const employers = ['Atlas Group', 'Northwind AU', 'Blue Harbour Bank', 'Summit Health', 'Redgum Retail', 'Oakridge Consulting', 'Pinnacle Telco', 'Greenfield Agri', 'Lighthouse Media', 'Mosaic Digital'];
  const locations = ['Sydney NSW', 'Melbourne VIC', 'Brisbane QLD', 'Perth WA', 'Adelaide SA', 'Canberra ACT', 'Hobart TAS', 'Newcastle NSW', 'Remote'];
  const sources = ['LinkedIn', 'SEEK', 'Referral', 'Website', 'Headhunt', 'Database'];
  const rights = ['Australian citizen', 'Permanent resident', 'Full work rights', 'Sponsorship required', 'NZ citizen'];
  const notice = ['Immediate', '2 weeks', '4 weeks', '6 weeks', '3 months'];

  const candProfile = [];
  for (let i = 0; i < 40; i++) {
    const fn = first[i];
    const ln = pick(last);
    const p = profiles[i % profiles.length];
    candProfile.push(i % profiles.length);
    const seeking = pick(['perm', 'perm', 'contract', 'either']);
    const created = int(3, 240);
    const status = i === 38 ? 'do_not_contact' : pick(['active', 'active', 'active', 'passive']);
    put('candidates', {
      first_name: fn, last_name: ln, email: `${fn}.${ln}`.toLowerCase() + '@mail.example', phone: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
      location: pick(locations), current_title: p.title, current_employer: pick(employers), skills: p.skills, seeking,
      salary_expectation: int(p.sal[0], p.sal[1]) * 1000, day_rate: seeking === 'perm' ? null : Math.round(int(p.rate[0], p.rate[1]) / 25) * 25,
      notice_period: pick(notice), work_rights: pick(rights), source: pick(sources), status, owner_id: cons[i % 4],
      consent_at: rand() > 0.15 ? daysAgoIso(created) : null, consent_source: 'Candidate registration form',
      last_contacted_at: daysAgoIso(int(0, Math.min(created, 60))), notes: null, created_at: daysAgoIso(created),
    });
  }
  d.candidates.forEach((c) => { if (!c.consent_at) c.consent_source = null; });

  // [companyId, profileIdx, type, engagement, status, priority, openedDaysAgo]
  const jobs = [
    [4, 0, 'contract', 'contingent', 'open', 'high', 12], [7, 2, 'perm', 'exclusive', 'open', 'high', 20],
    [2, 6, 'perm', 'contingent', 'open', 'medium', 34], [1, 9, 'perm', 'retained', 'open', 'high', 8],
    [3, 8, 'perm', 'contingent', 'open', 'medium', 45], [6, 7, 'contract', 'contingent', 'open', 'medium', 16],
    [10, 5, 'perm', 'contingent', 'open', 'low', 60], [7, 3, 'contract', 'exclusive', 'open', 'high', 5],
    [4, 1, 'perm', 'retained', 'on_hold', 'medium', 70], [2, 4, 'perm', 'contingent', 'filled', 'medium', 95],
    [1, 0, 'contract', 'contingent', 'filled', 'medium', 110], [10, 5, 'perm', 'contingent', 'filled', 'low', 130],
    [4, 3, 'perm', 'retained', 'filled', 'high', 150], [3, 8, 'perm', 'contingent', 'filled', 'medium', 75],
    [2, 2, 'perm', 'exclusive', 'filled', 'high', 50],
  ];
  jobs.forEach((j, i) => {
    const [co, pi, type, eng, status, prio, opened] = j;
    const p = profiles[pi];
    const c = companies[co - 1];
    const mid = (p.sal[0] + p.sal[1]) / 2;
    put('jobs', {
      company_id: co, contact_id: co, title: p.title, job_type: type, engagement: eng, location: c[2], work_mode: pick(['onsite', 'hybrid', 'hybrid', 'remote']),
      salary_min: type === 'perm' ? Math.round(mid * 0.9) * 1000 : null, salary_max: type === 'perm' ? Math.round(mid * 1.1) * 1000 : null,
      day_rate: type !== 'perm' ? Math.round((p.rate[1] * 1.2) / 25) * 25 : null, fee_pct: type === 'perm' ? c[5] : null, openings: 1, status, priority: prio,
      description: `${c[0]} is looking for a ${p.title} to join a growing team. Key skills: ${p.skills}.`, owner_id: cons[i % 3],
      opened_at: dateOffset(-opened), closed_at: status === 'filled' ? dateOffset(-opened + 40) : null,
    });
  });

  const stagesForOpen = ['sourced', 'sourced', 'screened', 'screened', 'submitted', 'submitted', 'interview', 'interview', 'offer', 'rejected', 'withdrawn'];
  const order = ['sourced', 'screened', 'submitted', 'interview', 'offer', 'placed'];
  jobs.forEach((j, idx) => {
    const jobId = idx + 1;
    const [co, pi, type, , status, , opened] = j;
    const matching = candProfile.map((p, ci) => ({ p, ci })).filter((x) => x.p === pi).map((x) => x.ci + 1);
    const others = Array.from({ length: 40 }, (_, k) => k + 1).filter((k) => !matching.includes(k) && k !== 39);
    const pool = [...matching.filter((k) => k !== 39), ...Array.from({ length: 2 }, () => pick(others))];
    const n = status === 'open' ? int(5, 8) : int(3, 5);
    [...new Set(pool)].slice(0, n).forEach((candId, k) => {
      if (d.applications.some((a) => a.candidate_id === candId && a.job_id === jobId)) return;
      let stage;
      if (status === 'filled') stage = k === 0 ? 'placed' : pick(['rejected', 'rejected', 'withdrawn']);
      else if (status === 'on_hold') stage = pick(['screened', 'submitted']);
      else stage = pick(stagesForOpen);
      const created = daysAgoIso(Math.max(1, opened - int(0, 4)));
      const updated = daysAgoIso(int(0, Math.max(1, Math.floor(opened / 2))));
      const reason = stage === 'rejected' ? pick(['Salary expectations too high', 'Lacked domain experience', 'Client chose another candidate', 'Culture fit concerns'])
        : stage === 'withdrawn' ? pick(['Accepted counter-offer', 'Took another role', 'Relocation not possible']) : null;
      const app = put('applications', { candidate_id: candId, job_id: jobId, stage, rejection_reason: reason, created_at: created, updated_at: updated });
      const target = order.indexOf(stage) === -1 ? 3 : order.indexOf(stage);
      let prev = null;
      for (let st = 0; st <= target; st++) { put('stage_history', { application_id: app.id, from_stage: prev, to_stage: order[st], changed_at: created }); prev = order[st]; }
      if (order.indexOf(stage) === -1) put('stage_history', { application_id: app.id, from_stage: prev, to_stage: stage, changed_at: updated });
      if (stage === 'placed') {
        const p = profiles[pi];
        const start = dateOffset(-opened + 55);
        if (type === 'perm') {
          const base = int(p.sal[0], p.sal[1]) * 1000;
          const pct = companies[co - 1][5];
          put('placements', { application_id: app.id, start_date: start, base_salary: base, fee_pct: pct, fee_amount: Math.round((base * pct) / 100), pay_rate: null, charge_rate: null, end_date: null, guarantee_days: 90, invoice_status: opened < 60 ? 'not_invoiced' : pick(['invoiced', 'paid', 'paid']), created_at: daysAgoIso(opened - 40) });
        } else {
          const pay = Math.round(p.rate[0] / 25) * 25;
          put('placements', { application_id: app.id, start_date: start, base_salary: null, fee_pct: null, fee_amount: null, pay_rate: pay, charge_rate: Math.round((pay * 1.18) / 25) * 25, end_date: dateOffset(-opened + 55 + 180), guarantee_days: 90, invoice_status: 'invoiced', created_at: daysAgoIso(opened - 40) });
        }
        d.candidates[candId - 1].status = 'placed';
      }
    });
  });

  const act = (row) => put('activities', { body: null, candidate_id: null, company_id: null, contact_id: null, job_id: null, due_at: null, done_at: null, ...row });
  for (const a of [...d.applications]) {
    const j = d.jobs[a.job_id - 1];
    const who = cons[a.candidate_id % 4];
    const t = daysAgoIso(int(5, 40));
    act({ kind: 'call', subject: `Screening call — ${j.title}`, body: 'Discussed motivations, salary and notice. Strong communicator.', candidate_id: a.candidate_id, job_id: a.job_id, consultant_id: who, done_at: t, created_at: t });
    if (['interview', 'offer'].includes(a.stage)) {
      act({ kind: 'interview', subject: `Client interview — ${j.title}`, body: 'Panel interview with hiring manager.', candidate_id: a.candidate_id, company_id: j.company_id,
        contact_id: j.contact_id, job_id: a.job_id, consultant_id: who, due_at: `${dateOffset(int(0, 6))}T${pad(int(9, 16))}:${pick(['00', '30'])}`, created_at: daysAgoIso(int(1, 5)) });
    }
    if (a.stage === 'submitted') {
      act({ kind: 'task', subject: 'Chase client feedback on shortlist', candidate_id: a.candidate_id, company_id: j.company_id, contact_id: j.contact_id, job_id: a.job_id, consultant_id: who, due_at: `${dateOffset(int(0, 4))}T10:00`, created_at: daysAgoIso(2) });
    }
  }
  const companyNotes = [
    ['meeting', 'Quarterly account review', 'Discussed hiring plan for next quarter; 3–4 roles expected in tech.'],
    ['email', 'Sent updated terms of business', 'Fee 18% of base, 90-day replacement guarantee.'],
    ['call', 'BD call — upcoming projects', 'Contact mentioned a new transformation program starting soon.'],
  ];
  for (let co = 1; co <= companies.length; co++) {
    const [kind, subject, body] = pick(companyNotes);
    const t = daysAgoIso(int(1, 30));
    act({ kind, subject, body, company_id: co, contact_id: co, consultant_id: cons[co % 3], done_at: t, created_at: t });
  }
  act({ kind: 'task', subject: 'Send retained search proposal', body: 'Prospect asked for a proposal covering 3 roles.', company_id: 5, contact_id: 5, consultant_id: 1, due_at: `${dateOffset(2)}T09:00`, created_at: daysAgoIso(1) });
  act({ kind: 'task', subject: 'Reference checks for offer candidate', company_id: 7, contact_id: 7, job_id: 8, consultant_id: 2, due_at: `${dateOffset(1)}T11:00`, created_at: daysAgoIso(1) });
  act({ kind: 'task', subject: 'Follow up Wattle Energy intro', company_id: 9, contact_id: 9, consultant_id: 3, due_at: `${dateOffset(-1)}T14:00`, created_at: daysAgoIso(4) });

  return d;
}
