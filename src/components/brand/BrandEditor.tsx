'use client';

import { Save, UploadCloud, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ColorPickerChip } from '@/components/onboarding/ColorPickerChip';
import { LogoPreview } from '@/components/onboarding/LogoPreview';
import { useLogoUpload } from '@/components/onboarding/useLogoUpload';
import { Button, FieldLabel, Input, Textarea } from '@/components/ui';
import type { BrandProfile } from '@/lib/brand';
import { pickContrast } from '@/lib/color';

type Props = { brand: BrandProfile };

export function BrandEditor({ brand }: Props) {
  const router = useRouter();
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? '');
  const [sourceUrl, setSourceUrl] = useState(brand.sourceUrl ?? '');
  const [tone, setTone] = useState(brand.tone ?? '');
  const [industry, setIndustry] = useState(brand.industry ?? '');
  const [tagline, setTagline] = useState(brand.tagline ?? '');
  const [font, setFont] = useState(brand.font ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(brand.logoUrl);
  const [logoName, setLogoName] = useState<string | null>(null);
  const logoUpload = useLogoUpload();
  const [palette, setPalette] = useState<string[]>(brand.palette);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addColor(hex: string) {
    const c = hex.toLowerCase();
    setPalette((cs) => {
      if (cs.includes(c)) return cs;
      if (cs.length >= 12) {
        setError('max 12 swatches');
        return cs;
      }
      setError(null);
      return [...cs, c];
    });
  }

  function removeColor(hex: string) {
    setPalette((cs) => cs.filter((c) => c !== hex));
  }

  async function handleLogoFile(file: File) {
    setLogoName(file.name);
    const result = await logoUpload.upload(file);
    if (result) setLogoUrl(result.publicUrl);
  }

  function clearLogo() {
    setLogoUrl(null);
    setLogoName(null);
  }

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
          tone: tone.trim() || null,
          industry: industry.trim() || null,
          tagline: tagline.trim() || null,
          font: font.trim() || null,
          logoUrl: logoUrl ?? null,
          palette,
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="b-name">brand name</FieldLabel>
          <Input
            id="b-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my brand"
            required
          />
        </div>
        <div>
          <FieldLabel htmlFor="b-industry">industry</FieldLabel>
          <Input
            id="b-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="beauty · food · apparel"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="b-tagline">tagline</FieldLabel>
        <Input
          id="b-tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="one-line hook · spoken aloud, not written"
        />
      </div>

      <div>
        <FieldLabel htmlFor="b-desc">description</FieldLabel>
        <Textarea
          id="b-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="one-line pitch · who you make it for · what makes you different"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="b-tone">tone</FieldLabel>
          <Input
            id="b-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="warm · playful · minimal · luxurious"
          />
        </div>
        <div>
          <FieldLabel htmlFor="b-font">font</FieldLabel>
          <Input
            id="b-font"
            value={font}
            onChange={(e) => setFont(e.target.value)}
            placeholder="inter · söhne · neue haas"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="b-source">source url</FieldLabel>
        <Input
          id="b-source"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://your-shop.co"
        />
      </div>

      <div className="flex flex-col gap-3">
        <FieldLabel>logo</FieldLabel>
        {logoUrl ? (
          <LogoPreview
            src={logoUrl}
            name={logoName}
            caption="brand logo"
            helperText="png / svg recommended"
            status={logoUpload.status}
            onReplace={handleLogoFile}
            onRemove={clearLogo}
          />
        ) : (
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-pill border border-line-subtle bg-bg-2 px-3 py-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-fg-1 hover:border-line-volt hover:text-volt">
            <UploadCloud size={12} strokeWidth={1.75} />
            upload logo
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
      </div>

      <div className="flex flex-col gap-3">
        <FieldLabel>palette</FieldLabel>
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
            <ColorPickerChip onPick={addColor} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <ColorPickerChip onPick={addColor} />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
              no colors yet — pick one
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex-1">
          {error && <span className="font-mono text-[11.5px] text-danger">{error}</span>}
          {saved && !error && <span className="font-mono text-[11.5px] text-volt">saved.</span>}
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || name.trim().length === 0}
          leadingIcon={<Save size={14} strokeWidth={1.75} />}
        >
          {busy ? 'saving…' : 'save changes'}
        </Button>
      </div>
    </form>
  );
}
