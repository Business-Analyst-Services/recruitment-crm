// Formatting and small HTML helpers. Every value that came from data goes through esc().

export const esc = (v) =>
  v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const audK = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1, trailingZeroDisplay: 'stripIfInteger' });

export const money = (n) => (n == null || n === '' ? '—' : aud.format(n));
export const moneyK = (n) => (n == null || n === '' ? '—' : n < 1000 ? aud.format(n) : audK.format(n));
export function salaryRange(min, max) {
  if (!min && !max) return '—';
  if (min && max) return `${moneyK(min)}–${moneyK(max)}`;
  return moneyK(min ?? max);
}

// "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM" are local wall-clock values; full ISO strings are UTC instants.
const parse = (s) => (s.length === 10 ? new Date(s + 'T00:00') : new Date(s));
const thisYear = new Date().getFullYear();

export function date(s) {
  if (!s) return '—';
  const d = parse(s);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: d.getFullYear() === thisYear ? undefined : 'numeric' });
}
export function dateTime(s) {
  if (!s) return '—';
  return parse(s).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function ago(s) {
  if (!s) return '—';
  const diff = Date.now() - parse(s).getTime();
  const days = Math.round(diff / 86400000);
  if (Math.abs(diff) < 3600000) return 'just now';
  if (Math.abs(diff) < 86400000) return diff > 0 ? `${Math.round(diff / 3600000)}h ago` : `in ${Math.round(-diff / 3600000)}h`;
  if (days < 0) return `in ${-days}d`;
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
export const daysSince = (s) => (s ? Math.floor((Date.now() - parse(s).getTime()) / 86400000) : null);
export const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// ---------------------------------------------------------------------------
// Vocabulary

export const PIPELINE_STAGES = ['sourced', 'screened', 'submitted', 'interview', 'offer', 'placed'];
export const CLOSED_STAGES = ['rejected', 'withdrawn'];
export const ALL_STAGES = [...PIPELINE_STAGES, ...CLOSED_STAGES];
export const STAGE_LABEL = {
  sourced: 'Sourced', screened: 'Screened', submitted: 'Submitted to client', interview: 'Interview',
  offer: 'Offer', placed: 'Placed', rejected: 'Rejected', withdrawn: 'Withdrawn',
};
export const CANDIDATE_STATUS = ['active', 'passive', 'placed', 'do_not_contact'];
export const COMPANY_STATUS = ['prospect', 'active', 'dormant'];
export const JOB_STATUS = ['open', 'on_hold', 'filled', 'closed'];
export const JOB_TYPES = ['perm', 'contract', 'temp'];
export const ENGAGEMENTS = ['contingent', 'exclusive', 'retained'];
export const PRIORITIES = ['low', 'medium', 'high'];
export const ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting', 'interview', 'task'];
export const INVOICE_STATUS = ['not_invoiced', 'invoiced', 'paid'];
export const SOURCES = ['LinkedIn', 'SEEK', 'Referral', 'Website', 'Headhunt', 'Database'];

export const label = (v) => (v ? STAGE_LABEL[v] ?? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

const TONE = {
  active: 'ok', passive: '', placed: 'accent', do_not_contact: 'danger', prospect: 'info', dormant: '',
  open: 'ok', on_hold: 'warn', filled: 'accent', closed: '', high: 'danger', medium: 'warn', low: '',
  sourced: '', screened: 'info', submitted: 'info', interview: 'warn', offer: 'warn', rejected: 'danger', withdrawn: '',
  not_invoiced: 'warn', invoiced: 'info', paid: 'ok', retained: 'accent', exclusive: 'info', contingent: '',
};

// ---------------------------------------------------------------------------
// HTML fragments

export const badge = (v, tone) => (v ? `<span class="badge ${tone ?? TONE[v] ?? ''}">${esc(label(v))}</span>` : '<span class="faint">—</span>');
export const link = (href, text, cls = 'link') => `<a class="${cls}" href="${esc(href)}">${esc(text)}</a>`;
export const empty = (text) => `<div class="empty">${esc(text)}</div>`;
export const tags = (csv) =>
  csv ? csv.split(',').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join('') : '<span class="faint">—</span>';

export function pageHead(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;
}
export function card(title, body, { action = '', tight = false } = {}) {
  return `<section class="card">${title ? `<div class="card-head"><h2>${title}</h2>${action}</div>` : ''}<div class="card-body${tight ? ' tight' : ''}">${body}</div></section>`;
}
export function options(values, selected, blank) {
  const sel = selected == null ? '' : String(selected);
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    values.map((v) => {
      const [val, text] = Array.isArray(v) ? v : [v, label(v)];
      return `<option value="${esc(val)}"${String(val) === sel ? ' selected' : ''}>${esc(text)}</option>`;
    }).join('');
}
