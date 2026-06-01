import Link from 'next/link';
import { ArrowRight, Dna, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';

const cards = [
  {
    num: '1',
    title: 'tell us about your brand',
    body: 'drop a url, a logo, brand colors, or a quick one-liner — any combo works. nothing is required.',
    icon: Pencil,
  },
  {
    num: '2',
    title: 'we extract your dna',
    body: 'palette, tone of voice, audience, and aesthetic — pulled together while you wait.',
    icon: Dna,
  },
  {
    num: '3',
    title: 'review and pick your first ship',
    body: 'tweak anything that feels off, then choose where to spend your first Buzz — a campaign or a photoshoot.',
    icon: Sparkles,
  },
];

export function WelcomeStep() {
  return (
    <section className="flex flex-col items-center gap-12 pt-12 text-center">
      <div className="grid h-[72px] w-[72px] place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt shadow-bloom-volt-sm">
        <Dna size={28} strokeWidth={1.75} />
      </div>
      <header className="flex flex-col items-center gap-4">
        <h1 className="t-h1 text-fg-0">
          welcome to{' '}
          <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
            vitrine.
          </span>
        </h1>
        <p className="max-w-[520px] text-[16px] leading-[1.5] text-fg-2">
          generate on-brand campaigns, photos, and reels — paid in Buzz. a quick setup teaches
          vitrine your brand so every shoot and campaign looks like you.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map(({ num, title, body, icon: Icon }) => (
          <article
            key={num}
            className="flex flex-col gap-4 rounded-[18px] border border-line-subtle bg-bg-2/80 p-5 text-left transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-3">
                step {num}
              </span>
              <span className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-bg-3 text-fg-2">
                <Icon size={18} strokeWidth={1.75} />
              </span>
            </div>
            <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-fg-0">
              {title}
            </h3>
            <p className="text-[13.5px] leading-[1.5] text-fg-2">{body}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link href="/onboarding/input">
          <Button variant="primary" size="lg" trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}>
            let&apos;s go
          </Button>
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-3">
          ~2 minutes · skip anything you want
        </span>
      </div>
    </section>
  );
}
