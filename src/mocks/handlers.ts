import { HttpResponse, http } from 'msw';

/**
 * Civitai + scrape-target mock handlers used only when MOCK_CIVITAI=1.
 *
 * Targets (in priority order):
 *   - /api/v1/me                          — profile
 *   - /api/trpc/buzz.getUserAccount       — Buzz balance
 *   - /v2/consumer/workflows?whatif=true  — estimate
 *   - /v2/consumer/workflows              — submit
 *   - /v2/consumer/workflows/:id          — getWorkflow / pollWorkflow
 *   - https://example.com/                — scrape fixture (HTML + favicon)
 *
 * Hostnames are matched on path only (`*`), so the same handlers work
 * regardless of CIVITAI_BASE_URL / ORCHESTRATOR_URL env values.
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
const workflowStore = new Map<string, { createdAt: number; status: string }>();

function fakeWorkflowId(): string {
  return `mock-wf-${nextWorkflowSeq++}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapshotFor(id: string, status: string) {
  const meta = workflowStore.get(id);
  return {
    id,
    status,
    cost: { total: 60, currency: 'BUZZ' },
    createdAt: meta ? new Date(meta.createdAt).toISOString() : NOW(),
    updatedAt: NOW(),
    steps: [
      {
        $type: 'textToImage',
        status,
        output: status === 'Succeeded'
          ? {
              images: [
                {
                  url: `https://mock.example/${id}/image-0.png`,
                  width: 1024,
                  height: 1024,
                },
              ],
            }
          : undefined,
      },
    ],
  };
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

  http.get('*/api/trpc/buzz.getUserAccount', () =>
    HttpResponse.json({
      result: {
        data: {
          json: [
            {
              accountType: 'user',
              type: 'yellow',
              balance: 100_000,
              lifetimeBalance: 100_000,
            },
          ],
        },
      },
    }),
  ),

  http.post('*/v2/consumer/workflows', ({ request }) => {
    const url = new URL(request.url);
    const whatif = url.searchParams.get('whatif') === 'true';
    const id = whatif ? `whatif-${nextWorkflowSeq++}` : fakeWorkflowId();
    if (!whatif) workflowStore.set(id, { createdAt: Date.now(), status: 'Processing' });
    return HttpResponse.json(snapshotFor(id, whatif ? 'WhatIf' : 'Processing'));
  }),

  http.get('*/v2/consumer/workflows/:id', ({ params }) => {
    const id = String(params.id ?? '');
    const meta = workflowStore.get(id);
    // Mark workflows done on first poll after a short grace window so the
    // polling spec can observe both the "cooking" and "done" branches.
    if (meta && Date.now() - meta.createdAt > 200) meta.status = 'Succeeded';
    const status = meta?.status ?? 'Succeeded';
    return HttpResponse.json(snapshotFor(id, status));
  }),

  // Scrape target — covers `example.com` so the onboarding scrape spec
  // exercises the real POST /api/onboarding/scrape route without weakening
  // the SSRF DNS check (example.com is publicly resolvable).
  http.get('https://example.com/', () =>
    HttpResponse.html(SCRAPE_FIXTURE_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
  ),
];
