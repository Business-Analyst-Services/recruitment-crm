const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const audK = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1, trailingZeroDisplay: 'stripIfInteger' } as Intl.NumberFormatOptions);

export const money = (n: number | null | undefined) => (n == null ? '—' : aud.format(n));
export const moneyK = (n: number | null | undefined) => (n == null ? '—' : n < 1000 ? aud.format(n) : audK.format(n));

export function salaryRange(min?: number | null, max?: number | null) {
  if (!min && !max) return '—';
  if (min && max) return `${moneyK(min)}–${moneyK(max)}`;
  return moneyK((min ?? max) as number);
}

/**
 * Timestamps written by SQLite's datetime('now') are UTC ("YYYY-MM-DD HH:MM:SS") and are shown in the agency's
 * time zone. Due dates entered by users ("YYYY-MM-DD HH:MM") and plain dates are wall-clock values and are shown as-is.
 */
export const TZ = process.env.APP_TIMEZONE || 'Australia/Sydney';

function parse(s: string): { d: Date; tz: string } {
  if (s.length === 19) return { d: new Date(s.replace(' ', 'T') + 'Z'), tz: TZ };
  return { d: new Date((s.length <= 10 ? s + 'T00:00' : s.slice(0, 16).replace(' ', 'T')) + ':00Z'), tz: 'UTC' };
}

const thisYear = new Date().getFullYear();

export function date(s: string | null | undefined) {
  if (!s) return '—';
  const { d, tz } = parse(s);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: d.getUTCFullYear() === thisYear ? undefined : 'numeric', timeZone: tz });
}

export function dateTime(s: string | null | undefined) {
  if (!s) return '—';
  const { d, tz } = parse(s);
  return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz });
}

/** Current wall-clock time in the agency time zone, formatted like a stored due date. */
export function nowLocal() {
  return new Date().toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16);
}

export function ago(s: string | null | undefined) {
  if (!s) return '—';
  const { d, tz } = parse(s);
  // Wall-clock values are compared against local "now" expressed the same way.
  const now = tz === 'UTC' ? parse(nowLocal()).d.getTime() : Date.now();
  const diff = now - d.getTime();
  const days = Math.round(diff / 86400000);
  if (Math.abs(diff) < 3600000) return 'just now';
  if (Math.abs(diff) < 86400000) return diff > 0 ? `${Math.round(diff / 3600000)}h ago` : `in ${Math.round(-diff / 3600000)}h`;
  if (days < 0) return `in ${-days}d`;
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function daysSince(s: string | null | undefined) {
  if (!s) return null;
  return Math.floor((Date.now() - parse(s).d.getTime()) / 86400000);
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
