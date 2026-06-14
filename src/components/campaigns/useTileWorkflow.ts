'use client';

import { extractImageUrls, type WorkflowSnapshot } from '@civitai/app-sdk/orchestrator';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

export type TileWorkflowStatus = 'queued' | 'cooking' | 'done' | 'failed';

/**
 * Map an orchestrator workflow snapshot onto the tile's four-state status.
 *
 * Mirrors the original `statusFromSnap` that lived inside `CreativeCard`.
 */
export function statusFromSnap(snap: WorkflowSnapshot | null): TileWorkflowStatus {
  const s = (snap?.status ?? '').toLowerCase();
  if (s === 'succeeded') return 'done';
  if (s === 'failed' || s === 'canceled' || s === 'expired') return 'failed';
  if (s === 'unassigned' || s === 'pending') return 'queued';
  return 'cooking';
}

/** Extract image URLs from a snapshot, tolerating a null snapshot. */
export function imageUrlsFromSnap(snap: WorkflowSnapshot | null): string[] {
  if (!snap) return [];
  return extractImageUrls(snap);
}

export type UseTileWorkflow = {
  workflowId: string;
  status: TileWorkflowStatus;
  imageUrls: string[];
  error: string | null;
  setStatus: Dispatch<SetStateAction<TileWorkflowStatus>>;
  setImageUrls: Dispatch<SetStateAction<string[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setWorkflowId: Dispatch<SetStateAction<string>>;
};

/**
 * Long-poll the orchestrator workflow for a single tile and surface its
 * status, resulting image URLs, and any poll error.
 *
 * This is a verbatim extraction of the polling `useEffect` that previously
 * lived inside `CreativeCard`. The loop polls unconditionally on mount (it
 * does not skip when the initial status is already terminal) and re-runs
 * whenever `workflowId` changes (e.g. after a regenerate). The `set*` setters
 * are returned so callers can drive the same shared state from outside the
 * loop (the regenerate handler resets status/urls/error before swapping the
 * workflow id).
 */
export function useTileWorkflow(
  initialWorkflowId: string,
  initial: { status: TileWorkflowStatus; imageUrls: string[] },
): UseTileWorkflow {
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [status, setStatus] = useState<TileWorkflowStatus>(initial.status);
  const [imageUrls, setImageUrls] = useState<string[]>(initial.imageUrls);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}?wait=15000`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setError(body?.error ?? `http ${res.status}`);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const data = (await res.json()) as { snapshot: WorkflowSnapshot; done: boolean };
          if (cancelled) return;
          const next = statusFromSnap(data.snapshot);
          setStatus(next);
          const urls = imageUrlsFromSnap(data.snapshot);
          if (urls.length > 0) setImageUrls(urls);
          if (data.done) return;
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'poll failed');
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  return { workflowId, status, imageUrls, error, setStatus, setImageUrls, setError, setWorkflowId };
}
