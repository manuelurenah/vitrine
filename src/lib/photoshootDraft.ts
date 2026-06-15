import OpenAI from 'openai';
import type { BrandProfile } from './brand';
import { env } from './env';
import {
  isPhotoshootTemplateId,
  PHOTOSHOOT_TEMPLATES,
  type PhotoshootTemplateId,
  recommendedTemplateIds,
} from './photoshootTemplates';

export type PhotoshootDraft = {
  title: string;
  prompt: string; // improved photoshoot prompt (becomes productNotes downstream)
  templateIds: PhotoshootTemplateId[]; // preselected styles, subset of the 7 known ids
};

export type PhotoshootDraftMeta = {
  llm: 'ok' | 'fallback';
  model?: string;
  attempts?: string[];
  reason?: string;
};

export type GeneratePhotoshootDraftInput = {
  prompt: string;
  brand?: BrandProfile | null;
  productName?: string;
  referenceCount?: number;
  signal?: AbortSignal;
};

export type PhotoshootDraftResult = {
  draft: PhotoshootDraft;
  meta: PhotoshootDraftMeta;
};

const MAX_TITLE = 120;
const MAX_PROMPT = 2000;

// --- Small helpers replicated from adCopy.ts (those are module-private there;
// we keep our own copies rather than widening adCopy's public surface). ---

function clamp(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function clampField(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return clamp(value, max) || fallback;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const stripped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    : trimmed;
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Built-in fallback chain. Mirrors adCopy.ts: when only OPENROUTER_MODEL is set
 * we derive the chain by prepending that pick and appending these known-good
 * free fallbacks (deduped).
 */
const DEFAULT_FALLBACK_TAIL = [
  'stepfun/step-3.5-flash',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-4.1-nano',
];

function resolveModels(): string[] {
  const raw = env.OPENROUTER_MODELS;
  if (raw && raw.trim()) {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return Array.from(new Set(list));
  }
  return Array.from(new Set([env.OPENROUTER_MODEL, ...DEFAULT_FALLBACK_TAIL]));
}

function isTransientError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (!status) return false;
  return status === 408 || status === 429 || status >= 500;
}

// --- Fallback + prompt building ---

function fallbackDraft(input: GeneratePhotoshootDraftInput): PhotoshootDraft {
  return {
    title: input.productName?.trim() || 'Photoshoot',
    prompt: input.prompt.trim(),
    templateIds: recommendedTemplateIds(),
  };
}

function buildSystemPrompt(): string {
  return [
    'You are a senior product-photography art director planning a commercial product shoot.',
    'You receive a short human prompt describing a product and the kind of imagery the user wants. You must INTERPRET that intent and EXPAND it into a concrete, vivid shoot brief — never echo the user prompt verbatim.',
    '',
    'Hard rules:',
    '- title: a short 1–5 word name for the shoot (e.g. "Amber Candle Studio Set"). Do NOT paste the literal user prompt.',
    '- prompt: a concrete product-photography brief in 1–3 sentences describing the product, the setting, lighting, mood, framing, and any props. Specific and visual — this becomes the art direction for the render. Do NOT echo the user prompt.',
    '- templateIds: choose 1–4 of the supplied style ids that best fit this product and brief. Pick ONLY from the ids provided. Do not invent ids.',
    '',
    'Output: respond with ONE JSON object only, no markdown, no commentary. Exact shape:',
    '{ "title": string, "prompt": string, "templateIds": string[] }',
  ].join('\n');
}

function buildUserPrompt(input: GeneratePhotoshootDraftInput): string {
  const { prompt, brand, productName, referenceCount = 0 } = input;
  const brandLines: string[] = [];
  if (brand?.name) brandLines.push(`name: ${brand.name}`);
  if (brand?.industry) brandLines.push(`industry: ${brand.industry}`);
  if (brand?.tone) brandLines.push(`tone: ${brand.tone}`);
  if (brand?.tagline) brandLines.push(`tagline: "${brand.tagline}"`);

  const contextLines: string[] = [];
  if (productName) contextLines.push(`product: ${productName}`);
  if (referenceCount > 0) {
    contextLines.push(
      `${referenceCount} visual reference${referenceCount === 1 ? '' : 's'} attached`,
    );
  }

  const templateLines = Object.values(PHOTOSHOOT_TEMPLATES).map(
    (t) => `${t.id} — ${t.label} — ${t.styleNotes}`,
  );

  return [
    `USER PROMPT\n${prompt}`,
    brandLines.length ? `BRAND DNA\n${brandLines.join('\n')}` : null,
    contextLines.length ? `CONTEXT\n${contextLines.join('\n')}` : null,
    `AVAILABLE STYLES (choose templateIds from these ids only)\n${templateLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function sanitizeTemplateIds(raw: unknown): PhotoshootTemplateId[] {
  if (!Array.isArray(raw)) return [];
  const out: PhotoshootTemplateId[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    if (!isPhotoshootTemplateId(value)) continue;
    if (out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

export async function generatePhotoshootDraft(
  input: GeneratePhotoshootDraftInput,
): Promise<PhotoshootDraftResult> {
  const { signal } = input;

  if (!env.OPENROUTER_API_KEY) {
    console.warn('[photoshootDraft] OPENROUTER_API_KEY not set — returning template fallback');
    return {
      draft: fallbackDraft(input),
      meta: { llm: 'fallback', reason: 'missing_api_key' },
    };
  }

  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
      'X-Title': 'Vitrine',
    },
  });

  async function callOne(model: string, opts: { jsonMode: boolean }) {
    const body = {
      model,
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: 'system' as const, content: buildSystemPrompt() },
        { role: 'user' as const, content: buildUserPrompt(input) },
      ],
      ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    };
    return client.chat.completions.create(body, signal ? { signal } : undefined);
  }

  function isJsonModeUnsupported(err: unknown): boolean {
    const msg = String((err as { message?: string })?.message ?? '');
    const meta = (err as { error?: { metadata?: { raw?: string } } })?.error?.metadata?.raw ?? '';
    const combined = `${msg} ${meta}`.toLowerCase();
    return combined.includes('response_format') && combined.includes('not supported');
  }

  // Parse + validate a successful completion into a usable draft. Returns the
  // draft on success, or a failure reason (empty / non-JSON output, or valid
  // JSON whose shape we don't recognise) so the chain can advance to the next
  // model instead of giving up to the local template.
  function buildDraftFromCompletion(
    completion: Awaited<ReturnType<typeof callOne>>,
    model: string,
  ): { ok: true; draft: PhotoshootDraft } | { ok: false; reason: string } {
    const text = completion.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(text);
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`[photoshootDraft] ${model} returned non-JSON. raw=`, text.slice(0, 500));
      return { ok: false, reason: 'invalid_json' };
    }
    // Accept top-level or single-key-wrapped JSON (e.g. { draft: {...} }).
    const top = parsed as Record<string, unknown>;
    const draftRaw =
      (top.draft && typeof top.draft === 'object'
        ? (top.draft as Record<string, unknown>)
        : null) ?? top;

    const fb = fallbackDraft(input);
    const title = clampField(draftRaw.title, MAX_TITLE, fb.title);
    const prompt = clampField(draftRaw.prompt, MAX_PROMPT, fb.prompt);
    let templateIds = sanitizeTemplateIds(draftRaw.templateIds);
    if (templateIds.length === 0) templateIds = recommendedTemplateIds();

    // Detect a "shape miss": valid JSON but neither title nor prompt nor any
    // template id landed — advance to the next model rather than emit a draft
    // that's entirely fallback.
    const titleFilled = typeof draftRaw.title === 'string' && draftRaw.title.trim().length > 0;
    const promptFilled = typeof draftRaw.prompt === 'string' && draftRaw.prompt.trim().length > 0;
    const idsFilled = sanitizeTemplateIds(draftRaw.templateIds).length > 0;
    if (!titleFilled && !promptFilled && !idsFilled) {
      console.warn(
        `[photoshootDraft] ${model} returned JSON with no recognisable fields. keys=`,
        Object.keys(top),
      );
      return { ok: false, reason: 'unrecognised_shape' };
    }

    return { ok: true, draft: { title, prompt, templateIds } };
  }

  const models = resolveModels();
  const attempts: string[] = [];
  let lastErr: unknown = null;
  let lastReason = 'all_models_failed';

  // Walk the chain. For each model: try once; on transient errors retry with
  // backoff; on response_format-not-supported, retry the same model without
  // JSON mode. A model that succeeds but yields unusable output advances to the
  // next model, exactly like a hard error — so the whole chain is exhausted
  // before falling back to the local template.
  for (const model of models) {
    attempts.push(model);
    let jsonMode = true;
    let triedNoJsonMode = false;
    let completion: Awaited<ReturnType<typeof callOne>> | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        completion = await callOne(model, { jsonMode });
        break;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastErr = err;
        if (isJsonModeUnsupported(err) && !triedNoJsonMode) {
          console.warn(
            `[photoshootDraft] ${model} rejected response_format — retrying without JSON mode`,
          );
          jsonMode = false;
          triedNoJsonMode = true;
          continue;
        }
        if (isTransientError(err)) {
          console.warn(
            `[photoshootDraft] transient error from ${model} (status=${(err as { status?: number }).status}) — retrying after 1.5s`,
          );
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn(`[photoshootDraft] non-transient error from ${model} — advancing chain`, err);
        break;
      }
    }

    if (!completion) {
      lastReason =
        lastErr instanceof Error
          ? `${lastErr.name}: ${lastErr.message.slice(0, 200)}`
          : 'request_failed';
      continue;
    }

    const built = buildDraftFromCompletion(completion, model);
    if (built.ok) {
      return { draft: built.draft, meta: { llm: 'ok', model, attempts } };
    }
    console.warn(
      `[photoshootDraft] ${model} produced unusable output (${built.reason}) — advancing chain`,
    );
    lastReason = built.reason;
  }

  console.error(
    `[photoshootDraft] all ${models.length} models in chain failed/unusable. reason=${lastReason}`,
    lastErr,
  );
  return {
    draft: fallbackDraft(input),
    meta: { llm: 'fallback', attempts, reason: lastReason },
  };
}
