import { notFound } from 'next/navigation';
import { get } from '@/lib/db';
import { updateCandidate } from '@/lib/actions';
import { consultants } from '@/lib/queries';
import { CandidateForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export default async function EditCandidate({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = get<Record<string, string | number | null>>('SELECT * FROM candidates WHERE id = ?', id);
  if (!row) notFound();
  return (
    <>
      <PageHead title={`Edit ${row.first_name} ${row.last_name}`} />
      <Card><CandidateForm action={updateCandidate.bind(null, id)} row={row} consultants={consultants()} submit="Save changes" /></Card>
    </>
  );
}
