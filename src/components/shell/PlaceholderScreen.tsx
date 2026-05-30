import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  cta?: ReactNode;
};

export function PlaceholderScreen({ eyebrow, title, body, cta }: Props) {
  return (
    <div className="relative mx-auto max-w-[640px] py-20 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-card"
        style={{
          background:
            'radial-gradient(ellipse 600px 320px at 50% 0%, var(--ultraviolet-soft), transparent 60%)',
        }}
      />
      <span className="t-eyebrow">// {eyebrow}</span>
      <h1 className="mt-2 t-h2 text-fg-0">{title}</h1>
      <p className="mx-auto mt-3 max-w-[480px] text-[14.5px] leading-[1.6] text-fg-2">{body}</p>
      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  );
}
