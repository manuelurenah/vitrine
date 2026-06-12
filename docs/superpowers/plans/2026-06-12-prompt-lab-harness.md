# Prompt-Lab Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI that submits campaign prompts to the real orchestrator, downloads the raw images, and records the exact prompt + cost, so `promptBuilder.ts` can be tuned against true pixels (not the editor's HTML overlay).

**Architecture:** A `scripts/prompt-lab/` CLI run via `tsx`. It imports the **real** `buildCampaignPrompt` + a newly-extracted `buildVitrineImageGenBody`, calls the SDK orchestrator client directly, and authenticates from a sealed `civ_session` cookie pasted into `.env` (`PROMPT_LAB_SESSION`), self-refreshing via `oauthRefresh`. Output lands in gitignored `runs/<ts>-<preset>/` as PNGs + `meta.json`. Claude reads the PNGs and judges them against the rubric in the design spec.

**Tech Stack:** TypeScript, `@civitai/app-sdk` (root + `/orchestrator` subpath), `tsx`, Node 20 `fetch`/`fs`, Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-12-prompt-lab-harness-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/imageGenBody.ts` (create) | Pure, `server-only`-free body builder + engine/model constants + `VitrineImageGenInput` type. Imported by both the app and the script. |
| `src/lib/civitai.ts` (modify) | Re-export the moved symbols; use `buildVitrineImageGenBody` from the new module. Behavior unchanged. |
| `scripts/prompt-lab/auth.ts` (create) | Resolve a fresh access token from `PROMPT_LAB_SESSION` (unseal + refresh) or `PROMPT_LAB_ACCESS_TOKEN`. |
| `scripts/prompt-lab/fixtures.ts` (create) | Sample briefs + brand profiles + ad copy + optional ref URLs. |
| `scripts/prompt-lab/run.ts` (create) | CLI: parse args → build prompt → estimate → submit → poll → download → `meta.json`. |
| `package.json` (modify) | Add `tsx` devDep + `prompt-lab` script. |
| `vitest.config.ts` (modify) | Add `scripts/**/*.test.ts` to the test include glob. |
| `.gitignore` (modify) | Ignore `scripts/prompt-lab/runs/`. |
| `.env.example` (modify) | Document `PROMPT_LAB_SESSION` / `PROMPT_LAB_ACCESS_TOKEN`. |

**Out of scope for this plan** (follow-up, enabled by the harness once the prompt is solid): the cook-vs-regenerate text inconsistency in `cook/route.ts` and the fix-layout original-image bug in `.../regenerate/route.ts`. Tracked in the spec's backlog.

---

## Task 1: Extract `imageGenBody.ts` (refactor, guarded by existing `civitai.test.ts`)

**Files:**
- Create: `src/lib/imageGenBody.ts`
- Modify: `src/lib/civitai.ts:17-64` (remove moved symbols), top imports + re-exports
- Test (existing, must stay green): `src/lib/civitai.test.ts`

- [ ] **Step 1: Create the new module**

Create `src/lib/imageGenBody.ts`:

```ts
import { buildImageGenBody } from '@civitai/app-sdk/orchestrator';

const STARTER_TAG = 'next-app';

/** Workflow tags attached to every Vitrine orchestrator submission. */
export const TAGS: string[] = ['civitai-app-starter', STARTER_TAG];

/** Default `imageGen` engine — Google. Pair with {@link DEFAULT_IMAGE_MODEL}. */
export const DEFAULT_IMAGE_ENGINE = 'google';
/** Default `imageGen` model — Nano Banana 2. Multi-modal; reference images optional. */
export const DEFAULT_IMAGE_MODEL = 'nano-banana-2';

/**
 * Vitrine-specific input shape for the single `imageGen` path used by both
 * campaigns and photoshoots. No `server-only` import, so plain Node scripts
 * (e.g. the prompt-lab CLI) can build identical bodies to the app.
 */
export type VitrineImageGenInput = {
  prompt: string;
  negativePrompt?: string;
  /** Reference images. URL, data URL, or raw base64 string. */
  images?: string[];
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  numImages: number;
  resolution?: '1K' | '2K';
  /** Override the default engine (`google`). */
  engine?: string;
  /** Override the default model (`nano-banana-2`). */
  model?: string;
};

export function buildVitrineImageGenBody(input: VitrineImageGenInput): unknown {
  return buildImageGenBody(
    {
      engine: input.engine ?? DEFAULT_IMAGE_ENGINE,
      model: input.model ?? DEFAULT_IMAGE_MODEL,
      prompt: input.prompt,
      ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
      ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
      aspectRatio: input.aspectRatio,
      numImages: input.numImages,
      resolution: input.resolution ?? '1K',
    },
    { tags: TAGS },
  );
}
```

- [ ] **Step 2: Update `civitai.ts` to use + re-export the moved symbols**

In `src/lib/civitai.ts`:

1. Delete the block defining `STARTER_TAG`, `TAGS`, `DEFAULT_IMAGE_ENGINE`, `DEFAULT_IMAGE_MODEL`, `VitrineImageGenInput`, and `buildVitrineImageGenBody` (current lines 17–64).
2. In the existing import from `@civitai/app-sdk/orchestrator`, **remove** `buildImageGenBody` (no longer used here; `buildWorkflowBody` stays for upscale/video).
3. Add a new import near the other `./` imports:

```ts
import {
  buildVitrineImageGenBody,
  DEFAULT_IMAGE_ENGINE,
  DEFAULT_IMAGE_MODEL,
  TAGS,
  type VitrineImageGenInput,
} from './imageGenBody';
```

4. Add re-exports so existing importers (`cook/route.ts`, `regenerate/route.ts`, `civitai.test.ts`) keep resolving these from `@/lib/civitai`:

```ts
export {
  buildVitrineImageGenBody,
  DEFAULT_IMAGE_ENGINE,
  DEFAULT_IMAGE_MODEL,
  type VitrineImageGenInput,
} from './imageGenBody';
```

`buildUpscaleBody` / `buildVideoAnimateBody` continue to reference `TAGS` (now imported). `submitImageGen` / `estimateImageGen` continue to call `buildVitrineImageGenBody` (now imported). No logic changes.

- [ ] **Step 3: Run the existing civitai test — must stay green**

Run: `pnpm test:unit src/lib/civitai.test.ts`
Expected: PASS (all `estimateImageGen`/`submitImageGen` body-shape + constant assertions hold; the test imports `DEFAULT_IMAGE_ENGINE`/`DEFAULT_IMAGE_MODEL` from `./civitai`, satisfied by the re-export).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imageGenBody.ts src/lib/civitai.ts
git commit -m "refactor(civitai): extract server-only-free imageGenBody module"
```

---

## Task 2: Tooling + config (tsx, vitest glob, gitignore, env docs)

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `.gitignore`
- Modify: `.env.example`

- [ ] **Step 1: Add tsx**

Run: `pnpm add -D tsx`
Expected: `tsx` appears under `devDependencies`.

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add (after `"dev:reset"`):

```json
"prompt-lab": "node --env-file=.env --import tsx scripts/prompt-lab/run.ts",
```

- [ ] **Step 3: Widen the vitest include glob**

In `vitest.config.ts`, change the `include` array to also match script tests:

```ts
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
```

- [ ] **Step 4: Ignore run output**

Append to `.gitignore`:

```
scripts/prompt-lab/runs/
```

- [ ] **Step 5: Document the env vars**

Append to `.env.example`:

```bash
# --- prompt-lab (dev image-prompt iteration CLI) --------------------------
# Script-only (NOT read by the app / src/lib/env.ts). Paste the sealed
# civ_session cookie from a real `pnpm dev` login (devtools → Application →
# Cookies → civ_session). The CLI unseals it with SESSION_SECRET and
# self-refreshes via the OAuth refresh token. Re-paste ~monthly.
# PROMPT_LAB_SESSION=
# Raw access-token fallback — used as-is, no refresh (quick probes only).
# PROMPT_LAB_ACCESS_TOKEN=
```

- [ ] **Step 6: Verify nothing broke**

Run: `pnpm test:unit && pnpm typecheck`
Expected: existing suite PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts .gitignore .env.example
git commit -m "chore(prompt-lab): add tsx runner, vitest script glob, env docs"
```

---

## Task 3: `auth.ts` — resolve a fresh access token (TDD)

**Files:**
- Create: `scripts/prompt-lab/auth.ts`
- Test: `scripts/prompt-lab/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/prompt-lab/auth.test.ts`:

```ts
import { sealCookie } from '@civitai/app-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { needsRefresh, resolveAccessToken } from './auth';

const SECRET = 'a'.repeat(64);

const ENV_KEYS = ['PROMPT_LAB_SESSION', 'PROMPT_LAB_ACCESS_TOKEN', 'SESSION_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function sealedSession(expiresAt: number): string {
  return sealCookie(
    JSON.stringify({
      tokens: {
        access_token: 'real_access',
        refresh_token: 'real_refresh',
        token_type: 'Bearer',
        expires_at: expiresAt,
        scope: 0,
      },
      user: { id: 1, username: 'dev' },
    }),
    SECRET,
  );
}

describe('needsRefresh', () => {
  it('false when token is comfortably in the future', () => {
    expect(needsRefresh(1_000_000, 0)).toBe(false);
  });
  it('true when within the 30s skew window', () => {
    expect(needsRefresh(20_000, 0)).toBe(true);
  });
  it('true when already expired', () => {
    expect(needsRefresh(0, 1_000)).toBe(true);
  });
});

describe('resolveAccessToken', () => {
  it('returns the unsealed access token when not near expiry', async () => {
    process.env.PROMPT_LAB_SESSION = sealedSession(Date.now() + 60 * 60 * 1000);
    await expect(resolveAccessToken()).resolves.toBe('real_access');
  });

  it('honors the raw-token fallback as-is', async () => {
    process.env.PROMPT_LAB_ACCESS_TOKEN = 'raw_tok';
    await expect(resolveAccessToken()).resolves.toBe('raw_tok');
  });

  it('throws a clear error when no credential is set', async () => {
    await expect(resolveAccessToken()).rejects.toThrow(/PROMPT_LAB_SESSION/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit scripts/prompt-lab/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'` / `resolveAccessToken is not a function`.

- [ ] **Step 3: Implement `auth.ts`**

Create `scripts/prompt-lab/auth.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type OAuthTokens,
  refreshToken as oauthRefresh,
  unsealCookie,
} from '@civitai/app-sdk';

const CACHE_PATH = '.auth/prompt-lab.json';
const SKEW_MS = 30_000;
const DEFAULT_CIVITAI_BASE_URL = 'https://civitai.com';

/** True when `expiresAt` is at/under `now + 30s` (refresh ahead of expiry). */
export function needsRefresh(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt <= now + SKEW_MS;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for prompt-lab auth`);
  return v;
}

type SessionShape = { tokens: OAuthTokens };

function parseSealedSession(sealed: string, secret: string): OAuthTokens {
  const raw = unsealCookie(sealed, secret);
  if (!raw) {
    throw new Error(
      'PROMPT_LAB_SESSION failed to unseal — wrong SESSION_SECRET or not an app cookie. ' +
        'Re-copy civ_session from devtools.',
    );
  }
  const parsed = JSON.parse(raw) as SessionShape;
  if (!parsed?.tokens?.access_token) {
    throw new Error('PROMPT_LAB_SESSION had no tokens — re-copy civ_session from devtools.');
  }
  return parsed.tokens;
}

async function readCachedTokens(): Promise<OAuthTokens | null> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as OAuthTokens;
  } catch {
    return null;
  }
}

async function writeCachedTokens(tokens: OAuthTokens): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(tokens, null, 2));
}

async function refresh(tokens: OAuthTokens): Promise<OAuthTokens> {
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token in session — re-paste PROMPT_LAB_SESSION from devtools.');
  }
  return oauthRefresh({
    baseUrl: process.env.CIVITAI_BASE_URL ?? DEFAULT_CIVITAI_BASE_URL,
    clientId: requireEnv('CIVITAI_CLIENT_ID'),
    clientSecret: requireEnv('CIVITAI_CLIENT_SECRET'),
    refreshToken: tokens.refresh_token,
  });
}

/**
 * Resolve a usable access token for the orchestrator. Priority:
 *   1. PROMPT_LAB_ACCESS_TOKEN (raw, used as-is, no refresh).
 *   2. Cached `.auth/prompt-lab.json` if still valid.
 *   3. PROMPT_LAB_SESSION (sealed civ_session): unseal → refresh if near expiry → cache.
 */
export async function resolveAccessToken(): Promise<string> {
  const raw = process.env.PROMPT_LAB_ACCESS_TOKEN;
  if (raw) return raw;

  const cached = await readCachedTokens();
  if (cached && !needsRefresh(cached.expires_at)) return cached.access_token;

  const sealed = process.env.PROMPT_LAB_SESSION;
  if (!sealed) {
    throw new Error(
      'Set PROMPT_LAB_SESSION (sealed civ_session cookie) or PROMPT_LAB_ACCESS_TOKEN in .env. ' +
        'Log into the app via `pnpm dev`, then copy civ_session from devtools.',
    );
  }
  const secret = requireEnv('SESSION_SECRET');
  const sessionTokens = parseSealedSession(sealed, secret);

  if (!needsRefresh(sessionTokens.expires_at)) return sessionTokens.access_token;

  const fresh = await refresh(sessionTokens);
  await writeCachedTokens(fresh);
  return fresh.access_token;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit scripts/prompt-lab/auth.test.ts`
Expected: PASS (6 assertions). The `needsRefresh`/raw-token/unseal paths run without network; the cache file is absent so `readCachedTokens` returns null.

- [ ] **Step 5: Commit**

```bash
git add scripts/prompt-lab/auth.ts scripts/prompt-lab/auth.test.ts
git commit -m "feat(prompt-lab): token resolution from sealed civ_session + refresh"
```

---

## Task 4: `fixtures.ts` — sample briefs/brands/copy (TDD-light)

**Files:**
- Create: `scripts/prompt-lab/fixtures.ts`
- Test: `scripts/prompt-lab/fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/prompt-lab/fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BRIEFS } from './fixtures';

describe('BRIEFS fixtures', () => {
  it('has at least two briefs', () => {
    expect(Object.keys(BRIEFS).length).toBeGreaterThanOrEqual(2);
  });

  it('every brief is complete enough to drive the prompt builder', () => {
    for (const [key, f] of Object.entries(BRIEFS)) {
      expect(key, 'fixture key').not.toBe('');
      for (const field of ['title', 'description', 'goal', 'offer', 'prompt'] as const) {
        expect(f.brief[field], `${key}.brief.${field}`).toBeTruthy();
      }
      expect(f.brand.name, `${key}.brand.name`).toBeTruthy();
      expect(f.adCopy.headline, `${key}.adCopy.headline`).toBeTruthy();
      expect(f.adCopy.subhead, `${key}.adCopy.subhead`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit scripts/prompt-lab/fixtures.test.ts`
Expected: FAIL — `Cannot find module './fixtures'`.

- [ ] **Step 3: Implement `fixtures.ts`**

Create `scripts/prompt-lab/fixtures.ts`:

```ts
import type { AdCopy } from '../../src/lib/adCopy';
import type { BrandProfile } from '../../src/lib/brand';
import type { BriefForPresets } from '../../src/lib/presets';

export type LabFixture = {
  brief: BriefForPresets;
  brand: BrandProfile;
  adCopy: AdCopy;
  /** Optional reference image URLs (product hero). */
  refs?: string[];
};

/** Fill the BrandProfile fields the prompt builder ignores with stable defaults. */
function brand(
  partial: Pick<BrandProfile, 'name'> &
    Partial<Pick<BrandProfile, 'industry' | 'tone' | 'tagline' | 'palette'>>,
): BrandProfile {
  return {
    id: 'fixture',
    userId: 'fixture',
    name: partial.name,
    description: null,
    sourceUrl: null,
    palette: partial.palette ?? [],
    tone: partial.tone ?? null,
    industry: partial.industry ?? null,
    tagline: partial.tagline ?? null,
    font: null,
    logoUrl: null,
    values: [],
    aesthetic: [],
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

export const BRIEFS: Record<string, LabFixture> = {
  skincare: {
    brief: {
      title: 'Lumen serum launch',
      description: 'A minimalist vitamin-C face serum in a frosted glass dropper bottle.',
      goal: 'drive first-purchase trials of the new serum',
      offer: '20% off the launch bundle',
      prompt: 'frosted glass serum bottle on a wet stone surface, soft morning light',
      audience: 'skincare-curious millennials',
      aesthetics: 'clean, dewy, editorial, lots of negative space',
    },
    brand: brand({
      name: 'Lumen',
      industry: 'skincare',
      tone: 'calm, premium, science-led',
      tagline: 'clarity, bottled.',
      palette: ['#0F1B2B', '#E8F0EF', '#C8A24B'],
    }),
    adCopy: {
      headline: 'CLARITY, BOTTLED',
      subhead: 'A vitamin-C serum that wakes your skin up.',
      cta: 'Shop the launch',
    },
  },
  coffee: {
    brief: {
      title: 'Ember cold brew',
      description: 'A matte-black canned cold brew with a bold amber label.',
      goal: 'build awareness for the new ready-to-drink can',
      offer: 'free can with your first subscription box',
      prompt: 'matte black coffee can on concrete, dramatic side light, condensation',
      audience: 'urban commuters who want craft coffee fast',
      aesthetics: 'bold, high-contrast, industrial, energetic',
    },
    brand: brand({
      name: 'Ember',
      industry: 'beverage',
      tone: 'bold, punchy, confident',
      tagline: 'cold brew, lit.',
      palette: ['#111111', '#F4A024', '#E7E2D8'],
    }),
    adCopy: {
      headline: 'COLD BREW, LIT',
      subhead: 'Craft cold brew in a can. No line, no wait.',
      cta: 'Get a can',
    },
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit scripts/prompt-lab/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/prompt-lab/fixtures.ts scripts/prompt-lab/fixtures.test.ts
git commit -m "feat(prompt-lab): sample brief/brand/copy fixtures"
```

---

## Task 5: `run.ts` argument parsing (TDD)

**Files:**
- Create: `scripts/prompt-lab/run.ts` (parseArgs + types only in this task)
- Test: `scripts/prompt-lab/run.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/prompt-lab/run.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseArgs } from './run';

describe('parseArgs', () => {
  it('applies defaults', () => {
    const o = parseArgs([]);
    expect(o.brief).toBe('skincare');
    expect(o.presets).toEqual(['ig-feed']);
    expect(o.num).toBe(1);
    expect(o.matrix).toBe(false);
    expect(o.refs).toEqual([]);
  });

  it('parses presets as a comma list', () => {
    expect(parseArgs(['--preset', 'ig-feed,ig-story']).presets).toEqual(['ig-feed', 'ig-story']);
  });

  it('parses refs, num, brief, overrides, and matrix', () => {
    const o = parseArgs([
      '--brief', 'coffee',
      '--refs', 'https://a/1.png,https://b/2.png',
      '--num', '3',
      '--matrix',
      '--prompt-override', 'raw prompt',
      '--negative-override', 'raw negative',
    ]);
    expect(o.brief).toBe('coffee');
    expect(o.refs).toEqual(['https://a/1.png', 'https://b/2.png']);
    expect(o.num).toBe(3);
    expect(o.matrix).toBe(true);
    expect(o.promptOverride).toBe('raw prompt');
    expect(o.negativeOverride).toBe('raw negative');
  });

  it('rejects an unknown preset id', () => {
    expect(() => parseArgs(['--preset', 'nope'])).toThrow(/unknown preset/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit scripts/prompt-lab/run.test.ts`
Expected: FAIL — `Cannot find module './run'`.

- [ ] **Step 3: Implement `parseArgs` (and the option type) in `run.ts`**

Create `scripts/prompt-lab/run.ts` with just the parser for now:

```ts
import { isPresetId, type PresetId } from '../../src/lib/presets';

export type RunOptions = {
  brief: string;
  presets: PresetId[];
  num: number;
  matrix: boolean;
  refs: string[];
  promptOverride?: string;
  negativeOverride?: string;
};

function takeValue(argv: string[], i: number, flag: string): string {
  const v = argv[i + 1];
  if (v === undefined) throw new Error(`${flag} requires a value`);
  return v;
}

function toPresets(csv: string): PresetId[] {
  const ids = csv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    if (!isPresetId(id)) throw new Error(`unknown preset id: ${id}`);
  }
  return ids as PresetId[];
}

export function parseArgs(argv: string[]): RunOptions {
  const o: RunOptions = {
    brief: 'skincare',
    presets: ['ig-feed'],
    num: 1,
    matrix: false,
    refs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--brief': o.brief = takeValue(argv, i++, a); break;
      case '--preset': o.presets = toPresets(takeValue(argv, i++, a)); break;
      case '--num': o.num = Number.parseInt(takeValue(argv, i++, a), 10); break;
      case '--matrix': o.matrix = true; break;
      case '--refs':
        o.refs = takeValue(argv, i++, a).split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--prompt-override': o.promptOverride = takeValue(argv, i++, a); break;
      case '--negative-override': o.negativeOverride = takeValue(argv, i++, a); break;
      default:
        throw new Error(`unknown flag: ${a}`);
    }
  }
  return o;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit scripts/prompt-lab/run.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/prompt-lab/run.ts scripts/prompt-lab/run.test.ts
git commit -m "feat(prompt-lab): CLI argument parser"
```

---

## Task 6: `run.ts` main flow — build → estimate → submit → poll → download

**Files:**
- Modify: `scripts/prompt-lab/run.ts` (append the IO flow + `main()`)

No unit test — this path is real network/IO, verified by the probe in Task 7.

- [ ] **Step 1: Append the orchestration flow to `run.ts`**

Add these imports to the top of `scripts/prompt-lab/run.ts` (keep the existing `isPresetId`/`PresetId` import):

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import {
  createOrchestratorClient,
  extractImageUrls,
  getWorkflow,
  isTerminal,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
import { resolveAccessToken } from './auth';
import { BRIEFS } from './fixtures';
import { PRESETS } from '../../src/lib/presets';
import { buildCampaignPrompt } from '../../src/lib/promptBuilder';
import {
  buildVitrineImageGenBody,
  type VitrineImageGenInput,
} from '../../src/lib/imageGenBody';
```

Then append the flow (the SDK client exposes `estimateWorkflow`/`submitWorkflow`; we import them lazily via the same module to keep one import block — add them to the orchestrator import list above: `estimateWorkflow, submitWorkflow`):

```ts
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'https://orchestration.civitai.com';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180_000;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function runStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function pollUntilTerminal(
  client: ReturnType<typeof createOrchestratorClient>,
  id: string,
): Promise<WorkflowSnapshot> {
  const start = Date.now();
  let snap = await getWorkflow(client, id);
  while (!isTerminal(snap)) {
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      console.warn(`[poll] ${id} timed out after ${POLL_TIMEOUT_MS}ms; returning last snapshot`);
      return snap;
    }
    await sleep(POLL_INTERVAL_MS);
    snap = await getWorkflow(client, id);
  }
  return snap;
}

async function downloadImage(url: string, destNoExt: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const ext = EXT_BY_MIME[res.headers.get('content-type') ?? ''] ?? 'png';
  const dest = `${destNoExt}.${ext}`;
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

type GenResult = {
  preset: PresetId;
  finalPrompt: string;
  negativePrompt: string;
  aspectRatio: string;
  cost: number;
  workflowId: string;
  imageUrls: string[];
  files: string[];
  status: string;
};

async function runOne(
  client: ReturnType<typeof createOrchestratorClient>,
  briefKey: string,
  preset: PresetId,
  opts: RunOptions,
  outDir: string,
): Promise<GenResult> {
  const fixture = BRIEFS[briefKey];
  if (!fixture) throw new Error(`unknown brief: ${briefKey} (have: ${Object.keys(BRIEFS).join(', ')})`);
  const refs = opts.refs.length ? opts.refs : (fixture.refs ?? []);

  const enhanced = buildCampaignPrompt({
    brief: fixture.brief,
    brand: fixture.brand,
    preset: PRESETS[preset],
    referenceCount: refs.length,
    adCopy: fixture.adCopy,
  });
  const finalPrompt = opts.promptOverride ?? enhanced.finalPrompt;
  const negativePrompt = opts.negativeOverride ?? enhanced.negativePrompt;

  const input: VitrineImageGenInput = {
    prompt: finalPrompt,
    aspectRatio: enhanced.aspectRatio,
    numImages: opts.num,
    ...(negativePrompt ? { negativePrompt } : {}),
    ...(refs.length ? { images: refs } : {}),
  };
  const body = buildVitrineImageGenBody(input);

  const estimate = await estimateWorkflow(client, body);
  const cost = estimate.cost?.total ?? 0;
  console.log(`[${briefKey}/${preset}] estimate: ${cost} buzz`);

  const submitted = await submitWorkflow(client, body);
  console.log(`[${briefKey}/${preset}] submitted ${submitted.id} — polling…`);
  const snap = await pollUntilTerminal(client, submitted.id);
  const status = String(snap.status ?? 'unknown');
  const imageUrls = extractImageUrls(snap);

  const dir = `${outDir}/${briefKey}-${preset}`;
  await mkdir(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const file = await downloadImage(imageUrls[i]!, `${dir}/${String(i + 1).padStart(2, '0')}`);
    files.push(file);
  }

  const result: GenResult = {
    preset,
    finalPrompt,
    negativePrompt,
    aspectRatio: enhanced.aspectRatio,
    cost,
    workflowId: submitted.id,
    imageUrls,
    files,
    status,
  };
  await writeFile(`${dir}/meta.json`, JSON.stringify({ brief: briefKey, ...result }, null, 2));
  console.log(`[${briefKey}/${preset}] ${status} — ${files.length} image(s) → ${dir}`);
  return result;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const accessToken = await resolveAccessToken();
  const client = createOrchestratorClient({ accessToken, baseUrl: ORCHESTRATOR_URL });

  const briefKeys = opts.matrix ? Object.keys(BRIEFS) : [opts.brief];
  const outDir = `scripts/prompt-lab/runs/${runStamp()}`;
  await mkdir(outDir, { recursive: true });

  for (const briefKey of briefKeys) {
    for (const preset of opts.presets) {
      try {
        await runOne(client, briefKey, preset, opts, outDir);
      } catch (err) {
        console.error(`[${briefKey}/${preset}] FAILED:`, err instanceof Error ? err.message : err);
      }
    }
  }
  console.log(`\nDone. Results in ${outDir}`);
}

// Run only when invoked directly (not when imported by the test).
if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

Update the orchestrator import block from Step 1 to include `estimateWorkflow` and `submitWorkflow`:

```ts
import {
  createOrchestratorClient,
  estimateWorkflow,
  extractImageUrls,
  getWorkflow,
  isTerminal,
  submitWorkflow,
  type WorkflowSnapshot,
} from '@civitai/app-sdk/orchestrator';
```

- [ ] **Step 2: Confirm the parser test still passes (import guard works)**

Run: `pnpm test:unit scripts/prompt-lab/run.test.ts`
Expected: PASS — importing `run.ts` does not trigger `main()` (guarded by the `process.argv[1]` check), so no network call fires during the test.

- [ ] **Step 3: Typecheck the whole project**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/prompt-lab/run.ts
git commit -m "feat(prompt-lab): real submit/poll/download flow + meta.json"
```

---

## Task 7: Token probe + first real run (manual verification gate)

**Prerequisite (Manuel):** Log into the app via `pnpm dev` (port 3333, real OAuth against the local civitai dev server). In devtools → Application → Cookies → copy the `civ_session` value. Add to `.env`:

```
PROMPT_LAB_SESSION=<pasted value>
```

- [ ] **Step 1: Probe one preset**

Run: `pnpm prompt-lab --preset ig-feed`
Expected:
- Logs an `estimate: <n> buzz` line (n > 0).
- Logs `submitted wf_… — polling…`, then `succeeded — 1 image(s) → scripts/prompt-lab/runs/<ts>/skincare-ig-feed`.
- `scripts/prompt-lab/runs/<ts>/skincare-ig-feed/01.png` exists and `meta.json` has a non-empty `finalPrompt` + non-zero `cost`.

**If it 401s:** the dev-server token is not accepted by the prod orchestrator (audience mismatch — the spec's flagged risk). Stop and revisit auth before proceeding; do not iterate prompts against a failing endpoint.

- [ ] **Step 2: Claude reads + judges the image**

Claude `Read`s the produced PNG and scores it against the rubric in the design spec (headline legible + spelled right · subhead legible · CTA correct · product fidelity · brand palette/tone · correct aspect · no garbled/duplicate text). Record the verdict.

- [ ] **Step 3: (Optional) consistency sweep**

Run: `pnpm prompt-lab --matrix --preset ig-feed,ig-story`
Expected: four result folders (skincare/coffee × ig-feed/ig-story). Claude reads all and looks for failures that reproduce across briefs — those become the first `promptBuilder.ts` tuning hypotheses.

---

## How the tuning loop runs (methodology, not a code task)

Once Task 7 passes, the iteration loop is: `pnpm prompt-lab` → `Read` the PNGs → score against the rubric → form one hypothesis → edit `src/lib/promptBuilder.ts` → rerun → compare. Because `run.ts` imports the real `buildCampaignPrompt`, every change that improves the lab output ships in the app. Stop when the rubric passes consistently across the matrix (not one lucky run). The two backlog bugs (cook-vs-regenerate text inconsistency, fix-layout original-image) are addressed after the prompt itself is solid, in a follow-up plan.

---

## Self-Review

- **Spec coverage:** harness file layout (Tasks 1,3,4,5,6) ✓ · shared-code refactor with `server-only` avoidance (Task 1) ✓ · paste-cookie auth + refresh + raw fallback (Task 3) ✓ · `tsx` runner + env docs (Task 2) ✓ · run contract flags/flow/meta.json (Tasks 5,6) ✓ · no Buzz guard, estimate-only (Task 6, estimate logged not gated) ✓ · token probe / audience risk (Task 7) ✓ · rubric + loop methodology (final section, references spec) ✓ · backlog explicitly out of scope ✓.
- **Placeholder scan:** none — every code step contains full code; commands have expected output.
- **Type consistency:** `RunOptions`, `parseArgs`, `resolveAccessToken`, `needsRefresh`, `buildVitrineImageGenBody`, `VitrineImageGenInput`, `LabFixture`, `BRIEFS`, `GenResult` are defined once and referenced with the same names throughout. `run.ts` imports `buildVitrineImageGenBody`/`VitrineImageGenInput` from the new `imageGenBody.ts` (created in Task 1), and `estimateWorkflow`/`submitWorkflow` are present in the final orchestrator import list.
