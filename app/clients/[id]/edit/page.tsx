import { notFound } from 'next/navigation';
import { get } from '@/lib/db';
import { updateCompany } from '@/lib/actions';
import { consultants } from '@/lib/queries';
import { CompanyForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = get<Record<string, string | number | null>>('SELECT * FROM companies WHERE id = ?', id);
  if (!row) notFound();
  return (
    <>
      <PageHead title={`Edit ${row.name}`} />
      <Card><CompanyForm action={updateCompany.bind(null, id)} row={row} consultants={consultants()} submit="Save changes" /></Card>
    </>
  );
}
