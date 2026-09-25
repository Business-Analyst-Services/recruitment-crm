import 'server-only';
import { all } from './db';

export type Consultant = { id: number; name: string };
export type Option = { id: number; name: string };

export const consultants = () => all<Consultant>('SELECT id, name FROM consultants ORDER BY id');
export const companyOptions = () => all<Option>('SELECT id, name FROM companies ORDER BY name');
export const contactOptions = () =>
  all<Option & { company_id: number }>('SELECT id, name, company_id FROM contacts ORDER BY name');
export const openJobOptions = () =>
  all<Option>(
    `SELECT j.id, j.title || ' — ' || c.name AS name FROM jobs j JOIN companies c ON c.id = j.company_id
     WHERE j.status IN ('open','on_hold') ORDER BY j.opened_at DESC`,
  );
export const candidateOptions = () =>
  all<Option>(
    `SELECT id, first_name || ' ' || last_name || COALESCE(' — ' || current_title, '') AS name
     FROM candidates WHERE status != 'do_not_contact' ORDER BY first_name, last_name`,
  );

export type Activity = {
  id: number; kind: string; subject: string; body: string | null; due_at: string | null; done_at: string | null; created_at: string;
  candidate_id: number | null; candidate_name: string | null; company_id: number | null; company_name: string | null;
  job_id: number | null; job_title: string | null; contact_name: string | null; consultant_name: string | null;
};

const ACT_SELECT = `SELECT a.*, ca.first_name || ' ' || ca.last_name AS candidate_name, co.name AS company_name,
  j.title AS job_title, ct.name AS contact_name, cs.name AS consultant_name
  FROM activities a
  LEFT JOIN candidates ca ON ca.id = a.candidate_id
  LEFT JOIN companies co ON co.id = a.company_id
  LEFT JOIN jobs j ON j.id = a.job_id
  LEFT JOIN contacts ct ON ct.id = a.contact_id
  LEFT JOIN consultants cs ON cs.id = a.consultant_id`;

export function activitiesFor(filter: { candidate?: number; company?: number; job?: number }, limit = 50) {
  const where: string[] = [];
  const params: number[] = [];
  if (filter.candidate) { where.push('a.candidate_id = ?'); params.push(filter.candidate); }
  if (filter.company) { where.push('a.company_id = ?'); params.push(filter.company); }
  if (filter.job) { where.push('a.job_id = ?'); params.push(filter.job); }
  return all<Activity>(
    `${ACT_SELECT} ${where.length ? 'WHERE ' + where.join(' OR ') : ''}
     ORDER BY COALESCE(a.done_at, a.due_at, a.created_at) DESC LIMIT ${limit}`,
    ...params,
  );
}

export function openTasks(limit = 100) {
  return all<Activity>(`${ACT_SELECT} WHERE a.done_at IS NULL AND a.due_at IS NOT NULL ORDER BY a.due_at ASC LIMIT ${limit}`);
}

export function recentActivity(limit = 30) {
  return all<Activity>(`${ACT_SELECT} WHERE a.done_at IS NOT NULL ORDER BY a.done_at DESC LIMIT ${limit}`);
}

export function boardCards(filter: { job?: number; owner?: number } = {}) {
  const where = ["j.status IN ('open','on_hold')"];
  const params: number[] = [];
  if (filter.job) { where.length = 0; where.push('a.job_id = ?'); params.push(filter.job); }
  if (filter.owner) { where.push('j.owner_id = ?'); params.push(filter.owner); }
  return all<import('@/components/KanbanBoard').BoardCard>(
    `SELECT a.id, a.stage, a.candidate_id, ca.first_name || ' ' || ca.last_name AS candidate_name,
       ca.current_title AS candidate_title, a.job_id, j.title AS job_title, co.name AS company_name,
       CAST(julianday('now') - julianday(a.updated_at) AS INTEGER) AS days_in_stage
     FROM applications a
     JOIN candidates ca ON ca.id = a.candidate_id
     JOIN jobs j ON j.id = a.job_id
     JOIN companies co ON co.id = j.company_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.updated_at DESC`,
    ...params,
  );
}
