import { all, get } from '@/lib/db';

/**
 * APP 12 — give an individual access to the personal information we hold about them.
 * Returns a JSON bundle of the candidate record, applications and activity history.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const candidate = get('SELECT * FROM candidates WHERE id = ?', id);
  if (!candidate) return new Response('Not found', { status: 404 });
  const bundle = {
    exported_at: new Date().toISOString(),
    candidate,
    applications: all(
      `SELECT a.stage, a.created_at, a.updated_at, a.rejection_reason, j.title AS job, c.name AS client
       FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id WHERE a.candidate_id = ?`, id),
    activities: all('SELECT kind, subject, body, created_at, done_at FROM activities WHERE candidate_id = ?', id),
  };
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="candidate-${id}-export.json"`,
    },
  });
}
