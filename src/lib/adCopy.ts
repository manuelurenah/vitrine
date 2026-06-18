import OpenAI from 'openai';
import type { BrandProfile } from './brand';
import { env } from './env';
import type { BriefForPresets } from './presets';
import { PRESETS, type PresetId } from './presets';

export type AdCopy = {
  headline: string;
  subhead: string;
  cta?: string;
};

const MAX_HEADLINE = 60;
const MAX_SUBHEAD = 140;
const MAX_CTA = 24;

function clamp(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function sanitize(raw: unknown): AdCopy | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const headline = typeof r.headline === 'string' ? clamp(r.headline, MAX_HEADLINE) : '';
  const subhead = typeof r.subhead === 'string' ? clamp(r.subhead, MAX_SUBHEAD) : '';
  const cta = typeof r.cta === 'string' && r.cta.trim() ? clamp(r.cta, MAX_CTA) : undefined;
  if (!headline || !subhead) return null;
  return cta ? { headline, subhead, cta } : { headline, subhead };
}

function fallbackCopy(
  brief: BriefForPresets,
  brand: BrandProfile | null | undefined,
  presetId: PresetId,
): AdCopy {
  const headlineSource =
    brief.offer?.trim() ||
    brief.goal?.trim() ||
    brand?.tagline?.trim() ||
    brief.title?.trim() ||
    'New from us';
  const headline = clamp(headlineSource, MAX_HEADLINE);
  const subheadSource =
    (brief.description?.split(/[.!?]/)[0] ?? '').trim() ||
    brief.audience?.trim() ||
    brand?.industry?.trim() ||
    'Made for you.';
  const subhead = clamp(subheadSource, MAX_SUBHEAD);
  const cta = brief.goal?.toLowerCase().includes('lead')
    ? 'Learn more'
    : presetId === 'li'
      ? 'Get in touch'
      : 'Shop now';
  return { headline, subhead, cta };
}

function buildSystemPrompt(): string {
  return [
    'You are a senior direct-response copywriter generating ad creatives.',
    'For each placement, write ONE punchy headline (≤ 8 words, no clickbait, no emojis), ONE subhead (≤ 16 words, plain sentence case, may include a single specific benefit), and an optional 1–3 word CTA in title case.',
    'Vary the angle across placements so they feel like a campaign set, not duplicates. Use the brand tone. Never invent claims not implied by the brief.',
    'Respond ONLY with a single JSON object: { "tiles": { "<presetId>": { "headline": string, "subhead": string, "cta"?: string } } }. Use the exact preset ids provided. Do not wrap in markdown.',
  ].join(' ');
}

function buildUserPrompt(
  brief: BriefForPresets,
  brand: BrandProfile | null | undefined,
  presetIds: PresetId[],
): string {
  const brandLines: string[] = [];
  if (brand?.name) brandLines.push(`name: ${brand.name}`);
  if (brand?.industry) brandLines.push(`industry: ${brand.industry}`);
  if (brand?.tone) brandLines.push(`tone: ${brand.tone}`);
  if (brand?.tagline) brandLines.push(`tagline: "${brand.tagline}"`);
  const briefLines: string[] = [];
  if (brief.title) briefLines.push(`campaign title: ${brief.title}`);
  if (brief.description) briefLines.push(`description: ${brief.description}`);
  if (brief.goal) briefLines.push(`goal: ${brief.goal}`);
  if (brief.offer) briefLines.push(`offer: ${brief.offer}`);
  if (brief.audience) briefLines.push(`audience: ${brief.audience}`);
  if (brief.aesthetics) briefLines.push(`aesthetic: ${brief.aesthetics}`);
  const placementLines = presetIds.map((id) => {
    const p = PRESETS[id];
    return `- ${id} (${p.label}, ${p.ratio})`;
  });
  return [
    brandLines.length ? `BRAND\n${brandLines.join('\n')}` : null,
    `BRIEF\n${briefLines.join('\n')}`,
    `PLACEMENTS (write copy for each)\n${placementLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
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

export type GenerateAdCopyInput = {
  brief: BriefForPresets;
  brand?: BrandProfile | null;
  presetIds: PresetId[];
  signal?: AbortSignal;
};

export async function generateAdCopyForPresets(
  input: GenerateAdCopyInput,
): Promise<Record<PresetId, AdCopy>> {
  const { brief, brand, presetIds, signal } = input;
  const fallback = (): Record<PresetId, AdCopy> => {
    const out = {} as Record<PresetId, AdCopy>;
    for (const id of presetIds) out[id] = fallbackCopy(brief, brand ?? null, id);
    return out;
  };

  if (!env.OPENROUTER_API_KEY) return fallback();

  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
      'X-Title': 'Vitrine',
    },
  });

  try {
    const completion = await client.chat.completions.create(
      {
        model: env.OPENROUTER_MODEL,
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(brief, brand, presetIds) },
        ],
      },
      signal ? { signal } : undefined,
    );
    const text = completion.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(text);
    if (!parsed || typeof parsed !== 'object') return fallback();
    const tiles =
      (parsed as { tiles?: Record<string, unknown> }).tiles ?? (parsed as Record<string, unknown>);
    if (!tiles || typeof tiles !== 'object') return fallback();
    const out = {} as Record<PresetId, AdCopy>;
    for (const id of presetIds) {
      const candidate = sanitize((tiles as Record<string, unknown>)[id]);
      out[id] = candidate ?? fallbackCopy(brief, brand ?? null, id);
    }
    return out;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return fallback();
  }
}

export async function generateAdCopyForPreset(
  input: Omit<GenerateAdCopyInput, 'presetIds'> & { presetId: PresetId },
): Promise<AdCopy> {
  const { presetId, ...rest } = input;
  const map = await generateAdCopyForPresets({ ...rest, presetIds: [presetId] });
  return map[presetId];
}

export type CampaignDraft = {
  title: string;
  description: string;
  goal: string;
  offer: string;
  audience: string;
  aesthetics: string;
  adCopy: Record<PresetId, AdCopy>;
  /**
   * Spare, distinct ad-copy variants beyond the selected placements. The wizard
   * rotates through these when the user adds new output formats on the review
   * step, so each added placement gets fresh copy instead of a clone.
   */
  copyPool: AdCopy[];
};

const MAX_TITLE = 80;
const MAX_DESC = 320;
const MAX_FIELD = 140;
/** How many extra spare copy variants to ask the draft LLM for. */
const DRAFT_SPARE_COPY_COUNT = 4;

function clampField(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return clamp(value, max) || fallback;
}

function fallbackDraft(
  prompt: string,
  brand: BrandProfile | null | undefined,
  presetIds: PresetId[],
): CampaignDraft {
  const seed: BriefForPresets = {
    prompt,
    title: brand?.name ? `${brand.name} drop` : 'New campaign',
    description: prompt,
    goal: 'awareness',
    offer: '',
    audience: '',
    aesthetics: brand?.tone ?? '',
  };
  const adCopy = {} as Record<PresetId, AdCopy>;
  for (const id of presetIds) adCopy[id] = fallbackCopy(seed, brand ?? null, id);
  return {
    title: seed.title,
    description: seed.description,
    goal: seed.goal,
    offer: seed.offer,
    audience: seed.audience ?? '',
    aesthetics: seed.aesthetics ?? '',
    adCopy,
    // No LLM means no distinct spares — the wizard falls back to seeding added
    // placements from an existing card when the pool is empty.
    copyPool: [],
  };
}

function buildDraftSystemPrompt(): string {
  return [
    'You are a senior marketing strategist and direct-response copywriter producing a fully fleshed-out social ad campaign brief.',
    'You receive a short human prompt that describes intent (the offer, the goal, sometimes the audience). You must INTERPRET that intent and EXPAND it into a complete brief and per-placement ad copy — never echo the user prompt verbatim into any field.',
    '',
    'Hard rules for the brief fields:',
    '- title: a punchy 2–6 word campaign name (e.g. "BOGO Online Drop", "July Peak Push"). Do NOT use the literal user prompt.',
    '- description: 1–2 sentences describing what this campaign is about, what it offers, and where it runs. Specific, not generic. Do NOT paste the user prompt.',
    '- goal: the marketing objective in 2–5 words (e.g. "drive online sales", "lead generation", "product launch awareness"). Never just "awareness" unless that is genuinely the only goal.',
    '- offer: the concrete promotional offer in ≤ 8 words (e.g. "Buy one, get one free, online only"). Empty string only if there truly is no offer.',
    '- audience: the target buyer in ≤ 12 words (e.g. "deal-hunting online shoppers, 25–45"). Infer from the prompt and brand.',
    '- aesthetics: visual mood / art direction in ≤ 12 words (e.g. "bold red and white, sale energy, high contrast"). Match brand tone + palette when given.',
    '',
    'Hard rules for per-placement ad copy:',
    '- For each placement id provided, write copy that converts: headline (≤ 8 words, no emojis, no clickbait), subhead (≤ 16 words, sentence case, one specific benefit or offer detail), CTA (1–3 words, title case, action verb).',
    '- The copy MUST reference the offer from the brief explicitly (e.g. mention BOGO / 2-for-1 / free / online-exclusive when the prompt says so).',
    '- Vary the angle across placements so the set feels like a campaign, not duplicates.',
    '- Never invent specific prices, dates, sizes, or claims not implied by the prompt or brand.',
    '',
    'Spare copy:',
    `- Also produce ${DRAFT_SPARE_COPY_COUNT} extra spare ad-copy variants in "extraCopy" — distinct campaign angles the user may apply to additional placements later.`,
    '- Each spare must differ from every tile above and from the other spares (different hook/angle), while staying on-brief and on-brand.',
    '',
    'Output: respond with ONE JSON object only, no markdown, no commentary. Exact shape:',
    '{ "brief": { "title": string, "description": string, "goal": string, "offer": string, "audience": string, "aesthetics": string }, "tiles": { "<presetId>": { "headline": string, "subhead": string, "cta": string } }, "extraCopy": [ { "headline": string, "subhead": string, "cta": string } ] }',
    'Use the exact preset ids provided in the user message.',
  ].join('\n');
}

function buildDraftUserPrompt(
  prompt: string,
  brand: BrandProfile | null | undefined,
  presetIds: PresetId[],
  context: { referenceCount: number; productName?: string },
): string {
  const brandLines: string[] = [];
  if (brand?.name) brandLines.push(`name: ${brand.name}`);
  if (brand?.industry) brandLines.push(`industry: ${brand.industry}`);
  if (brand?.tone) brandLines.push(`tone: ${brand.tone}`);
  if (brand?.tagline) brandLines.push(`tagline: "${brand.tagline}"`);
  const palette = (brand?.palette ?? []).slice(0, 4).filter(Boolean);
  if (palette.length) brandLines.push(`palette: ${palette.join(', ')}`);
  const placementLines = presetIds.map((id) => {
    const p = PRESETS[id];
    return `- ${id} (${p.label}, ${p.ratio})`;
  });
  const contextLines: string[] = [];
  if (context.productName) contextLines.push(`product: ${context.productName}`);
  if (context.referenceCount > 0) {
    contextLines.push(
      `${context.referenceCount} visual reference${context.referenceCount === 1 ? '' : 's'} attached`,
    );
  }
  return [
    `USER PROMPT\n${prompt}`,
    brandLines.length ? `BRAND DNA\n${brandLines.join('\n')}` : null,
    contextLines.length ? `CONTEXT\n${contextLines.join('\n')}` : null,
    `PLACEMENTS\n${placementLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export type GenerateCampaignDraftInput = {
  prompt: string;
  brand?: BrandProfile | null;
  presetIds: PresetId[];
  referenceCount?: number;
  productName?: string;
  signal?: AbortSignal;
};

export type CampaignDraftResult = {
  draft: CampaignDraft;
  meta: { llm: 'ok' | 'fallback'; model?: string; attempts?: string[]; reason?: string };
};

/**
 * Built-in fallback chain. When the user only sets OPENROUTER_MODEL we
 * derive the chain by prepending that pick and appending these known-good
 * free fallbacks (deduped). Tweak the list as new free models surface.
 */
const DEFAULT_FALLBACK_TAIL = [
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
  // Derive a chain: primary first, then the built-in tail (deduped).
  return Array.from(new Set([env.OPENROUTER_MODEL, ...DEFAULT_FALLBACK_TAIL]));
}

function isTransientError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (!status) return false;
  return status === 408 || status === 429 || status >= 500;
}

export async function generateCampaignDraft(
  input: GenerateCampaignDraftInput,
): Promise<CampaignDraftResult> {
  const { prompt, brand, presetIds, referenceCount = 0, productName, signal } = input;
  if (!env.OPENROUTER_API_KEY) {
    console.warn('[adCopy] OPENROUTER_API_KEY not set — returning template fallback');
    return {
      draft: fallbackDraft(prompt, brand, presetIds),
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
      temperature: 0.75,
      max_tokens: 1800,
      messages: [
        { role: 'system' as const, content: buildDraftSystemPrompt() },
        {
          role: 'user' as const,
          content: buildDraftUserPrompt(prompt, brand, presetIds, {
            referenceCount,
            productName,
          }),
        },
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
  ): { ok: true; draft: CampaignDraft } | { ok: false; reason: string } {
    const text = completion.choices?.[0]?.message?.content ?? '';
    console.log(
      `[adCopy] LLM raw response (model=${model}, len=${text.length}):`,
      text.slice(0, 1200),
    );
    const parsed = parseJson(text) as
      | { brief?: Record<string, unknown>; tiles?: Record<string, unknown> }
      | Record<string, unknown>
      | null;
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`[adCopy] ${model} returned non-JSON. raw=`, text.slice(0, 500));
      return { ok: false, reason: 'invalid_json' };
    }
    // Some models return the brief and tiles at the top level instead of
    // wrapped. Accept both shapes so a slightly off-spec JSON still works.
    const top = parsed as Record<string, unknown>;
    const briefRaw =
      (top.brief && typeof top.brief === 'object'
        ? (top.brief as Record<string, unknown>)
        : null) ?? top;
    const tilesRaw =
      (top.tiles && typeof top.tiles === 'object'
        ? (top.tiles as Record<string, unknown>)
        : null) ??
      (top.placements && typeof top.placements === 'object'
        ? (top.placements as Record<string, unknown>)
        : null) ??
      {};

    const extraRaw = Array.isArray(top.extraCopy) ? top.extraCopy : [];
    const copyPool = extraRaw
      .map((entry) => sanitize(entry))
      .filter((c): c is AdCopy => c !== null);

    const fb = fallbackDraft(prompt, brand, presetIds);
    const draft: CampaignDraft = {
      title: clampField(briefRaw.title, MAX_TITLE, fb.title),
      description: clampField(briefRaw.description, MAX_DESC, fb.description),
      goal: clampField(briefRaw.goal, MAX_FIELD, fb.goal),
      offer: clampField(briefRaw.offer, MAX_FIELD, fb.offer),
      audience: clampField(briefRaw.audience, MAX_FIELD, fb.audience),
      aesthetics: clampField(briefRaw.aesthetics, MAX_FIELD, fb.aesthetics),
      adCopy: {} as Record<PresetId, AdCopy>,
      copyPool,
    };
    const seed: BriefForPresets = {
      prompt,
      title: draft.title,
      description: draft.description,
      goal: draft.goal,
      offer: draft.offer,
      audience: draft.audience,
      aesthetics: draft.aesthetics,
    };
    let usableTileCount = 0;
    for (const id of presetIds) {
      const candidate = sanitize(tilesRaw[id]);
      if (candidate) usableTileCount++;
      draft.adCopy[id] = candidate ?? fallbackCopy(seed, brand ?? null, id);
    }

    // Detect "shape miss": LLM returned valid JSON but none of the fields we
    // asked for landed — treat it as unusable so the chain advances.
    const briefFilledCount = [
      briefRaw.title,
      briefRaw.description,
      briefRaw.goal,
      briefRaw.offer,
      briefRaw.audience,
      briefRaw.aesthetics,
    ].filter((v) => typeof v === 'string' && v.trim().length > 0).length;
    if (briefFilledCount === 0 && usableTileCount === 0) {
      console.warn(
        `[adCopy] ${model} returned JSON with no recognisable brief/tile fields. Parsed keys=`,
        Object.keys(top),
      );
      return { ok: false, reason: 'unrecognised_shape' };
    }

    return { ok: true, draft };
  }

  const models = resolveModels();
  const attempts: string[] = [];
  let lastErr: unknown = null;
  let lastReason = 'all_models_failed';

  // Walk the chain. For each model: try once; on transient errors retry with
  // backoff; on response_format-not-supported, retry the same model without JSON
  // mode (parseJson handles raw/prose output). A model that *succeeds* but yields
  // unusable output (empty / non-JSON / wrong shape) advances to the next model,
  // exactly like a hard error — so the whole chain is exhausted before we fall
  // back to the local template.
  for (const model of models) {
    attempts.push(model);
    let jsonMode = true;
    let triedNoJsonMode = false;
    let completion: Awaited<ReturnType<typeof callOne>> | null = null;

    // Per-model loop: handles retry-with-json-off + transient retry.
    // Bail to next model after at most 3 attempts per model.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        completion = await callOne(model, { jsonMode });
        break;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastErr = err;
        if (isJsonModeUnsupported(err) && !triedNoJsonMode) {
          console.warn(`[adCopy] ${model} rejected response_format — retrying without JSON mode`);
          jsonMode = false;
          triedNoJsonMode = true;
          continue;
        }
        if (isTransientError(err)) {
          console.warn(
            `[adCopy] transient error from ${model} (status=${(err as { status?: number }).status}) — retrying after 1.5s`,
          );
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn(`[adCopy] non-transient error from ${model} — advancing chain`, err);
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
    console.warn(`[adCopy] ${model} produced unusable output (${built.reason}) — advancing chain`);
    lastReason = built.reason;
  }

  console.error(
    `[adCopy] all ${models.length} models in chain failed/unusable. reason=${lastReason}`,
    lastErr,
  );
  return {
    draft: fallbackDraft(prompt, brand, presetIds),
    meta: { llm: 'fallback', attempts, reason: lastReason },
  };
}
