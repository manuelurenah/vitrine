import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { buzzEvents, type BuzzEvent as BuzzEventRow } from '@/lib/db/schema';

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
