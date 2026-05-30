import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  generations,
  type Generation as GenerationRow,
  type NewGeneration,
} from '@/lib/db/schema';
import type { GenerateInput, WorkflowSnapshot } from '@/lib/civitai';
import { isTerminal } from '@/lib/civitai';

export type GenerationSource = NewGeneration['source'];
export type WorkflowDbStatus = NewGeneration['status'];

export type Generation = {
  workflowId: string;
  userId: string;
  source: GenerationSource;
  sourceId: string | null;
  tileId: string | null;
  status: WorkflowDbStatus;
  prompt: string | null;
  estimatedBuzz: number;
  chargedBuzz: number;
  submittedAt: number;
  finishedAt: number | null;
  updatedAt: number;
};

function toGeneration(row: GenerationRow): Generation {
  return {
    workflowId: row.workflowId,
    userId: row.userId,
    source: row.source,
    sourceId: row.sourceId,
    tileId: row.tileId,
    status: row.status,
    prompt: row.prompt,
    estimatedBuzz: row.estimatedBuzz,
    chargedBuzz: row.chargedBuzz,
    submittedAt: row.submittedAt.getTime(),
    finishedAt: row.finishedAt?.getTime() ?? null,
    updatedAt: row.updatedAt.getTime(),
  };
}

export type RecordGenerationInput = {
  workflowId: string;
  userId: string;
  source: GenerationSource;
  sourceId?: string | null;
  tileId?: string | null;
  prompt?: string;
  input: GenerateInput;
  estimatedBuzz?: number;
};

export async function recordGeneration(input: RecordGenerationInput): Promise<Generation> {
  const [row] = await db
    .insert(generations)
    .values({
      workflowId: input.workflowId,
      userId: input.userId,
      source: input.source,
      sourceId: input.sourceId ?? null,
      tileId: input.tileId ?? null,
      status: 'queued',
      prompt: input.prompt ?? input.input.prompt,
      input: input.input,
      estimatedBuzz: input.estimatedBuzz ?? 0,
    })
    .onConflictDoUpdate({
      target: generations.workflowId,
      set: {
        sourceId: input.sourceId ?? null,
        tileId: input.tileId ?? null,
        estimatedBuzz: input.estimatedBuzz ?? 0,
        updatedAt: new Date(),
      },
    })
    .returning();
  return toGeneration(row!);
}

function mapSnapshotStatus(snapshot: WorkflowSnapshot): WorkflowDbStatus {
  const status = String(snapshot.status ?? '').toLowerCase();
  if (status.includes('success') || status.includes('done') || status.includes('complete')) {
    return 'done';
  }
  if (status.includes('fail') || status.includes('error')) return 'failed';
  if (status.includes('cancel')) return 'canceled';
  if (status.includes('process') || status.includes('cooking') || status.includes('running')) {
    return 'cooking';
  }
  return 'queued';
}

export async function updateGenerationFromSnapshot(
  workflowId: string,
  snapshot: WorkflowSnapshot,
): Promise<Generation | null> {
  const status = mapSnapshotStatus(snapshot);
  const terminal = isTerminal(snapshot);
  const charged = snapshot.cost?.total ?? 0;
  const [row] = await db
    .update(generations)
    .set({
      status,
      snapshot,
      chargedBuzz: charged,
      finishedAt: terminal ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(generations.workflowId, workflowId))
    .returning();
  return row ? toGeneration(row) : null;
}

export async function getGeneration(workflowId: string): Promise<Generation | null> {
  const [row] = await db
    .select()
    .from(generations)
    .where(eq(generations.workflowId, workflowId))
    .limit(1);
  return row ? toGeneration(row) : null;
}
