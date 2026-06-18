import type { ReactNode } from 'react';
import { MobileTabBar, type MobileTabId } from './MobileTabBar';
import { MobileTopBar } from './MobileTopBar';

type Props = {
  /** TopBar center title. */
  title?: string;
  /** Optional eyebrow above the title in the TopBar. */
  eyebrow?: string;
  /**
   * Show a back affordance in the TopBar's leading slot.
   * Pass `{ href }` for a link, or `true` for a button (pair with onClick wrapper).
   */
  back?: { href: string; label?: string } | true;
  /** Show the wordmark in the leading slot (ignored when back is set). */
  leadingLogo?: boolean;
  /** Trailing slot of the TopBar (e.g. BuzzPill, IconButton). */
  rightSlot?: ReactNode;
  /** Which bottom tab is currently active. */
  active: MobileTabId;
  /** Enable volt + ultraviolet bloom radial gradient background. */
  bloom?: boolean;
  /**
   * Optional sticky CTA rendered just above the tab bar (e.g. "generate · 60 buzz").
   * The content region automatically gains extra bottom padding to avoid
   * being obscured.
   */
  stickyCta?: ReactNode;
  children: ReactNode;
};

/**
 * Full-screen mobile layout composer.
 *
 * Stacking order (bottom → top):
 *   1. Optional bloom background (z-0, pointer-events-none)
 *   2. Scrollable content region (z-1, independent scroll)
 *   3. Optional sticky CTA (z-15, fixed above tab bar)
 *   4. MobileTabBar (z-20, absolute floating pill — inset 12px, safe-area aware)
 *
 * Content padding-bottom = calc(safe-area + 76px) (pill height 64 + inset 12) + 72px (stickyCta) when present, so the last item is never hidden behind chrome.
 *
 * Matches mobile-shell.jsx `.m-screen` + `.m-screen-content`.
 */
export function ScreenFrame({
  title,
  eyebrow,
  back,
  leadingLogo,
  rightSlot,
  active,
  bloom = false,
  stickyCta,
  children,
}: Props) {
  // Content bottom padding baseline: pill height (64) + edge inset (12) = 76,
  // plus the sticky CTA row (~72) when present. Safe-area is added in CSS.
  const contentPbBase = 76 + (stickyCta ? 72 : 0);

  return (
    <div
      data-testid="screen-frame"
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg-0 font-body text-fg-0"
    >
      {/* Optional volt/ultraviolet bloom */}
      {bloom && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: [
              'radial-gradient(ellipse 380px 280px at 50% -20px, var(--volt-soft), transparent 60%)',
              'radial-gradient(ellipse 320px 240px at 110% 60%, var(--ultraviolet-soft), transparent 60%)',
            ].join(', '),
          }}
        />
      )}

      {/* Top bar — sits above scroll, below bloom */}
      <MobileTopBar
        title={title}
        eyebrow={eyebrow}
        back={back}
        leadingLogo={leadingLogo}
        rightSlot={rightSlot}
        className="relative z-10"
      />

      {/* Scrollable content region */}
      <div
        data-testid="screen-content"
        className="relative z-[1] flex-1 overflow-x-hidden overflow-y-auto px-4 pt-6"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${contentPbBase}px)` }}
      >
        {children}
      </div>

      {/* Sticky CTA — floats just above the tab bar */}
      {stickyCta && (
        <div
          data-testid="screen-sticky-cta"
          className="absolute left-3 right-3 z-[15] rounded-[14px] border border-line p-[10px] backdrop-blur-[14px]"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
            background: 'rgba(15,15,22,0.92)',
            boxShadow: '0 -8px 32px -12px rgba(0,0,0,0.5)',
          }}
        >
          {stickyCta}
        </div>
      )}

      {/* Bottom tab bar */}
      <MobileTabBar active={active} />
    </div>
  );
}
