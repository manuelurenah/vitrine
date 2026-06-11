import { Wordmark } from '@/components/shell';
import { AuthCard } from './AuthCard';
import { LoginPitch } from './LoginPitch';

type Props = {
  error?: string;
  notice?: string;
};

export function LoginScreen({ error, notice }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 900px 540px at 12% -10%, var(--volt-soft), transparent 60%),' +
            'radial-gradient(ellipse 800px 480px at 92% 110%, var(--ultraviolet-soft), transparent 60%)',
        }}
      />

      {/* Responsive header padding: px-4 on mobile, px-10 on sm+ */}
      <header className="relative z-card flex items-center justify-between px-4 py-5 sm:px-10 sm:py-6">
        <Wordmark size={28} />
        {/* Tagline hidden on narrow screens to avoid overflow */}
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-3 sm:inline">
          campaigns · photoshoot · brand dna
        </span>
      </header>

      {(error || notice) && (
        <div className="relative z-card mx-auto mt-2 max-w-[1100px] px-4 sm:px-10">
          {error && (
            <div className="mb-3 rounded-[12px] border border-danger bg-danger-soft px-4 py-3 text-[13px] text-fg-0">
              oauth error: <code className="font-mono text-danger">{error}</code>
            </div>
          )}
          {notice && (
            <div className="mb-3 rounded-[12px] border border-line-volt bg-volt-soft px-4 py-3 text-[13px] text-fg-0">
              {notice}
            </div>
          )}
        </div>
      )}

      {/* Single column on mobile, two-column at 960px+ */}
      <main className="relative z-card mx-auto grid max-w-[1100px] grid-cols-1 items-start gap-8 px-4 pb-16 pt-6 sm:px-10 sm:pt-8 min-[960px]:items-center min-[960px]:gap-16 min-[960px]:grid-cols-[1fr_minmax(0,440px)]">
        <LoginPitch />
        <AuthCard />
      </main>

      <footer className="relative z-card px-4 pb-8 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3 sm:px-10">
        powered by Civitai · buzz inside
      </footer>
    </div>
  );
}
