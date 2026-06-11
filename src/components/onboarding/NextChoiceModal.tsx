'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BuzzPill, Modal } from '@/components/ui';

type Props = {
  onClose: () => void;
};

/**
 * "What's next?" choice modal overlaying the DNA screen.
 * Two cards: campaigns (recommended) + photoshoot.
 * Closing / Esc / outside-click navigates to /campaigns (dashboard fallback).
 */
export function NextChoiceModal({ onClose }: Props) {
  const router = useRouter();

  function handleClose() {
    onClose();
    router.push('/campaigns');
  }

  function handleCampaigns() {
    router.push('/campaigns');
  }

  function handlePhotoshoot() {
    router.push('/photoshoot');
  }

  return (
    <Modal
      open
      onClose={handleClose}
      eyebrow="// step 3 of 3 · ship it"
      title="your brand DNA is ready."
      maxWidth={760}
    >
      <div className="flex flex-col gap-6">
        <p className="text-[14px] leading-[1.5] text-fg-2">
          pick where to start — you can come back for the other any time.
        </p>

        {/* Choice cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Campaigns — recommended */}
          <button
            type="button"
            onClick={handleCampaigns}
            className="group relative flex flex-col gap-4 rounded-[16px] border border-line-volt bg-bg-2 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-bloom-volt-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            {/* Recommended badge */}
            <span className="absolute right-4 top-4 rounded-pill bg-volt px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bg-0">
              recommended
            </span>

            <div className="flex flex-col gap-1 pr-24">
              <h4 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-fg-0">
                campaigns
              </h4>
              <p className="text-[12.5px] leading-[1.45] text-fg-2">
                12 posts, 3 ad creatives, a hero reel — all from one product shot, tuned to your
                dna.
              </p>
            </div>

            {/* Mini 3-post preview */}
            <div className="grid h-[72px] grid-cols-3 gap-1.5 overflow-hidden rounded-[10px]">
              <div className="flex flex-col items-center justify-center rounded-[8px] bg-[#c84a2e] p-1">
                <span className="text-center font-display text-[7px] font-bold leading-tight text-white">
                  put the
                  <br />
                  heat
                  <br />
                  back in
                </span>
                <span className="mt-1 font-mono text-[5.5px] text-white/60">1/12</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-[8px] bg-[#ffd966] p-1">
                <span className="text-center font-display text-[7px] font-bold leading-tight text-[#1a1a1a]">
                  small
                  <br />
                  batch.
                  <br />
                  big flavor.
                </span>
                <span className="mt-1 font-mono text-[5.5px] text-[#1a1a1a]/50">2/12</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-[8px] bg-[#1a3d2a] p-1">
                <span className="text-center font-display text-[7px] font-bold leading-tight text-[#ffd966]">
                  cooked
                  <br />
                  with
                  <br />
                  care
                </span>
                <span className="mt-1 font-mono text-[5.5px] text-white/40">reel</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <BuzzPill amount={60} size="compact" />
              <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-volt opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                start <ArrowRight size={13} strokeWidth={2} />
              </span>
            </div>
          </button>

          {/* Photoshoot */}
          <button
            type="button"
            onClick={handlePhotoshoot}
            className="group flex flex-col gap-4 rounded-[16px] border border-line-subtle bg-bg-2 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-[2px] hover:border-line-volt hover:shadow-bloom-volt-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          >
            <div className="flex flex-col gap-1">
              <h4 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-fg-0">
                photoshoot
              </h4>
              <p className="text-[12.5px] leading-[1.45] text-fg-2">
                turn one phone photo into studio, lifestyle, in-use, and hero variations.
              </p>
            </div>

            {/* Mini input-photo + 4-shot preview */}
            <div className="flex h-[72px] gap-1.5 overflow-hidden rounded-[10px]">
              {/* Input pane */}
              <div className="flex w-[38%] flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-line bg-bg-3/60 p-1">
                <div className="h-8 w-8 rounded-[6px] bg-[#2a6fa8]/70" />
                <span className="font-mono text-[6px] uppercase tracking-[0.08em] text-fg-3">
                  your photo
                </span>
              </div>
              {/* 4-shot grid */}
              <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1">
                <div className="rounded-[6px] bg-[#2a6fa8]" />
                <div className="rounded-[6px] bg-[#f5b8b8]" />
                <div className="rounded-[6px] bg-[#4a3a2e]" />
                <div className="rounded-[6px] bg-[#8ed0a8]" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <BuzzPill amount={36} size="compact" />
              <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-volt opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                start <ArrowRight size={13} strokeWidth={2} />
              </span>
            </div>
          </button>
        </div>

        {/* Footer alt link */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => router.push('/campaigns')}
            className="font-mono text-[11.5px] text-fg-3 transition-colors duration-fast ease-out hover:text-fg-1"
          >
            or just drop me at the dashboard →
          </button>
        </div>
      </div>
    </Modal>
  );
}
