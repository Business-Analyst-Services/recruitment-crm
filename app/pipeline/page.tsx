import { boardCards, consultants } from '@/lib/queries';
import KanbanBoard from '@/components/KanbanBoard';
import { PageHead } from '@/components/ui';

export const metadata = { title: 'Pipeline' };
export const dynamic = 'force-dynamic';

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const { owner } = await searchParams;
  const cards = boardCards({ owner: owner ? Number(owner) : undefined });
  return (
    <>
      <PageHead title="Pipeline" sub="Every candidate across all open and on-hold jobs.">
        <form className="row">
          <select name="owner" defaultValue={owner ?? ''} style={{ width: 'auto' }}>
            <option value="">All consultants' jobs</option>
            {consultants().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn">Apply</button>
        </form>
      </PageHead>
      <KanbanBoard cards={cards} />
    </>
  );
}
