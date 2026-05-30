import { BuzzGlyph } from '@/components/ui';
import { CivitaiSsoButton } from './CivitaiSsoButton';
import { EmailDisclosure } from './EmailDisclosure';

export function AuthCard() {
  return (
    <section
      aria-labelledby="auth-title"
      className="flex w-full max-w-[440px] flex-col gap-5 rounded-[18px] border border-line-subtle bg-bg-1/70 p-7 shadow-lg backdrop-blur-md"
    >
      <header className="flex flex-col gap-2">
        <span className="t-eyebrow">// welcome back</span>
        <h2 id="auth-title" className="t-h3 text-fg-0">
          sign in to vitrine
        </h2>
        <span className="text-[13px] text-fg-2">one click with your Civitai account</span>
      </header>

      <CivitaiSsoButton />

      <div className="flex items-center justify-center gap-[10px] font-mono text-[11.5px] text-fg-2">
        <BuzzGlyph size={14} />
        <span>your Buzz &amp; saved brand DNA travel with you</span>
      </div>

      <div className="flex items-center gap-3" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-line-subtle" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">or</span>
        <span className="h-px flex-1 bg-line-subtle" />
      </div>

      <EmailDisclosure />

      <p className="text-center text-[11.5px] leading-[1.5] text-fg-3">
        by continuing you agree to vitrine&apos;s{' '}
        <a href="#" className="text-fg-2 underline-offset-2 hover:underline">
          terms
        </a>{' '}
        &amp;{' '}
        <a href="#" className="text-fg-2 underline-offset-2 hover:underline">
          privacy
        </a>
        .
      </p>
    </section>
  );
}
