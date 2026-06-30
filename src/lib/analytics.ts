/**
 * Shared analytics types (client + server safe — no `server-only`, no faro/db
 * imports). The client `track()` lives below; the server `recordEvent()` lives
 * in `analytics.server.ts` and imports these types only.
 */
export type AnalyticsEvent =
  | 'login_succeeded'
  | 'onboarding_step_viewed'
  | 'onboarding_completed'
  | 'brand_dna_saved'
  | 'campaign_cook_submitted'
  | 'tile_regenerated'
  | 'campaign_exported'
  | 'photoshoot_cook_submitted';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

// @ts-ignore — faro-web-sdk types are available at runtime but TypeScript module resolution doesn't pick them up in pnpm virtual store
import { faro } from '@grafana/faro-web-sdk';

/**
 * Client-side product-analytics emit. Dual-writes: Faro `pushEvent` (realtime
 * → Loki) + `POST /api/track` (durable Postgres). Best-effort and synchronous
 * to call — never throws, never blocks the UI. Identity is attached
 * server-side in `/api/track`; we only pass the Faro session id for correlation.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  let sessionId: string | null = null;
  try {
    faro.api?.pushEvent(event, props);
    sessionId = faro.api?.getSession()?.id ?? null;
  } catch {
    // faro not initialized (telemetry off) — skip the realtime copy.
  }
  // Durable copy. Fire-and-forget; swallow network errors.
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, props: props ?? {}, sessionId }),
  }).catch(() => {});
}
