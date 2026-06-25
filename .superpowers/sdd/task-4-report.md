# Task 4 Report: Onboarding Form Validation

## TDD Evidence

### RED (Step 2)
Command:
```
node /Users/hackstreetboy/Projects/vitrine/node_modules/vitest/vitest.mjs run src/lib/onboardingValidation.test.ts
```
Output:
```
FAIL  src/lib/onboardingValidation.test.ts
Error: Cannot find module './onboardingValidation'
Test Files  1 failed (1)
Tests  no tests
```

### GREEN (Step 4)
Command:
```
node /Users/hackstreetboy/Projects/vitrine/node_modules/vitest/vitest.mjs run src/lib/onboardingValidation.test.ts
```
Output:
```
✓ src/lib/onboardingValidation.test.ts (8 tests) 2ms
Test Files  1 passed (1)
Tests  8 passed (8)
```

## Files Changed

1. **`src/lib/onboardingValidation.ts`** (new)
   - `isBrandDnaSufficient(brand)`: returns true when brand has non-default/non-empty `name` AND (`description` non-empty OR `palette.length > 0`). Uses `palette` field (not `colors`) to match `BrandProfile`.
   - `canLeaveInputStep(input)`: returns true when `brandName` is non-empty AND (`description` or `url` is non-empty).
   - `INPUT_STEP_MIN`: zod schema for input step minimum fields.

2. **`src/lib/onboardingValidation.test.ts`** (new)
   - 8 unit tests: 4 for `isBrandDnaSufficient` (empty brand, default name only, name+desc, name+palette), 4 for `canLeaveInputStep` (empty name, name only, name+desc, name+url).

3. **`src/lib/onboarding.ts`**
   - Added imports: `getDefaultBrand` from `@/lib/brand`, `isBrandDnaSufficient` from `@/lib/onboardingValidation`.
   - `recordOnboardingStep`: when `isFinal`, reads `getDefaultBrand(userId)` and only sets `completedAt: new Date()` if `isBrandDnaSufficient(brand ?? {})`. Otherwise keeps existing `completedAt` via `sql\`${onboardingState.completedAt}\``.

4. **`src/app/onboarding/[step]/page.tsx`**
   - After `recordOnboardingStep` + `getOnboarding`, added server gate: if `step === 'next' && snapshot.completedAt === null`, `redirect('/onboarding/input')`. Closes all client bypasses at the server boundary.
   - Passes `suppressKeyboardNav={step === 'input'}` to `OnboardingFrame` so the frame's built-in keyboard nav is disabled for the input step (the step handles it itself with a guard).

5. **`src/components/onboarding/InputStep.tsx`**
   - Added import: `canLeaveInputStep` from `@/lib/onboardingValidation`, `useOnboardingKeyboardNav` from `./useOnboardingKeyboardNav`.
   - Added `continueError` useState.
   - `onContinue`: calls `canLeaveInputStep({ brandName, description, url })` before `flushPatch()`. Sets inline error message and returns without navigating if validation fails.
   - Continue button: `disabled={pending !== null || !brandName.trim()}` (disabled when name empty).
   - Inline error rendered above the nav row using existing `TriangleAlert` + `urlError` pattern.
   - Calls `useOnboardingKeyboardNav('input', { canAdvance: () => canLeaveInputStep({ brandName, description, url }) })` directly so ArrowRight is blocked when the form is incomplete.

6. **`src/components/onboarding/DnaStep.tsx`**
   - Added `useRouter` import.
   - Added `READINESS_THRESHOLD = 60` constant.
   - Added `const router = useRouter()`.
   - Readiness bar: replaced hardcoded `w-full` with `style={{ width: \`${readiness}%\` }}` and hardcoded `100%` label with `{readiness}%`. Added `transition-[width]` for smooth animation.
   - "let's go" button: replaced `<Link href="/onboarding/next"><Button>` with plain `<Button disabled={readiness < READINESS_THRESHOLD} onClick={() => router.push('/onboarding/next')}>`.

7. **`src/components/onboarding/OnboardingFrame.tsx`**
   - Removed `skipHref` prop and the `<Link href={skipHref}>skip →</Link>` element + adjacent `<span aria-hidden>` separator.
   - Added optional `suppressKeyboardNav?: boolean` prop: when true, passes `null` to `useOnboardingKeyboardNav` which disables the listener.
   - Added optional `canAdvance?: () => boolean` prop forwarded to the hook (for future use; currently not used by the server page since `InputStep` handles it directly).

8. **`src/components/onboarding/useOnboardingKeyboardNav.ts`**
   - Added `Options` type with `canAdvance?: () => boolean`.
   - Hook signature changed to `useOnboardingKeyboardNav(currentStep: OnboardingStep | null, options?)`.
   - When `currentStep === null`: early return in `useEffect` (listener not registered).
   - ArrowRight: checks `canAdvance && !canAdvance()` before navigating; returns early if guard fails.
   - Added `canAdvance` to `useEffect` dependency array.

## How the Server Gate Works

1. User navigates to `/onboarding/next` (by any means — direct URL, skip link removed but still typeable).
2. `recordOnboardingStep(userKey, 'next')` runs server-side.
3. Inside, `getDefaultBrand(userId)` fetches the persisted brand. `isBrandDnaSufficient(brand)` checks: non-default name AND (description OR palette color).
4. If insufficient: `completedAt` stays null. The db update preserves the existing value.
5. Back in the page, `snapshot.completedAt === null` → `redirect('/onboarding/input')`.
6. User is sent back to fill in the required fields. No amount of client-side bypassing can get past this.

## Typecheck Output

```
pnpm typecheck
> tsc --noEmit
(no errors, clean exit 0)
```

## Self-Review

- The server gate is the real security boundary. All client guards (button disabled, inline errors, keyboard nav) are UX conveniences only.
- `isBrandDnaSufficient` uses `palette` (the real `BrandProfile` field), not `colors` (which was in the brief's initial example code).
- The `useOnboardingKeyboardNav(null)` pattern avoids double-listener issues cleanly. The frame disables its listener when `suppressKeyboardNav=true`; `InputStep` owns its own listener with `canAdvance`.
- `canLeaveInputStep` does NOT block the "extract + continue" (scraping) path — that path navigates to `/onboarding/processing`, which is correct. Only the manual "continue" button (→ `/onboarding/dna`) is gated.
- The `DnaStep` readiness threshold of 60% means the user needs at least 4 of 7 fields filled: brand name, palette, description, logo, tagline, tone, font. Brand name alone (1/7 = ~14%) is not enough, which correctly forces engagement.

## Concerns

- The `READINESS_THRESHOLD = 60` value (matching the brief's example) means the "let's go" button stays disabled if a user only fills in a brand name and description (2/7 = ~28%). They'd need to also add colors, a tagline, etc. This might frustrate users who want a minimal but valid DNA. The server gate (`isBrandDnaSufficient`) is more permissive (name + description OR one color). Consider lowering the client threshold or aligning it with the server gate in a follow-up.
- `markOnboardingComplete` (called from elsewhere) still unconditionally sets `completedAt`. If there are other code paths that call it outside of the normal step flow, they bypass the DNA gate. Recommend auditing callers if this matters.
