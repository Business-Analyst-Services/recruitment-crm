# Roadmap

In priority order. Items in **Now** are needed before any real data goes in.

The current build is a static GitHub Pages site: every viewer's data lives in their own browser. The first step to real use is a shared backend
(for example Supabase/Postgres in an Australian region, or the earlier Next.js + SQLite version on a small server) so a team works from one database.

## Now: production readiness
- [ ] **Authentication & roles**: consultant / manager / admin. Scope "my" views to the signed-in user (actions currently default to consultant #1)
- [ ] **Audit log**: who viewed, changed, exported or erased what
- [ ] **Shared backend**: move from browser storage to a hosted database (HTTPS, Australian region, nightly encrypted backups). The data model in `assets/store.js` maps one-to-one to tables
- [ ] **Validation & error states** on all forms (browser validation only today)
- [ ] **Automated tests**: store logic (stage moves, placement fee calculations) and a Playwright smoke test

## Next: consultant productivity
- [ ] **CV upload & parsing**: attach CVs to candidates, extract skills and work history
- [ ] **Email integration** (Microsoft 365 / Gmail): log sent and received emails against candidates and contacts automatically
- [ ] **Calendar sync** for interview scheduling
- [ ] **Boolean search** and saved searches over the talent pool
- [ ] **Better matching**: weighted scoring on skills, location, salary fit and availability
- [ ] **Shortlist builder**: send a branded, anonymised shortlist to a client from the job page
- [ ] **Right to represent**: record candidate approval per submission
- [ ] **Bulk actions**: add many candidates to a job, bulk email

## Later: business management
- [ ] **Reporting** from `stage_history`: conversion ratios, time-to-fill, fall-off reasons, consultant KPIs and leaderboards
- [ ] **Staged retained billing**: engagement / shortlist / completion instalments
- [ ] **Contractor management**: timesheets, extensions, end-date alerts, on-costs (super, payroll tax, workers' comp) in margin
- [ ] **Invoicing integration** (Xero / MYOB) from the placements page
- [ ] **Job board multiposting** (SEEK, LinkedIn, Indeed) and an application inbox
- [ ] **Candidate portal**: self-registration with a collection notice, profile updates, privacy requests
- [ ] **Retention automation**: flag candidates untouched for N months for review or erasure
- [ ] **Client portal**: hiring managers review shortlists and give feedback
