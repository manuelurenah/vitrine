'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export type TabStripTab<K extends string> = {
  key: K;
  label: string;
  icon?: ReactNode;
};

export type TabStripProps<K extends string> = {
  value: K;
  onChange: (key: K) => void;
  label: string;
  tabs: ReadonlyArray<TabStripTab<K>>;
  panelIds?: Partial<Record<K, string>>;
  className?: string;
};

/**
 * Shared tab strip used by uploader-style flows (Task 6 cross-flow UX).
 *
 * Renders a `role="tablist"` of segmented buttons. Each button gets a stable
 * `id` derived from `useId()` + the tab key, so callers can wire
 * `aria-labelledby` on the matching `tabpanel` via {@link tabId}. Pass
 * `panelIds` so each tab button's `aria-controls` points at the right panel.
 */
export function TabStrip<K extends string>({
  value,
  onChange,
  label,
  tabs,
  panelIds,
  className,
}: TabStripProps<K>) {
  const base = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex gap-1 self-start rounded-[10px] border border-line bg-bg-2 p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={tabId(base, tab.key)}
            aria-selected={active}
            aria-controls={panelIds?.[tab.key]}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-fast ease-out',
              active ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function tabId(base: string, key: string) {
  return `${base}-${key}-tab`;
}
