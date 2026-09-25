# Privacy (Australia)

A recruitment CRM is mostly personal information: CVs, contact details, salary history, work rights, interview
feedback. In Australia, most agencies are bound by the *Privacy Act 1988* and the **Australian Privacy Principles (APPs)**.
The APPs apply to businesses with annual turnover above $3m, and some smaller businesses are covered too.
This page maps the MVP to the APPs that matter most for recruitment. It's a design aid, **not legal advice**.

| APP | What it requires (simplified) | In the MVP | Gap / roadmap |
|---|---|---|---|
| **1** Open & transparent management | A clear privacy policy | — | Link your privacy policy from the candidate registration flow |
| **3** Collection | Only collect what's reasonably necessary | Fields limited to recruitment needs. Work rights is a free-text summary, not documents | Don't store ID documents, TFNs or bank details here; they belong in payroll/onboarding systems |
| **5** Notification of collection | Tell people what you collect, why, and who you'll disclose it to (clients) | *Consent / collection notice* checkbox with timestamp and source; warnings when missing; unconsented candidates are excluded from pipeline pickers | Candidate self-registration with the notice text versioned and stored |
| **6** Use or disclosure | Only use for the purpose collected, e.g. don't send a CV to a client without permission | Consultant workflow: screen before submit | Per-submission *right to represent* confirmation recorded on the application |
| **7** Direct marketing | Opt-out for marketing | *Do not contact* status | Separate marketing opt-out from recruitment contact |
| **10** Quality | Keep data accurate and up to date | Last-contacted date on every candidate | Prompt to refresh stale profiles (e.g. >12 months) |
| **11** Security & retention | Protect data; destroy or de-identify when no longer needed | Data stays in the user's own browser (localStorage); nothing is sent to a server or third party. **Erase candidate** hard-deletes all linked records. **Your data** page offers export and reset | **Authentication and roles (not built yet)**, encryption at rest, backups, audit log, automated retention review |
| **12** Access | Give people their information on request | **Export data**: JSON bundle of the profile, applications and activity | Include documents once CV upload exists |
| **13** Correction | Correct information on request | Edit candidate | Log corrections in the audit trail |

Also consider the **Notifiable Data Breaches** scheme (have a breach response plan) and cross-border disclosure (APP 8)
if you host outside Australia.

**The GitHub Pages demo is for fictional data only.** Browser storage is unencrypted, tied to one device, and lost if browser data is cleared.
Don't load real candidate data until there is a proper backend with authentication, Australian hosting and backups (see the roadmap).
