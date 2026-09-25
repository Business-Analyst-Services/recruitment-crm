'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { moveStage } from '@/lib/actions';
import { CLOSED_STAGES, PIPELINE_STAGES, STAGE_LABEL } from '@/lib/constants';

export type BoardCard = {
  id: number;
  stage: string;
  candidate_id: number;
  candidate_name: string;
  candidate_title: string | null;
  job_id: number;
  job_title: string;
  company_name: string;
  days_in_stage: number;
};

const STALE_DAYS = 7;

export default function KanbanBoard({ cards, showJob = true }: { cards: BoardCard[]; showJob?: boolean }) {
  const [showClosed, setShowClosed] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimistic, applyMove] = useOptimistic(cards, (state, m: { id: number; stage: string }) =>
    state.map((c) => (c.id === m.id ? { ...c, stage: m.stage, days_in_stage: 0 } : c)),
  );

  const columns = showClosed ? [...PIPELINE_STAGES, ...CLOSED_STAGES] : [...PIPELINE_STAGES];

  function move(id: number, stage: string) {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    startTransition(async () => {
      applyMove({ id, stage });
      await moveStage(id, stage);
    });
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="small muted">
          Drag cards between columns, or use the stage menu on each card. Moving to <strong>Placed</strong> creates a placement record.
        </span>
        <label className="check small">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Show rejected &amp; withdrawn ({optimistic.filter((c) => (CLOSED_STAGES as readonly string[]).includes(c.stage)).length})
        </label>
      </div>
      <div className="board">
        {columns.map((stage) => {
          const items = optimistic.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              data-stage={stage}
              className={`col${over === stage ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) move(id, stage);
              }}
            >
              <div className="col-head">
                <span>{STAGE_LABEL[stage]}</span>
                <span className="badge">{items.length}</span>
              </div>
              <div className="col-body">
                {items.map((c) => (
                  <article
                    key={c.id}
                    className={`kcard${dragId === c.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(c.id)); setDragId(c.id); }}
                    onDragEnd={() => setDragId(null)}
                  >
                    <Link href={`/candidates/${c.candidate_id}`} className="kname">{c.candidate_name}</Link>
                    <div className="ksub">{c.candidate_title ?? '—'}</div>
                    {showJob ? (
                      <div className="ksub" style={{ marginTop: 4 }}>
                        <Link href={`/jobs/${c.job_id}`} className="link">{c.job_title}</Link> · {c.company_name}
                      </div>
                    ) : null}
                    <div className="kfoot">
                      <span title="Days in this stage" style={{ whiteSpace: 'nowrap' }} className={c.days_in_stage >= STALE_DAYS && !['placed', 'rejected', 'withdrawn'].includes(c.stage) ? 'stale' : ''}>
                        {c.days_in_stage === 0 ? 'Today' : `${c.days_in_stage}d`}
                      </span>
                      <select aria-label="Move to stage" value={c.stage} onChange={(e) => move(c.id, e.target.value)}>
                        {[...PIPELINE_STAGES, ...CLOSED_STAGES].map((s) => (
                          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
