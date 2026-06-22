'use client';

import { usePreferences } from '@/components/PreferencesProvider';
import { MOTION_PREFS, THEME_PREFS } from '@/lib/preferences';

export function PreferencesControls() {
  const { theme, reduceMotion, setTheme, setReduceMotion } = usePreferences();

  return (
    <div className="flex flex-col gap-4">
      <Segmented label="theme" value={theme} options={THEME_PREFS} onChange={setTheme} />
      <Segmented
        label="reduce motion"
        value={reduceMotion}
        options={MOTION_PREFS}
        onChange={setReduceMotion}
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-fit gap-1 rounded-[10px] border border-line-subtle bg-bg-1 p-1"
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className={`rounded-[7px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                active ? 'bg-volt-soft text-volt' : 'text-fg-2 hover:bg-bg-3 hover:text-fg-0'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
