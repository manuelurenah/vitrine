import { buildAuthorizeUrl, generatePkce, generateState } from '@civitai/app-sdk';
import { type NextRequest, NextResponse } from 'next/server';
import { env, REDIRECT_URI } from '@/lib/env';
import { clientIp } from '@/lib/rateLimit';
import { rateLimitOr429 } from '@/lib/rateLimitGuard';
import { REQUESTED_SCOPES } from '@/lib/scopes';
import { setOAuthState } from '@/lib/session';

export async function POST(req: NextRequest) {
  // Pre-auth: key by client IP so one host can't spam OAuth-state cookies /
  // redirects. Generous enough for legitimate retries.
  const limited = await rateLimitOr429(`login:${clientIp(req)}`, 15, 60);
  if (limited) return limited;

  const pkce = generatePkce();
  const state = generateState();

  await setOAuthState({
    state,
    verifier: pkce.verifier,
    scope: REQUESTED_SCOPES,
  });

  const authorizeUrl = buildAuthorizeUrl({
    baseUrl: env.NEXT_PUBLIC_CIVITAI_BASE_URL,
    clientId: env.CIVITAI_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scope: REQUESTED_SCOPES,
    state,
    codeChallenge: pkce.challenge,
  });

  return NextResponse.redirect(authorizeUrl, { status: 303 });
}
