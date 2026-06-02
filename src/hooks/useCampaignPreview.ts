'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EnhancedPrompt } from '@/lib/promptBuilder';

export type PreviewBrief = {
  prompt: string;
  title: string;
  description: string;
  goal: string;
  offer: string;
  audience: string;
  aesthetics: string;
};

export type CampaignPreviewResponse = {
  enhancedPrompts: Record<string, EnhancedPrompt>;
  estimatePerPreset: Record<string, number>;
  totalBuzz: number;
  errors?: Record<string, string>;
};

export type FetchPreviewArgs = {
  brief: PreviewBrief;
  presetIds: string[];
  variantsPerPreset: number;
  referenceAssetIds: string[];
};

/**
 * Issues a POST against /api/campaigns/preview. Exported so the wizard and
 * tests can drive it directly. Throws on non-2xx so the caller can surface a
 * single error path.
 */
export async function fetchCampaignPreview(
  args: FetchPreviewArgs,
  init?: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<CampaignPreviewResponse> {
  const f = init?.fetcher ?? fetch;
  const res = await f('/api/campaigns/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: init?.signal,
  });
  const json = (await res.json().catch(() => ({}))) as
    | CampaignPreviewResponse
    | { error?: string };
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? `http ${res.status}`;
    throw new Error(err);
  }
  return json as CampaignPreviewResponse;
}

export type UseCampaignPreviewOptions = {
  debounceMs?: number;
  fetcher?: typeof fetch;
};

export type UseCampaignPreviewResult = {
  preview: CampaignPreviewResponse | null;
  loading: boolean;
  error: string | null;
  /** Fire the preview immediately (used for step transitions). Returns the response or null on error. */
  run: (args: FetchPreviewArgs) => Promise<CampaignPreviewResponse | null>;
  /** Schedule a debounced preview. Used while the user is editing overrides. */
  schedule: (args: FetchPreviewArgs) => void;
  setPreview: (value: CampaignPreviewResponse | null) => void;
};

/**
 * Encapsulates campaign preview fetching with debounce + abort. The hook owns
 * the in-flight controller so subsequent calls cancel stale ones and the UI
 * never flashes a previous response.
 */
export function useCampaignPreview(
  opts: UseCampaignPreviewOptions = {},
): UseCampaignPreviewResult {
  const debounceMs = opts.debounceMs ?? 300;
  const fetcher = opts.fetcher;
  const [preview, setPreview] = useState<CampaignPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const run = useCallback(
    async (args: FetchPreviewArgs): Promise<CampaignPreviewResponse | null> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCampaignPreview(args, { signal: ctl.signal, fetcher });
        if (ctl.signal.aborted) return null;
        setPreview(res);
        setLoading(false);
        return res;
      } catch (err) {
        if (ctl.signal.aborted) return null;
        setError(err instanceof Error ? err.message : 'preview failed');
        setLoading(false);
        return null;
      }
    },
    [fetcher],
  );

  const schedule = useCallback(
    (args: FetchPreviewArgs) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void run(args);
      }, debounceMs);
    },
    [debounceMs, run],
  );

  return { preview, loading, error, run, schedule, setPreview };
}
