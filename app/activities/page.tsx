import { openTasks, recentActivity } from '@/lib/queries';
import { ActivityFeed, ActivityForm, TaskList } from '@/components/Activity';
import { Card, PageHead } from '@/components/ui';

export const metadata = { title: 'Tasks & activity' };
export const dynamic = 'force-dynamic';

export default function Activities() {
  return (
    <>
      <PageHead title="Tasks & activity" sub="Follow-ups, scheduled interviews, and everything the team has logged." />
      <div className="grid-halves">
        <div className="stack">
          <Card title="Open tasks & upcoming interviews" tight><TaskList items={openTasks()} /></Card>
          <Card title="New task or note"><ActivityForm returnTo="/activities" /></Card>
        </div>
        <Card title="Team activity" tight><ActivityFeed items={recentActivity(60)} /></Card>
      </div>
    </>
  );
}
