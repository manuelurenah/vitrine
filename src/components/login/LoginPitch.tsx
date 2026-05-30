import { Check } from 'lucide-react';

const travels = [
  ['your Buzz balance', 'spend it on shoots, posts, and reels'],
  ['saved brand dna', 'palette, tone, audience, ready to use'],
  ['every campaign you’ve shipped', 'picks up where you left off'],
] as const;

export function LoginPitch() {
  return (
    <section className="flex max-w-[520px] flex-col gap-7">
      <span className="t-eyebrow">// step 0 · sign in</span>
      <h1 className="t-h1 text-fg-0">
        one door.
        <br />
        <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
          all your buzz.
        </span>
      </h1>
      <p className="max-w-[460px] text-[15.5px] leading-[1.6] text-fg-1">
        vitrine runs on your Civitai account — your Buzz balance, saved brand DNA, and every
        campaign you’ve shipped come along for the ride. one click in, no second password to lose.
      </p>
      <ul className="flex flex-col gap-3">
        {travels.map(([bold, rest]) => (
          <li key={bold} className="flex items-start gap-3 text-[13.5px] text-fg-1">
            <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-line-volt bg-volt-soft text-volt">
              <Check size={12} strokeWidth={3} />
            </span>
            <span>
              <b className="font-semibold text-fg-0">{bold}</b> — {rest}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
