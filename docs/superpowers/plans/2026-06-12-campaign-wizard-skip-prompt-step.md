# Campaign Wizard — Skip Prompt Step (Auto-Draft) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "generate brief" in the composer kicks off the LLM draft immediately and lands the user on the review step — the manual intermediate "draft brief" click is gone, and format/variants controls move into the review step.

**Architecture:** Keep `<PromptComposer>` dumb (routes to `/campaigns/new?prompt=…`). The wizard detects an incoming prompt on mount and auto-fires the existing `runDraft({navigate:true})` path, reusing the `DraftingOverlay`. Arrivals without a prompt (mobile FAB, refs-only link) get a slimmed prompt-entry screen. The format picker (`<PresetGrid>`) and the variants stepper move from the prompt step into the review (`BriefStep`). The single global `variantsPerPreset` model is unchanged — no API, hook, or DB changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Vitest (SSR-only unit tests via `renderToStaticMarkup`), Playwright e2e.

---

## Background the engineer needs

- **Unit tests are SSR-only.** `CampaignWizard.test.tsx` renders with `renderToStaticMarkup` — **`useEffect` never runs**. So the auto-draft *effect* itself is verified by (a) a pure exported helper unit test and (b) e2e. SSR tests cover static render branches (which step/overlay shows, what controls are present).
- `next/navigation` is mocked in the unit test via `navMocks` — `navMocks.state.step` drives `?step`. There is **no** way to seed `defaultBrief` through that mock; pass it through the component's `initial` prop instead.
- `./PresetGrid` and `@/components/pickers/AssetCatalogPicker` are mocked as stubs in the unit test: the PresetGrid stub renders `data-testid="preset-grid-stub"`, the picker stub renders `data-testid="picker-stub"`.
- The wizard's preview re-runs automatically when `presetIds` changes on the brief step (existing effect at `CampaignWizard.tsx:230`), so moving the format picker there needs **no** new preview wiring.
- On a hard draft failure, the existing `runDraft` already sets `draftError` and does **not** navigate (`CampaignWizard.tsx:186-190, 212-214`). We reuse that: a hard auto-draft failure reveals the slimmed prompt entry with the error.
- Current branch is `main`. **Before Task 1, create a feature branch** (repo policy: feature branches only).

```bash
git checkout -b feature/campaign-wizard-auto-draft
```

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/components/campaigns/PresetGrid.tsx` | Format multi-select grid | Add optional controlled `value` prop; keep uncontrolled fallback. |
| `src/components/campaigns/CampaignWizard.tsx` | Wizard flow + steps | Add `resolveVisibleSteps` helper + `STEP_LABELS`; make `StepDots` take a `steps` list; slim `PromptStep`; add `<PresetGrid>` to `BriefStep`; add auto-draft effect + overlay branch. |
| `src/components/campaigns/CampaignWizard.test.tsx` | Unit tests | Update prompt-step assertions; add auto-draft-overlay, brief-step-has-format-picker, and `resolveVisibleSteps` tests. |
| `src/components/campaigns/PresetGrid.test.tsx` *(new)* | PresetGrid unit test | New SSR test for controlled `value`. |
| `e2e/50-campaigns.spec.ts` | e2e cook flow | Re-point main test to the auto-draft path; bump variants on the brief step. |

---

## Task 1: PresetGrid optional controlled `value`

**Files:**
- Modify: `src/components/campaigns/PresetGrid.tsx`
- Test: `src/components/campaigns/PresetGrid.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/campaigns/PresetGrid.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresetGrid } from './PresetGrid';

function countPressed(html: string): number {
  return (html.match(/aria-pressed="true"/g) ?? []).length;
}

describe('PresetGrid', () => {
  it('falls back to its default selection when uncontrolled', () => {
    const html = renderToStaticMarkup(<PresetGrid />);
    // Three presets are defaultOn: ig-feed, ig-story, li.
    expect(countPressed(html)).toBe(3);
  });

  it('reflects a controlled value exactly', () => {
    const html = renderToStaticMarkup(<PresetGrid value={['ig-feed', 'li']} />);
    expect(countPressed(html)).toBe(2);
  });

  it('shows nothing selected for an empty controlled value', () => {
    const html = renderToStaticMarkup(<PresetGrid value={[]} />);
    expect(countPressed(html)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/PresetGrid.test.tsx`
Expected: FAIL — the "controlled value" cases fail because `PresetGrid` ignores `value` (always uses internal default selection).

- [ ] **Step 3: Implement controlled/uncontrolled `value`**

Replace the `Props` type and the `PresetGrid` function head + `toggle` in `src/components/campaigns/PresetGrid.tsx` (lines 53-68) with:

```tsx
type Props = {
  /** When provided, the grid is controlled and renders exactly these ids. */
  value?: string[];
  onChange?: (ids: string[]) => void;
};

export function PresetGrid({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Set<string>>(
    () => new Set(PRESETS.filter((p) => p.defaultOn).map((p) => p.id)),
  );
  const selected = value ? new Set(value) : internal;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!value) setInternal(next);
    onChange?.(Array.from(next));
  }

  return (
```

(Leave the JSX body below `return (` unchanged — it already reads `selected.has(p.id)`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/PresetGrid.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/campaigns/PresetGrid.tsx src/components/campaigns/PresetGrid.test.tsx
git commit -m "feat(campaigns): make PresetGrid optionally controlled"
```

---

## Task 2: `resolveVisibleSteps` helper + labelled, list-driven `StepDots`

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx:64-71` (types/helpers), `:373-405` (StepDots)
- Test: `src/components/campaigns/CampaignWizard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this block to `CampaignWizard.test.tsx` (after the existing `import { CampaignWizard } from './CampaignWizard';` — also add `resolveVisibleSteps` to that import):

Change line 78 from:

```tsx
import { CampaignWizard } from './CampaignWizard';
```

to:

```tsx
import { CampaignWizard, resolveVisibleSteps } from './CampaignWizard';
```

Then add a new describe block at the end of the file:

```tsx
describe('resolveVisibleSteps', () => {
  it('omits the describe step when arriving with a prompt', () => {
    expect(
      resolveVisibleSteps({ hasInitialPrompt: true, showingPromptEntry: false }),
    ).toEqual(['brief', 'submit']);
  });

  it('shows all three steps when there is no incoming prompt', () => {
    expect(
      resolveVisibleSteps({ hasInitialPrompt: false, showingPromptEntry: true }),
    ).toEqual(['prompt', 'brief', 'submit']);
  });

  it('restores the describe step when an auto-draft hard-fails back to entry', () => {
    expect(
      resolveVisibleSteps({ hasInitialPrompt: true, showingPromptEntry: true }),
    ).toEqual(['prompt', 'brief', 'submit']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t resolveVisibleSteps`
Expected: FAIL — `resolveVisibleSteps` is not exported / not defined.

- [ ] **Step 3: Add the helper + labels**

In `src/components/campaigns/CampaignWizard.tsx`, just after the `STEP_ORDER` constant (line 66), add:

```tsx
const STEP_LABELS: Record<Step, string> = {
  prompt: 'describe',
  brief: 'review',
  submit: 'cook',
};

/**
 * The step dots a user sees depend on how they entered. Arriving from the
 * composer with a prompt skips the manual "describe" entry (we auto-draft) —
 * unless the auto-draft hard-fails and we drop them back onto the entry screen.
 */
export function resolveVisibleSteps(opts: {
  hasInitialPrompt: boolean;
  showingPromptEntry: boolean;
}): Step[] {
  if (opts.hasInitialPrompt && !opts.showingPromptEntry) return ['brief', 'submit'];
  return STEP_ORDER;
}
```

- [ ] **Step 4: Make `StepDots` take a `steps` list and render labels**

Replace the whole `StepDots` function (lines 373-405) with:

```tsx
function StepDots({ steps, step }: { steps: Step[]; step: Step }) {
  const rawIdx = steps.indexOf(step);
  const idx = rawIdx === -1 ? 0 : rawIdx;
  return (
    <div
      className="flex items-center gap-2"
      role="tablist"
      aria-label="campaign wizard steps"
      data-step={step}
    >
      {steps.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              role="tab"
              aria-selected={state === 'current'}
              data-state={state}
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.1em]',
                state === 'current' && 'text-fg-0',
                state === 'done' && 'text-volt',
                state === 'upcoming' && 'text-fg-3',
              )}
            >
              {`0${i + 1}`} · {STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-line" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
```

Update the single call site (line 318) from `<StepDots step={step} />` to:

```tsx
<StepDots steps={steps} step={step} />
```

> `steps` does not exist yet — it is added in Task 5. Until then this line will not typecheck. That's expected; Task 2 ends with `resolveVisibleSteps` unit-tested. Do NOT run a full typecheck at the end of this task. If you prefer green-between-tasks, temporarily pass `steps={STEP_ORDER}` here and switch to `steps={steps}` in Task 5 — either is fine.

- [ ] **Step 5: Run the helper test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t resolveVisibleSteps`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/campaigns/CampaignWizard.tsx src/components/campaigns/CampaignWizard.test.tsx
git commit -m "feat(campaigns): list-driven step dots + resolveVisibleSteps helper"
```

---

## Task 3: Slim the prompt step (drop format picker + variants)

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx` — `PromptStepProps` (411-423), `PromptStep` (425-512), and the `<PromptStep .../>` call site (319-333)
- Test: `src/components/campaigns/CampaignWizard.test.tsx:316-321`

- [ ] **Step 1: Update the failing test**

Replace the test at `CampaignWizard.test.tsx:316-321` ("renders the draft-brief CTA and the variants stepper") with:

```tsx
  it('renders the generate CTA but no format picker or variants on the prompt step', () => {
    const html = renderToStaticMarkup(<CampaignWizard />);
    expect(html).toContain('data-testid="prompt-continue"');
    // Format picker + variants moved to the review step.
    expect(html).not.toContain('data-testid="preset-grid-stub"');
    expect(html).not.toContain('data-testid="variants-stepper"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "no format picker"`
Expected: FAIL — the prompt step still renders the preset grid + variants stepper.

- [ ] **Step 3: Slim `PromptStepProps`**

Replace `PromptStepProps` (lines 411-423) with:

```tsx
type PromptStepProps = {
  brief: PreviewBrief;
  setBrief: (next: PreviewBrief) => void;
  referenceAssetIds: string[];
  setReferenceAssetIds: (ids: string[]) => void;
  drafting: boolean;
  error: string | null;
  onContinue: (e: React.FormEvent) => void;
};
```

- [ ] **Step 4: Slim the `PromptStep` body**

Replace the entire `PromptStep` function (lines 425-512) with:

```tsx
function PromptStep({
  brief,
  setBrief,
  referenceAssetIds,
  setReferenceAssetIds,
  drafting,
  error,
  onContinue,
}: PromptStepProps) {
  const canSubmit = brief.prompt.trim().length > 0;

  return (
    <form className="flex flex-col gap-6" onSubmit={onContinue} data-testid="prompt-step">
      {drafting && <DraftingOverlay />}

      <div>
        <FieldLabel htmlFor="prompt-input">your prompt</FieldLabel>
        <Textarea
          id="prompt-input"
          rows={4}
          value={brief.prompt}
          onChange={(e) => setBrief({ ...brief, prompt: e.target.value })}
          placeholder="describe the campaign you want — product, vibe, time of year, audience. we'll fill in the rest."
          data-testid="prompt-input"
        />
        <p className="mt-1 font-mono text-[10.5px] text-fg-3">
          we&rsquo;ll use this + your brand DNA to draft a full brief with copy for each placement.
          you&rsquo;ll pick formats and quantities on the next step.
        </p>
      </div>

      <section>
        <FieldLabel>references</FieldLabel>
        <AssetCatalogPicker value={referenceAssetIds} onChange={setReferenceAssetIds} max={4} />
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line-subtle pt-4">
        <span className="text-[12.5px] text-fg-3">
          a brief and per-placement copy will be drafted before you cook.
        </span>
        <span className="flex-1" />
        {error && (
          <span className="font-mono text-[11.5px] text-danger" data-testid="prompt-error">
            {error}
          </span>
        )}
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={drafting || !canSubmit}
          leadingIcon={
            drafting ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={1.75} />
            )
          }
          data-testid="prompt-continue"
        >
          {drafting ? 'drafting…' : 'generate brief'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Update the `<PromptStep />` call site**

Replace the call site (lines 320-332) with:

```tsx
        <PromptStep
          brief={brief}
          setBrief={setBrief}
          referenceAssetIds={referenceAssetIds}
          setReferenceAssetIds={setReferenceAssetIds}
          drafting={drafting}
          error={draftError}
          onContinue={handleGenerateDraft}
        />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "no format picker"`
Expected: PASS.

> Note: `variantsPerPreset` / `setVariantsPerPreset` / `presetIds` / `setPresetIds` are no longer passed to `PromptStep` but are still used by `BriefStep` and `runDraft`, so the wizard-level state stays. The `VariantsStepper` component is still used by `BriefStep`.

- [ ] **Step 7: Commit**

```bash
git add src/components/campaigns/CampaignWizard.tsx src/components/campaigns/CampaignWizard.test.tsx
git commit -m "feat(campaigns): slim prompt step to prompt + references only"
```

---

## Task 4: Add the format picker to the review step

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx` — `BriefStepProps` (629-656), `BriefStep` signature + body (658-831), and the `<BriefStep .../>` call site (334-363)
- Test: `src/components/campaigns/CampaignWizard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `CampaignWizard.test.tsx`, inside the existing `describe('CampaignWizard — prompt step rendering', ...)` block (or a new describe) — append this test:

```tsx
  it('renders the format picker and variants stepper on the brief step', () => {
    navMocks.state.step = 'brief';
    const html = renderToStaticMarkup(<CampaignWizard />);
    expect(html).toContain('data-testid="brief-step"');
    expect(html).toContain('data-testid="preset-grid-stub"');
    expect(html).toContain('data-testid="variants-stepper"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "format picker and variants stepper on the brief"`
Expected: FAIL — the brief step has the variants stepper but not the preset grid stub.

- [ ] **Step 3: Import `PresetGrid` into the wizard**

At the top of `CampaignWizard.tsx`, the import already exists: `import { PresetGrid } from './PresetGrid';` (line 36). No change needed.

- [ ] **Step 4: Add `setPresetIds` to `BriefStepProps`**

In `BriefStepProps` (lines 629-656), add `setPresetIds` right after the `presetIds` field:

```tsx
  presetIds: string[];
  setPresetIds: (ids: string[]) => void;
```

- [ ] **Step 5: Destructure `setPresetIds` in `BriefStep`**

In the `BriefStep({ ... })` parameter destructuring (starts line 658), add `setPresetIds,` next to `presetIds,`.

- [ ] **Step 6: Render the format picker section**

In `BriefStep`'s JSX, insert a new `<section>` immediately **before** the existing variants `<section className="grid gap-4 md:grid-cols-2">` (line 819):

```tsx
      <section>
        <FieldLabel>output formats</FieldLabel>
        <PresetGrid value={presetIds} onChange={setPresetIds} />
      </section>

```

- [ ] **Step 7: Disable cook when no format is selected**

In `BriefStep`, find the `insufficientBuzz` derivation (line 694) and add below it:

```tsx
  const noPresets = presetIds.length === 0;
```

Then update the cook `<Button>` `disabled` prop (line 1059) from `disabled={insufficientBuzz}` to:

```tsx
          disabled={insufficientBuzz || noPresets}
```

- [ ] **Step 8: Pass `setPresetIds` at the call site**

In the `<BriefStep .../>` call site (lines 334-363), add after `presetIds={presetIds}`:

```tsx
          setPresetIds={setPresetIds}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "format picker and variants stepper on the brief"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/campaigns/CampaignWizard.tsx src/components/campaigns/CampaignWizard.test.tsx
git commit -m "feat(campaigns): move format picker into the review step"
```

---

## Task 5: Auto-draft on arrival + overlay/entry branch + wire `steps`

**Files:**
- Modify: `src/components/campaigns/CampaignWizard.tsx` — wizard body (around 91-367)
- Test: `src/components/campaigns/CampaignWizard.test.tsx`

- [ ] **Step 1: Write the failing SSR test**

Add a new describe block to `CampaignWizard.test.tsx`:

```tsx
describe('CampaignWizard — auto-draft on arrival', () => {
  beforeEach(() => {
    navMocks.state.step = null;
    navMocks.replaceMock.mockClear();
  });

  const promptInitial = {
    defaultBrief: { prompt: 'summer chili-oil launch', description: 'summer chili-oil launch' },
  };

  it('shows the drafting overlay (not the prompt entry) when a prompt is present', () => {
    const html = renderToStaticMarkup(<CampaignWizard initial={promptInitial} />);
    expect(html).toContain('data-testid="drafting-overlay"');
    expect(html).not.toContain('data-testid="prompt-step"');
    expect(html).not.toContain('data-testid="brief-step"');
  });

  it('marks review as the current dot while auto-drafting (2-step dots)', () => {
    const html = renderToStaticMarkup(<CampaignWizard initial={promptInitial} />);
    // Two dots only: review (01, current) · cook (02, upcoming).
    expect(html).toMatch(/data-state="current"[^>]*>\s*01\s*·\s*review/);
    expect(html).toMatch(/data-state="upcoming"[^>]*>\s*02\s*·\s*cook/);
    expect(html).not.toContain('describe');
  });

  it('still shows the prompt entry when no prompt is present', () => {
    const html = renderToStaticMarkup(<CampaignWizard />);
    expect(html).toContain('data-testid="prompt-step"');
    expect(html).not.toContain('data-testid="drafting-overlay"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "auto-draft on arrival"`
Expected: FAIL — with a prompt present the wizard currently renders the full prompt step, not an overlay; dots show 3 steps with "describe".

- [ ] **Step 3: Derive `hasInitialPrompt`, the entry/overlay flags, and `steps`**

In the `CampaignWizard` body, immediately after `const step = parseStep(searchParams.get('step'));` (line 94), add:

```tsx
  const hasInitialPrompt = !!initial?.defaultBrief?.prompt?.trim();
```

Then, after the `step 3` state declarations (after line 123, before the `goToStep` callback), add:

```tsx
  /* ---------------------------------------- prompt-entry vs auto-draft routing */
  // We auto-draft when the user arrived with a prompt. While that draft is in
  // flight we show only the overlay. A hard draft failure sets draftError and
  // reveals the manual prompt entry so the user can retry.
  const showingPromptEntry = step === 'prompt' && (!hasInitialPrompt || !!draftError);
  const autoDraftPending = step === 'prompt' && hasInitialPrompt && !draftError;
  const steps = resolveVisibleSteps({ hasInitialPrompt, showingPromptEntry });
```

> `draftError` is declared at line 110, so it is in scope here.

- [ ] **Step 4: Add the auto-draft effect**

Add a ref next to `submitInFlightRef` (after line 138):

```tsx
  const didAutoDraftRef = useRef(false);
```

Then add this effect right after the existing `step → submit` effect (after line 145, i.e. after the `}, [step]);` of the submit effect). It must be placed **after** `runDraft` is defined OR reference it through the same eslint-disabled dep pattern. Since `runDraft` is declared later (line 153) as a `useCallback`, place this effect AFTER the `runDraft` declaration (after line 219):

```tsx
  /* ------------------------------- auto-draft on arrival when a prompt exists */
  useEffect(() => {
    if (didAutoDraftRef.current) return;
    if (step !== 'prompt') return;
    if (!hasInitialPrompt) return;
    if (!brief.prompt.trim()) return;
    didAutoDraftRef.current = true;
    void runDraft({ navigate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hasInitialPrompt]);
```

- [ ] **Step 5: Branch the prompt-step render between overlay and entry**

Replace the `{step === 'prompt' && ( … )}` block (lines 319-333) with:

```tsx
      {step === 'prompt' &&
        (autoDraftPending ? (
          <DraftingOverlay />
        ) : (
          <PromptStep
            brief={brief}
            setBrief={setBrief}
            referenceAssetIds={referenceAssetIds}
            setReferenceAssetIds={setReferenceAssetIds}
            drafting={drafting}
            error={draftError}
            onContinue={handleGenerateDraft}
          />
        ))}
```

- [ ] **Step 6: Pass `steps` to `StepDots`**

Confirm the `StepDots` call (line 318) reads:

```tsx
      <StepDots steps={steps} step={step} />
```

(If Task 2 left a temporary `steps={STEP_ORDER}`, switch it to `steps={steps}` now.)

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx -t "auto-draft on arrival"`
Expected: PASS (3 tests).

- [ ] **Step 8: Run the full wizard unit suite**

Run: `pnpm test:unit src/components/campaigns/CampaignWizard.test.tsx`
Expected: PASS — all blocks green. The pre-existing "marks the current step in the step dots" test (no `initial`) still renders 3 dots with `01 done / 02 current / 03 upcoming`, now labelled `describe / review / cook`.

- [ ] **Step 9: Commit**

```bash
git add src/components/campaigns/CampaignWizard.tsx src/components/campaigns/CampaignWizard.test.tsx
git commit -m "feat(campaigns): auto-draft on arrival, skip the manual prompt step"
```

---

## Task 6: Re-point the e2e cook flow to the auto-draft path

**Files:**
- Modify: `e2e/50-campaigns.spec.ts`

- [ ] **Step 1: Update the "prompt step by default" test**

Replace the test at `e2e/50-campaigns.spec.ts:17-27` with (it now asserts the slimmed no-prompt entry — the variants stepper is gone from here):

```ts
  test('new wizard renders the prompt entry by default (no incoming prompt)', async ({
    page,
    baseURL,
  }) => {
    await signInToApp(page, baseURL!);
    await page.goto(`${baseURL}/campaigns/new`);

    // No ?prompt= → the slimmed prompt entry (prompt + references + generate).
    await expect(page.getByTestId('prompt-step')).toBeVisible();
    await expect(page.getByTestId('prompt-input')).toBeVisible();
    await expect(page.getByTestId('prompt-continue')).toBeVisible();
    // Format picker + variants now live on the review step, not here.
    await expect(page.getByTestId('variants-stepper')).toHaveCount(0);
  });
```

- [ ] **Step 2: Update the main cook test to auto-draft**

Replace the main test body at `e2e/50-campaigns.spec.ts:29-101` with:

```ts
  test('auto-draft → brief → cook → /campaigns/[id] with skeletons & populated tiles', async ({
    page,
    baseURL,
  }) => {
    // Generous timeout: POST /api/campaigns/draft calls an LLM chain that can
    // take up to ~30s when it has to retry across models / JSON-mode fallback.
    test.setTimeout(180_000);

    await signInToApp(page, baseURL!);

    // Arrive WITH a prompt (mirrors the composer). The wizard auto-fires the
    // draft on mount and lands on the brief step — no manual "draft brief" click.
    const prompt = 'summer chili-oil product launch — warm tones, bold copy';
    await page.goto(`${baseURL}/campaigns/new?prompt=${encodeURIComponent(prompt)}`);

    // The drafting overlay shows while the LLM chain runs, then the brief step
    // appears. 60s covers multi-model fallback.
    await expect(page.getByTestId('brief-step')).toBeVisible({ timeout: 60_000 });

    // Variants stepper now lives on the brief step. Bump from 1 → 2.
    const stepper = page.getByTestId('variants-stepper');
    await expect(stepper).toBeVisible();
    const initialVariants = await page.getByTestId('variants-value').textContent();
    await stepper.getByRole('button', { name: /increment variants/i }).click();
    await expect(page.getByTestId('variants-value')).not.toHaveText(initialVariants ?? '1');

    // Ad-copy cards for each preset are always rendered on the brief step.
    const adCopyCards = page.locator('[data-testid^="adcopy-card-"]');
    await expect(adCopyCards.first()).toBeVisible();
    const firstPresetId = await adCopyCards.first().getAttribute('data-preset-id');
    expect(firstPresetId).toBeTruthy();

    // Expand advanced — gated on showAdvanced && preview. Wait for total-buzz
    // to confirm the preview returned before clicking.
    await expect(page.getByTestId('total-buzz')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('toggle-advanced').click();

    const presetCards = page.locator('[data-testid^="preset-card-"]');
    await expect(presetCards.first()).toBeVisible({ timeout: 15_000 });
    const firstAdvancedPresetId = await presetCards.first().getAttribute('data-preset-id');
    expect(firstAdvancedPresetId).toBeTruthy();

    // Verify enhanced prompt + brand layer disclosure on the first preset.
    await expect(page.getByTestId(`final-prompt-${firstAdvancedPresetId}`)).toBeVisible();
    await page.getByTestId(`toggle-brand-${firstAdvancedPresetId}`).click();
    await expect(page.getByTestId(`brand-layer-${firstAdvancedPresetId}`)).toBeVisible();

    // Override the raw prompt on the first preset → debounced re-preview.
    await page.getByTestId(`toggle-edit-${firstAdvancedPresetId}`).click();
    const override = page.getByTestId(`override-input-${firstAdvancedPresetId}`);
    await expect(override).toBeVisible();
    await override.fill('hand-tuned override prompt for e2e — chili oil, dramatic light');

    // Cook. Button text encodes the total buzz dynamically — match by test id.
    await page.getByTestId('brief-cook').click();

    await page.waitForURL(/\/campaigns\/[\w-]+$/, { timeout: 30_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Skeletons render before the first poll resolves (MSW pending → processing
    // → succeeded). Real images render after.
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });
```

- [ ] **Step 3: Run the campaigns e2e spec**

Run: `pnpm test:e2e 50-campaigns`
Expected: PASS. (Requires the e2e prerequisites from README › End-to-end tests — Civitai dev server with `testing-login`, the OAuth app redirect URIs, MSW-mocked orchestrator. If the environment isn't set up, note that and defer this run; do NOT weaken assertions to make it pass.)

- [ ] **Step 4: Commit**

```bash
git add e2e/50-campaigns.spec.ts
git commit -m "test(e2e): cook via auto-draft path; variants on the review step"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — no type errors. (Watch for: unused `STEP_ORDER` if every reference was replaced — it is still used inside `resolveVisibleSteps`, so it should remain referenced. Watch for unused `variantsPerPreset`/`setVariantsPerPreset` — still used by `BriefStep`.)

- [ ] **Step 2: Full unit suite**

Run: `pnpm test:unit`
Expected: PASS. Note: per memory, 2 component suites are red on `main` independent of this work (pre-existing). Confirm the only failures (if any) are those known ones and that `PresetGrid.test.tsx` + `CampaignWizard.test.tsx` are green.

- [ ] **Step 3: Lint/format if the repo gate requires it**

Run: `pnpm lint` (if present in `package.json` scripts; skip if not)
Expected: PASS.

- [ ] **Step 4: Final commit (only if Step 3 changed files)**

```bash
git add -A
git commit -m "chore(campaigns): lint pass for auto-draft wizard"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** auto-draft on arrival (Task 5), slimmed no-prompt entry (Task 3), format picker on review step (Task 4), hard-failure → prompt entry with error (Task 5 `showingPromptEntry`/`draftError` branch + reused `runDraft` behavior), template-fallback → review with warning (unchanged `draftWarning` path, no code change needed), dynamic step dots (Tasks 2+5), `PresetGrid` controlled (Task 1), global variants unchanged (no API task — verified by absence). All spec sections map to a task.
- **Type consistency:** `resolveVisibleSteps({hasInitialPrompt, showingPromptEntry})` signature is identical in Task 2 (definition + test) and Task 5 (call site). `setPresetIds` prop name consistent across Task 4. `PresetGrid` `value` prop consistent across Tasks 1 and 4.
- **Known non-issue:** React StrictMode in dev may double-invoke the auto-draft effect (fresh ref per dev remount), causing one extra draft call in dev only — this mirrors the existing `submitInFlightRef` pattern and is not a production concern. Do not add a module-level guard.
</content>
</invoke>
