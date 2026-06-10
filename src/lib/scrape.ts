import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type ScrapeResult = {
  finalUrl: string;
  brandName: string | null;
  description: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  palette: string[];
  font: string | null;
};

export class ScrapeError extends Error {
  code: ScrapeErrorCode;
  constructor(code: ScrapeErrorCode, message: string) {
    super(message);
    this.name = 'ScrapeError';
    this.code = code;
  }
}

export type ScrapeErrorCode =
  | 'invalid_url'
  | 'blocked_host'
  | 'request_failed'
  | 'response_too_large'
  | 'not_html'
  | 'timeout';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 750_000;
const MAX_REDIRECTS = 3;
const MAX_STYLESHEETS = 3;
const STYLESHEET_MAX_BYTES = 300_000;
const STYLESHEET_TIMEOUT_MS = 5_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; VitrineBot/1.0; +https://vitrine.civitai.com)';

export async function scrapeSite(input: string): Promise<ScrapeResult> {
  const url = normalizeUrl(input);
  await assertPublicHost(url.hostname);

  const { html, finalUrl } = await fetchHtml(url);
  const base = new URL(finalUrl);

  // SPA sites (Next.js, Vite, Astro) put brand colors in linked stylesheets,
  // not inline. Fetch a few same-origin sheets and scan them too, otherwise
  // the palette is dominated by Tailwind grays or random Open Graph CSS.
  const stylesheetCss = await fetchStylesheetText(html, base);
  const paletteSource = stylesheetCss ? `${html}\n${stylesheetCss}` : html;

  return {
    finalUrl,
    brandName: pickBrandName(html, base.hostname),
    description: pickDescription(html),
    logoUrl: pickLogoUrl(html, base),
    themeColor: pickThemeColor(html),
    palette: pickPalette(paletteSource),
    font: pickFont(html, paletteSource),
  };
}

export function normalizeUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new ScrapeError('invalid_url', 'empty url');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) {
    throw new ScrapeError('invalid_url', `unsupported protocol in ${input}`);
  }
  const withProto = hasScheme ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new ScrapeError('invalid_url', `could not parse ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScrapeError('invalid_url', `unsupported protocol ${url.protocol}`);
  }
  return url;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map((n) => Number(n));
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('ff')) return true; // multicast
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice(7);
      if (isIP(v4) === 4) return isPrivateIp(v4);
    }
    return false;
  }
  return true; // unknown is treated as unsafe
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (!hostname) throw new ScrapeError('blocked_host', 'missing host');
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    throw new ScrapeError('blocked_host', 'localhost is not allowed');
  }
  if (lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new ScrapeError('blocked_host', `${hostname} is not allowed`);
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new ScrapeError('blocked_host', `${hostname} is private`);
    return;
  }
  let resolved: { address: string }[];
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new ScrapeError('blocked_host', `could not resolve ${hostname}`);
  }
  if (resolved.length === 0) {
    throw new ScrapeError('blocked_host', `no DNS records for ${hostname}`);
  }
  for (const r of resolved) {
    if (isPrivateIp(r.address)) {
      throw new ScrapeError('blocked_host', `${hostname} resolves to private IP`);
    }
  }
}

async function fetchHtml(url: URL): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = url;
    let redirects = 0;
    while (true) {
      const res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc)
          throw new ScrapeError('request_failed', `redirect without location (${res.status})`);
        if (++redirects > MAX_REDIRECTS) {
          throw new ScrapeError('request_failed', 'too many redirects');
        }
        const next = new URL(loc, current);
        await assertPublicHost(next.hostname);
        current = next;
        continue;
      }
      if (!res.ok) {
        throw new ScrapeError('request_failed', `upstream returned ${res.status}`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml/i.test(ct)) {
        throw new ScrapeError('not_html', `content-type was ${ct || 'unknown'}`);
      }
      const html = await readBodyCapped(res, MAX_BYTES);
      return { html, finalUrl: current.toString() };
    }
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ScrapeError('timeout', `request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new ScrapeError('request_failed', err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStylesheetText(html: string, base: URL): Promise<string> {
  const urls = collectStylesheetUrls(html, base).slice(0, MAX_STYLESHEETS);
  if (urls.length === 0) return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STYLESHEET_TIMEOUT_MS);
  try {
    const settled = await Promise.allSettled(
      urls.map((u) => fetchOneStylesheet(u, controller.signal)),
    );
    return settled
      .map((r) => (r.status === 'fulfilled' ? r.value : ''))
      .filter(Boolean)
      .join('\n');
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOneStylesheet(url: URL, signal: AbortSignal): Promise<string> {
  try {
    await assertPublicHost(url.hostname);
  } catch {
    return ''; // skip silently — palette is best-effort, never block the page scrape on a bad CSS host
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/css,*/*;q=0.1',
      },
    });
  } catch {
    return '';
  }
  if (!res.ok) return '';
  const ct = res.headers.get('content-type') ?? '';
  if (ct && !/text\/css|text\/plain|application\/octet-stream/i.test(ct)) return '';
  try {
    return await readBodyCapped(res, STYLESHEET_MAX_BYTES);
  } catch {
    return '';
  }
}

function collectStylesheetUrls(html: string, base: URL): URL[] {
  const out: URL[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(LINK_RE)) {
    const tag = m[0];
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (!rel.includes('stylesheet')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
    // Only follow same-host stylesheets — keeps SSRF blast radius the same
    // as the primary fetch and avoids burning bandwidth on CDN tracking CSS.
    if (abs.hostname !== base.hostname) continue;
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(abs);
  }
  return out;
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new ScrapeError('response_too_large', `response exceeded ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    combined.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

const META_RE = /<meta\b[^>]*>/gi;
const LINK_RE = /<link\b[^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
const RGB_RE = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi;

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = re.exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function clean(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

export function pickBrandName(html: string, hostname: string): string | null {
  const meta = readMetaContent(html, [
    'og:site_name',
    'application-name',
    'apple-mobile-web-app-title',
  ]);
  if (meta) return clean(meta);
  const title = TITLE_RE.exec(html)?.[1];
  if (title) {
    const t = clean(title);
    const head = t.split(/\s+[|·—–-]\s+/)[0];
    if (head) return head;
  }
  return hostname.replace(/^www\./i, '') || null;
}

export function pickDescription(html: string): string | null {
  const desc = readMetaContent(html, ['og:description', 'twitter:description', 'description']);
  if (!desc) return null;
  const c = clean(desc);
  return c.length > 0 ? c.slice(0, 600) : null;
}

export function pickThemeColor(html: string): string | null {
  const c = readMetaContent(html, ['theme-color']);
  if (!c) return null;
  const hex = normalizeColor(c);
  return hex;
}

export function pickLogoUrl(html: string, base: URL): string | null {
  const candidates: { href: string; rank: number }[] = [];
  for (const m of html.matchAll(LINK_RE)) {
    const tag = m[0];
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (!rel) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    if (rel.includes('apple-touch-icon')) candidates.push({ href, rank: 1 });
    else if (rel.includes('icon') && !rel.includes('mask-icon')) candidates.push({ href, rank: 2 });
    else if (rel.includes('mask-icon')) candidates.push({ href, rank: 4 });
  }
  const og = readMetaContent(html, ['og:image', 'twitter:image']);
  if (og) candidates.push({ href: og, rank: 3 });

  candidates.sort((a, b) => a.rank - b.rank);
  for (const c of candidates) {
    try {
      return new URL(c.href, base).toString();
    } catch {
      // skip
    }
  }
  try {
    return new URL('/favicon.ico', base).toString();
  } catch {
    return null;
  }
}

export function pickPalette(text: string): string[] {
  const counts = new Map<string, number>();

  for (const m of text.matchAll(HEX_RE)) {
    const hex = `#${m[1]!.toLowerCase()}`;
    if (isSkippableColor(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  for (const m of text.matchAll(RGB_RE)) {
    const hex = rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
    if (isSkippableColor(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  // Theme color is the brand's explicit signal — push it to the top even on
  // sites where the CSS bundle drowns the HTML mention.
  const theme = pickThemeColor(text);
  if (theme && !isSkippableColor(theme)) {
    counts.set(theme, (counts.get(theme) ?? 0) + 10_000);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);
}

function readMetaContent(html: string, names: string[]): string | null {
  const byName = new Map<string, string>();
  for (const m of html.matchAll(META_RE)) {
    const tag = m[0];
    const name = (
      attr(tag, 'name') ??
      attr(tag, 'property') ??
      attr(tag, 'itemprop') ??
      ''
    ).toLowerCase();
    if (!name) continue;
    if (byName.has(name)) continue;
    const content = attr(tag, 'content');
    if (content) byName.set(name, content);
  }
  for (const n of names) {
    const hit = byName.get(n.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function normalizeColor(c: string): string | null {
  const t = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(t);
  if (rgb) return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Generic CSS font keywords + system-stack defaults that should never be
// reported as a brand font.
const SYSTEM_FONT_TOKENS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'inherit',
  'initial',
  'unset',
  'revert',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'helvetica',
  'helvetica neue',
  'arial',
  'roboto',
  'apple color emoji',
  'segoe ui emoji',
  'segoe ui symbol',
  'noto color emoji',
  'liberation sans',
  'sans',
  'tahoma',
  'verdana',
  'georgia',
  'times',
  'times new roman',
  'courier',
  'courier new',
  'menlo',
  'monaco',
  'consolas',
  'liberation mono',
  'emoji',
]);

const FONT_FAMILY_RE = /font-family\s*:\s*([^;}\n{]+)/gi;
const GOOGLE_FONTS_HREF_RE = /https?:\/\/fonts\.googleapis\.com\/css2?[^"'\s>]+/gi;

export function pickFont(html: string, cssText: string): string | null {
  // Strongest signal: a Google Fonts <link> tells us the brand's chosen
  // typeface explicitly. If present, take the first `family=` value.
  for (const m of html.matchAll(GOOGLE_FONTS_HREF_RE)) {
    const href = m[0];
    const queryStart = href.indexOf('?');
    if (queryStart === -1) continue;
    const params = new URLSearchParams(href.slice(queryStart + 1));
    const families = params.getAll('family');
    for (const fam of families) {
      const name = fam.split(':')[0]?.replace(/\+/g, ' ').trim();
      if (name && !SYSTEM_FONT_TOKENS.has(name.toLowerCase())) return name;
    }
  }

  // Otherwise count font-family declarations and return the most-used
  // non-system name.
  const counts = new Map<string, number>();
  const source = `${html}\n${cssText}`;
  for (const m of source.matchAll(FONT_FAMILY_RE)) {
    const value = m[1] ?? '';
    for (const raw of value.split(',')) {
      const cleaned = raw
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim();
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (SYSTEM_FONT_TOKENS.has(lower)) continue;
      // Skip CSS variables — they reference unresolved values.
      if (cleaned.startsWith('var(')) continue;
      // Skip generic patterns like `_font_abc123` from CSS-in-JS hashes.
      if (/^_+/.test(cleaned)) continue;
      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
  }

  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best ? best[0] : null;
}

function isSkippableColor(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/.test(hex)) return true;
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // HSL-based filter — drops grays (low saturation) and the extremes of the
  // lightness axis, but keeps saturated brand colors at any lightness. The
  // previous channel-by-channel cutoffs accidentally filtered dark navy
  // brand colors like #0c1929 because all channels were under 24.
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (lightness < 0.04) return true; // near-black
  if (lightness > 0.96) return true; // near-white
  if (saturation < 0.14) return true; // near-gray / Tailwind neutral utilities
  return false;
}
