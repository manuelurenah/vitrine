import { ArrowRight, Dna } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui';

// Decorative SVGs ported from design_handoff_vitrine/design_files/onboarding-icons.jsx

function DnaDecoration() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 320 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 50 C 80 20, 80 80, 160 50 C 240 20, 240 80, 300 50"
        stroke="rgba(0,255,157,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20 50 C 80 80, 80 20, 160 50 C 240 80, 240 20, 300 50"
        stroke="rgba(25,240,255,0.45)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {[40, 80, 120, 160, 200, 240, 280].map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={i % 2 === 0 ? 36 : 64}
          x2={x}
          y2={i % 2 === 0 ? 64 : 36}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

function CampaignDecoration() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 320 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <rect x="30" y="20" width="60" height="60" rx="6" fill="#c84a2e" />
      <rect x="100" y="14" width="60" height="72" rx="6" fill="#ffd966" />
      <rect x="170" y="20" width="60" height="60" rx="6" fill="#1a3d2a" />
      <rect x="240" y="28" width="60" height="48" rx="6" fill="rgba(124,92,255,0.5)" />
      <text
        x="60"
        y="58"
        fontSize="14"
        fontWeight="700"
        fontFamily="Bricolage Grotesque, sans-serif"
        fill="#fff"
        textAnchor="middle"
      >
        HOT
      </text>
      <text
        x="130"
        y="58"
        fontSize="14"
        fontWeight="700"
        fontFamily="Bricolage Grotesque, sans-serif"
        fill="#0a0a0f"
        textAnchor="middle"
      >
        NEW
      </text>
    </svg>
  );
}

function ShootDecoration() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 320 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="shoot-g1" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#d49060" />
          <stop offset="100%" stopColor="#5a2818" />
        </radialGradient>
      </defs>
      <rect
        x="40"
        y="20"
        width="80"
        height="60"
        rx="6"
        fill="#1f1f2c"
        stroke="rgba(255,255,255,0.15)"
      />
      <circle cx="80" cy="58" r="14" fill="url(#shoot-g1)" />
      <rect x="140" y="20" width="36" height="28" rx="4" fill="#2a6fa8" />
      <rect x="180" y="20" width="36" height="28" rx="4" fill="#f5b8b8" />
      <rect x="140" y="52" width="36" height="28" rx="4" fill="#4a3a2e" />
      <rect x="180" y="52" width="36" height="28" rx="4" fill="#8ed0a8" />
      <line x1="125" y1="50" x2="138" y2="50" stroke="rgba(0,255,157,0.6)" strokeWidth="1.5" />
      <polyline
        points="134,46 138,50 134,54"
        fill="none"
        stroke="rgba(0,255,157,0.6)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const cards = [
  {
    num: '1',
    title: 'build your brand DNA',
    body: 'drop a URL, a logo, or just describe yourself — we extract palette, tone, audience.',
    thumbClass:
      'radial-gradient(120% 80% at 20% 0%, rgba(0,255,157,0.30), transparent 60%), radial-gradient(120% 80% at 80% 100%, rgba(25,240,255,0.22), transparent 60%), var(--bg-3)',
    deco: <DnaDecoration />,
  },
  {
    num: '2',
    title: 'cook three reads',
    body: 'we propose three distinct campaign directions — pick the one that clicks.',
    thumbClass:
      'radial-gradient(120% 80% at 30% 100%, rgba(124,92,255,0.34), transparent 60%), radial-gradient(80% 80% at 80% 20%, rgba(255,43,214,0.22), transparent 60%), var(--bg-3)',
    deco: <CampaignDecoration />,
  },
  {
    num: '3',
    title: 'shoot, post, ship',
    body: 'phone photo → studio shot. one product → 12 posts, 3 ads, a hero reel.',
    thumbClass:
      'radial-gradient(100% 80% at 50% 50%, rgba(255,206,61,0.24), transparent 60%), radial-gradient(100% 60% at 0% 100%, rgba(0,255,157,0.16), transparent 60%), var(--bg-3)',
    deco: <ShootDecoration />,
  },
];

export function WelcomeStep() {
  return (
    <section className="flex flex-col items-center gap-6 pt-4 text-center lg:gap-8 lg:pt-6">
      <div className="grid h-[56px] w-[56px] place-items-center rounded-[16px] border border-line-volt bg-volt-soft text-volt shadow-bloom-volt-sm">
        <Dna size={28} strokeWidth={1.75} />
      </div>
      <header className="flex flex-col items-center gap-3">
        <h1 className="t-h1 text-fg-0">
          welcome to{' '}
          <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
            vitrine.
          </span>
        </h1>
        <p className="max-w-[540px] text-[16px] leading-[1.5] text-fg-1">
          generate on-brand campaigns, photos, and reels — paid in Buzz. three steps to your first.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map(({ num, title, body, thumbClass, deco }) => (
          <article
            key={num}
            className="flex flex-col gap-2 rounded-[20px] border border-line bg-gradient-to-b from-bg-1 to-bg-2 p-5 text-left transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-volt lg:gap-3 lg:p-6"
          >
            <span className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] text-volt">
              {num}
            </span>
            <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-fg-0">
              {title}
            </h3>
            <p className="text-[14px] leading-[1.5] text-fg-1">{body}</p>
            <div
              className="relative mt-auto h-[100px] overflow-hidden rounded-[12px] border border-white/[0.06]"
              style={{ background: thumbClass }}
            >
              {deco}
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link href="/onboarding/input">
          <Button
            variant="primary"
            size="lg"
            trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}
          >
            let&apos;s go
          </Button>
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3">
          ~2 minutes · skip anything you want
        </span>
      </div>
    </section>
  );
}
