import { ArrowRight } from 'lucide-react';

export function CivitaiSsoButton() {
  return (
    <form method="post" action="/api/auth/login">
      <button
        type="submit"
        className="group flex w-full items-center gap-3 rounded-[12px] border-0 bg-volt px-5 py-[14px] text-[15px] font-semibold text-fg-on-volt shadow-bloom-volt-sm transition-all duration-base ease-out hover:bg-volt-hover hover:shadow-bloom-volt active:translate-y-[1px] active:bg-volt-press"
      >
        <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden>
          <path
            d="M16 3 L28.124 10 L28.124 22 L16 29 L3.876 22 L3.876 10 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M21.5 12.5 a6.5 6.5 0 1 0 0 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="flex-1 text-left">continue with Civitai</span>
        <ArrowRight
          size={18}
          strokeWidth={2.4}
          className="opacity-70 transition-transform duration-base ease-out group-hover:translate-x-[3px] group-hover:opacity-100"
        />
      </button>
    </form>
  );
}
