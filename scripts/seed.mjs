// Seeds the TalentLedger database with fictional demo data.
//   node scripts/seed.mjs            -> create schema and seed (only if empty)
//   node scripts/seed.mjs --reset    -> delete the database and reseed
// All companies and people below are invented.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.resolve(root, process.env.DATABASE_PATH || 'data/talentledger.db');
const reset = process.argv.includes('--reset');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (reset) {
  for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(fs.readFileSync(path.join(root, 'lib/schema.sql'), 'utf8'));

const existing = db.prepare('SELECT COUNT(*) AS n FROM candidates').get().n;
if (existing > 0) {
  console.log(`Database already has ${existing} candidates — skipping seed. Use "npm run reset" to start fresh.`);
  process.exit(0);
}

// Deterministic pseudo-random so every seed looks the same.
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (a, b) => Math.floor(a + rand() * (b - a + 1));
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const dateOffset = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

db.exec('BEGIN');

// Consultants ---------------------------------------------------------------
const consultants = [
  ['Priya Raman', 'priya@talentledger.example', 'manager'],
  ['Tom Achterberg', 'tom@talentledger.example', 'consultant'],
  ['Mei Lin', 'mei@talentledger.example', 'consultant'],
  ['Jack Fenwick', 'jack@talentledger.example', 'resourcer'],
];
const insC = db.prepare('INSERT INTO consultants (name, email, role) VALUES (?, ?, ?)');
consultants.forEach((c) => insC.run(...c));
const consultantIds = [1, 2, 3, 4];

// Companies & contacts -----------------------------------------------------
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
const insCo = db.prepare(`INSERT INTO companies (name, industry, location, status, terms_signed, default_fee_pct, owner_id, website, abn, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
companies.forEach((c, i) => {
  const slug = c[0].toLowerCase().replace(/[^a-z]+/g, '');
  insCo.run(...c, consultantIds[i % 3], `https://${slug}.example`, `${int(10, 99)} ${int(100, 999)} ${int(100, 999)} ${int(100, 999)}`,
    c[3] === 'prospect' ? 'Warm lead from industry event. Pitch retained search.' : null);
});

const contactNames = ['Sarah Mitchell', 'David Nguyen', 'Emma Clarke', 'Liam O\'Brien', 'Chloe Papadopoulos', 'Raj Patel',
  'Olivia Walsh', 'Noah Kim', 'Grace Thompson', 'Ethan Rossi', 'Isla McDonald', 'Lucas Fernando', 'Ava Sutherland',
  'Henry Tran', 'Mia Kowalski', 'James Whitfield', 'Zoe Hartley', 'William Chen', 'Ruby Anderson', 'Oscar Singh'];
const contactTitles = ['Head of Talent', 'HR Business Partner', 'CFO', 'Engineering Manager', 'Operations Director',
  'Talent Acquisition Lead', 'General Manager', 'CTO'];
const insCt = db.prepare('INSERT INTO contacts (company_id, name, title, email, phone, is_hiring_manager) VALUES (?, ?, ?, ?, ?, ?)');
contactNames.forEach((n, i) => {
  const companyId = (i % companies.length) + 1;
  const email = n.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@example.com';
  insCt.run(companyId, n, pick(contactTitles), email, `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`, i < 10 ? 1 : 0);
});

// Candidates ----------------------------------------------------------------
const first = ['Alex', 'Jordan', 'Sam', 'Charlotte', 'Hamish', 'Aisha', 'Ben', 'Freya', 'Kai', 'Lachlan', 'Nadia', 'Oliver',
  'Poppy', 'Quinn', 'Rohan', 'Sienna', 'Tariq', 'Uma', 'Vince', 'Willow', 'Xavier', 'Yasmin', 'Zac', 'Harper', 'Declan',
  'Imogen', 'Jasper', 'Keira', 'Matilda', 'Nikhil', 'Phoebe', 'Riley', 'Saoirse', 'Theo', 'Hugo', 'Leila', 'Marcus', 'Ella', 'Finn', 'Talia'];
const last = ['Brennan', 'Costa', 'Doyle', 'Evans', 'Fraser', 'Gupta', 'Hughes', 'Ibrahim', 'Jensen', 'Kaur', 'Lawson',
  'Morgan', 'Nakamura', 'Okafor', 'Price', 'Quinlan', 'Reid', 'Sharma', 'Taylor', 'Usman', 'Vu', 'Watson', 'Young', 'Zhang'];
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
const employers = ['Atlas Group', 'Northwind AU', 'Blue Harbour Bank', 'Summit Health', 'Redgum Retail', 'Oakridge Consulting',
  'Pinnacle Telco', 'Greenfield Agri', 'Lighthouse Media', 'Mosaic Digital'];
const locations = ['Sydney NSW', 'Melbourne VIC', 'Brisbane QLD', 'Perth WA', 'Adelaide SA', 'Canberra ACT', 'Hobart TAS', 'Newcastle NSW', 'Remote'];
const sources = ['LinkedIn', 'SEEK', 'Referral', 'Website', 'Headhunt', 'Database'];
const rights = ['Australian citizen', 'Permanent resident', 'Full work rights', 'Sponsorship required', 'NZ citizen'];
const notice = ['Immediate', '2 weeks', '4 weeks', '6 weeks', '3 months'];
const insCand = db.prepare(`INSERT INTO candidates
  (first_name, last_name, email, phone, location, current_title, current_employer, skills, seeking, salary_expectation, day_rate,
   notice_period, work_rights, source, status, owner_id, consent_at, consent_source, last_contacted_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const candProfile = [];
for (let i = 0; i < 40; i++) {
  const fn = first[i];
  const ln = pick(last);
  const p = profiles[i % profiles.length];
  candProfile.push(i % profiles.length);
  const seeking = pick(['perm', 'perm', 'contract', 'either']);
  const created = int(3, 240);
  const status = i === 38 ? 'do_not_contact' : pick(['active', 'active', 'active', 'passive']);
  insCand.run(fn, ln, `${fn}.${ln}`.toLowerCase() + '@mail.example', `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
    pick(locations), p.title, pick(employers), p.skills, seeking, int(p.sal[0], p.sal[1]) * 1000,
    seeking === 'perm' ? null : Math.round(int(p.rate[0], p.rate[1]) / 25) * 25,
    pick(notice), pick(rights), pick(sources), status, consultantIds[i % 4],
    rand() > 0.15 ? daysAgo(created) : null, 'Candidate registration form', daysAgo(int(0, Math.min(created, 60))), daysAgo(created));
}

// Jobs ----------------------------------------------------------------------
// [companyIdx, profileIdx, type, engagement, status, priority, openedDaysAgo]
const jobs = [
  [4, 0, 'contract', 'contingent', 'open', 'high', 12],
  [7, 2, 'perm', 'exclusive', 'open', 'high', 20],
  [2, 6, 'perm', 'contingent', 'open', 'medium', 34],
  [1, 9, 'perm', 'retained', 'open', 'high', 8],
  [3, 8, 'perm', 'contingent', 'open', 'medium', 45],
  [6, 7, 'contract', 'contingent', 'open', 'medium', 16],
  [10, 5, 'perm', 'contingent', 'open', 'low', 60],
  [7, 3, 'contract', 'exclusive', 'open', 'high', 5],
  [4, 1, 'perm', 'retained', 'on_hold', 'medium', 70],
  [2, 4, 'perm', 'contingent', 'filled', 'medium', 95],
  [1, 0, 'contract', 'contingent', 'filled', 'medium', 110],
  [10, 5, 'perm', 'contingent', 'filled', 'low', 130],
  [4, 3, 'perm', 'retained', 'filled', 'high', 150],
  [3, 8, 'perm', 'contingent', 'filled', 'medium', 75],
  [2, 2, 'perm', 'exclusive', 'filled', 'high', 50],
];
const insJob = db.prepare(`INSERT INTO jobs (company_id, contact_id, title, job_type, engagement, location, work_mode,
  salary_min, salary_max, day_rate, fee_pct, openings, status, priority, description, owner_id, opened_at, closed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
jobs.forEach((j, i) => {
  const [co, pi, type, eng, status, prio, opened] = j;
  const p = profiles[pi];
  const company = companies[co - 1];
  const contactId = co; // first contact for each company is the hiring manager
  const mid = (p.sal[0] + p.sal[1]) / 2;
  insJob.run(co, contactId, p.title, type, eng, company[2], pick(['onsite', 'hybrid', 'hybrid', 'remote']),
    type === 'perm' ? Math.round(mid * 0.9) * 1000 : null, type === 'perm' ? Math.round(mid * 1.1) * 1000 : null,
    type !== 'perm' ? Math.round((p.rate[1] * 1.2) / 25) * 25 : null, type === 'perm' ? company[5] : null,
    1, status, prio,
    `${company[0]} is looking for a ${p.title} to join a growing team. Key skills: ${p.skills}.`,
    consultantIds[i % 3], dateOffset(-opened), status === 'filled' ? dateOffset(-opened + 40) : null);
});

// Applications (pipeline) -------------------------------------------------
const stagesForOpen = ['sourced', 'sourced', 'screened', 'screened', 'submitted', 'submitted', 'interview', 'interview', 'offer', 'rejected', 'withdrawn'];
const order = ['sourced', 'screened', 'submitted', 'interview', 'offer', 'placed'];
const insApp = db.prepare('INSERT OR IGNORE INTO applications (candidate_id, job_id, stage, rejection_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
const insHist = db.prepare('INSERT INTO stage_history (application_id, from_stage, to_stage, changed_at) VALUES (?, ?, ?, ?)');
const insPl = db.prepare(`INSERT INTO placements (application_id, start_date, base_salary, fee_pct, fee_amount, pay_rate, charge_rate, end_date, invoice_status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

jobs.forEach((j, idx) => {
  const jobId = idx + 1;
  const [, pi, type, , status, , opened] = j;
  const matching = candProfile.map((p, ci) => ({ p, ci })).filter((x) => x.p === pi).map((x) => x.ci + 1);
  const others = Array.from({ length: 40 }, (_, k) => k + 1).filter((k) => !matching.includes(k) && k !== 39);
  const pool = [...matching.filter((k) => k !== 39), ...Array.from({ length: 2 }, () => pick(others))];
  const n = status === 'open' ? int(5, 8) : int(3, 5);
  const chosen = [...new Set(pool)].slice(0, n);
  chosen.forEach((candId, k) => {
    let stage;
    if (status === 'filled') stage = k === 0 ? 'placed' : pick(['rejected', 'rejected', 'withdrawn']);
    else if (status === 'on_hold') stage = pick(['screened', 'submitted']);
    else stage = pick(stagesForOpen);
    const created = daysAgo(Math.max(1, opened - int(0, 4)));
    const updated = daysAgo(int(0, Math.max(1, Math.floor(opened / 2))));
    const reason = stage === 'rejected' ? pick(['Salary expectations too high', 'Lacked domain experience', 'Client chose another candidate', 'Culture fit concerns'])
      : stage === 'withdrawn' ? pick(['Accepted counter-offer', 'Took another role', 'Relocation not possible']) : null;
    const r = insApp.run(candId, jobId, stage, reason, created, updated);
    if (!r.changes) return;
    const appId = Number(r.lastInsertRowid);
    const target = order.indexOf(stage) === -1 ? 3 : order.indexOf(stage);
    let prev = null;
    for (let st = 0; st <= target; st++) { insHist.run(appId, prev, order[st], created); prev = order[st]; }
    if (order.indexOf(stage) === -1) insHist.run(appId, prev, stage, updated);
    if (stage === 'placed') {
      const p = profiles[pi];
      const start = dateOffset(-opened + 55);
      if (type === 'perm') {
        const base = int(p.sal[0], p.sal[1]) * 1000;
        const pct = companies[j[0] - 1][5];
        insPl.run(appId, start, base, pct, Math.round(base * pct / 100), null, null, null, opened < 60 ? 'not_invoiced' : pick(['invoiced', 'paid', 'paid']), daysAgo(opened - 40));
      } else {
        const pay = Math.round(p.rate[0] / 25) * 25;
        insPl.run(appId, start, null, null, null, pay, Math.round((pay * 1.18) / 25) * 25, dateOffset(-opened + 55 + 180), 'invoiced', daysAgo(opened - 40));
      }
      db.prepare("UPDATE candidates SET status = 'placed' WHERE id = ?").run(candId);
    }
  });
});

// Activities ------------------------------------------------------------------
const insAct = db.prepare(`INSERT INTO activities (kind, subject, body, candidate_id, company_id, contact_id, job_id, consultant_id, due_at, done_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const apps = db.prepare(`SELECT a.id, a.candidate_id, a.job_id, a.stage, j.company_id, j.contact_id, j.title
  FROM applications a JOIN jobs j ON j.id = a.job_id`).all();
for (const a of apps) {
  const who = consultantIds[a.candidate_id % 4];
  insAct.run('call', `Screening call — ${a.title}`, 'Discussed motivations, salary and notice. Strong communicator.',
    a.candidate_id, null, null, a.job_id, who, null, null, daysAgo(int(5, 40)));
  if (['interview', 'offer'].includes(a.stage)) {
    const due = `${dateOffset(int(0, 6))} ${String(int(9, 16)).padStart(2, '0')}:${pick(['00', '30'])}`;
    insAct.run('interview', `Client interview — ${a.title}`, 'Panel interview with hiring manager.', a.candidate_id, a.company_id,
      a.contact_id, a.job_id, who, due, null, daysAgo(int(1, 5)));
  }
  if (a.stage === 'submitted') {
    insAct.run('task', 'Chase client feedback on shortlist', null, a.candidate_id, a.company_id, a.contact_id, a.job_id, who,
      dateOffset(int(0, 4)) + ' 10:00', null, daysAgo(2));
  }
}
const companyNotes = [
  ['meeting', 'Quarterly account review', 'Discussed hiring plan for next quarter; 3–4 roles expected in tech.'],
  ['email', 'Sent updated terms of business', 'Fee 18% of base, 90-day replacement guarantee.'],
  ['call', 'BD call — upcoming projects', 'Contact mentioned a new transformation program starting soon.'],
];
for (let co = 1; co <= companies.length; co++) {
  const [kind, subject, body] = pick(companyNotes);
  insAct.run(kind, subject, body, null, co, co, null, consultantIds[co % 3], null, null, daysAgo(int(1, 30)));
}
insAct.run('task', 'Send retained search proposal', 'Prospect asked for a proposal covering 3 roles.', null, 5, 5, null, 1, dateOffset(2) + ' 09:00', null, daysAgo(1));
insAct.run('task', 'Reference checks for offer candidate', null, null, 7, 7, 8, 2, dateOffset(1) + ' 11:00', null, daysAgo(1));
insAct.run('task', 'Follow up Wattle Energy intro', null, null, 9, 9, null, 3, dateOffset(-1) + ' 14:00', null, daysAgo(4));

db.exec('COMMIT');

const counts = ['consultants', 'companies', 'contacts', 'candidates', 'jobs', 'applications', 'placements', 'activities']
  .map((t) => `${t}: ${db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n}`).join(', ');
console.log(`Seeded ${dbPath}\n  ${counts}`);
