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

      <header className="relative z-card flex items-center justify-between px-10 py-6">
        <Wordmark size={28} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-3">
          campaigns · photoshoot · brand dna
        </span>
      </header>

      {(error || notice) && (
        <div className="relative z-card mx-auto mt-2 max-w-[1100px] px-10">
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

      <main className="relative z-card mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 px-10 pb-16 pt-8 lg:grid-cols-[1fr_minmax(0,440px)]">
        <LoginPitch />
        <AuthCard />
      </main>

      <footer className="relative z-card px-10 pb-8 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
        powered by Civitai · buzz inside
      </footer>
    </div>
  );
}
