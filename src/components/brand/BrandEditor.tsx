'use client';

import { Loader2, Plus, RefreshCw, Save, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ColorPickerChip } from '@/components/onboarding/ColorPickerChip';
import { LogoPreview } from '@/components/onboarding/LogoPreview';
import { useLogoUpload } from '@/components/onboarding/useLogoUpload';
import { Button, cn, Input, Textarea } from '@/components/ui';
import type { BrandProfile } from '@/lib/brand';
import { pickContrast } from '@/lib/color';

type Props = { brand: BrandProfile };

// ── Suggestions ──────────────────────────────────────────────────────────────

const VOICE_SUGGESTIONS = ['playful', 'plainspoken', 'lowercase', 'punchy', 'warm', 'bold'];
const VALUES_SUGGESTIONS = [
  'quality',
  'sustainability',
  'community',
  'transparency',
  'innovation',
  'inclusivity',
];
const AESTHETIC_SUGGESTIONS = [
  'minimal',
  'luxurious',
  'earthy',
  'maximalist',
  'retro',
  'futuristic',
  'editorial',
];

// ── Progress bar ──────────────────────────────────────────────────────────────

function computeCompletion({
  name,
  description,
  palette,
  logoUrl,
  tagline,
  voice,
  font,
  values,
  aesthetic,
}: {
  name: string;
  description: string;
  palette: string[];
  logoUrl: string | null;
  tagline: string;
  voice: string[];
  font: string;
  values: string[];
  aesthetic: string[];
}): number {
  const checks: boolean[] = [
    name.trim().length > 0,
    description.trim().length > 0,
    palette.length > 0,
    Boolean(logoUrl),
    tagline.trim().length > 0,
    voice.length > 0,
    font.trim().length > 0,
    values.length > 0,
    aesthetic.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Chip card ─────────────────────────────────────────────────────────────────

function EditorCard({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-[14px] border border-line-subtle bg-bg-2 p-4',
        wide && 'md:col-span-2',
      )}
    >
      <span className="t-eyebrow">// {title}</span>
      {children}
    </article>
  );
}

// ── FieldLabel ────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{children}</span>
  );
}

// ── TagInput (chip group) ─────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const t = draft.trim();
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, t]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function addSuggestion(s: string) {
    if (value.some((v) => v.toLowerCase() === s.toLowerCase())) return;
    onChange([...value, s]);
  }

  const selectedKeys = new Set(value.map((v) => v.toLowerCase()));
  const remainingSuggestions = suggestions.filter((s) => !selectedKeys.has(s.toLowerCase()));
  const pills: { label: string; on: boolean }[] = [
    ...value.map((tag) => ({ label: tag, on: true })),
    ...remainingSuggestions.map((tag) => ({ label: tag, on: false })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="text-[12.5px]"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="inline-flex h-9 items-center justify-center rounded-[8px] border border-line-volt bg-bg-3 px-2 text-fg-2 transition-colors duration-fast ease-out hover:text-volt disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="add tag"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map(({ label, on }) =>
            on ? (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-pill border border-line-volt bg-volt-soft px-2.5 py-1 text-[12px] text-fg-0"
              >
                {label}
                <button
                  type="button"
                  onClick={() => remove(label)}
                  className="text-fg-3 hover:text-danger"
                  aria-label={`remove ${label}`}
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </span>
            ) : (
              <button
                key={label}
                type="button"
                onClick={() => addSuggestion(label)}
                className="rounded-pill border border-dashed border-line bg-bg-3 px-2.5 py-1 text-[12px] text-fg-3 transition-colors duration-fast ease-out hover:border-line-volt hover:text-fg-1"
              >
                + {label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ── FontPreview (inline Aa preview + input) ───────────────────────────────────

function FontPreview({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    const name = value.trim();
    if (!name) return;
    const id = `google-font-brand-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [value]);

  function commit(next: string) {
    const t = next.trim();
    if (t === value) return;
    onChange(t);
  }

  const previewFont = value.trim() || draft.trim();
  const previewFamily = previewFont ? `'${previewFont}', ui-sans-serif, system-ui` : 'inherit';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-[10px] border border-line-subtle bg-bg-3/60 px-3 py-2">
        <span className="text-[36px] leading-none text-fg-0" style={{ fontFamily: previewFamily }}>
          Aa
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
          {value.trim() ? value : 'using vitrine defaults'}
        </span>
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="e.g. inter, bricolage grotesque (any google font)"
        spellCheck={false}
      />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
        any name from{' '}
        <a
          href="https://fonts.google.com"
          target="_blank"
          rel="noreferrer"
          className="text-volt hover:underline"
        >
          fonts.google.com
        </a>{' '}
        — leave blank for defaults
      </span>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function BrandEditor({ brand }: Props) {
  const router = useRouter();

  // core fields
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? '');
  const [sourceUrl, setSourceUrl] = useState(brand.sourceUrl ?? '');
  const [industry, setIndustry] = useState(brand.industry ?? '');
  const [tagline, setTagline] = useState(brand.tagline ?? '');

  // font
  const [font, setFont] = useState(brand.font ?? '');

  // logo
  const [logoUrl, setLogoUrl] = useState<string | null>(brand.logoUrl);
  const [logoName, setLogoName] = useState<string | null>(null);
  const logoUpload = useLogoUpload();

  // palette
  const [palette, setPalette] = useState<string[]>(brand.palette);

  // voice — stored as comma-joined string in `tone` column
  const [voice, setVoice] = useState<string[]>(
    brand.tone
      ? brand.tone
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

  // new array fields
  const [values, setValues] = useState<string[]>(brand.values);
  const [aesthetic, setAesthetic] = useState<string[]>(brand.aesthetic);

  // form state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // rescrape state
  const [rescraping, setRescraping] = useState(false);

  // ── dirty tracking ───────────────────────────────────────────────────────

  const initial = useMemo(
    () => ({
      name: brand.name,
      description: brand.description ?? '',
      industry: brand.industry ?? '',
      tagline: brand.tagline ?? '',
      font: brand.font ?? '',
      logoUrl: brand.logoUrl ?? null,
      palette: brand.palette,
      voice: brand.tone
        ? brand.tone
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      values: brand.values,
      aesthetic: brand.aesthetic,
    }),
    [brand],
  );

  const dirty = useMemo(() => {
    const eqArr = (a: string[], b: string[]) =>
      a.length === b.length && a.every((v, i) => v === b[i]);
    return (
      name !== initial.name ||
      description !== initial.description ||
      industry !== initial.industry ||
      tagline !== initial.tagline ||
      font !== initial.font ||
      (logoUrl ?? null) !== initial.logoUrl ||
      !eqArr(palette, initial.palette) ||
      !eqArr(voice, initial.voice) ||
      !eqArr(values, initial.values) ||
      !eqArr(aesthetic, initial.aesthetic)
    );
  }, [name, description, industry, tagline, font, logoUrl, palette, voice, values, aesthetic, initial]);

  // ── palette helpers ──────────────────────────────────────────────────────

  function addColor(hex: string) {
    const c = hex.toLowerCase();
    setPalette((cs) => {
      if (cs.includes(c)) return cs;
      if (cs.length >= 6) {
        setError('max 6 swatches');
        return cs;
      }
      setError(null);
      return [...cs, c];
    });
  }

  function removeColor(hex: string) {
    setPalette((cs) => cs.filter((c) => c !== hex));
  }

  // ── logo helpers ─────────────────────────────────────────────────────────

  async function handleLogoFile(file: File) {
    setLogoName(file.name);
    const result = await logoUpload.upload(file);
    if (result) setLogoUrl(result.publicUrl);
  }

  function clearLogo() {
    setLogoUrl(null);
    setLogoName(null);
  }

  // ── progress ─────────────────────────────────────────────────────────────

  const completion = computeCompletion({
    name,
    description,
    palette,
    logoUrl,
    tagline,
    voice,
    font,
    values,
    aesthetic,
  });

  // ── rescrape ──────────────────────────────────────────────────────────────

  async function onRescrape() {
    setRescraping(true);
    setError(null);
    try {
      const res = await fetch(`/api/brand/${brand.id}/rescrape`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        return;
      }
      const s = body.scraped as {
        palette?: string[];
        font?: string | null;
        logoUrl?: string | null;
        description?: string | null;
      };
      if (s.palette && s.palette.length) setPalette(s.palette.slice(0, 6));
      if (s.font) setFont(s.font);
      if (s.logoUrl) setLogoUrl(s.logoUrl);
      if (s.description) setDescription(s.description);
    } catch {
      setError('rescrape failed');
    } finally {
      setRescraping(false);
    }
  }

  // ── submit ───────────────────────────────────────────────────────────────

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/brand/${brand.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sourceUrl: sourceUrl.trim() || null,
          // voice chips → comma-joined string stored in `tone` column
          tone: voice.length > 0 ? voice.join(', ') : null,
          industry: industry.trim() || null,
          tagline: tagline.trim() || null,
          font: font.trim() || null,
          logoUrl: logoUrl ?? null,
          palette,
          values,
          aesthetic,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `http ${res.status}`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setBusy(false);
    }
  }

  // ── identity card helpers ────────────────────────────────────────────────

  const loadedSourceUrl = brand.sourceUrl ?? '';

  const hostnameDisplay = (() => {
    const url = loadedSourceUrl.trim();
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      return (
        url
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0] ?? null
      );
    }
  })();

  const fontFamily = font.trim() ? `'${font.trim()}', ui-sans-serif, system-ui` : 'inherit';

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* ── grid of cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* identity card */}
        <EditorCard title="identity">
          <div className="flex flex-col gap-1">
            {/* wordmark: logo image or name in display font */}
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={name || 'brand logo'}
                  className="h-10 max-w-[120px] rounded-[6px] object-contain"
                />
              ) : (
                <span
                  className="text-[22px] font-bold leading-none tracking-[-0.02em] text-fg-0"
                  style={{ fontFamily }}
                >
                  {name.trim() || 'brand name'}
                </span>
              )}
            </div>
            {hostnameDisplay && (
              <span className="font-mono text-[10.5px] text-fg-3">{hostnameDisplay}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>brand name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my brand"
              required
              aria-label="brand name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>industry</FieldLabel>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="beauty · food · apparel"
              aria-label="industry"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>url</FieldLabel>
            {loadedSourceUrl ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-mono text-[12.5px] text-fg-2">
                  {hostnameDisplay ?? loadedSourceUrl}
                </span>
                <button
                  type="button"
                  onClick={() => void onRescrape()}
                  disabled={rescraping}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-bg-3 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2 transition-colors duration-fast ease-out hover:border-line-volt hover:text-volt disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="rescrape brand url"
                >
                  {rescraping ? (
                    <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} strokeWidth={2} />
                  )}
                  rescrape
                </button>
              </div>
            ) : (
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://your-shop.co"
                aria-label="source url"
              />
            )}
          </div>
        </EditorCard>

        {/* logo card */}
        <EditorCard title="logo">
          {logoUrl ? (
            <LogoPreview
              src={logoUrl}
              name={logoName ?? (name.trim() || null)}
              caption="brand logo"
              helperText="png / svg recommended"
              status={logoUpload.status}
              onReplace={handleLogoFile}
              onRemove={clearLogo}
            />
          ) : (
            <label className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line bg-bg-3/60 text-fg-2 transition-colors duration-fast ease-out hover:border-line-volt hover:text-volt">
              <UploadCloud size={22} strokeWidth={1.5} />
              <div className="text-center text-[12.5px]">
                <div className="text-fg-1">upload a logo</div>
                <div className="font-mono text-[10.5px] text-fg-3">png, svg, or jpg</div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {logoUpload.status.kind === 'error' && (
            <span className="font-mono text-[11.5px] text-danger">{logoUpload.status.message}</span>
          )}
        </EditorCard>

        {/* font card */}
        <EditorCard title="font">
          <FontPreview value={font} onChange={setFont} />
        </EditorCard>

        {/* palette card */}
        <EditorCard title="palette">
          {palette.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              {palette.map((c) => (
                <div key={c} className="group relative">
                  <button
                    type="button"
                    onClick={() => removeColor(c)}
                    className="grid h-[56px] w-[56px] place-items-end rounded-[10px] border border-line p-2 transition-transform duration-fast ease-out hover:scale-[1.04]"
                    style={{ background: c }}
                    title={`${c} · tap to remove`}
                    aria-label={`color ${c}, tap to remove`}
                  >
                    <span
                      className="font-mono text-[9.5px] uppercase"
                      style={{
                        color: pickContrast(c),
                        opacity: 0.85,
                        textShadow:
                          pickContrast(c) === '#ffffff'
                            ? '0 1px 1px rgba(0,0,0,0.35)'
                            : '0 1px 1px rgba(255,255,255,0.35)',
                      }}
                    >
                      {c.slice(1)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeColor(c)}
                    aria-label={`remove ${c}`}
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-pill border border-line bg-bg-2 text-fg-2 opacity-0 transition-opacity duration-fast ease-out hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {palette.length < 6 && <ColorPickerChip onPick={addColor} />}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <ColorPickerChip onPick={addColor} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
                no colors yet — pick one
              </span>
            </div>
          )}
        </EditorCard>

        {/* description + tagline card (merged) */}
        <EditorCard title="description" wide>
          <div className="flex flex-col gap-1">
            <FieldLabel>tagline</FieldLabel>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="one-line hook · spoken aloud, not written"
              className="font-display text-[18px] leading-[1.2] tracking-[-0.01em]"
              aria-label="tagline"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>description</FieldLabel>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="one-line pitch · who you make it for · what makes you different"
              aria-label="description"
            />
          </div>
        </EditorCard>

        {/* voice chip group */}
        <EditorCard title="voice">
          <TagInput
            value={voice}
            onChange={setVoice}
            placeholder="add tone (playful, punchy, …)"
            suggestions={VOICE_SUGGESTIONS.filter((s) => !voice.includes(s))}
          />
        </EditorCard>

        {/* values chip group */}
        <EditorCard title="values">
          <TagInput
            value={values}
            onChange={setValues}
            placeholder="add a brand value (quality, community, …)"
            suggestions={VALUES_SUGGESTIONS.filter((s) => !values.includes(s))}
          />
        </EditorCard>

        {/* aesthetic chip group */}
        <EditorCard title="aesthetic" wide>
          <TagInput
            value={aesthetic}
            onChange={setAesthetic}
            placeholder="add aesthetic (minimal, editorial, …)"
            suggestions={AESTHETIC_SUGGESTIONS.filter((s) => !aesthetic.includes(s))}
          />
        </EditorCard>
      </div>

      {/* ── progress bar + save row ────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-line-subtle pt-4">
        {/* progress bar */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            dna complete
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-pill bg-bg-3">
            <span
              className="block h-full bg-volt transition-all duration-base ease-out"
              style={{ width: `${completion}%` }}
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </span>
          <span className="min-w-[3ch] font-mono text-[11px] text-volt">{completion}%</span>
        </div>

        {/* save row */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {error && <span className="font-mono text-[11.5px] text-danger">{error}</span>}
            {saved && !error && <span className="font-mono text-[11.5px] text-volt">saved.</span>}
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim() || !dirty}
            leadingIcon={
              busy ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <Save size={14} strokeWidth={1.75} />
              )
            }
          >
            {busy ? 'saving…' : 'save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
