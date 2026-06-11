'use client';

import { ArrowRight, Check, Link2, Sparkles, TriangleAlert, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, cn, Input, Textarea } from '@/components/ui';
import { pickContrast } from '@/lib/color';
import type { OnboardingPayload } from '@/lib/onboarding';
import { ColorPickerChip } from './ColorPickerChip';
import { LogoPreview } from './LogoPreview';
import { useLogoUpload } from './useLogoUpload';

const SUGGESTED_COLORS = ['#ff7849', '#ffd13d', '#1c4f29', '#7c5cff', '#19f0ff'] as const;

type Props = { payload?: OnboardingPayload };

export function InputStep({ payload = {} }: Props) {
  const router = useRouter();

  const [url, setUrl] = useState(payload.websiteUrl ?? '');
  const [brandName, setBrandName] = useState(payload.brandName ?? '');
  const [description, setDescription] = useState(payload.description ?? '');
  const [colors, setColors] = useState<string[]>(payload.colors ?? []);
  const [logoName, setLogoName] = useState<string | null>(payload.logoName ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(payload.logoUrl ?? null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const logoUpload = useLogoUpload();

  async function handleLogoFile(file: File) {
    setLogoName(file.name);
    const result = await logoUpload.upload(file);
    if (result) setLogoUrl(result.publicUrl);
  }

  function clearLogo() {
    setLogoUrl(null);
    setLogoName(null);
  }

  function addColor(hex: string) {
    const c = hex.toLowerCase();
    setColors((cs) => (cs.includes(c) ? cs : [c, ...cs]));
  }

  function toggleColor(hex: string) {
    setColors((cs) => (cs.includes(hex) ? cs.filter((x) => x !== hex) : [...cs, hex]));
  }

  // Debounced persistence — every editable field rides the same patch so
  // the user's state survives reloads. Skipped on initial mount.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void fetch('/api/onboarding/payload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: ctrl.signal,
        body: JSON.stringify({
          websiteUrl: url.trim(),
          brandName,
          description,
          colors,
          logoName,
          logoUrl,
        }),
      }).catch(() => {});
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [url, brandName, description, colors, logoName, logoUrl]);

  const [pending, setPending] = useState<null | 'extract' | 'continue'>(null);

  async function flushPatch() {
    // Await the patch so the next step's server render sees fresh data.
    // Debounced effect would race with router.push.
    try {
      await fetch('/api/onboarding/payload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          websiteUrl: url.trim(),
          brandName,
          description,
          colors,
          logoName,
          logoUrl,
        }),
      });
    } catch {
      // best-effort — navigation continues even if persistence failed
    }
  }

  async function onExtract() {
    setUrlError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('add a url first, or use the continue button below to skip scraping.');
      return;
    }
    if (!isLikelyUrl(trimmed)) {
      setUrlError("that doesn't look right — drop the https:// and try just `your-shop.co`");
      return;
    }
    setPending('extract');
    await flushPatch();
    router.push('/onboarding/processing');
  }

  async function onContinue() {
    setUrlError(null);
    setPending('continue');
    await flushPatch();
    // Skip the processing screen entirely — there's nothing to do.
    router.push('/onboarding/dna');
  }

  const customColors = colors.filter(
    (c) => !SUGGESTED_COLORS.some((s) => s.toLowerCase() === c.toLowerCase()),
  );
  const allSwatches = uniqueColors([...customColors, ...SUGGESTED_COLORS]);

  return (
    <section className="flex flex-col gap-10 pt-10">
      <header className="flex flex-col gap-2 text-center">
        <span className="t-eyebrow">// step 1 of 3 · brand dna</span>
        <h2 className="t-h2 text-fg-0">tell us who you are.</h2>
        <p className="mx-auto max-w-[560px] text-[14.5px] leading-[1.5] text-fg-2">
          drop a url and we&apos;ll extract everything — or skip the url and tell us yourself. every
          field is optional, but the more you give us the sharper your shoots.
        </p>
      </header>

      <article className="rounded-[18px] border border-line-volt bg-bg-2 p-6 shadow-bloom-volt-sm">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill border border-line-volt bg-volt-soft text-volt">
            <Sparkles size={18} strokeWidth={1.75} />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <h3 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-fg-0">
              let vitrine read your site
            </h3>
            <p className="text-[12.5px] text-fg-2">
              fastest path. we extract your logo, palette, fonts, copy, and tone.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-volt">
            recommended
          </span>
        </div>
        <div className="relative mt-5">
          <Link2
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-fg-2"
          />
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="your-shop.co"
            className="pl-[34px]"
            type="url"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {urlError && (
          <p className="mt-2 flex items-center gap-2 text-[12px] text-fg-2">
            <TriangleAlert size={12} strokeWidth={2} className="text-danger" />
            {urlError}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={onExtract}
            disabled={pending !== null || !url.trim()}
            trailingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            {pending === 'extract' ? 'extracting…' : 'extract + continue'}
          </Button>
        </div>
      </article>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line-subtle" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-3">
          or tell us manually
        </span>
        <span className="h-px flex-1 bg-line-subtle" />
      </div>

      <article className="rounded-[18px] border border-line-subtle bg-bg-2 p-6">
        <header className="flex flex-col gap-1 pb-5">
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-fg-0">
            tell us in your own words
          </h3>
          <p className="text-[12.5px] text-fg-2">
            anything you have — we&apos;ll fill the rest at the next step. all optional.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHead title="brand name" tag="optional" />
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. lumen skincare"
            />
          </Card>

          <Card>
            <CardHead title="logo" tag={logoUrl ? 'uploaded' : 'optional'} />
            {logoUrl ? (
              <LogoPreview
                src={logoUrl}
                name={logoName}
                caption="your uploaded logo."
                helperText="replace or remove anytime. we crop + tint automatically."
                onReplace={handleLogoFile}
                onRemove={clearLogo}
                status={logoUpload.status}
              />
            ) : (
              <label className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line bg-bg-3/60 text-fg-2 transition-colors duration-fast ease-out hover:border-line-volt hover:text-volt">
                <UploadCloud size={22} strokeWidth={1.5} />
                <div className="text-center text-[12.5px]">
                  <div className="text-fg-1">
                    {logoUpload.status.kind === 'uploading'
                      ? `uploading ${logoName ?? ''}…`
                      : (logoName ?? 'drop a png, svg, or jpg')}
                  </div>
                  <div className="font-mono text-[10.5px] text-fg-3">
                    we crop + tint automatically
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoFile(f);
                  }}
                />
              </label>
            )}
            {logoUpload.status.kind === 'error' && (
              <p className="flex items-center gap-2 text-[12px] text-fg-2">
                <TriangleAlert size={12} strokeWidth={2} className="text-danger" />
                upload failed — {logoUpload.status.message}
              </p>
            )}
          </Card>

          <Card className="md:col-span-2">
            <CardHead title="describe your business" tag="in your own words" />
            <p className="text-[12.5px] text-fg-2">
              like talking to a friend. what do you sell? who buys? what&apos;s the vibe?
            </p>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="we make small-batch chili oil — sold at three farmers markets in austin. customers are mostly food nerds in their 30s…"
            />
          </Card>

          <Card className="md:col-span-2">
            <CardHead
              title="brand colors"
              tag={colors.length > 0 ? `${colors.length} picked` : 'pick a few'}
            />
            <p className="text-[12.5px] text-fg-2">tap a suggestion or click + to add your own.</p>
            <div className="flex flex-wrap gap-3 pt-1">
              {allSwatches.map((c) => {
                const on = colors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleColor(c)}
                    aria-pressed={on}
                    title={c}
                    className="group relative grid h-10 w-10 place-items-center rounded-pill transition-all duration-fast ease-out hover:scale-[1.06]"
                    style={{
                      background: c,
                      transform: on ? 'scale(1.08)' : undefined,
                      boxShadow: on
                        ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--volt), 0 0 16px -2px var(--volt-glow)'
                        : 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    <Check
                      size={16}
                      strokeWidth={3}
                      className={cn(
                        'pointer-events-none transition-opacity duration-fast ease-out',
                        on ? 'opacity-100' : 'opacity-0',
                      )}
                      style={{
                        color: pickContrast(c),
                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
                      }}
                    />
                    <span className="sr-only">{c}</span>
                  </button>
                );
              })}
              <ColorPickerChip onPick={addColor} />
            </div>
          </Card>
        </div>
      </article>

      <div className="flex items-center justify-between">
        <Link
          href="/onboarding/welcome"
          className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg-3 hover:text-fg-1"
        >
          ← back
        </Link>
        <Button
          variant="primary"
          size="lg"
          onClick={onContinue}
          disabled={pending !== null}
          trailingIcon={<ArrowRight size={16} strokeWidth={1.75} />}
        >
          {pending === 'continue' ? 'continuing…' : 'continue'}
        </Button>
      </div>
    </section>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-1 p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardHead({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-fg-0">
        {title}
      </h4>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{tag}</span>
    </div>
  );
}

function uniqueColors(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of input) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function isLikelyUrl(input: string): boolean {
  const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  // Hostname must have a dot (no `localhost`, no missing TLD) and be more
  // than just the protocol slashes.
  return u.hostname.includes('.') && u.hostname.length > 3;
}
