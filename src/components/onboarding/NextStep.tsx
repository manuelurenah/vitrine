import { Camera, Megaphone, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { BuzzPill } from '@/components/ui';

const options = [
  {
    href: '/campaigns',
    eyebrow: 'recommended for you',
    title: 'cook a campaign',
    body: '12 posts, 3 ad creatives, captions — all tuned to your dna.',
    cost: 60,
    icon: Megaphone,
  },
  {
    href: '/photoshoot',
    eyebrow: 'or start a',
    title: 'photoshoot',
    body: 'phone shot → studio set. clean backgrounds, lifestyle, hero crops.',
    cost: 36,
    icon: Camera,
  },
] as const;

export function NextStep() {
  return (
    <section className="flex flex-col items-center gap-10 pt-12 text-center">
      <header className="flex flex-col items-center gap-3">
        <span className="t-eyebrow">// step 3 of 3 · pick your ship</span>
        <h2 className="t-h2 text-fg-0">pick your first ship.</h2>
        <p className="max-w-[480px] text-[14.5px] leading-[1.5] text-fg-2">
          we&apos;ve got everything we need to start cooking. choose where to spend your first 60
          buzz.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        {options.map(({ href, eyebrow, title, body, cost, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group relative flex flex-col gap-5 rounded-[20px] border border-line-subtle bg-bg-2 p-6 text-left transition-all duration-base ease-out hover:-translate-y-[3px] hover:border-line-volt hover:shadow-bloom-volt-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <div className="flex flex-col">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                  {eyebrow}
                </span>
                <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-fg-0">
                  {title}
                </span>
              </div>
              <span className="ml-auto">
                <BuzzPill amount={cost} size="compact" />
              </span>
            </div>
            <p className="text-[13.5px] leading-[1.5] text-fg-2">{body}</p>
            <span className="mt-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-volt opacity-0 transition-opacity duration-fast ease-out group-hover:opacity-100">
              start <Sparkles size={12} strokeWidth={1.75} />
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/onboarding/dna"
        className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg-3 hover:text-fg-1"
      >
        ← review your brand dna
      </Link>
    </section>
  );
}
