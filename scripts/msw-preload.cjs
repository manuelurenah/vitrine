/* eslint-disable @typescript-eslint/no-require-imports */
// Preload that starts MSW BEFORE Next.js loads, so MSW patches globalThis.fetch
// before Next's patch-fetch (server/lib/patch-fetch.js) captures the original
// fetch reference. Without this, route-handler SDK calls use Next's captured
// pre-MSW fetch and escape interception (hit live Civitai/orchestrator).
//
// Loaded via NODE_OPTIONS="--require tsx/cjs --require .../scripts/msw-preload.cjs"
// in scripts/test-server.mjs (test only). tsx/cjs lets us require the TS handlers.
if (process.env.MOCK_CIVITAI === '1' && !globalThis.__vitrineMswStarted) {
  require('tsx/cjs'); // register TS require hook so we can load the .ts handlers
  const { handlers } = require('../src/mocks/handlers.ts');
  const { setupServer } = require('msw/node');
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'bypass' });
  globalThis.__vitrineMswStarted = true;
  console.log('[msw][preload] node interceptor started before Next bootstrap');
}
