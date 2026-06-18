'use client';

import { AtSign, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button, cn, FieldLabel, Input } from '@/components/ui';

export function EmailDisclosure() {
  const [open, setOpen] = useState(false);

  function handleToggle() {
    setOpen((prev) => !prev);
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[12px] border transition-colors duration-fast ease-out',
        open
          ? 'border-line bg-bg-2'
          : 'border-dashed border-line-subtle bg-transparent hover:border-line hover:bg-white/[0.02]',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="email-panel"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 px-[14px] py-[12px] text-[13.5px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:text-fg-0"
      >
        <span className="flex items-center gap-[10px]">
          <span
            aria-hidden="true"
            className="inline-grid h-[22px] w-[22px] place-items-center rounded-[6px] border border-line-subtle bg-bg-3"
          >
            <AtSign size={12} strokeWidth={2} className="text-fg-2" />
          </span>
          sign in with email instead
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={cn(
            'text-fg-2 transition-transform duration-base ease-out',
            open && 'rotate-180 text-fg-1',
          )}
        />
      </button>

      {/* Inline disclosure panel — expands in place, no content swap */}
      <div
        id="email-panel"
        role="region"
        aria-label="email sign-in form"
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 320ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <form
            className="flex flex-col gap-3 border-t border-line-subtle px-[14px] pb-[14px] pt-[14px]"
            action="#"
          >
            <div>
              <FieldLabel htmlFor="vitrine-email">email</FieldLabel>
              <Input
                id="vitrine-email"
                type="email"
                autoComplete="email"
                placeholder="you@studio.co"
              />
            </div>
            <div>
              <FieldLabel htmlFor="vitrine-password">password</FieldLabel>
              <Input
                id="vitrine-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-center justify-between text-[12px] text-fg-2">
              <label className="inline-flex cursor-pointer select-none items-center gap-2">
                <input type="checkbox" className="accent-volt" />
                remember me
              </label>
              <a href="#" className="text-fg-1 hover:text-fg-0">
                forgot?
              </a>
            </div>
            <Button variant="secondary" type="submit" className="w-full justify-center">
              sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
