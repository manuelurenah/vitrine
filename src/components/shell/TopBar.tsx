'use client';

import { ArrowLeft } from 'lucide-react';
import { BuzzPill } from '@/components/ui';
import { ThemeToggle } from './ThemeToggle';

export type Crumb = { label: string; href?: string };

type Props = {
  crumbs?: Crumb[];
  back?: { label: string; href: string };
  buzzBalance?: number;
};

export function TopBar({ crumbs = [], back, buzzBalance }: Props) {
  return (
    <header className="flex h-14 items-center gap-[14px] border-b border-line-subtle bg-bg-0 px-6">
      {back ? (
        <a
          href={back.href}
          className="inline-flex h-[34px] items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-[14px] text-[13px] font-medium text-fg-0 transition-colors duration-fast ease-out hover:bg-bg-3"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          {back.label}
        </a>
      ) : (
        <nav aria-label="breadcrumb" className="flex items-center gap-[6px] text-[13px] text-fg-2">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="flex items-center gap-[6px]">
                {c.href && !isLast ? (
                  <a href={c.href} className="hover:text-fg-0">
                    {c.label}
                  </a>
                ) : (
                  <span className={isLast ? 'font-medium text-fg-0' : ''}>{c.label}</span>
                )}
                {!isLast && <span className="text-fg-3">/</span>}
              </span>
            );
          })}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-2">
        {typeof buzzBalance === 'number' && <BuzzPill amount={buzzBalance} />}
        <ThemeToggle />
      </div>
    </header>
  );
}
