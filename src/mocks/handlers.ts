import { HttpResponse, http } from 'msw';

/**
 * Civitai mock handlers used only when MOCK_CIVITAI=1.
 *
 * Targets (in priority order):
 *   - /api/v1/me                          — profile
 *   - /api/trpc/buzz.getUserAccount       — Buzz balance
 *   - /v2/consumer/workflows?whatif=true  — estimate
 *   - /v2/consumer/workflows              — submit
 *   - /v2/consumer/workflows/:id          — getWorkflow / pollWorkflow
 *
 * Hostnames are matched on path only (`*`), so the same handlers work
 * regardless of CIVITAI_BASE_URL / ORCHESTRATOR_URL env values.
 */

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
];
