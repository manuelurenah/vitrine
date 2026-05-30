/**
 * Next.js runs this at process boot before any route handlers. We use it
 * to opt into MSW node-level fetch interception when running under e2e —
 * gated on MOCK_CIVITAI=1 so prod/dev paths are unaffected.
 */
export async function register(): Promise<void> {
  if (process.env.MOCK_CIVITAI !== '1') return;
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { server } = await import('./mocks/node');
  server.listen({ onUnhandledRequest: 'bypass' });
  console.log('[msw] node interceptor started — Civitai + orchestrator calls are mocked');
}
