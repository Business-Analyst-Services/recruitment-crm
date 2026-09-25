import { createJob } from '@/lib/actions';
import { companyOptions, consultants, contactOptions } from '@/lib/queries';
import { JobForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export const metadata = { title: 'New job' };
export const dynamic = 'force-dynamic';

export default async function NewJob({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company } = await searchParams;
  return (
    <>
      <PageHead title="New job" sub="Take a brief and open a vacancy." />
      <Card>
        <JobForm action={createJob} row={company ? { company_id: Number(company) } : undefined}
          consultants={consultants()} companies={companyOptions()} contacts={contactOptions()} submit="Create job" />
      </Card>
    </>
  );
}
