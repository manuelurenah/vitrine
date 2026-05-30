import { GradientThumb, type ThumbTone } from './GradientThumb';

type Props = {
  title: string;
  sub: string;
  tone?: ThumbTone;
};

export function SuggestionCard({ title, sub, tone }: Props) {
  return (
    <article className="group flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-3 transition-all duration-base ease-out hover:-translate-y-[2px] hover:border-line-strong">
      <GradientThumb tone={tone} className="aspect-[4/3]">
        <div className="absolute inset-0 flex flex-col justify-between p-[14px]">
          <div
            className="font-display text-[13px] font-bold leading-[1.1] tracking-[-0.02em] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
          >
            {title}
          </div>
          <div className="h-1 w-[60%] rounded-[2px] bg-white/50" />
        </div>
      </GradientThumb>
      <div className="px-[2px]">
        <div className="text-[14px] font-medium leading-[1.2] text-fg-0">{title}</div>
        <p
          className="mt-1 text-[12.5px] leading-[1.4] text-fg-2"
          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {sub}
        </p>
      </div>
    </article>
  );
}
