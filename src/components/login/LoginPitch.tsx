import { Check } from 'lucide-react';

const features = [
  ['campaigns from a brief', 'cook social-ready posts and reels across every channel in one pass'],
  ['product photoshoots', 'turn a single product shot into a full library of on-brand scenes'],
  ['brand dna, once', 'palette, tone, audience, and presets reused on every generation'],
  ['paid in Buzz', 'cost previewed before you cook — no surprises, no second wallet'],
] as const;

export function LoginPitch() {
  return (
    <section className="flex max-w-[520px] flex-col gap-7">
      <span className="t-eyebrow">// step 0 · sign in</span>
      <h1 className="t-h1 text-fg-0">
        your brand,
        <br />
        <span className="bg-gradient-to-br from-volt to-ion bg-clip-text text-transparent">
          shot on demand.
        </span>
      </h1>
      <p className="max-w-[460px] text-[15.5px] leading-[1.6] text-fg-1">
        vitrine is a campaign and product-photoshoot studio for small brands. write a brief, get a
        full set of on-brand images and copy back — powered by Civitai Buzz, no second password to
        lose.
      </p>
      <ul className="flex flex-col gap-3">
        {features.map(([bold, rest]) => (
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
