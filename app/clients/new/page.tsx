import { createCompany } from '@/lib/actions';
import { consultants } from '@/lib/queries';
import { CompanyForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export const metadata = { title: 'New client' };
export const dynamic = 'force-dynamic';

export default function NewClient() {
  return (
    <>
      <PageHead title="Add client" />
      <Card><CompanyForm action={createCompany} consultants={consultants()} submit="Create client" /></Card>
    </>
  );
}
