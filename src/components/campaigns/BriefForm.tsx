'use client';

import { ImageIcon, ShoppingBag, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button, Chip, FieldLabel, Input, Textarea } from '@/components/ui';
import { PresetGrid } from './PresetGrid';

type Props = {
  initialPrompt?: string;
  onSubmit?: (brief: BriefPayload) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  error?: string | null;
};

export type BriefPayload = {
  prompt: string;
  title: string;
  description: string;
  goal: string;
  offer: string;
  audience: string;
  aesthetics: string;
  presetIds: string[];
};

const DEFAULT_PROMPT =
  'launch the four-piece chili oil sampler for summer. festive, citrus-forward, loud.';

export function BriefForm({
  initialPrompt = DEFAULT_PROMPT,
  onSubmit,
  submitting = false,
  submitLabel = 'start cooking',
  error = null,
}: Props) {
  const [prompt] = useState(initialPrompt);
  const [title, setTitle] = useState("summer heat sampler '26");
  const [description, setDescription] = useState(
    'four chili oils, four moods. bright, citrus-forward photography, festive energy, no holiday clichés.',
  );
  const [goal, setGoal] = useState('launch');
  const [offer, setOffer] = useState('20% off bundle');
  const [audience, setAudience] = useState('');
  const [aesthetics, setAesthetics] = useState('');
  const [presetIds, setPresetIds] = useState<string[]>(['ig-feed', 'ig-story', 'li']);

  const buzzCost = 8 + presetIds.length * 6;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.({ prompt, title, description, goal, offer, audience, aesthetics, presetIds });
      }}
    >
      <section className="rounded-[14px] border border-line-subtle bg-bg-2 p-4">
        <span className="t-eyebrow">// you wrote</span>
        <p className="mt-2 text-[14.5px] leading-[1.5] text-fg-0">{prompt}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip leadingIcon={<ShoppingBag size={12} strokeWidth={1.75} />}>chili oil · catalog</Chip>
          <Chip leadingIcon={<ImageIcon size={12} strokeWidth={1.75} />}>4 product shots</Chip>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="brief-title">campaign title</FieldLabel>
          <Input
            id="brief-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="brief-goal">campaign goal</FieldLabel>
          <Input
            id="brief-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="launch · awareness · sale · lifestyle"
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="brief-desc">description</FieldLabel>
        <Textarea
          id="brief-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <FieldLabel htmlFor="brief-offer">offer or hook</FieldLabel>
        <Input
          id="brief-offer"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          placeholder="20% off bundle · early access · free shipping"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="brief-audience">audience</FieldLabel>
          <Input
            id="brief-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="30s · urban · gift-giving"
          />
        </div>
        <div>
          <FieldLabel htmlFor="brief-aesthetics">aesthetics</FieldLabel>
          <Input
            id="brief-aesthetics"
            value={aesthetics}
            onChange={(e) => setAesthetics(e.target.value)}
            placeholder="festive · citrus-forward · golden hour"
          />
        </div>
      </div>

      <section>
        <FieldLabel>output formats</FieldLabel>
        <PresetGrid onChange={setPresetIds} />
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line-subtle pt-4">
        <div className="flex flex-col">
          <span className="t-eyebrow">est. cost</span>
          <span className="mt-1 font-mono text-[15px] text-buzz">~{buzzCost} buzz</span>
        </div>
        <span className="text-[12.5px] text-fg-3">
          actual buzz settles after the orchestrator confirms each tile.
        </span>
        <span className="flex-1" />
        {error && (
          <span className="font-mono text-[11.5px] text-danger">{error}</span>
        )}
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={submitting || presetIds.length === 0}
          leadingIcon={<Sparkles size={14} strokeWidth={1.75} />}
        >
          {submitting ? 'cooking…' : submitLabel}
          <span className="ml-1 font-mono text-[12px] opacity-70">· ~{buzzCost} buzz</span>
        </Button>
      </div>
    </form>
  );
}
