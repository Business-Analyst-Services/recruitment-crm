-- TalentLedger schema (SQLite)
-- Core objects: consultants, companies (clients), contacts, candidates, jobs,
-- applications (the pipeline join between candidate and job), placements, activities.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS consultants (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'consultant'   -- consultant | resourcer | manager | admin
);

CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  industry      TEXT,
  abn           TEXT,
  website       TEXT,
  location      TEXT,
  status        TEXT NOT NULL DEFAULT 'prospect',  -- prospect | active | dormant
  terms_signed  INTEGER NOT NULL DEFAULT 0,        -- signed terms of business on file
  default_fee_pct REAL,                            -- perm fee % of first-year base
  owner_id      INTEGER REFERENCES consultants(id),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id          INTEGER PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  is_hiring_manager INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id                 INTEGER PRIMARY KEY,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  email              TEXT,
  phone              TEXT,
  location           TEXT,
  current_title      TEXT,
  current_employer   TEXT,
  skills             TEXT,                          -- comma-separated tags
  seeking            TEXT NOT NULL DEFAULT 'perm',  -- perm | contract | either
  salary_expectation INTEGER,                       -- AUD, base incl. or excl. super noted in notes
  day_rate           INTEGER,                       -- AUD per day, for contractors
  notice_period      TEXT,
  work_rights        TEXT,                          -- e.g. Full work rights, Sponsorship required
  source             TEXT,                          -- LinkedIn, SEEK, Referral, Website, Headhunt
  status             TEXT NOT NULL DEFAULT 'active',-- active | passive | placed | do_not_contact
  owner_id           INTEGER REFERENCES consultants(id),
  consent_at         TEXT,                          -- when collection/consent notice was acknowledged
  consent_source     TEXT,                          -- how consent was captured
  last_contacted_at  TEXT,
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  job_type      TEXT NOT NULL DEFAULT 'perm',      -- perm | contract | temp
  engagement    TEXT NOT NULL DEFAULT 'contingent',-- contingent | exclusive | retained
  location      TEXT,
  work_mode     TEXT,                              -- onsite | hybrid | remote
  salary_min    INTEGER,
  salary_max    INTEGER,
  day_rate      INTEGER,                           -- client charge rate for contract roles
  fee_pct       REAL,                              -- perm fee %
  openings      INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'open',      -- open | on_hold | filled | closed
  priority      TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high
  description   TEXT,
  owner_id      INTEGER REFERENCES consultants(id),
  opened_at     TEXT NOT NULL DEFAULT (date('now')),
  closed_at     TEXT
);

-- An application is one candidate in one job's pipeline.
CREATE TABLE IF NOT EXISTS applications (
  id            INTEGER PRIMARY KEY,
  candidate_id  INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL DEFAULT 'sourced',
  -- sourced | screened | submitted | interview | offer | placed | rejected | withdrawn
  rejection_reason TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE IF NOT EXISTS stage_history (
  id              INTEGER PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage      TEXT,
  to_stage        TEXT NOT NULL,
  changed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS placements (
  id              INTEGER PRIMARY KEY,
  application_id  INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  start_date      TEXT,
  base_salary     INTEGER,          -- perm: first-year base (AUD)
  fee_pct         REAL,             -- perm fee %
  fee_amount      INTEGER,          -- perm: invoiced fee (AUD, ex GST)
  pay_rate        INTEGER,          -- contract: daily pay rate to contractor
  charge_rate     INTEGER,          -- contract: daily charge rate to client
  end_date        TEXT,             -- contract end
  guarantee_days  INTEGER NOT NULL DEFAULT 90,
  invoice_status  TEXT NOT NULL DEFAULT 'not_invoiced', -- not_invoiced | invoiced | paid
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id            INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL,     -- note | call | email | meeting | interview | task
  subject       TEXT NOT NULL,
  body          TEXT,
  candidate_id  INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
  company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  job_id        INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  consultant_id INTEGER REFERENCES consultants(id),
  due_at        TEXT,              -- set for tasks / scheduled interviews
  done_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_job ON applications(job_id, stage);
CREATE INDEX IF NOT EXISTS idx_app_cand ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_act_cand ON activities(candidate_id);
CREATE INDEX IF NOT EXISTS idx_act_company ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_act_due ON activities(due_at, done_at);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
