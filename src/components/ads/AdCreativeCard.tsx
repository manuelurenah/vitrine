'use client';

import { Download, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTileWorkflow } from '@/components/campaigns/useTileWorkflow';
import { Badge, Button, cn, Textarea } from '@/components/ui';
import type { AdCampaignTile } from '@/lib/adCampaigns';

type Props = {
  campaignId: string;
  tile: AdCampaignTile;
};

/**
 * One ad creative: a fixed box whose CSS aspect-ratio matches the deliverable's
 * pixel dimensions (so the preview equals the cropped output), live-polled until
 * the workflow is done, with download + regenerate affordances.
 */
export function AdCreativeCard({ campaignId, tile }: Props) {
  const router = useRouter();
  const aspect = tile.width / tile.height;
  const {
    status,
    imageUrls,
    error,
    setStatus,
    setImageUrls,
    setError,
    setWorkflowId,
  } = useTileWorkflow(tile.workflowId, {
    status: tile.status,
    // Seed with the server-resolved asset so a `done` tile renders immediately
    // without waiting for the first poll.
    imageUrls: tile.assetUrl ? [tile.assetUrl] : [],
  });

  const [showRegen, setShowRegen] = useState(false);
  const [promptHint, setPromptHint] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const url = imageUrls[0] ?? null;

  async function onRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/ads/${campaignId}/tiles/${tile.id}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(promptHint.trim() ? { promptHint: promptHint.trim() } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        return;
      }
      // Reset card state and resume polling against the freshly-submitted run.
      setImageUrls([]);
      setStatus('cooking');
      if (body.workflowId) setWorkflowId(body.workflowId);
      setShowRegen(false);
      setPromptHint('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <article className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong">
      <div
        className="relative overflow-hidden rounded-[10px] border border-line bg-bg-3"
        style={{ aspectRatio: aspect }}
      >
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="open full-size creative"
            className="absolute inset-0 cursor-zoom-in"
          >
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </a>
        ) : (
          <PlaceholderGlow />
        )}

        {status !== 'done' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg-0/70 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <div
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-pill border',
                  status === 'failed'
                    ? 'border-danger bg-danger-soft text-danger'
                    : 'border-line-volt bg-volt-soft text-volt shadow-bloom-volt-sm',
                )}
              >
                <Sparkles size={16} strokeWidth={1.75} />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-2">
                {status}…
              </span>
              {error && <span className="text-[10.5px] text-danger">{error}</span>}
            </div>
          </div>
        )}

        {/* Hover-reveal download — only meaningful in the done state. */}
        {status === 'done' && url && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 z-card flex items-center gap-1 rounded-b-[10px] bg-gradient-to-t from-bg-0/80 to-transparent px-2 pb-2 pt-8',
              'opacity-0 transition-opacity duration-fast ease-out',
              'group-hover:pointer-events-auto group-hover:opacity-100',
              'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
            )}
          >
            <span className="flex-1" />
            <a
              href={`/api/ads/${campaignId}/tiles/${tile.id}/download`}
              download
              aria-label={`download ${tile.width}×${tile.height} png`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3/80"
            >
              <Download size={12} strokeWidth={1.75} />
            </a>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 px-1">
        <Badge kind={status === 'done' ? 'live' : status === 'failed' ? 'archived' : 'cooking'}>
          {status === 'done' ? 'ready' : status === 'failed' ? 'failed' : status}
        </Badge>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-2">
          {tile.width}×{tile.height}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="regenerate"
          disabled={regenerating || status === 'cooking' || status === 'queued'}
          onClick={() => setShowRegen((v) => !v)}
          className="inline-flex h-7 items-center gap-[4px] rounded-[7px] px-[6px] text-[11.5px] text-fg-1 transition-colors duration-fast ease-out hover:bg-bg-3 hover:text-fg-0 disabled:opacity-40"
        >
          <RefreshCw size={12} strokeWidth={1.75} className={regenerating ? 'animate-spin' : ''} />{' '}
          redo
        </button>
      </footer>

      {showRegen && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-line-subtle bg-bg-3 p-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-2">
              regenerate
            </span>
            <span className="flex-1" />
            <button
              type="button"
              aria-label="cancel regenerate"
              onClick={() => setShowRegen(false)}
              className="grid h-6 w-6 place-items-center rounded-[6px] text-fg-2 hover:bg-bg-2 hover:text-fg-0"
            >
              <X size={12} strokeWidth={1.75} />
            </button>
          </div>
          <Textarea
            rows={2}
            value={promptHint}
            onChange={(e) => setPromptHint(e.target.value)}
            placeholder="optional: nudge the prompt (e.g. brighter background, tighter crop)"
            aria-label="prompt hint"
          />
          <div className="flex items-center justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating}
              leadingIcon={
                regenerating ? (
                  <Loader2 size={12} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <Sparkles size={12} strokeWidth={1.75} />
                )
              }
            >
              {regenerating ? 'submitting…' : 'regenerate'}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function PlaceholderGlow() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, var(--volt-soft), transparent 60%),' +
          'radial-gradient(ellipse at 80% 80%, var(--ultraviolet-soft), transparent 60%)',
      }}
    />
  );
}
