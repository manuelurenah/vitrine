import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type BuzzEvent as BuzzEventRow, buzzEvents } from '@/lib/db/schema';

export type BuzzEventKind = 'estimate' | 'submit' | 'refund';

export type BuzzEvent = {
  id: string;
  userId: string;
  workflowId: string | null;
  kind: BuzzEventKind;
  estimated: number;
  charged: number;
  note: string | null;
  createdAt: number;
};

function toEvent(row: BuzzEventRow): BuzzEvent {
  return {
    id: row.id,
    userId: row.userId,
    workflowId: row.workflowId,
    kind: row.kind,
    estimated: row.estimated,
    charged: row.charged,
    note: row.note,
    createdAt: row.createdAt.getTime(),
  };
}

export type RecordBuzzInput = {
  userId: string;
  workflowId?: string | null;
  kind: BuzzEventKind;
  estimated?: number;
  charged?: number;
  note?: string;
};

export async function recordBuzzEvent(input: RecordBuzzInput): Promise<BuzzEvent> {
  const [row] = await db
    .insert(buzzEvents)
    .values({
      userId: input.userId,
      workflowId: input.workflowId ?? null,
      kind: input.kind,
      estimated: input.estimated ?? 0,
      charged: input.charged ?? 0,
      note: input.note ?? null,
    })
    .returning();
  return toEvent(row!);
}

/**
 * Record the single authoritative `submit` (charge) event for a workflow,
 * idempotently. Backed by the `buzz_events_submit_once` partial unique index,
 * so concurrent terminal polls of the same workflow can't insert duplicate
 * charge rows (which would inflate the user-facing "buzz spent" total).
 *
 * Returns `true` if this call inserted the charge, `false` if a charge for the
 * workflow already existed (the conflict was a no-op).
 */
export async function recordSubmitChargeOnce(input: {
  userId: string;
  workflowId: string;
  charged: number;
  estimated?: number;
  note?: string;
}): Promise<boolean> {
  const rows = await db
    .insert(buzzEvents)
    .values({
      userId: input.userId,
      workflowId: input.workflowId,
      kind: 'submit',
      estimated: input.estimated ?? 0,
      charged: input.charged,
      note: input.note ?? null,
    })
    .onConflictDoNothing({
      target: buzzEvents.workflowId,
      where: sql`${buzzEvents.kind} = 'submit'`,
    })
    .returning({ id: buzzEvents.id });
  return rows.length > 0;
}

export async function listBuzzEvents(userId: string, limit = 100): Promise<BuzzEvent[]> {
  const rows = await db
    .select()
    .from(buzzEvents)
    .where(eq(buzzEvents.userId, userId))
    .orderBy(desc(buzzEvents.createdAt))
    .limit(limit);
  return rows.map(toEvent);
}

export async function sumChargedBuzz(userId: string): Promise<number> {
  const rows = await db
    .select({ charged: buzzEvents.charged })
    .from(buzzEvents)
    .where(eq(buzzEvents.userId, userId));
  return rows.reduce((sum, r) => sum + (r.charged ?? 0), 0);
}
