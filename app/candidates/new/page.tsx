import { createCandidate } from '@/lib/actions';
import { consultants } from '@/lib/queries';
import { CandidateForm } from '@/components/Forms';
import { Card, PageHead } from '@/components/ui';

export const metadata = { title: 'New candidate' };
export const dynamic = 'force-dynamic';

export default function NewCandidate() {
  return (
    <>
      <PageHead title="Add candidate" sub="Register a new candidate in the talent pool." />
      <Card><CandidateForm action={createCandidate} consultants={consultants()} submit="Create candidate" /></Card>
    </>
  );
}
