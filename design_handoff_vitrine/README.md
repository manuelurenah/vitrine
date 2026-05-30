# Handoff: Vitrine Web App

## Overview

**Vitrine** is a campaign generator for small businesses, creators, and D2C brands. The product turns one product photo (plus the brand's DNA — palette, tone, audience) into a full campaign: 12 social posts, 3 ad creatives, a hero video, and editorial photoshoots. Everything is paid for in **Buzz**, Civitai's compute credit.

This handoff covers the **full app**: pre-auth, onboarding, and the four main workspaces (campaigns, photoshoot, catalog, assets). Desktop **and** mobile.

## About the Design Files

The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in your chosen production stack** (React + your framework of choice, Next.js, Remix, Vite — whatever fits the codebase) using its established patterns, component library, and conventions. The HTML/JSX is meant for:

- Reading the visual intent (colors, type, spacing, layout)
- Understanding component composition
- Lifting copy, microcopy, and content
- Seeing how interactions and states feel

The prototypes use:
- React 18 + Babel-standalone in the browser (development only)
- Inline `<script type="text/babel">` JSX — **do not ship this approach to production**
- A `DesignCanvas` wrapper that lays multiple artboards out on a pannable/zoomable surface (for review only)

In production, render real routes/pages and split components properly.

## Fidelity

**High-fidelity (hifi)**. The mocks are pixel-perfect mockups with final colors, typography, spacing, interactions, hover/active/cooking/empty/error states, and exact copy. Recreate the UI pixel-perfectly using your stack's component library and patterns. Match the design tokens exactly (listed below).

A wireframe set exists alongside (`Campaigns wireframes.html`, `Onboarding wireframes.html`, etc.) — those are earlier explorations and **not** the source of truth. Use only the hi-fi files for implementation.

---

## Stack Recommendation

The prototypes lean on patterns that map cleanly to a modern React stack:

- **React 18+** with file-based routing (Next.js App Router / Remix / TanStack Router)
- **CSS variables for tokens** (the existing `colors_and_type.css` ports directly — see `design_files/colors_and_type.css`)
- **Lucide-react** for icons (the prototypes use a hand-rolled Lucide-style set in `hifi-campaigns-shell.jsx` — replace with the real `lucide-react` package)
- **Google Fonts** — Bricolage Grotesque, Space Grotesk, JetBrains Mono (or self-host the `.woff2`s for production)
- **Real state management** for the campaign/photoshoot generation flows — the prototypes are static snapshots of cooking / ready / queued states

CSS architecture: keep the design tokens (`colors_and_type.css`) as global CSS variables. Module-style CSS, Tailwind with token mapping, or vanilla-extract all work — the tokens are stack-agnostic.

---

## Voice & Content

Treat copy as part of the design. The brand voice is **playful, energetic, lowercase**.

| Do | Don't |
|---|---|
| "drop a photo. ship a campaign." | "Upload your image to generate marketing materials" |
| "we're cooking." | "Loading…" |
| "low buzz. top up to keep generating." | "Insufficient credits. Please add more." |
| "three reads." | "Choose a Creative Direction" |

Rules:

- **Headlines, buttons, labels, nav: all lowercase.** Brand name in the wordmark too: `vitrine`.
- **Brand & proper nouns stay as-is**: "Lumen Skincare", "Civitai", "Buzz".
- **All-caps only** for: monospace eyebrows (`// STEP 1 · BRIEF`), status badges (`LIVE`, `DRAFT`), unit labels (`BUZZ BALANCE`).
- Periods at the end of short headlines: "three reads.", "mango. finally."
- Em-dashes for asides: "we read your brand dna and turn a single product shot into 12 social posts — all on-brand."
- `→` for transformations: "phone photo → studio shot"
- `·` (middle dot) as separator in metadata: "festive · loud", "1080×1080 · 14 assets"
- `// ` prefix on monospace eyebrows ("`// step 1 · brief`") is intentional — reads as a code comment, reinforces tech-forward feel.
- **"we"** = Vitrine. **"you"** = the user. Never "the user".
- **Buzz costs always inline on the action**: "generate · 12 buzz", never "this will cost 12 buzz to generate".
- **No emoji** in product UI.

Lift the exact copy from the JSX files where possible — it's been written carefully.

---

## Design Tokens

All tokens live in `design_files/colors_and_type.css`. Port them verbatim into your app as CSS variables (or map to your token system). The full list:

### Color (dark theme — default)

```
--bg-0:     #0a0a0f    (canvas — solid near-black)
--bg-1:     #11111a
--bg-2:     #16161f    (cards)
--bg-3:     #1c1c26    (hover / inset)
--bg-4:     #232330
--bg-inverse: #f6f6fa  (light surface, rare)

--fg-0:     #f6f6fa    (primary text)
--fg-1:     #d4d4dc
--fg-2:     #9a9aa6    (muted text)
--fg-3:     #6a6a76    (faint text)
--fg-on-volt: #0a0a0f  (text on volt CTA)

--volt:         #00ff9d   (electric — primary CTA, success, signature)
--volt-hover:   ...
--volt-press:   ...
--volt-soft:    rgba(0,255,157, 0.10)
--volt-glow:    rgba(0,255,157, 0.40)

--ion:           #19f0ff   (cyan — data / info)
--ion-soft:      rgba(25,240,255, 0.10)
--ion-glow:      rgba(25,240,255, 0.40)

--ultraviolet:   #7c5cff   (violet — video / motion)
--ultraviolet-soft: rgba(124,92,255, 0.10)
--ultraviolet-glow: rgba(124,92,255, 0.40)

--flux:          #ff2bd6   (magenta — social)
--flux-soft:     rgba(255,43,214, 0.10)
--flux-glow:     rgba(255,43,214, 0.40)

--buzz:          #ffce3d   (warm yellow — currency only)
--buzz-soft:     rgba(255,206,61, 0.10)
--buzz-border:   rgba(255,206,61, 0.30)
--buzz-glow:     rgba(255,206,61, 0.45)

--success: var(--volt)
--info:    var(--ion)
--danger:  #ff4d6a
--danger-soft: rgba(255,77,106, 0.10)
--warning: var(--buzz)
--warning-soft: var(--buzz-soft)

--line:         rgba(255,255,255, 0.12)    (default card border)
--line-faint:   rgba(255,255,255, 0.04)
--line-subtle:  rgba(255,255,255, 0.06)
--line-strong:  rgba(255,255,255, 0.22)    (hover)
--line-volt:    rgba(0,255,157, 0.30)      (volt-tinted border)
```

A **light theme** is also defined — apply `data-theme="light"` on `<html>` or any container. Tokens automatically swap. Topbar toggle in the desktop shell does this. The volt darkens to `#00a55f` on light to hold AA contrast.

### Typography

Three families. Load from Google Fonts (or self-host `.woff2`).

- **Bricolage Grotesque** — display / headlines. Variable, with `opsz` axis used in `font-variation-settings: "opsz" 40` at H1, `"opsz" 28` at H2, `"opsz" 24` at branded wordmark.
- **Space Grotesk** — body, UI labels, buttons. Default.
- **JetBrains Mono** — eyebrows, code, IDs, numeric badges, Buzz amounts.

```
--font-display: "Bricolage Grotesque", system-ui, sans-serif
--font-body:    "Space Grotesk", system-ui, sans-serif
--font-mono:    "JetBrains Mono", ui-monospace, monospace

--text-xs:   11px
--text-sm:   13px
--text-base: 14px        (default body)
--text-md:   15px
--text-lg:   17px
--text-xl:   22px
--text-2xl:  28px
--text-3xl:  36px
--text-4xl:  44px
--text-5xl:  56px
--text-6xl:  72px

--lh-tight:  1.0
--lh-snug:   1.15
--lh-normal: 1.45
--lh-loose:  1.6

--track-tight:  -0.04em      (headlines)
--track-snug:   -0.02em
--track-normal: 0
--track-wide:    0.04em
--track-mono:    0.06em      (default for mono)
```

Type recipes used in the prototypes:

```css
.h1 { font: 700 44px/1.05 var(--font-display); letter-spacing: -0.04em;
      font-variation-settings: "opsz" 40; }
.h2 { font: 700 28px var(--font-display); letter-spacing: -0.025em;
      font-variation-settings: "opsz" 28; }
.h3 { font: 600 18px var(--font-display); letter-spacing: -0.015em; }
.eyebrow { font: 500 10px var(--font-mono); letter-spacing: 0.14em;
           text-transform: uppercase; color: var(--fg-2); }
```

### Spacing & radii

4-pt scale.

```
--space-0:  0      --space-1: 4px   --space-2: 8px
--space-3:  12px   --space-4: 16px  --space-5: 20px
--space-6:  24px   --space-8: 32px  --space-10: 40px
--space-12: 48px   --space-16: 64px --space-20: 80px
--space-24: 96px

--radius-xs:   4px
--radius-sm:   6px
--radius-md:   12px   (cards)
--radius-lg:   18px   (hero cards, modals)
--radius-xl:   24px
--radius-pill: 999px  (chips, badges, Buzz balance)
```

### Shadows

Two independent systems.

**Depth shadows** (standard drop shadows for elevation):

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.4)
--shadow-md: 0 4px 12px rgba(0,0,0,0.5)
--shadow-lg: 0 12px 32px -8px rgba(0,0,0,0.6)
--shadow-xl: 0 32px 80px -20px rgba(0,0,0,0.7)
```

**Bloom shadows** (the signature electric halo — 1px tinted ring + soft outer glow). **Reserved for** the primary CTA in a view, selected states, live-status indicators. **Don't bloom everything.**

```
--bloom-volt:    0 0 0 1px var(--volt-glow), 0 0 32px -4px var(--volt-glow), inset 0 1px 0 rgba(255,255,255,0.3)
--bloom-volt-sm: 0 0 0 1px var(--volt-glow), 0 0 18px -4px var(--volt-glow)
--bloom-ion:     same pattern with --ion-glow
--bloom-ultraviolet: same pattern with --ultraviolet-glow
--bloom-flux:    same pattern with --flux-glow
```

### Motion

```
--dur-fast:   120ms
--dur-base:   160ms
--dur-slow:   240ms
--dur-slower: 320ms

--ease-out:    cubic-bezier(0.22, 1, 0.36, 1)
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

**No spring bounces** in product UI — feels un-serious for an SMB tool. Springs are OK for marketing motifs only.

### Z-index scale

```
--z-base:    0
--z-card:    1
--z-sticky:  100
--z-overlay: 200
--z-modal:   500
--z-toast:   1000
```

### Backgrounds (decorative)

**Bloom radials** — soft off-center electric color washes used as page backdrops (dashboards, hero sections). Not decorative gradients. Defined in `colors_and_type.css` as `.bloom-bg` + helper classes `.bloom-volt`, `.bloom-ion`, `.bloom-ultraviolet`, `.bloom-flux`. Example:

```css
.bloom-bg {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 800px 480px at 50% -10%, var(--volt-soft), transparent 60%),
    radial-gradient(ellipse 700px 400px at 90% 110%, var(--ultraviolet-soft), transparent 60%);
}
```

**Don't use**: photographic full-bleed, hand-drawn illustrations, patterns/textures, blurry mesh gradients, scanlines.

### Transparency & blur

Used sparingly:
- Modal scrims: `rgba(0,0,0,0.55)` + `backdrop-filter: blur(6px)`
- Asset overlays (channel tags, more buttons on images): `rgba(0,0,0,0.55)` + `backdrop-filter: blur(8px)`
- Mobile topbar / tabbar: `rgba(15,15,22,0.92)` + `backdrop-filter: blur(14px)`

---

## Iconography

- **Lucide-style** — clean line icons, 1.5px stroke, round caps/joins, 24px viewBox.
- Use **`lucide-react`** in production. The prototype's inline icon set in `hifi-campaigns-shell.jsx` (`Icons.Sparkles`, `Icons.Bolt`, `Icons.Camera`, `Icons.Video`, `Icons.Megaphone`, `Icons.Dna`, `Icons.Bag`, etc.) maps 1:1 to lucide-react names — swap them straight across:

| Prototype `Icons.X` | lucide-react import |
|---|---|
| `Icons.Sparkles` | `Sparkles` |
| `Icons.Bolt` | `Zap` |
| `Icons.Camera` | `Camera` |
| `Icons.Video` | `Video` |
| `Icons.Wand` | `Wand2` |
| `Icons.Image` | `Image` |
| `Icons.Megaphone` | `Megaphone` |
| `Icons.Dna` | `Dna` |
| `Icons.Bag` | `ShoppingBag` |
| `Icons.BookOpen` | `BookOpen` |
| `Icons.Layers` | `Layers` |
| `Icons.Folder` | `Folder` |
| `Icons.History` | `History` |
| `Icons.Refresh` | `RefreshCw` |
| `Icons.Send` | `Send` |
| `Icons.Mic` | `Mic` |
| `Icons.Crop` | `Crop` |
| `Icons.Compare` | `GitCompare` |

(Full list in `hifi-campaigns-shell.jsx` `Icons` object.)

- **No emoji** in product UI.
- **Unicode arrows OK** in microcopy: `→` is part of the voice ("phone photo → studio shot").

---

## Imagery

Vitrine generates imagery, so **the product is the image library**. Placeholders in the prototypes use **gradient thumbs** (`.thumb-a` through `.thumb-h` in `app.css`), each a different electric-on-dark radial:

- `.thumb-a`, `.thumb-f` — volt-leaning
- `.thumb-b`, `.thumb-g` — ion (cyan) leaning
- `.thumb-c` — ultraviolet leaning
- `.thumb-d` — flux (magenta) leaning
- `.thumb-e`, `.thumb-h` — buzz (yellow) leaning

In production, these become **real generated images**. Keep the gradient thumb classes as fallbacks for loading/empty states.

For product photos that exist (uploaded by the user): studio-clean or warm/cinematic, never with grain or vintage filters. Apply tone-on-tone color overlays sparingly.

---

## Brand Assets

In `design_files/assets/`:

- `logomark.svg` — chunky `v` with electric spark (use for favicons, app icon)
- `wordmark.svg` — lowercase "vitrine" with volt gradient mark
- `wordmark-mono.svg` — monochrome version for photo overlays
- `buzz.svg` — Buzz currency glyph (use wherever a Buzz amount is displayed)
- `app-icon.svg` — 128px rounded square + bloom

---

## Component Library

The prototypes export a set of atoms (in `hifi-campaigns-shell.jsx`) plus screen-level patterns. Recreate these as proper components in your stack:

### Atoms

- **Button** — variants: `primary` (volt fill + bloom), `secondary` (bg-2 + line), `ghost` (transparent), `tonal` (volt-soft). Sizes: default (36px), `sm` (28px), `lg` (44px). Optional leading icon. Disabled state: bg-3 fill, fg-3 text, no shadow.
- **IconButton** — square button, same variants.
- **Chip** — pill, 12px text, optional `active` state (volt-soft fill + line-volt border), optional check icon when active. Used everywhere for filters, tags, selections.
- **Badge** — small uppercase mono pill with status dot. Kinds: `live` (volt), `gen` / `cooking` (ion), `draft` (bg-3), `archived` (bg-3 dim).
- **Avatar** — 32px circle, initials, optional brand-gradient bg.
- **BuzzPill** — pill with buzz glyph + amount in mono, warm-yellow tint. Compact (mobile) and default sizes.
- **Spinner / Cooking state** — small volt-soft circle with sparkle icon + "cooking…" label + monospace ETA.

### Inputs

- **Input** — 38px height, bg-2 fill, 9px radius, focus ring `0 0 0 3px var(--volt-soft)` + `border-color: var(--volt)`.
- **Textarea** — same fill/border, min-height 70px, line-height 1.5, vertical resize.
- **Field label** — mono 10px uppercase, `var(--fg-2)`, `letter-spacing: 0.1em`, 6px margin-bottom.

### Composite

- **Prompt Composer** — the hero element on the Campaigns list/empty screens. Textarea + row of chips (`product`, `images`, `aspect ratio`) + mic button + primary CTA with inline Buzz cost. Has a gradient border (volt → ion, masked) and a soft volt drop-shadow. See `.composer` styles in `app.css`.
- **Creative Card** — the recurring social-post mockup. Image area (with aspect ratio per channel), channel tag (top-left pill), more-button (top-right circle), optional cooking/queued overlay, footer with version label + animate + download. See `.creative-card`.
- **Suggestion Card** — used on Campaigns list and onboarding. Gradient thumb header + title + 3-line clamp sub-description.
- **Past Row** — used on Campaigns list. 40px thumb + name + meta (`date · count`) + status badge + more button.
- **Modal / Bottom Sheet** — desktop uses a centered modal (`.modal`, `.scrim`); mobile lifts the same content into a bottom sheet with a drag handle. Both keep the same field structure.

### Shells

- **Desktop shell** (`Shell` in `hifi-campaigns-shell.jsx`): 232px sidebar + flex main + 56px topbar.
  - Sidebar items: hover fills to bg-2; active fills bg-2 + 2px inset left border in volt + icon turns volt.
  - Topbar: breadcrumbs OR back button on the left, search + Buzz pill + more on the right.
  - Content padding: `28px 36px 60px`. Section gap inside content: `32px`.

- **Mobile shell** (`ScreenFrame` in `mobile-shell.jsx`): 52px topbar (sticky, blurred) + scrollable content + 76px bottom tab bar (absolute, blurred, with home indicator).
  - Tabs: `campaigns · shoot · animate · brand` (4-tab). Active tab in volt with icon drop-shadow.
  - The "brand" tab houses brand DNA + catalog + assets + book via an **inner sub-tab strip** under the topbar (`BrandSubTabs`).
  - Bottom sheets replace desktop modals on mobile.
  - FAB (+) on list screens for new campaign / new product / upload asset.
  - Sticky CTA above the tab bar for the photoshoot builder ("generate").

---

## Screens / Views

### Desktop

#### 0. Sign-in — `Login.html`

- **Layout**: Two-column hero. Left = pitch (eyebrow `// step 0 · sign in`, headline "one door. all your buzz." with volt-gradient second line, paragraph, three checked "travels with you" rows). Right = auth card with Civitai SSO primary button, divider, email disclosure (collapsed by default, expands inline). Bloom backdrop (volt top-left + ultraviolet bottom-right), faint background grid masked to a radial.
- **States**: email disclosure collapsed/expanded, focus rings on inputs, hover on SSO button (deeper bloom + arrow shift).
- **Responsive**: collapses to single column under 960px.
- **CTA**: "continue with Civitai" — primary action. Email is secondary.

#### 1. Onboarding — `Onboarding.html` (5 screens, single app with state)

**State**: `screen` ∈ `welcome | input | generating | dna | next`. Plus `formState` (url, description, logoName, colors[]) and `dnaTab` (`overview | details`). Keyboard ←/→ moves between screens. Skip jumps to dna.

1. **Welcome** — eyebrow logo + "welcome to vitrine." (with volt-gradient reveal) + paragraph + 3-step grid (numbered cards with decorative SVGs: DNA wave, campaign tile grid, photoshoot composition). Primary CTA: "let's go".
2. **Input** — 2-column form. Left: URL field + describe-business textarea (with "or instead" divider). Right: logo dropzone + color picker (5 suggested swatches + custom). Skip-or-analyze footer.
3. **Generating** — orb (volt-glowing circle with DNA icon) + headline "we're cooking your brand DNA" + status pill that cycles through 5 tasks ("reading your site", "extracting palette", "tasting your tone of voice", "sketching your audience", "naming the read") + skeleton preview window with a scanner line + checklist below. Auto-advances after the last task.
4. **DNA reveal** — eyebrow + headline "your brand DNA." + tabs (`brand overview | business details`) + cards: identity (logo wordmark + URL), logo (rendered Lumen text), fonts (Aa + name), palette (4 swatches with hex). Business details tab has tagline, brand values, aesthetic, tone of voice, business blurb (all editable chip groups). 100%-complete progress bar at bottom. Primary CTA: "let's go".
5. **What's next modal** — overlays the DNA screen (faded). Two large choice cards: **campaigns** (recommended, with a 3-post preview) and **photoshoot** (with input + 4-shot preview). Each shows its Buzz cost.

#### 2. Campaigns — `Campaigns Hi-Fi.html` (7 screens)

1. **List** — center-aligned hero (`// step 1 · brief`, "campaigns.", lede) + Prompt Composer + 3 suggestion cards (from brand DNA) + past campaigns table.
2. **Empty** — same hero + composer + suggestions, then a dashed empty card: "no campaigns yet." + first-campaign cost.
3. **Brief modal** — opens over the list. Sidecar of submitted prompt + tags (product chip, image-count chip) + title + description fields + goal/offer split + **output format presets grid** (Instagram feed, story, reels, tiktok, facebook, linkedin, x, youtube — each with aspect-ratio glyph and check state) + bottom strip showing est. cost and confirm CTA.
4. **Cooking** — 3-column header (brief sidecar / title with "X of Y still cooking" / right action stack with `gen` badge and share/download). Filter pills (`all 8 · ig·feed 3 · …`). 4-col creative grid. Some cards show `cooking…` overlay, some show `queued`, the rest show the rendered ad mockup.
5. **Ready** — same layout, all 8 done. Badge flips to `live`. Per-card "animate" + download show on hover.
6. **Single creative editor** — 2-col. Left: version pill (e.g., "version 2 of 3" with chevrons) + 4:5 canvas with the rendered ad (eyebrow, big headline, brand name, volt "shop now" pill) + action bar (`fix layout · 3 buzz` + regenerate + download + share + animate). Right: collapsible panel rows (image expanded, header, description, cta, logo, background) + "fix layout" promo card.
7. **Version history** — 2-col. Left: enhanced version pill + the current canvas with `v4 · current` badge in volt + strip of all 4 versions (each as a small thumb with v-label, title, time). Right: diff rail showing what changed in v4 (header line-through old → new, description "unchanged", cta line-through old → new) + actions (restore v3, compare v3 vs v4, delete this version).

#### 3. Photoshoot — `Photoshoot Hi-Fi.html` (3 screens)

1. **List** — hero ("photoshoot.") + single primary CTA card ("new photoshoot") + alt link to assets · single-image edit + 6-card grid of past photoshoots (each: 2×2 thumb collage, name, date · count, ratio tags).
2. **Builder** — 2-col. Left: product picker (radio list of catalog products + selected references + upload-new link). Right: stepped template tiles, grouped (`recommended for [product]` with `based on brand dna` badge, then `studio`, `lifestyle · in use`, `hero`). Each tile shows the template thumb at its aspect ratio + label + sub. Sticky bottom action bar: ratio chips (feed 4:5, story 9:16, square 1:1) + variants-per-template counter + estimate copy + `generate · 60 buzz` primary CTA.
3. **Results** — 3-col header (source product card with templates chips / center title with `// step 3 · results` + cooking count / right action stack). Filter chips. Grouped rows per template, each with `regenerate template · 20 buzz` link and a 4-card variant row. Same cooking/queued/done states as campaigns.

#### 4. Catalog & Assets — `Catalog & Assets.html` (8 screens, single app with state)

`screen` ∈ `cat-grid | cat-empty | cat-add | cat-detail | assets-grid | assets-empty | assets-add | asset-detail`. URL `?s=` deep-links. ←/→ keyboard nav.

1. **Catalog grid** — page head + chip toolbar (`all · live · draft · merch · search`) + product cards grid (each: thumb / dashed placeholder if no photo, name, meta, status badge).
2. **Catalog empty** — page head + "no products yet" hero with empty illustration + benefits list + jump-to-assets link.
3. **Catalog add modal** — name, sku, notes, tags, photo dropzone. Cancel + confirm.
4. **Catalog detail** — hero photo + thumb strip + name + tags + meta table (sku, added, used in) + notes + used-in-campaigns grid + CTA row (new photoshoot, use in campaign).
5. **Assets gallery** — page head + filter chips (`all · logos · partners · past campaigns · references`) + grouped grid (logos as 4-up tiles with Lumen wordmark in each variant; partners as labeled tiles; past campaigns as thumbs).
6. **Assets empty** — page head + collection cards (logos, partners, past campaigns, references — each as a tappable row).
7. **Assets add modal** — drop zone + collection assignment chips + tags + upload.
8. **Asset lightbox** — fullscreen overlay with breadcrumbs, large preview, left/right nav, thumb strip below, meta table (name, format, added, used in), tags, action row (download, use in campaign).

### Mobile — `Mobile Hi-Fi.html` (24 screens, 390px-wide artboards)

All desktop screens have a mobile counterpart. Key adaptations:

- **Bottom tab bar** (4 tabs: `campaigns · shoot · animate · brand`) replaces the desktop sidebar. The "brand" tab houses brand DNA + catalog + assets via an **inner sub-tab strip** under the topbar.
- **Modals become bottom sheets** with drag handles (brief, catalog add, assets add).
- **FAB (+)** on list screens for primary create actions.
- **Sticky CTA** above tab bar for the photoshoot builder.
- **Horizontal scroll** for suggestion cards, product chips, filter pills.
- **2-column creative grid** instead of 4-column.
- **Pre-auth screens** (login, all 5 onboarding) have **no tab bar** — they're full-bleed.

See `design_files/mobile-*.jsx` for each screen. The `ScreenFrame` component (`mobile-shell.jsx`) is the mobile shell — owns topbar, scroll, optional bloom, optional sticky CTA, and the bottom tab bar. Pass `activeTab` to light up the correct tab. Pass `tabBar={false}` on screens without nav (login, onboarding, builders, editors).

---

## State Management

The prototypes are mostly static — but the real app needs state for:

### Auth
- Civitai SSO redirect flow → callback → user object (Buzz balance, brand DNA pointer, campaigns list).
- Email/password fallback (form is wired up cosmetically in the prototype).

### Onboarding
- `formState`: { url, description, logoName, colors[] }
- Generation: simulated 5-step task list with ~850ms per task. In production, this is a real background job — poll or stream progress.
- DNA result: brand identity, logo, fonts, palette, tagline, values, aesthetic, tone, business overview. All editable.

### Campaigns
- Prompt → brief generation (`8 buzz`) → confirm → campaign cooking (`60 buzz`).
- Per-creative state: `cooking | queued | done`. Track via job IDs.
- Version history per creative: array of versions with thumb, label, timestamp, content diff. Restore swaps current.
- "Fix layout" action (`3 buzz`) creates a new version with re-balanced layout.
- "Animate" action turns a static asset into a Reel-ready clip (`animate` is a separate workspace, not implemented in this handoff — placeholder nav item only).

### Photoshoot
- Source product (from catalog, multi-reference) + selected templates (max 4) + aspect ratio + variants-per-template.
- Cost = templates × variants × per-variant Buzz cost.
- Same `cooking | queued | done` states per variant.
- Regenerate single variant or whole template.

### Catalog & Assets
- Products: name, sku, photos[], notes, tags, status (live/draft), usage count.
- Assets: collections (logos, partners, past campaigns, references — extensible) + per-asset metadata (name, format, file size, tags, usage).
- Both feed into campaigns and photoshoot.

### Buzz
- Balance displayed in every shell (sidebar on desktop, topbar on mobile).
- Every generate action shows inline cost on the button.
- Low-buzz state: "low buzz. only X left. top up to keep generating." (Not in current designs — add when implementing.)

---

## Interactions & Behavior

### Hover / press

- **Buttons** — primary: lighter fill on hover + stronger bloom; `translateY(1px)` + darker fill on press.
- **Cards** — bg shifts up one step (`--bg-2 → --bg-3`), border strengthens, `translateY(-2px)` lifts. 180ms `var(--ease-out)`.
- **Sidebar items** — bg fills to `--bg-2`, no transform. 120ms.
- **Chips** — border strengthens to `--line-strong`, text to `--fg-0`.

### Selected states

- **Chip active** — `var(--volt-soft)` fill, `var(--line-volt)` border, `var(--volt)` text, optional inline check icon.
- **Tile active** (photoshoot template) — 1px volt border + a `0 0 22px -8px var(--volt-glow)` outer ring + small check pill in top-right.
- **Sidebar active** — `--bg-2` fill + 2px inset left border in volt + icon turns volt.

### Cooking

- Overlay an empty card with a 36px circle (volt-soft fill, line-volt border, volt sparkle icon, volt bloom) + "cooking…" headline + monospace ETA "~ 2 min left".
- Queued state: history icon + uppercase "queued" mono label.
- Don't animate the sparkle in production — keep it still. Spinners feel cheap against this aesthetic.

### Transitions

- 120–200ms with `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-out`). No spring bounces in product UI.

### Modal open/close

- Desktop: fade + scale-in (96% → 100%) on the modal, scrim fades 0 → 0.55.
- Mobile sheets: slide up from bottom, scrim fades. Drag handle is visual only in the prototype — wire to touch drag in production.

### Loading

- Use the `cooking…` pattern where appropriate. For instant operations (list re-filter, navigation), skip loaders entirely.

### Form validation

- Inputs validate on blur, not keystroke.
- Required field empty + submitted: red border `var(--danger)` + inline mono error in `var(--danger)`.
- The composer's "generate brief" button enables only when text is non-empty.

### Responsive

- The desktop screens collapse cleanly at 960px (Login does this in the prototype). For the app screens, build mobile-first or have a hard breakpoint at the mobile screens — they're designed as a separate experience, not a fluid responsive layout.

---

## Routing

Suggested URL structure:

```
/                              → Sign-in (or redirect to /campaigns if authed)
/onboarding/:step              → Onboarding (step: welcome | input | generating | dna | next)
/campaigns                     → Campaigns list
/campaigns/new                 → Brief modal (over list)
/campaigns/:id                 → Campaign detail (cooking or ready)
/campaigns/:id/c/:creativeId   → Single creative editor
/campaigns/:id/c/:creativeId/history → Version history
/photoshoot                    → Photoshoot list
/photoshoot/new                → Builder
/photoshoot/:id                → Results
/brand                         → Brand DNA overview (currently the onboarding dna screen, reused)
/brand/catalog                 → Catalog grid
/brand/catalog/new             → Add product modal (over grid)
/brand/catalog/:id             → Product detail
/brand/assets                  → Assets gallery
/brand/assets/new              → Upload modal (over gallery)
/brand/assets/:id              → Asset lightbox
/brand/book                    → Brand book (not designed yet — placeholder)
/animate                       → Animate workspace (not designed yet — placeholder, marked "new")
```

---

## Files

### Design source files (in `design_files/`)

**Desktop entry HTMLs** (open in a browser to view prototypes):

- `Login.html` — single self-contained page
- `Onboarding.html` — loads `onboarding-app.jsx`, `onboarding-icons.jsx`, `onboarding.css`
- `Campaigns Hi-Fi.html` — loads `hifi-campaigns-shell.jsx` + `hifi-campaigns-screens-a.jsx` + `hifi-campaigns-screens-b.jsx` + `design-canvas.jsx`
- `Photoshoot Hi-Fi.html` — loads `hifi-campaigns-shell.jsx` + `hifi-photoshoot-screens.jsx` + `design-canvas.jsx`
- `Catalog & Assets.html` — loads `vitrine-shell.jsx` + `catalog-screens.jsx` + `assets-screens.jsx` + `catalog-assets-app.jsx` (uses `vendor/Icons.jsx` + `vendor/app.css`)

**Mobile entry HTML**:

- `Mobile Hi-Fi.html` — single design canvas containing all 24 mobile artboards. Loads `mobile-shell.jsx` + `mobile-auth.jsx` + `mobile-campaigns.jsx` + `mobile-photoshoot.jsx` + `mobile-catalog.jsx` + `mobile-app.jsx` + `hifi-campaigns-shell.jsx` (for shared Icons + atoms).

**Shared / atoms**:

- `hifi-campaigns-shell.jsx` — Icons, Button, IconButton, Chip, Badge, Avatar, BuzzPill, Sidebar, TopBar, Shell. Used by desktop campaigns + photoshoot + mobile.
- `vitrine-shell.jsx` — same role for catalog & assets app.
- `mobile-shell.jsx` — mobile-specific: ScreenFrame, MobileTopBar, MobileTabBar, BottomSheet, FAB, MobileBuzzPill, MobileProductShot, MobileSectionHead.

**Styles**:

- `colors_and_type.css` — the master token file. Port this **first**.
- `vitrine/app.css` — desktop app styles (sidebar, topbar, buttons, cards, modals, creative grid).
- `vitrine-mobile.css` — mobile styles (screen frame, topbar, tab bar, sheets, mobile composer, mobile cards).
- `onboarding.css` — onboarding-specific (welcome card decorations, generating orb + scanner, DNA reveal cards).
- `catalog-assets.css` — catalog/assets-specific (product cards, asset tiles, lightbox).
- `vendor/app.css` — older app.css; the newer `vitrine/app.css` is the source of truth.

**Helper (review only — do not port)**:

- `design-canvas.jsx` — the pan/zoom design canvas wrapper used to lay out artboards side by side. Pure tooling for review; throw away in production.

**Brand assets** (in `design_files/assets/` and `design_files/vitrine/`):

- `logomark.svg`, `wordmark.svg`, `wordmark-mono.svg`, `app-icon.svg`, `buzz.svg`

### Reference

- `design_files/colors_and_type.css` — the canonical token file. (The full design system also lives in a separate Vitrine Design System reference if you have access — its README covers preview cards for every component.)

---

## How to run the prototypes locally

Just open the HTML files in a browser — they use unpkg CDN for React + Babel-standalone. No build step. The design canvas pages (Campaigns/Photoshoot/Mobile) pan with click-drag, zoom with scroll-wheel. Each artboard can be opened fullscreen via the focus button.

---

## Open questions / things not yet designed

These are real product surfaces that don't have mocks yet:

- **Animate workspace** — surfaced as a "new" sidebar/tab item only.
- **Brand Book** — surfaced as a "new" sidebar/tab item only.
- **Settings / account / billing / Buzz top-up flow** — there's a `top up` button in the sidebar's Buzz card, but no destination screen.
- **Low-Buzz state / paywall** — copy exists in the voice docs but no UI.
- **Notifications / job-complete toasts** — implied by the cooking states but not designed.
- **Empty Buzz balance** — what does the app look like at 0 Buzz?
- **Marketing site / public homepage** — out of scope for this handoff.

If any of these become priority, ask the designer for mocks before building.

---

## Implementation order (suggested)

1. **Tokens first** — port `colors_and_type.css` to your global styles. Verify all 106 `--*` resolve.
2. **Atoms** — Button, IconButton, Chip, Badge, Avatar, BuzzPill, Input, Textarea, FieldLabel.
3. **Shells** — desktop Shell (sidebar + topbar) and mobile ScreenFrame (topbar + tab bar). Get the active states right.
4. **Auth** — Civitai SSO + email fallback. Land users on Campaigns by default.
5. **Onboarding** — all 5 steps, real DNA-extraction backend call instead of the simulated task list.
6. **Campaigns** — list, brief modal, cooking, ready, editor. Editor's "fix layout" is the trickiest — needs real layout-rebalance backend.
7. **Photoshoot** — list, builder, results. Reuses cooking/done patterns from campaigns.
8. **Catalog & Assets** — these are CRUD around the user's brand data. Build last; they feed into campaigns + photoshoot via product/asset pickers.
9. **Mobile** — once each desktop screen is shipped, build its mobile counterpart. The component library + tokens carry over; only shells + dense compositions need new layouts.

Bug hunt at each step against the HTML prototypes — they're the source of truth.
