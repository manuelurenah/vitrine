import { ArrowUpRight, KeyRound, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';
import { SessionActions } from '@/components/settings/SessionActions';
import { Badge, BuzzGlyph } from '@/components/ui';
import { ensureDefaultBrand } from '@/lib/brand';
import { sumChargedBuzz } from '@/lib/buzz';
import { getBuzzAccount, getMe } from '@/lib/civitai';
import { buzzTopUpUrl } from '@/lib/links';
import { REQUESTED_SCOPES } from '@/lib/scopes';
import { getSession } from '@/lib/session';
import { getUserKey } from '@/lib/userKey';

export const metadata = { title: 'settings · vitrine' };
export const dynamic = 'force-dynamic';

const SCOPE_LABELS: Array<{ bit: number; label: string; reason: string }> = [
  { bit: 1, label: 'UserRead', reason: 'identity (/me)' },
  { bit: 2, label: 'BuzzRead', reason: 'buzz balance' },
  { bit: 4, label: 'AIServicesRead', reason: 'past generations' },
  { bit: 8, label: 'AIServicesWrite', reason: 'cook + photoshoot' },
  { bit: 16, label: 'MediaRead', reason: 'image library' },
  { bit: 32, label: 'MediaWrite', reason: 'asset uploads' },
];

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const [userKey, me, buzz] = await Promise.all([
    getUserKey(session),
    getMe(session).catch(() => null),
    getBuzzAccount(session).catch(() => null),
  ]);
  const [brand, spentInApp] = await Promise.all([
    ensureDefaultBrand(userKey),
    sumChargedBuzz(userKey).catch(() => 0),
  ]);

  const username = me?.username ?? 'unknown';
  const civitaiId = me?.id ?? '—';
  const buzzBalance = buzz?.balance ?? null;
  const topUpUrl = buzzTopUpUrl();
  const grantedMask = session.tokens.scope ?? Number(REQUESTED_SCOPES);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <span className="t-eyebrow">{'// '}settings</span>
        <h1 className="t-h2 text-fg-0">account.</h1>
        <p className="text-[13.5px] text-fg-2">
          identity from Civitai · buzz spent in vitrine · scope grants · brand summary.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="identity">
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 font-mono text-[11.5px]">
            <dt className="text-fg-3">username</dt>
            <dd className="text-fg-1">{username}</dd>
            <dt className="text-fg-3">civitai id</dt>
            <dd className="text-fg-1">{civitaiId}</dd>
            <dt className="text-fg-3">tier</dt>
            <dd className="text-fg-1">creator · vitrine</dd>
          </dl>
        </Card>

        <Card title="buzz">
          <div className="flex items-center justify-between">
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
                balance
              </span>
              <span className="inline-flex items-center gap-1.5 t-h3 text-fg-0">
                <BuzzGlyph size={16} />
                {buzzBalance === null ? '—' : buzzBalance.toLocaleString()}
              </span>
              <span className="mt-1 font-mono text-[10.5px] text-fg-3">
                spent in vitrine · {spentInApp.toLocaleString()}
              </span>
            </div>
            <a
              href={topUpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-volt bg-volt-soft px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-volt hover:bg-volt/15"
            >
              <Sparkles size={13} strokeWidth={1.75} /> top up
              <ArrowUpRight size={12} strokeWidth={1.75} />
            </a>
          </div>
        </Card>
      </section>

      <Card title="oauth scopes">
        <p className="mb-3 text-[12.5px] text-fg-2">
          scopes vitrine requested at login. revoke to invalidate the grant on Civitai&apos;s side.
        </p>
        <ul className="flex flex-wrap gap-2">
          {SCOPE_LABELS.map(({ bit, label, reason }) => {
            const granted = (grantedMask & bit) === bit;
            return (
              <li key={label}>
                <Badge kind={granted ? 'live' : 'draft'}>
                  <span className="inline-flex items-center gap-1.5">
                    <KeyRound size={11} strokeWidth={1.75} />
                    {label}
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-70">
                      · {reason}
                    </span>
                  </span>
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="brand">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
              default brand
            </span>
            <span className="t-h3 text-fg-0">{brand.name}</span>
            <span className="mt-1 font-mono text-[10.5px] text-fg-3">
              {brand.palette.length} swatches · {brand.tone || 'tone tbd'}
            </span>
          </div>
          <a
            href="/brand"
            className="inline-flex items-center gap-1.5 rounded-pill border border-line-subtle bg-bg-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-1 hover:bg-bg-3 hover:text-fg-0"
          >
            edit
          </a>
        </div>
      </Card>

      <Card title="session" tone="danger">
        <p className="mb-3 text-[12.5px] text-fg-2">
          sign out clears your local cookie. revoke also invalidates tokens at Civitai.
        </p>
        <SessionActions />
      </Card>
    </div>
  );
}

function Card({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  const ring = tone === 'danger' ? 'border-danger/30' : 'border-line-subtle';
  return (
    <section className={`rounded-[14px] border ${ring} bg-bg-2 p-5`}>
      <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
        {'// '}
        {title}
      </h2>
      {children}
    </section>
  );
}
