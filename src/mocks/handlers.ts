import { HttpResponse, http } from 'msw';

/**
 * Civitai + scrape-target mock handlers used only when MOCK_CIVITAI=1.
 *
 * Targets (in priority order):
 *   - /api/v1/me                          — profile
 *   - /api/trpc/buzz.getBuzzAccount       — Buzz balance
 *   - /v2/consumer/workflows?whatif=true  — estimate
 *   - /v2/consumer/workflows              — submit
 *   - /v2/consumer/workflows/:id          — getWorkflow / pollWorkflow
 *   - /chat/completions                   — OpenRouter LLM draft (campaign + photoshoot)
 *   - https://example.com/                — scrape fixture (HTML + favicon)
 *
 * Hostnames are matched on path only (`*`), so the same handlers work
 * regardless of NEXT_PUBLIC_CIVITAI_BASE_URL / ORCHESTRATOR_URL env values.
 *
 * Step support (post generation-pipeline workstreams):
 *   - `imageGen` (engine `google`, model `nano-banana-2`) → N placeholder
 *     image URLs sized to `numImages`.
 *   - `imageUpscaler` → single upscaled image URL.
 *   - `videoGen` → image output stub + blob with mimeType `video/mp4`.
 *
 * GET /v2/consumer/workflows/:id progression: real submits flip status from
 * Processing → Succeeded after the first poll (legacy behaviour for the
 * polling spec). Submits keyed as `mock-imagegen-*`, `mock-upscale-*`, and
 * `mock-video-*` track their own poll counters so e2e specs can observe a
 * believable pending → processing → succeeded progression.
 */

const SCRAPE_FIXTURE_HTML = `<!doctype html>
<html>
<head>
  <title>Acme Brews — Small-Batch Cold Coffee</title>
  <meta name="description" content="Default description from name tag." />
  <meta property="og:site_name" content="Acme Brews" />
  <meta property="og:description" content="Cold-brew coffee made small-batch in Brooklyn. Sold honest, drunk slow." />
  <meta property="og:image" content="/og-cover.png" />
  <meta name="theme-color" content="#ff7849" />
  <link rel="icon" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700&display=swap" />
  <style>
    :root { --primary: #ff7849; --ink: #1c4f29; --accent: #7C5CFF; --warm: #ffd13d; }
    body { color: rgb(28, 79, 41); background: #fafafa; font-family: 'Bricolage Grotesque', sans-serif; }
  </style>
</head>
<body><h1>Acme Brews</h1></body>
</html>`;

const NOW = () => new Date().toISOString();

let nextWorkflowSeq = 1;

/** What was submitted, so polls can replay the correct shape per workflow. */
type WorkflowKind = 'imageGen' | 'imageUpscaler' | 'videoGen' | 'textToImage';
type StoredWorkflow = {
  createdAt: number;
  pollCount: number;
  status: string;
  kind: WorkflowKind;
  numImages: number;
  cost: number;
};

const workflowStore = new Map<string, StoredWorkflow>();

/**
 * Test-only escape hatch — drops the in-memory progression map so a fresh
 * spec run starts with no carried-over state. Currently called via the
 * `__mockReset` global hook below if tests need it.
 */
export function __resetMockState(): void {
  nextWorkflowSeq = 1;
  workflowStore.clear();
}

function fakeWorkflowId(kind: WorkflowKind): string {
  const prefix =
    kind === 'imageGen'
      ? 'mock-imagegen'
      : kind === 'imageUpscaler'
        ? 'mock-upscale'
        : kind === 'videoGen'
          ? 'mock-video'
          : 'mock-wf';
  return `${prefix}-${nextWorkflowSeq++}-${Math.random().toString(36).slice(2, 8)}`;
}

type SubmittedStep = {
  $type?: string;
  input?: {
    engine?: string;
    model?: string;
    numImages?: number;
    prompt?: string;
    images?: string[];
    [k: string]: unknown;
  };
};

type SubmittedBody = {
  steps?: SubmittedStep[];
};

function classifySubmit(body: SubmittedBody): { kind: WorkflowKind; numImages: number } {
  const step = body.steps?.[0];
  const $type = String(step?.$type ?? '').toLowerCase();
  if ($type === 'imagegen') {
    const n = Number(step?.input?.numImages ?? 1);
    return {
      kind: 'imageGen',
      numImages: Number.isFinite(n) && n > 0 ? Math.min(8, Math.floor(n)) : 1,
    };
  }
  if ($type === 'imageupscaler') return { kind: 'imageUpscaler', numImages: 1 };
  if ($type === 'videogen') return { kind: 'videoGen', numImages: 1 };
  // Legacy textToImage path — kept for back-compat with any code we haven't
  // migrated yet.
  return { kind: 'textToImage', numImages: 1 };
}

function costFor(kind: WorkflowKind, numImages: number): number {
  // Deterministic, believable costs. Upscale + video are 5-20× base per the
  // plan; we pick the lower bound to keep totals predictable for assertions.
  if (kind === 'imageUpscaler') return 200;
  if (kind === 'videoGen') return 500;
  return 60 * numImages;
}

function buildStepOutput(
  workflowId: string,
  kind: WorkflowKind,
  numImages: number,
  succeeded: boolean,
): Record<string, unknown> | undefined {
  if (!succeeded) return undefined;
  if (kind === 'videoGen') {
    return {
      images: [
        {
          url: `https://image.mock/${workflowId}/poster.png`,
          width: 1024,
          height: 1024,
          available: true,
        },
      ],
      blobs: [
        {
          url: `https://image.mock/${workflowId}/clip.mp4`,
          mimeType: 'video/mp4',
          type: 'video',
        },
      ],
    };
  }
  if (kind === 'imageUpscaler') {
    return {
      images: [
        {
          url: `https://image.mock/${workflowId}/upscaled.png`,
          width: 2048,
          height: 2048,
          available: true,
        },
      ],
    };
  }
  const images = Array.from({ length: numImages }).map((_, i) => ({
    url: `https://image.mock/${workflowId}/${i}.png`,
    width: 1024,
    height: 1024,
    available: true,
  }));
  return { images };
}

function snapshotFor(workflowId: string, statusOverride?: string): Record<string, unknown> {
  const meta = workflowStore.get(workflowId);
  // Unknown ids (e.g. whatif scratch ids that we never persisted): treat as
  // a succeeded single-image imageGen so any stale callers still get a
  // sensible shape.
  const kind = meta?.kind ?? 'imageGen';
  const numImages = meta?.numImages ?? 1;
  const cost = meta?.cost ?? costFor(kind, numImages);
  const status = statusOverride ?? meta?.status ?? 'succeeded';
  const succeeded = status.toLowerCase().includes('succeed') || status.toLowerCase() === 'done';
  return {
    id: workflowId,
    status,
    cost: { total: cost, currency: 'BUZZ' },
    createdAt: meta ? new Date(meta.createdAt).toISOString() : NOW(),
    updatedAt: NOW(),
    steps: [
      {
        $type: kind,
        status,
        output: buildStepOutput(workflowId, kind, numImages, succeeded),
      },
    ],
  };
}

function statusAfterPoll(meta: StoredWorkflow): string {
  // Legacy progression for ids we created before this change: based on
  // wall-clock as before so the existing pollWorkflow spec still observes
  // the cooking → done transition without relying on poll count.
  meta.pollCount += 1;
  if (meta.kind === 'textToImage') {
    if (Date.now() - meta.createdAt > 200) return 'succeeded';
    return meta.status;
  }
  // imageGen / imageUpscaler / videoGen — deterministic per-poll progression
  // so long-poll e2e tests observe pending → processing → succeeded.
  // Statuses are lowercase to match the SDK's `TERMINAL_STATUSES` contract
  // (`isTerminal` uses strict-case `.includes()`).
  if (meta.pollCount === 1) return 'pending';
  if (meta.pollCount === 2) return 'processing';
  return 'succeeded';
}

export const handlers = [
  http.get('*/api/v1/me', () =>
    HttpResponse.json({
      id: 1,
      username: 'e2e-tester',
      email: 'e2e-tester@example.com',
      tier: 'free',
    }),
  ),

  http.get('*/api/trpc/buzz.getBuzzAccount', () =>
    HttpResponse.json({
      result: {
        data: {
          json: { yellow: 100_000, blue: 0, green: 0 },
        },
      },
    }),
  ),

  http.post('*/v2/consumer/workflows', async ({ request }) => {
    const url = new URL(request.url);
    const whatif = url.searchParams.get('whatif') === 'true';
    let body: SubmittedBody = {};
    try {
      body = (await request.clone().json()) as SubmittedBody;
    } catch {
      // Ignore — empty body just classifies as textToImage default.
    }
    const { kind, numImages } = classifySubmit(body);
    const cost = costFor(kind, numImages);

    if (whatif) {
      // Estimate (whatif=true): cost only, no images, no persistence.
      const id = `whatif-${nextWorkflowSeq++}`;
      return HttpResponse.json({
        id,
        status: 'WhatIf',
        cost: { total: cost, currency: 'BUZZ' },
        createdAt: NOW(),
        updatedAt: NOW(),
        steps: [{ $type: kind, status: 'WhatIf', output: undefined }],
      });
    }

    const id = fakeWorkflowId(kind);
    workflowStore.set(id, {
      createdAt: Date.now(),
      pollCount: 0,
      status: 'processing',
      kind,
      numImages,
      cost,
    });
    // Submit response — initial snapshot pre-polls. Status = processing,
    // no output yet. Tests will hit the GET handler to drive progression.
    return HttpResponse.json(snapshotFor(id, 'processing'));
  }),

  http.get('*/v2/consumer/workflows/:id', ({ params }) => {
    const id = String(params.id ?? '');
    const meta = workflowStore.get(id);
    if (meta) {
      meta.status = statusAfterPoll(meta);
    }
    return HttpResponse.json(snapshotFor(id, meta?.status));
  }),

  // OpenRouter chat completions — the LLM "draft" step (campaigns + photoshoot)
  // calls this. Return a single JSON `content` blob carrying BOTH shapes:
  //   - photoshoot draft: { title, prompt, templateIds }
  //   - campaign draft:   { brief, tiles }
  // Each parser ignores the keys it doesn't recognise, so one deterministic
  // response serves both flows under MOCK_CIVITAI=1.
  http.post('*/chat/completions', () => {
    const content = JSON.stringify({
      title: 'Mock Shoot',
      prompt: 'studio shot of the product, clean lighting',
      templateIds: ['studio-clean', 'lifestyle-handheld'],
      brief: {
        title: 'Mock Campaign',
        description: 'A deterministic mock campaign brief for e2e.',
        goal: 'drive online sales',
        offer: '2-for-1, online only',
        audience: 'deal-hunting online shoppers, 25–45',
        aesthetics: 'clean studio look, high contrast',
      },
      tiles: {},
    });
    return HttpResponse.json({ choices: [{ message: { content } }] });
  }),

  // Scrape target — covers `example.com` so the onboarding scrape spec
  // exercises the real POST /api/onboarding/scrape route without weakening
  // the SSRF DNS check (example.com is publicly resolvable).
  http.get('https://example.com/', () =>
    HttpResponse.html(SCRAPE_FIXTURE_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
  ),

  // Orchestrator output blobs — return a 1×1 transparent PNG so the
  // ad-hoc save flow (`mirrorOrchestratorImage` → fetch + S3 put) actually
  // succeeds end-to-end in e2e. PascalCase URLs (above) point here.
  http.get('https://image.mock/*', () => {
    // 1×1 transparent PNG (smallest valid PNG, 67 bytes).
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x48, 0xaf, 0xa4, 0x71, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return new HttpResponse(pngBytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  }),
];
