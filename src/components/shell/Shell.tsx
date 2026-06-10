import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { type Crumb, TopBar } from './TopBar';

type Props = {
  user: { initials: string; name: string; tier?: string };
  buzzBalance?: number;
  crumbs?: Crumb[];
  back?: { label: string; href: string };
  children: ReactNode;
};

export function Shell({ user, buzzBalance, crumbs, back, children }: Props) {
  return (
    <div className="grid h-screen w-screen grid-cols-[232px_1fr] overflow-hidden bg-bg-0">
      <Sidebar user={user} buzzBalance={buzzBalance} />
      <div className="grid grid-rows-[56px_1fr] overflow-hidden">
        <TopBar crumbs={crumbs} back={back} buzzBalance={buzzBalance} />
        <main className="relative overflow-auto px-9 pb-[60px] pt-7">{children}</main>
      </div>
    </div>
  );
}
