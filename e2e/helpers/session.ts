import { sealCookie } from '@civitai/app-sdk';

/**
 * Seal a fake-token `civ_session` cookie VALUE for the given app user id,
 * using SESSION_SECRET. Shared by global-setup (real-OAuth mode) and the
 * per-worker storageState fixture. MSW intercepts /api/v1/me + buzz on the
 * test server, so this mock token is never validated against Civitai.
 */
export function sealCivSession(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required to seal an e2e app session cookie.');
  }
  const session = {
    tokens: {
      access_token: 'e2e-mock-access-token',
      refresh_token: 'e2e-mock-refresh-token',
      token_type: 'Bearer',
      expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
      scope: 0xff,
    },
    user: { id: Number(userId), username: `e2e-tester-${userId}` },
  };
  return sealCookie(JSON.stringify(session), secret);
}
