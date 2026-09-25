import { notFound } from 'next/navigation';
import { get } from '@/lib/db';
import { updateJob } from '@/lib/actions';
import { companyOptions, consultants, contactOptions } from '@/lib/queries';
import { JobForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = get<Record<string, string | number | null>>('SELECT * FROM jobs WHERE id = ?', id);
  if (!row) notFound();
  return (
    <>
      <PageHead title={`Edit ${row.title}`} />
      <Card>
        <JobForm action={updateJob.bind(null, id)} row={row} consultants={consultants()} companies={companyOptions()}
          contacts={contactOptions()} submit="Save changes" />
      </Card>
    </>
  );
}
