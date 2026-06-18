import { describe, expect, it } from 'vitest';
import {
  assertAddressesPublic,
  isPrivateIp,
  normalizeUrl,
  pickBrandName,
  pickDescription,
  pickFont,
  pickLogoUrl,
  pickPalette,
  pickThemeColor,
} from './scrape';

describe('normalizeUrl', () => {
  it('adds https when missing', () => {
    expect(normalizeUrl('example.com').toString()).toBe('https://example.com/');
  });
  it('keeps http when explicit', () => {
    expect(normalizeUrl('http://example.com').protocol).toBe('http:');
  });
  it('rejects non-http(s) protocols', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow(/protocol/);
  });
  it('rejects empty', () => {
    expect(() => normalizeUrl('   ')).toThrow(/empty/);
  });
});

describe('isPrivateIp', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.0.0.1', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['169.254.0.1', true],
    ['224.0.0.1', true],
    ['0.0.0.0', true],
    // 100.64.0.0/10 — carrier-grade NAT / shared address space (used by some
    // cloud/k8s internal networks).
    ['100.64.0.1', true],
    ['100.127.255.255', true],
    ['100.63.255.255', false],
    ['100.128.0.1', false],
    // 192.0.0.0/24 — IETF protocol assignments.
    ['192.0.0.1', true],
    ['192.0.1.1', false],
    // 198.18.0.0/15 — benchmarking range.
    ['198.18.0.1', true],
    ['198.19.255.255', true],
    ['198.20.0.1', false],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['::1', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['fd00::1', true],
    ['::ffff:127.0.0.1', true],
    ['2001:4860:4860::8888', false],
    ['not-an-ip', true],
  ])('private(%s) = %s', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

describe('assertAddressesPublic', () => {
  it('passes when every resolved address is public', () => {
    expect(() =>
      assertAddressesPublic('cdn.example.com', [{ address: '8.8.8.8' }, { address: '1.1.1.1' }]),
    ).not.toThrow();
  });

  it('throws when any resolved address is private (rebinding / split-horizon)', () => {
    expect(() =>
      assertAddressesPublic('evil.example.com', [
        { address: '8.8.8.8' },
        { address: '169.254.169.254' },
      ]),
    ).toThrow(/private/);
  });

  it('throws when there are no resolved addresses', () => {
    expect(() => assertAddressesPublic('nowhere.example.com', [])).toThrow();
  });
});

const HTML_FIXTURE = `<!doctype html>
<html>
<head>
  <title>Lumen Skincare — Honest Glow</title>
  <meta name="description" content="Clean skincare from a small lab in Brooklyn." />
  <meta property="og:site_name" content="Lumen" />
  <meta property="og:description" content="Clean skincare. Made small. Sold honest." />
  <meta property="og:image" content="/static/og.png" />
  <meta name="theme-color" content="#ff7849" />
  <link rel="icon" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <style>
    :root { --primary: #ff7849; --ink: #1c4f29; --accent: #7C5CFF; }
    body { color: rgb(28, 79, 41); background: #fafafa; }
  </style>
</head>
<body><h1>Lumen</h1></body>
</html>`;

const BASE = new URL('https://lumen.co/');

describe('parsers', () => {
  it('extracts og:site_name as brand name', () => {
    expect(pickBrandName(HTML_FIXTURE, 'lumen.co')).toBe('Lumen');
  });

  it('falls back to hostname when nothing matches', () => {
    expect(pickBrandName('<html><head></head></html>', 'fallback.example')).toBe(
      'fallback.example',
    );
  });

  it('prefers title head when no og:site_name', () => {
    const html = '<html><head><title>Acme · Industries Inc</title></head></html>';
    expect(pickBrandName(html, 'acme.test')).toBe('Acme');
  });

  it('extracts description (og preferred)', () => {
    expect(pickDescription(HTML_FIXTURE)).toBe('Clean skincare. Made small. Sold honest.');
  });

  it('extracts theme-color', () => {
    expect(pickThemeColor(HTML_FIXTURE)).toBe('#ff7849');
  });

  it('expands 3-digit theme color', () => {
    const html = '<html><head><meta name="theme-color" content="#f0c" /></head></html>';
    expect(pickThemeColor(html)).toBe('#ff00cc');
  });

  it('prefers apple-touch-icon for logo, returns absolute URL', () => {
    expect(pickLogoUrl(HTML_FIXTURE, BASE)).toBe('https://lumen.co/apple-touch-icon.png');
  });

  it('falls back to /favicon.ico when no link or og:image', () => {
    expect(pickLogoUrl('<html><head></head></html>', BASE)).toBe('https://lumen.co/favicon.ico');
  });

  it('extracts palette and dedupes case-insensitively, drops black/white', () => {
    const palette = pickPalette(HTML_FIXTURE);
    expect(palette).toContain('#ff7849');
    expect(palette).toContain('#1c4f29');
    expect(palette).toContain('#7c5cff');
    expect(palette).not.toContain('#000000');
    expect(palette).not.toContain('#ffffff');
    // theme color should rank first due to +50 boost
    expect(palette[0]).toBe('#ff7849');
  });

  it('handles rgb() colors', () => {
    const html = '<style>.a{color:rgb(255, 120, 73);} .b{background:rgb(28,79,41);}</style>';
    const palette = pickPalette(html);
    expect(palette).toContain('#ff7849');
    expect(palette).toContain('#1c4f29');
  });

  it('caps palette to 6 entries', () => {
    const colors = [
      '#aa1111',
      '#bb2222',
      '#cc3333',
      '#dd4444',
      '#ee5555',
      '#664488',
      '#778899',
      '#abcdef',
    ];
    const html = `<style>${colors.map((c, i) => `.x${i}{color:${c};}`).join(' ')}</style>`;
    expect(pickPalette(html).length).toBe(6);
  });

  it('drops near-grays even when frequent', () => {
    const grays = [
      '#0a0a0a',
      '#1a1a1a',
      '#2a2a2a',
      '#3a3a3a',
      '#4a4a4a',
      '#5a5a5a',
      '#6a6a6a',
      '#7a7a7a',
    ];
    const css = grays.map((c, i) => `.g${i}{color:${c};} `.repeat(30)).join('');
    const real = '.brand{color:#7c5cff;background:#ff7849;}';
    const palette = pickPalette(`<style>${css} ${real}</style>`);
    expect(palette).toContain('#7c5cff');
    expect(palette).toContain('#ff7849');
    for (const gray of grays) expect(palette).not.toContain(gray);
  });

  it('drops near-black and near-white', () => {
    const html = '<style>.a{color:#050505;background:#fafafa;border:#7c5cff;}</style>';
    const palette = pickPalette(html);
    expect(palette).toContain('#7c5cff');
    expect(palette).not.toContain('#050505');
    expect(palette).not.toContain('#fafafa');
  });

  it('keeps dark-but-saturated brand colors (e.g. brand navy)', () => {
    const html = `<style>
      .navy{color:#0c1929;}
      .deep{color:#1a0a3f;}
      .gray{color:#1a1a1a;}
    </style>`;
    const palette = pickPalette(html);
    // Saturated darks survive; the neutral dark gray does not.
    expect(palette).toContain('#0c1929');
    expect(palette).toContain('#1a0a3f');
    expect(palette).not.toContain('#1a1a1a');
  });

  it('promotes theme-color above raw count', () => {
    const html = `<!doctype html>
<html><head>
  <meta name="theme-color" content="#22c55e" />
</head><body>
<style>${'.x{color:#ff0099;}'.repeat(500)} .y{color:#22c55e;}</style>
</body></html>`;
    const palette = pickPalette(html);
    expect(palette[0]).toBe('#22c55e');
  });
});

describe('pickFont', () => {
  it('extracts the family from a Google Fonts <link>', () => {
    const html =
      '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700&display=swap"></head>';
    expect(pickFont(html, '')).toBe('Bricolage Grotesque');
  });

  it('skips system-stack tokens', () => {
    const css =
      '.a{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;}';
    expect(pickFont('', css)).toBeNull();
  });

  it('returns the most-used non-system font-family', () => {
    const css = `
      .a{font-family: 'Inter', sans-serif;}
      .b{font-family: 'Inter', sans-serif;}
      .c{font-family: 'Inter', sans-serif;}
      .d{font-family: 'Playfair Display', serif;}
    `;
    expect(pickFont('', css)).toBe('Inter');
  });

  it('handles unquoted family names', () => {
    const css =
      '.x{font-family: Helvetica Neue, Arial, sans-serif;} .y{font-family: Outfit, sans-serif;}';
    // Helvetica Neue + Arial are skipped as system-stack fallbacks, so
    // Outfit wins despite a lower direct count.
    expect(pickFont('', css)).toBe('Outfit');
  });

  it('drops CSS-in-JS hashed identifiers', () => {
    const css = '.a{font-family: _font_abc123, sans-serif;}';
    expect(pickFont('', css)).toBeNull();
  });

  it('prefers Google Fonts link over count-based heuristic', () => {
    const html =
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700">';
    const css = `${'.a{font-family: "Inter", sans-serif;}'.repeat(50)}`;
    expect(pickFont(html, css)).toBe('Outfit');
  });
});
