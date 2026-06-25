import {
  buildSetCookieHeader,
  type OAuthTokens,
  refreshToken as oauthRefresh,
  sealCookie,
  unsealCookie,
} from '@civitai/app-sdk';
import { cookies } from 'next/headers';
import 'server-only';
import { env } from './env';

const SESSION_COOKIE = 'civ_session';
const OAUTH_STATE_COOKIE = 'civ_oauth_state';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — bound by refresh-token TTL on Civitai
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export interface Session {
  tokens: OAuthTokens;
  /** Cached user info from /api/v1/me — refreshed lazily. */
  user?: { id?: number; username?: string };
}

export interface OAuthStateCookie {
  state: string;
  verifier: string;
  scope: number;
}

/**
 * Load the current session from the sealed cookie. Returns null if not logged
 * in or if the cookie failed to decrypt (tampered / wrong secret / expired).
 *
 * If the access token is past expiry but a refresh token is present, this
 * function automatically refreshes and writes the new session back.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const sealed = jar.get(SESSION_COOKIE)?.value;
  if (!sealed) return null;

  const raw = unsealCookie(sealed, env.SESSION_SECRET);
  if (!raw) return null;

  let session: Session;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }

  // Token still valid? Done.
  if (session.tokens.expires_at > Date.now() + 30_000) return session;

  // Try to refresh.
  if (!session.tokens.refresh_token) return null;
  return refreshAndPersist(session);
}

/**
 * Merge a refreshed token set onto the previous one. Civitai may issue a fresh
 * `refresh_token` (rotation) or omit it; when omitted we carry the previous one
 * forward so the next refresh still has a usable token.
 */
export function mergeRefreshedTokens(prev: OAuthTokens, fresh: OAuthTokens): OAuthTokens {
  return { ...fresh, refresh_token: fresh.refresh_token ?? prev.refresh_token };
}

/**
 * Single-flight refresh dedupe. Civitai issues single-use refresh tokens, so two
 * concurrent renders racing the same token would burn it (one wins, the other's
 * old token is dead). Keyed by the refresh token so concurrent callers share one
 * in-flight promise. In-process only — across separate serverless invocations
 * this can't help; the client keep-alive is what keeps RSC reads from ever
 * seeing expiry in practice.
 */
const inflight = new Map<string, Promise<Session | null>>();

async function refreshAndPersist(session: Session): Promise<Session | null> {
  const key = session.tokens.refresh_token;
  if (!key) return null;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async (): Promise<Session | null> => {
    try {
      const fresh = await oauthRefresh({
        baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL,
        clientId: env.CIVITAI_CLIENT_ID,
        clientSecret: env.CIVITAI_CLIENT_SECRET,
        refreshToken: key,
      });
      const next: Session = { ...session, tokens: mergeRefreshedTokens(session.tokens, fresh) };
      await setSession(next);
      return next;
    } catch {
      await clearSession();
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Shared cookie attrs — httpOnly + lax + secure-in-prod for every cookie we set. */
async function writeCookie(name: string, value: string, maxAge: number): Promise<void> {
  const jar = await cookies();
  try {
    jar.set({
      name,
      value,
      maxAge,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  } catch (err) {
    // Next 16 throws when cookies are mutated outside a Server Action / Route
    // Handler (e.g. from a Server Component reading getSession() and hitting
    // the refresh-failure → clearSession path). The read still works; the
    // cookie just survives until the user's next route handler hits.
    // Surfacing the throw would 500 the page render — silently absorb so the
    // RSC treats the user as logged-out and renders the login screen.
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Cookies can only be modified')) return;
    throw err;
  }
}

export async function setSession(session: Session): Promise<void> {
  const sealed = sealCookie(JSON.stringify(session), env.SESSION_SECRET);
  await writeCookie(SESSION_COOKIE, sealed, SESSION_MAX_AGE_SECONDS);
}

export async function clearSession(): Promise<void> {
  await writeCookie(SESSION_COOKIE, '', 0);
}

export async function setOAuthState(payload: OAuthStateCookie): Promise<void> {
  const sealed = sealCookie(JSON.stringify(payload), env.SESSION_SECRET);
  await writeCookie(OAUTH_STATE_COOKIE, sealed, OAUTH_STATE_MAX_AGE_SECONDS);
}

export async function consumeOAuthState(): Promise<OAuthStateCookie | null> {
  const jar = await cookies();
  const sealed = jar.get(OAUTH_STATE_COOKIE)?.value;
  await writeCookie(OAUTH_STATE_COOKIE, '', 0);
  if (!sealed) return null;
  const raw = unsealCookie(sealed, env.SESSION_SECRET);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Re-export for routes that need to construct Set-Cookie headers directly. */
export { buildSetCookieHeader };
