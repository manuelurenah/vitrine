'use client';

import { AtSign, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button, FieldLabel, Input, cn } from '@/components/ui';

export function EmailDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-[12px] border border-line-subtle bg-bg-2/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="email-panel"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-[14px] py-[12px] text-[13.5px] font-medium text-fg-1 transition-colors duration-fast ease-out hover:text-fg-0"
      >
        <span className="flex items-center gap-[10px]">
          <AtSign size={12} strokeWidth={2} className="text-fg-2" />
          sign in with email instead
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={cn('text-fg-2 transition-transform duration-base ease-out', open && 'rotate-180')}
        />
      </button>
      <div
        id="email-panel"
        hidden={!open}
        className={cn(
          'grid gap-3 border-t border-line-subtle px-[14px] pb-[14px] pt-[14px]',
          !open && 'hidden',
        )}
      >
        <form className="flex flex-col gap-3" action="#">
          <div>
            <FieldLabel htmlFor="vitrine-email">email</FieldLabel>
            <Input id="vitrine-email" type="email" autoComplete="email" placeholder="you@studio.co" />
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
            <label className="inline-flex items-center gap-2">
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
  );
}
