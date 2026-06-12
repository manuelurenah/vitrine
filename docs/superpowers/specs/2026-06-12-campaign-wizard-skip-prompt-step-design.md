# Campaign wizard — collapse the prompt step into auto-draft

**Date:** 2026-06-12
**Status:** Design — pending implementation

## Problem

Cooking a campaign from the home composer takes two prompt-confirmation
actions for what feels like one intent:

1. On `/campaigns`, the user types a prompt in `<PromptComposer>` and clicks
   **generate brief**. This only navigates to `/campaigns/new?prompt=…&refs=…`.
2. On `/campaigns/new`, the wizard's first step (`PromptStep`) re-shows the
   same prompt plus a format picker and a variants stepper, and asks the user
   to click **draft brief** to actually start the LLM draft.

Step 2 is redundant: the user already expressed intent in step 1. The LLM
draft should start the moment **generate brief** is clicked, and the user
should land directly on the review (brief) step to adjust the result.

## Goal

From the composer: **type prompt → generate brief → (drafting) → review step → cook.**
The manual "draft brief" click disappears. Format selection and the variants
control move into the review step, where the user adjusts them against a live
buzz estimate.

## Non-goals / decisions locked in brainstorming

- **Variants model stays global.** Keep the single `variantsPerPreset` number
  applied to all formats. We are *relocating* the existing format picker +
  variants stepper into the review step, not introducing per-format
  quantities. No changes to `/api/campaigns/{draft,preview,cook}`,
  `useCampaignPreview`, or `createCampaign`.
- No new persisted entities, no schema changes.

## Approach (chosen)

**Auto-draft on arrival, inside the wizard.**

`<PromptComposer>` stays unchanged — it still only routes to
`/campaigns/new?prompt=…&refs=…`. The wizard detects a non-empty incoming
prompt on mount and fires the LLM draft automatically, reusing the existing
`runDraft({ navigate: true })` path and the `DraftingOverlay`. This mirrors the
pattern already used to auto-run the cook on entering the `submit` step, so no
draft state needs to survive the navigation.

Rejected alternatives:

- **Draft inside PromptComposer before navigating** — the draft payload is too
  large for the URL and would require shared client state or a server
  round-trip to rehydrate. More moving parts, worse failure story.
- **Server-side draft in the `/campaigns/new` RSC** — an LLM call in an RSC
  blocks navigation with no loading affordance, and AGENTS.md mandates Civitai
  SDK / LLM calls happen in route handlers, not RSCs.

## Behavior

### Entry points to `/campaigns/new`

| Entry | Has prompt? | Behavior |
|---|---|---|
| `<PromptComposer>` (on `/campaigns`) | yes | auto-draft → land on **review** |
| Mobile FAB (`/campaigns/new`) | no | show **slimmed prompt entry** |
| `buildCampaignNewHref` (refs-only) | no | show **slimmed prompt entry** (refs pre-filled) |

### Arriving WITH a prompt

1. Wizard mounts with `brief.prompt` set (from `defaultBrief`).
2. A `useEffect` guarded by a `didAutoDraftRef` runs `runDraft({ navigate: true })`
   once. The `DraftingOverlay` covers the screen while the draft is in flight.
3. **Draft returns a usable draft** (`res.ok && json.draft`, including the
   template fallback when `meta.llm === 'fallback'`): navigate to the review
   step. If it was a fallback, the existing `draftWarning` banner shows there.
4. **Hard failure** (`!res.ok || !json.draft` — auth / validation / network,
   i.e. the model fallback chain in the draft route is exhausted *and* no
   template draft came back): do **not** navigate. The user remains on the
   slimmed prompt entry with the prompt pre-filled and `draftError` shown, and
   can retry manually. (This is exactly what `runDraft` already does on hard
   error — it sets `draftError` and skips the navigate.)

### Arriving WITHOUT a prompt

The slimmed prompt entry (`PromptStep`) renders: prompt textarea + references
picker + **generate brief** button. Format picker and variants stepper are
*not* here anymore. Submitting runs `runDraft({ navigate: true })` with
`DEFAULT_PRESETS`, then lands on the review step.

### Review (brief) step additions

- Gains the **`<PresetGrid>` format picker**, beside the variants stepper it
  already renders.
- Toggling formats re-runs the buzz estimate. This is already wired: the
  brief-step preview `useEffect` depends on `presetIds`, so changing the set
  reschedules `/api/campaigns/preview`.
- Ad-copy cards already render per `presetIds`, so adding a format shows an
  empty copy card for it. **Regenerate** redrafts ad copy for the *current*
  format set, covering formats added here. At cook time, the `hasClientCopy`
  guard in the cook route already regenerates server-side copy for any format
  missing client copy, so an un-regenerated added format still cooks correctly.

### Initial draft formats

The composer does not choose formats, so the auto-draft uses `DEFAULT_PRESETS`
(`ig-feed`, `ig-story`, `li`). The user adjusts them in the review step.

### Step indicator

`StepDots` derives its visible steps from whether a prompt was present at mount:

- **with prompt:** `review · cook` (2 dots)
- **without prompt:** `describe · review · cook` (3 dots)

Implementation: compute the visible step list once at mount (a prompt was
present ⇒ omit `describe`) and pass it to `StepDots` instead of the static
`STEP_ORDER`.

## Components touched

| File | Change |
|---|---|
| `src/components/campaigns/CampaignWizard.tsx` | Auto-draft `useEffect` + `didAutoDraftRef`; slim `PromptStep` (drop PresetGrid + VariantsStepper); add `<PresetGrid>` to `BriefStep`; dynamic `StepDots`. |
| `src/components/campaigns/PresetGrid.tsx` | Accept an optional controlled `value: string[]` so the relocated picker stays in sync with the wizard's `presetIds` (today it is uncontrolled with its own `defaultOn` set). Backward compatible — falls back to internal state when `value` is absent. |
| `src/components/campaigns/PromptComposer.tsx` | No change (kept dumb). |
| `src/app/(app)/campaigns/new/page.tsx` | No change. |

No API route, hook, or DB changes.

## Edge cases

- **Empty/whitespace prompt arriving in the URL** — `runDraft` already guards
  `!brief.prompt.trim()` and sets `draftError`; the auto-draft effect must read
  the same guard so a junk `?prompt=` doesn't fire a doomed call. Treat as the
  no-prompt case (show slimmed entry).
- **Browser back from review → no-prompt entry** — after auto-draft we
  `router.replace` to `?step=brief` (existing `goToStep`), so back does not
  re-trigger the auto-draft loop. The `didAutoDraftRef` guard also prevents a
  re-fire within the same mount.
- **Refs-only entry then user types a prompt** — flows through the normal
  slimmed-entry → `runDraft` path; refs are carried as today.
- **Regenerate on the review step** — unchanged (`runDraft({ navigate:false })`),
  now also useful for drafting copy for formats added in the review step.

## Testing

- **`src/components/campaigns/CampaignWizard.test.tsx`**
  - Replace "renders the prompt step by default" with: with no prompt →
    slimmed prompt entry; with a prompt → auto-draft fires and lands on the
    brief step (assert the draft fetch is called, then `brief-step` shows).
  - Update step-dot assertions for the dynamic 2-vs-3 step list.
  - Add: hard draft failure with an incoming prompt → stays on prompt entry
    with `draft-error` visible.
  - Keep the `fetchCampaignPreview` / `useCampaignPreview` suites as-is.
- **e2e `tests/e2e/50-campaigns*`** — re-point the cook flow: it no longer
  clicks **draft brief**; from the composer it should land on the review step
  directly. Format toggling now happens on the review step.
- Run `pnpm typecheck`; targeted `pnpm test` for the wizard unit suite;
  `pnpm test:e2e` for the campaign cook spec.

## Risks

- The auto-draft effect must fire exactly once and not race the URL-driven step
  parsing. Mitigation: `didAutoDraftRef` guard + only auto-draft when
  `step === 'prompt'` and a prompt is present.
- `PresetGrid` becoming controlled must remain backward compatible for any
  other caller. Mitigation: optional `value`, internal state fallback. (Current
  only callers are the wizard steps.)
