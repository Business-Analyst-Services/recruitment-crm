// Router, navigation and event wiring.
import * as S from './store.js';
import * as V from './views.js';

S.load();

const app = document.getElementById('app');

// ---------------------------------------------------------------------------
// Routing (hash-based so it works on GitHub Pages without server config)

const routes = [
  [/^\/$/, () => V.dashboard(), 'Dashboard'],
  [/^\/pipeline$/, (m, q) => V.pipeline(q), 'Pipeline'],
  [/^\/jobs$/, (m, q) => V.jobsList(q), 'Jobs'],
  [/^\/jobs\/new$/, (m, q) => V.jobForm(null, q), 'New job'],
  [/^\/jobs\/(\d+)$/, (m) => V.jobDetail(+m[1]), 'Job'],
  [/^\/jobs\/(\d+)\/edit$/, (m, q) => V.jobForm(+m[1], q), 'Edit job'],
  [/^\/candidates$/, (m, q) => V.candidatesList(q), 'Candidates'],
  [/^\/candidates\/new$/, () => V.candidateForm(null), 'New candidate'],
  [/^\/candidates\/(\d+)$/, (m) => V.candidateDetail(+m[1]), 'Candidate'],
  [/^\/candidates\/(\d+)\/edit$/, (m) => V.candidateForm(+m[1]), 'Edit candidate'],
  [/^\/clients$/, (m, q) => V.clientsList(q), 'Clients'],
  [/^\/clients\/new$/, () => V.clientForm(null), 'New client'],
  [/^\/clients\/(\d+)$/, (m) => V.clientDetail(+m[1]), 'Client'],
  [/^\/clients\/(\d+)\/edit$/, (m) => V.clientForm(+m[1]), 'Edit client'],
  [/^\/placements$/, () => V.placements(), 'Placements'],
  [/^\/activities$/, () => V.activities(), 'Tasks & activity'],
  [/^\/data$/, (m, q) => V.dataPage(q), 'Your data'],
];

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { path: path || '/', q: new URLSearchParams(qs) };
}

let lastPath = null;
function render() {
  const { path, q } = parseHash();
  let html = V.notFound();
  let title = 'Not found';
  for (const [re, fn, t] of routes) {
    const m = path.match(re);
    if (m) { html = fn(m, q); title = t; break; }
  }
  const y = window.scrollY;
  app.innerHTML = html;
  document.title = `${title} · TalentLedger`;
  // Keep scroll position when re-rendering the same page (e.g. after logging an activity).
  window.scrollTo(0, path === lastPath ? y : 0);
  lastPath = path;
  document.querySelectorAll('.nav-link').forEach((a) => {
    const href = a.getAttribute('href').slice(1);
    a.classList.toggle('active', href === '/' ? path === '/' : path.startsWith(href));
  });
}

const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
window.addEventListener('hashchange', render);

// ---------------------------------------------------------------------------
// Forms

const NUMERIC = new Set(['salary_expectation', 'day_rate', 'owner_id', 'default_fee_pct', 'company_id', 'contact_id', 'salary_min', 'salary_max',
  'fee_pct', 'openings', 'candidate_id', 'job_id', 'base_salary', 'fee_amount', 'pay_rate', 'charge_rate', 'guarantee_days']);

function values(form) {
  const out = {};
  form.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
    if (el.type === 'checkbox') { out[el.name] = el.checked; return; }
    let v = el.value.trim();
    if (v === '') v = null;
    else if (NUMERIC.has(el.name)) { const n = Number(v.replace(/[$,\s]/g, '')); v = Number.isFinite(n) ? n : null; }
    out[el.name] = v;
  });
  return out;
}

const handlers = {
  candidate(f, id) { const r = S.saveCandidate(id, f, f.consent); return `#/candidates/${r.id}`; },
  company(f, id) { const r = S.saveCompany(id, f); return `#/clients/${r.id}`; },
  contact(f, id) { S.addContact(id, f); },
  job(f, id) { const r = S.saveJob(id, f); return `#/jobs/${r.id}`; },
  pipeline(f) { S.addToPipeline(f.candidate_id, f.job_id); },
  activity(f) { S.addActivity(f); },
  placement(f, id) { S.savePlacement(id, f); },
};

document.addEventListener('submit', (e) => {
  const form = e.target;
  // Filter forms turn their fields into a query string on the current route.
  if (form.dataset.filter) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) params.set(k, v);
    const qs = params.toString();
    go(`${form.dataset.filter}${qs ? `?${qs}` : ''}`);
    return;
  }
  const h = handlers[form.dataset.form];
  if (!h) return;
  e.preventDefault();
  const id = form.dataset.id ? Number(form.dataset.id) : null;
  const next = h(values(form), id);
  if (next) go(next); else render();
});

// ---------------------------------------------------------------------------
// Buttons and selects

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'file') return;
  const id = Number(el.dataset.id);
  switch (el.dataset.action) {
    case 'complete-activity': S.completeActivity(id); render(); break;
    case 'add-to-pipeline': S.addToPipeline(el.dataset.candidate, el.dataset.job); render(); break;
    case 'erase-candidate': S.eraseCandidate(id); go('#/candidates?erased=1'); break;
    case 'export-candidate': {
      // APP 12 — give an individual access to the personal information held about them.
      const c = S.candidate(id);
      const bundle = {
        exported_at: new Date().toISOString(), candidate: c,
        applications: S.applicationsForCandidate(id).map((a) => {
          const j = S.job(a.job_id);
          return { job: j.title, client: S.company(j.company_id).name, stage: a.stage, created_at: a.created_at, updated_at: a.updated_at, rejection_reason: a.rejection_reason };
        }),
        activities: S.all('activities').filter((a) => a.candidate_id === id).map(({ kind, subject, body, created_at, done_at }) => ({ kind, subject, body, created_at, done_at })),
      };
      download(`candidate-${id}-export.json`, JSON.stringify(bundle, null, 2));
      break;
    }
    case 'export-all': download(`talentledger-export-${new Date().toISOString().slice(0, 10)}.json`, S.exportAll()); break;
    case 'reset-demo': S.resetDemo(); go('#/data?reset=1'); break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'move-stage') { S.moveStage(Number(el.dataset.app), el.value); render(); }
  if (el.dataset.action === 'toggle-closed') {
    el.closest('.card, .main')?.querySelectorAll('.closed-col').forEach((c) => { c.hidden = !el.checked; });
  }
  if (el.dataset.action === 'import-all' && el.files[0]) {
    el.files[0].text().then((t) => {
      try { S.importAll(t); go('#/data?imported=1'); } catch (err) { el.insertAdjacentHTML('afterend', `<div class="notice warn">${err.message}</div>`); }
    });
  }
});

// ---------------------------------------------------------------------------
// Kanban drag and drop

let dragId = null;
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest?.('.kcard');
  if (!card) return;
  dragId = Number(card.dataset.app);
  e.dataTransfer.setData('text/plain', String(dragId));
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragend', (e) => { e.target.closest?.('.kcard')?.classList.remove('dragging'); document.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over')); });
document.addEventListener('dragover', (e) => {
  const col = e.target.closest?.('.col');
  if (!col) return;
  e.preventDefault();
  document.querySelectorAll('.col.over').forEach((c) => c !== col && c.classList.remove('over'));
  col.classList.add('over');
});
document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('.col');
  if (!col) return;
  e.preventDefault();
  const id = Number(e.dataTransfer.getData('text/plain')) || dragId;
  dragId = null;
  if (id) { S.moveStage(id, col.dataset.stage); render(); }
});

render();
