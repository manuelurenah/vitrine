'use client';

import { ImageIcon, Mic, ShoppingBag, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AssetCatalogPicker } from '@/components/pickers/AssetCatalogPicker';
import { Button, Chip, IconButton, Modal } from '@/components/ui';

type Props = {
  placeholder?: string;
};

type PickerTab = 'products' | 'assets';

// Minimal Web Speech API types — not universally present in lib.dom.d.ts.
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionResultEvent {
  results: { 0: { transcript: string } }[];
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// Map Web Speech error codes to a short, user-readable reason. The mic otherwise
// fails silently — the most common case is `not-allowed` (permission blocked for
// the site), which shows no browser prompt, so the user sees nothing happen.
function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'microphone permission denied — allow mic for this site via the address-bar icon';
    case 'service-not-allowed':
      return 'speech service blocked — enable Chrome under System Settings › Privacy › Microphone, then reopen Chrome';
    case 'audio-capture':
      return 'no microphone found';
    case 'no-speech':
      return "didn't catch that — try again";
    case 'network':
      return 'voice service unavailable — check your connection';
    default:
      return `voice input error: ${code}`;
  }
}

// Speech support is a fixed browser capability — it never changes at runtime,
// so the store never emits. useSyncExternalStore lets us read a client-only
// value (false on the server, real value on the client) without a setState
// effect or a hydration mismatch.
const subscribeSpeechSupport = () => () => {};
const getSpeechSupportSnapshot = () => getSpeechRecognition() !== null;
const getSpeechSupportServerSnapshot = () => false;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as SpeechRecognitionConstructor | undefined) ??
    (w['webkitSpeechRecognition'] as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

export function PromptComposer({ placeholder = 'describe the campaign you want to cook' }: Props) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const speechSupported = useSyncExternalStore(
    subscribeSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const canSubmit = value.trim().length > 0;

  const productCount = useMemo(() => refs.filter((id) => id.startsWith('product:')).length, [refs]);
  const assetCount = useMemo(() => refs.filter((id) => id.startsWith('asset:')).length, [refs]);

  function handleSubmit() {
    const prompt = value.trim();
    if (!prompt) return;
    const params = new URLSearchParams({ prompt });
    if (refs.length > 0) params.set('refs', refs.join(','));
    router.push(`/campaigns/new?${params.toString()}`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleMicClick() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    setMicError(null);

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setMicError(null);
        setValue((prev) => {
          const trimmed = prev.trimEnd();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      }
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListening(false);
      recognitionRef.current = null;
      setMicError(describeSpeechError(event.error));
    };

    recognitionRef.current = rec;
    // start() can also throw synchronously (e.g. an already-running instance or a
    // non-secure context); surface that instead of dying silently.
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      recognitionRef.current = null;
      setMicError(
        err instanceof Error ? `voice input failed: ${err.message}` : 'voice input failed to start',
      );
    }
  }

  return (
    <>
      <div
        className="relative rounded-[18px] border border-line-subtle bg-bg-2 p-4 shadow-md"
        style={{ boxShadow: 'var(--shadow-md), 0 0 0 1px var(--line-faint)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] opacity-60"
          style={{
            background:
              'linear-gradient(135deg, var(--volt-glow), transparent 40%, var(--ion-glow) 100%)',
            mask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />
        <div className="relative flex gap-3">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="min-h-[60px] flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-fg-0 outline-none placeholder:text-fg-3"
          />
          <IconButton
            icon={<Mic size={14} strokeWidth={1.75} />}
            aria-label={
              speechSupported
                ? listening
                  ? 'stop listening'
                  : 'dictate prompt'
                : 'voice input not supported in this browser'
            }
            aria-pressed={listening}
            disabled={!speechSupported}
            onClick={handleMicClick}
            variant="ghost"
            size="md"
            className={listening ? 'text-volt' : 'text-fg-1'}
            title={
              speechSupported
                ? listening
                  ? 'stop listening'
                  : 'dictate prompt'
                : 'voice input not supported in this browser'
            }
          />
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerTab('products')}
            aria-label="select products"
            className="appearance-none bg-transparent p-0"
          >
            <Chip
              leadingIcon={<ShoppingBag size={12} strokeWidth={1.75} />}
              active={productCount > 0}
            >
              product{productCount > 0 ? ` · ${productCount}` : ''}
            </Chip>
          </button>
          <button
            type="button"
            onClick={() => setPickerTab('assets')}
            aria-label="select reference images"
            className="appearance-none bg-transparent p-0"
          >
            <Chip leadingIcon={<ImageIcon size={12} strokeWidth={1.75} />} active={assetCount > 0}>
              images{assetCount > 0 ? ` · ${assetCount}` : ''}
            </Chip>
          </button>
          <span className="flex-1" />
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
            leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
          >
            generate brief
          </Button>
        </div>
        {micError && (
          <p role="alert" className="relative mt-2 text-[12px] text-danger">
            {micError}
          </p>
        )}
      </div>

      <Modal
        open={pickerTab !== null}
        onClose={() => setPickerTab(null)}
        eyebrow="// pick references"
        title={pickerTab === 'assets' ? 'images' : 'products'}
        maxWidth={840}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-fg-2">
              {refs.length} selected · {productCount} product
              {productCount === 1 ? '' : 's'}, {assetCount} image
              {assetCount === 1 ? '' : 's'}
            </span>
            <Button type="button" variant="primary" onClick={() => setPickerTab(null)}>
              done
            </Button>
          </div>
        }
      >
        {pickerTab !== null && (
          <AssetCatalogPicker value={refs} onChange={setRefs} initialTab={pickerTab} />
        )}
      </Modal>
    </>
  );
}
