export const PIPELINE_STAGES = ['sourced', 'screened', 'submitted', 'interview', 'offer', 'placed'] as const;
export const CLOSED_STAGES = ['rejected', 'withdrawn'] as const;
export const ALL_STAGES = [...PIPELINE_STAGES, ...CLOSED_STAGES] as const;
export type Stage = (typeof ALL_STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  sourced: 'Sourced',
  screened: 'Screened',
  submitted: 'Submitted to client',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const CANDIDATE_STATUS = ['active', 'passive', 'placed', 'do_not_contact'] as const;
export const COMPANY_STATUS = ['prospect', 'active', 'dormant'] as const;
export const JOB_STATUS = ['open', 'on_hold', 'filled', 'closed'] as const;
export const JOB_TYPES = ['perm', 'contract', 'temp'] as const;
export const ENGAGEMENTS = ['contingent', 'exclusive', 'retained'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting', 'interview', 'task'] as const;
export const INVOICE_STATUS = ['not_invoiced', 'invoiced', 'paid'] as const;
export const SOURCES = ['LinkedIn', 'SEEK', 'Referral', 'Website', 'Headhunt', 'Database'] as const;

export const label = (v: string | null | undefined) =>
  v ? (STAGE_LABEL[v] ?? v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())) : '—';
