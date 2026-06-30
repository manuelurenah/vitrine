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
