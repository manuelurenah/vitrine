/**
 * App-side sign-in helper.
 *
 * Most specs rely on the pre-sealed `civ_session` cookie that global-setup
 * injects, so this helper simply visits `/` and waits for the server-side
 * onboarding/campaigns gate to redirect into the app shell.
 *
 * For the OAuth spec (which clears the injected cookie to exercise the real
 * flow), pass `{ realOAuth: true }`.
 */

import type { Page } from '@playwright/test';

const APP_SHELL = /\/(onboarding\/[a-z]+|campaigns)/;
const POST_OAUTH = /\/(onboarding\/[a-z]+|campaigns|login\/oauth\/authorize)/;

export type SignInOpts = { realOAuth?: boolean };

export async function signInToApp(
  page: Page,
  baseURL: string,
  opts: SignInOpts = {},
): Promise<void> {
  await page.goto(baseURL);

  if (APP_SHELL.test(page.url())) return;

  if (!opts.realOAuth) {
    // With the injected cookie, the root page should server-redirect into
    // the shell. If we're still on `/`, the injection is broken — fail loud.
    await page.waitForURL(APP_SHELL, { timeout: 15_000 });
    return;
  }

  const ssoBtn = page.getByRole('button', { name: /continue with Civitai/i });
  await ssoBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await ssoBtn.click();
  await page.waitForURL(POST_OAUTH, { timeout: 30_000 });

  if (page.url().includes('/login/oauth/authorize')) {
    const approveBtn = page
      .getByRole('button', { name: /^(allow|authorize|approve|continue)$/i })
      .first();
    await approveBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await approveBtn.click();
    await page.waitForURL(APP_SHELL, { timeout: 30_000 });
  }
}
