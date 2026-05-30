/* Hi-fi photoshoot — 3 screens
   List → Builder → Results.
   Reuses primitives from hifi-campaigns-shell.jsx (window-scoped). */

/* ─────────────────────────────────────────
   PSShell — swap sidebar active to 'photoshoot'
   ───────────────────────────────────────── */
const PSShell = ({ crumbs, back, bloom, children }) => (
  <div className="app-shell">
    <Sidebar active="photoshoot" />
    <div className="app-main">
      <TopBar crumbs={crumbs} back={back}/>
      <div className="app-content">
        {bloom && <div className="bloom-bg" />}
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   ProductShot — gradient thumb + bottle silhouette
   ───────────────────────────────────────── */
function ProductShot({ thumb = "thumb-a", style, children, rounded = 10, padded = true }) {
  return (
    <div className={`thumb ${thumb}`}
         style={{ position: "absolute", inset: 0, borderRadius: rounded, ...style }}>
      {/* abstract bottle silhouette so it reads as 'product photo' */}
      <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet"
           style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     opacity: 0.85 }}>
        <defs>
          <linearGradient id="bottleHL" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.35)"/>
            <stop offset="0.5" stopColor="rgba(255,255,255,0.05)"/>
            <stop offset="1" stopColor="rgba(255,255,255,0.0)"/>
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="118" rx="22" ry="3.5" fill="rgba(0,0,0,0.35)"/>
        <path d="M 42 30 V 18 H 58 V 30 C 58 30 64 36 64 48 V 104 C 64 110 60 114 54 114 H 46 C 40 114 36 110 36 104 V 48 C 36 36 42 30 42 30 Z"
              fill="rgba(20,12,8,0.65)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"/>
        <path d="M 42 30 V 18 H 58 V 30 C 58 30 64 36 64 48 V 104 C 64 110 60 114 54 114 H 46 C 40 114 36 110 36 104 V 48 C 36 36 42 30 42 30 Z"
              fill="url(#bottleHL)"/>
        <rect x="40" y="58" width="20" height="22" fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"/>
        <rect x="44" y="62" width="12" height="2" fill="rgba(255,255,255,0.4)"/>
        <rect x="42" y="68" width="16" height="1" fill="rgba(255,255,255,0.2)"/>
        <rect x="44" y="73" width="12" height="1" fill="rgba(255,255,255,0.2)"/>
      </svg>
      {padded && (
        <div style={{ position: "absolute", inset: 0, padding: 14 }}>
          {children}
        </div>
      )}
      {!padded && children}
    </div>
  );
}

/* ─────────────────────────────────────────
   01 — photoshoot list
   ───────────────────────────────────────── */

const PAST_SHOOTS = [
  { name: "summer studio · chili oil",  date: "yesterday",  count: "8 shots",
    ratios: ["4:5", "1:1", "9:16"], thumbs: ["thumb-e", "thumb-a", "thumb-d", "thumb-c"] },
  { name: "in-use · lifestyle set",     date: "4 days ago", count: "6 shots",
    ratios: ["9:16", "4:5"],        thumbs: ["thumb-b", "thumb-g", "thumb-h", "thumb-a"] },
  { name: "founder's table",            date: "12 feb",     count: "4 shots",
    ratios: ["1:1"],                thumbs: ["thumb-d", "thumb-e", "thumb-c", "thumb-a"] },
  { name: "ingredient close-ups",       date: "8 feb",      count: "5 shots",
    ratios: ["4:5", "1:1"],         thumbs: ["thumb-f", "thumb-c", "thumb-b", "thumb-g"] },
  { name: "valentine's hero",           date: "6 feb",      count: "3 shots",
    ratios: ["16:9", "1:1"],        thumbs: ["thumb-d", "thumb-c", "thumb-a", "thumb-h"] },
  { name: "holiday gift box v1",        date: "20 dec",     count: "8 shots",
    ratios: ["4:5", "9:16"],        thumbs: ["thumb-e", "thumb-h", "thumb-b", "thumb-f"] },
];

function PastShootCard({ name, date, count, ratios, thumbs }) {
  return (
    <div className="suggestion-card" style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
                     borderRadius: 10, overflow: "hidden" }}>
        {thumbs.slice(0,4).map((t, i) => (
          <div key={i} className={`thumb ${t}`}
               style={{ height: 78, borderRadius: 4, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0,
                           background: "radial-gradient(ellipse at 50% 90%, rgba(0,0,0,0.45), transparent 55%)" }}/>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
        <div className="tile-title">{name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                       color: "var(--fg-3)", letterSpacing: "0.04em" }}>
          {date} · {count}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {ratios.map((r, i) => (
            <span key={i} style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              padding: "2px 6px", borderRadius: 4,
              border: "1px solid var(--line-subtle)", color: "var(--fg-2)",
              letterSpacing: "0.04em" }}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenPhotoshootList() {
  return (
    <PSShell crumbs={["photoshoot"]} bloom>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span className="eyebrow">// product photography, generated</span>
        <h1 className="h1" style={{ marginTop: 6 }}>photoshoot.</h1>
        <p style={{ color: "var(--fg-2)", fontSize: 15, marginTop: 6,
                     maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          turn one product into studio, in-use, ingredient, and hero variants — all on-brand,
          all in your aspect ratios.
        </p>
      </div>

      {/* HERO CTA — single primary action (no edit/generate split, that lives in assets) */}
      <div style={{ maxWidth: 720, margin: "28px auto 0",
                     background: "var(--bg-2)", border: "1px solid var(--line)",
                     borderRadius: 18, padding: 18,
                     display: "flex", alignItems: "center", gap: 16,
                     position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0,
                       background: "radial-gradient(ellipse at 90% 50%, rgba(0,255,157,0.10), transparent 60%)",
                       pointerEvents: "none" }}/>
        <div style={{ width: 56, height: 56, borderRadius: 14,
                       background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                       display: "grid", placeItems: "center", color: "var(--volt)",
                       boxShadow: "var(--bloom-volt-sm)", flexShrink: 0,
                       position: "relative", zIndex: 1 }}>
          <Icons.Camera size={22}/>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                         fontSize: 19, letterSpacing: "-0.02em", color: "var(--fg-0)",
                         lineHeight: 1.2 }}>
            new photoshoot
          </div>
          <div style={{ color: "var(--fg-2)", fontSize: 13.5, marginTop: 4, lineHeight: 1.45 }}>
            pick a product · choose up to 4 templates · we cook a full set of on-brand variants.
          </div>
        </div>
        <Button variant="primary" icon={<Icons.Plus size={14}/>}
                 style={{ position: "relative", zIndex: 1 }}>
          start
        </Button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12,
                     fontSize: 12.5, color: "var(--fg-3)" }}>
        <span>just want to edit or generate a single image?</span>
        <a style={{ color: "var(--fg-1)", textDecoration: "none",
                     display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          → assets · generate or edit
        </a>
      </div>

      {/* PAST SHOOTS */}
      <div style={{ marginTop: 40 }}>
        <div className="section-head">
          <Icons.History size={15} className="muted"/>
          <span className="title">past photoshoots</span>
          <span className="count">· {PAST_SHOOTS.length}</span>
          <span className="ml-auto" style={{ display: "flex", gap: 14 }}>
            <a><Icons.Search size={12}/> search</a>
            <a>view all →</a>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {PAST_SHOOTS.map((p, i) => <PastShootCard key={i} {...p} />)}
        </div>
      </div>
    </PSShell>
  );
}

/* ─────────────────────────────────────────
   02 — builder
   ───────────────────────────────────────── */

const CATALOG_PRODUCTS = [
  { id: "csc-001", name: "cherry-smoked chili oil",  sku: "CSC-001",  thumb: "thumb-d", on: true },
  { id: "rh-04",   name: "reaper honey · 4oz",       sku: "RH-04",    thumb: "thumb-e", on: false },
  { id: "sum-s4",  name: "summer sampler box",       sku: "SUM-S4",   thumb: "thumb-a", on: false },
  { id: "gg-008",  name: "ginger gold sauce",        sku: "GG-008",   thumb: "thumb-h", on: false },
  { id: "mz-002",  name: "mezcal chimichurri",       sku: "MZ-002",   thumb: "thumb-c", on: false },
];

const TEMPLATE_GROUPS = [
  {
    id: "recommended", title: "recommended for cherry-smoked chili oil",
    badge: "based on brand dna",
    items: [
      { id: "studio-clean",  label: "studio · clean",  sub: "white sweep",    thumb: "thumb-g", ratio: "4:5", on: true },
      { id: "in-use",        label: "in use",          sub: "drizzle · hand", thumb: "thumb-d", ratio: "1:1", on: true },
      { id: "ingredient",    label: "ingredient",      sub: "chiles, smoke",  thumb: "thumb-e", ratio: "1:1", on: false },
      { id: "contextual",    label: "contextual",      sub: "kitchen scene",  thumb: "thumb-b", ratio: "9:16", on: true },
    ],
  },
  {
    id: "studio", title: "studio",
    items: [
      { id: "s-shadow",   label: "hard shadow",  sub: "sun · acute",  thumb: "thumb-e", ratio: "4:5", on: false },
      { id: "s-float",    label: "floating",     sub: "no surface",   thumb: "thumb-h", ratio: "4:5", on: false },
      { id: "s-pedestal", label: "pedestal",     sub: "marble · low", thumb: "thumb-g", ratio: "4:5", on: false },
      { id: "s-color",    label: "color block",  sub: "brand fill",   thumb: "thumb-a", ratio: "1:1", on: false },
    ],
  },
  {
    id: "lifestyle", title: "lifestyle · in use",
    items: [
      { id: "l-kitchen", label: "kitchen",     sub: "warm · morning",  thumb: "thumb-d", ratio: "9:16", on: false },
      { id: "l-outdoor", label: "outdoor",     sub: "patio · summer",  thumb: "thumb-a", ratio: "9:16", on: false },
      { id: "l-table",   label: "table scene", sub: "dinner · candle", thumb: "thumb-c", ratio: "1:1", on: false },
      { id: "l-hand",    label: "in hand",     sub: "human · scale",   thumb: "thumb-f", ratio: "4:5", on: false },
    ],
  },
  {
    id: "hero", title: "hero",
    items: [
      { id: "h-poster",  label: "poster",  sub: "vertical · type",  thumb: "thumb-c", ratio: "4:5", on: false },
      { id: "h-banner",  label: "banner",  sub: "wide · web",       thumb: "thumb-b", ratio: "16:9", on: false },
      { id: "h-splash",  label: "splash",  sub: "story · launch",   thumb: "thumb-d", ratio: "9:16", on: false },
    ],
  },
];

function ProductRow({ name, sku, thumb, on }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 8, borderRadius: 10,
      background: on ? "var(--volt-soft)" : "transparent",
      border: on ? "1px solid var(--line-volt)" : "1px solid transparent",
      cursor: "pointer", position: "relative",
    }}>
      <div className={`thumb ${thumb}`}
           style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                     position: "relative", overflow: "hidden" }}>
        <Icons.Bag size={13} style={{ position: "absolute", top: "50%", left: "50%",
                                       transform: "translate(-50%, -50%)",
                                       color: "rgba(255,255,255,0.6)" }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13, color: "var(--fg-0)",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                       color: "var(--fg-3)", letterSpacing: "0.05em" }}>{sku}</div>
      </div>
      {on && (
        <div style={{ width: 18, height: 18, borderRadius: 999,
                       background: "var(--volt)", color: "var(--fg-on-volt)",
                       display: "grid", placeItems: "center",
                       boxShadow: "0 0 12px var(--volt-glow)" }}>
          <Icons.Check size={11} strokeWidth={3}/>
        </div>
      )}
    </div>
  );
}

function TemplateTile({ label, sub, thumb, ratio, on }) {
  const [w, h] = ratio.split(":").map(Number);
  // Normalize to height = 130
  const targetH = 130;
  const targetW = Math.round(targetH * (w / h));
  return (
    <div style={{
      background: "var(--bg-2)",
      border: on ? "1px solid var(--volt)" : "1px solid var(--line-subtle)",
      borderRadius: 12, padding: 10, cursor: "pointer", position: "relative",
      transition: "all 160ms var(--ease-out)",
      boxShadow: on ? "0 0 0 1px var(--volt), 0 0 22px -8px var(--volt-glow)" : "none",
    }}>
      <div style={{ position: "relative", height: targetH, width: "100%",
                     borderRadius: 8, overflow: "hidden",
                     background: "var(--bg-3)" }}>
        <ProductShot thumb={thumb} padded={false} rounded={0}/>
        <div style={{ position: "absolute", bottom: 6, left: 6,
                       background: "rgba(0,0,0,0.55)",
                       backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                       borderRadius: 4, padding: "2px 6px",
                       fontFamily: "var(--font-mono)", fontSize: 9,
                       letterSpacing: "0.06em", color: "#fff" }}>
          {ratio}
        </div>
        {on && (
          <div style={{ position: "absolute", top: 6, right: 6,
                         width: 18, height: 18, borderRadius: 999,
                         background: "var(--volt)", color: "var(--fg-on-volt)",
                         display: "grid", placeItems: "center",
                         boxShadow: "0 0 12px var(--volt-glow)" }}>
            <Icons.Check size={11} strokeWidth={3}/>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                       fontSize: 13, color: on ? "var(--fg-0)" : "var(--fg-1)",
                       letterSpacing: "-0.01em" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                       color: "var(--fg-3)", letterSpacing: "0.04em",
                       marginTop: 2 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function ScreenPhotoshootBuilder() {
  const selectedCount = TEMPLATE_GROUPS.flatMap(g => g.items).filter(i => i.on).length;
  const ratios = [
    { id: "4:5",  label: "feed",   ratio: "4:5",  on: true  },
    { id: "9:16", label: "story",  ratio: "9:16", on: false },
    { id: "1:1",  label: "square", ratio: "1:1",  on: false },
  ];

  return (
    <PSShell back="back to photoshoot" bloom>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr",
                     gap: 28, paddingBottom: 96 /* room for sticky bar */ }}>

        {/* LEFT — product picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <span className="eyebrow">// step 1 · product</span>
            <h2 className="h2" style={{ marginTop: 6, fontSize: 26 }}>new photoshoot.</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              from your catalog — no re-uploading every time.
            </p>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                         borderRadius: 12, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8,
                           padding: "0 4px 6px", borderBottom: "1px solid var(--line-subtle)",
                           marginBottom: 6 }}>
              <span className="eyebrow">// from catalog</span>
              <a className="ml-auto" style={{ marginLeft: "auto", fontSize: 11.5,
                                              color: "var(--fg-2)", cursor: "pointer",
                                              textDecoration: "none" }}>
                upload new
              </a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {CATALOG_PRODUCTS.map(p => <ProductRow key={p.id} {...p} />)}
            </div>
            <div style={{ marginTop: 8, paddingTop: 8,
                           borderTop: "1px solid var(--line-subtle)",
                           fontFamily: "var(--font-mono)", fontSize: 10.5,
                           color: "var(--fg-3)", letterSpacing: "0.04em",
                           textAlign: "center" }}>
              5 of 28 products · search →
            </div>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                         borderRadius: 12, padding: 12 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
              // selected reference
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {["thumb-d", "thumb-c"].map((t, i) => (
                <div key={i} className={`thumb ${t}`}
                     style={{ width: 60, height: 60, borderRadius: 8, flexShrink: 0,
                               border: "1px solid var(--line-subtle)" }} />
              ))}
              <div style={{ width: 60, height: 60, borderRadius: 8,
                             border: "1px dashed var(--line)",
                             display: "grid", placeItems: "center",
                             color: "var(--fg-3)", cursor: "pointer" }}>
                <Icons.Plus size={14}/>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 8, lineHeight: 1.4 }}>
              2 product shots in catalog. add more for richer variants.
            </div>
          </div>
        </div>

        {/* RIGHT — templates */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <span className="eyebrow">// step 2 · templates</span>
            <span style={{ color: "var(--fg-2)", fontSize: 13 }}>
              pick up to 4 looks — we cook a full set of variants per look.
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11.5,
                            color: selectedCount > 4 ? "var(--danger)" : "var(--volt)",
                            background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                            padding: "3px 10px", borderRadius: 999, letterSpacing: "0.04em" }}>
              {selectedCount}/4 selected
            </span>
          </div>

          {TEMPLATE_GROUPS.map(g => (
            <div key={g.id} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                                fontSize: 14.5, letterSpacing: "-0.015em",
                                color: "var(--fg-0)" }}>
                  {g.title}
                </span>
                {g.badge && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                                  letterSpacing: "0.08em", textTransform: "uppercase",
                                  color: "var(--volt)", background: "var(--volt-soft)",
                                  border: "1px solid var(--line-volt)",
                                  padding: "2px 7px", borderRadius: 4 }}>
                    {g.badge}
                  </span>
                )}
              </div>
              <div style={{ display: "grid",
                             gridTemplateColumns: `repeat(${g.items.length}, 1fr)`,
                             gap: 10 }}>
                {g.items.map(t => <TemplateTile key={t.id} {...t} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STICKY action bar */}
      <div style={{ position: "sticky", bottom: 0, left: 0, right: 0,
                     marginTop: 24, padding: 12,
                     background: "rgba(15, 15, 22, 0.92)",
                     backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                     border: "1px solid var(--line)", borderRadius: 14,
                     display: "flex", alignItems: "center", gap: 16,
                     boxShadow: "0 -8px 32px -12px rgba(0,0,0,0.4)",
                     zIndex: 5 }}>
        {/* aspect ratio */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Crop size={14} className="muted"/>
          <span style={{ fontSize: 12, color: "var(--fg-2)" }}>ratio</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 2 }}>
            {ratios.map(r => (
              <Chip key={r.id} active={r.on}>
                {r.label}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                                color: r.on ? "var(--volt)" : "var(--fg-3)",
                                marginLeft: 4 }}>{r.ratio}</span>
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: "var(--line-subtle)" }}/>

        {/* variants */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Layers size={13} className="muted"/>
          <span style={{ fontSize: 12, color: "var(--fg-2)" }}>variants per template</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                         background: "var(--bg-3)", border: "1px solid var(--line)",
                         borderRadius: 999, padding: "3px 10px",
                         fontSize: 12.5, color: "var(--fg-0)", cursor: "pointer" }}>
            4
            <Icons.ChevronDown size={11} className="muted"/>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                          color: "var(--fg-2)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>
            3 templates × 4 variants
          </span>
          <Button variant="primary" icon={<Icons.Sparkles size={14}/>}>
            generate
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                            opacity: 0.7, marginLeft: 4 }}>· 60 buzz</span>
          </Button>
        </div>
      </div>
    </PSShell>
  );
}

/* ─────────────────────────────────────────
   03 — results
   ───────────────────────────────────────── */

function ResultCard({ template, ratio, state, thumb, headline }) {
  const [w, h] = ratio.split(":").map(Number);
  const done = state === "done";

  return (
    <div className="creative-card">
      <div className="creative-preview" style={{ aspectRatio: `${w}/${h}` }}>
        {done && (
          <>
            <ProductShot thumb={thumb} padded={false} rounded={0}/>
            <div style={{ position: "absolute", inset: 0,
                           background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 40%)" }}/>
            {headline && (
              <div style={{ position: "absolute", bottom: 10, left: 12, right: 12,
                             fontFamily: "var(--font-display)", fontWeight: 700,
                             fontSize: 13, letterSpacing: "-0.02em",
                             color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                             lineHeight: 1.15 }}>
                {headline}
              </div>
            )}
          </>
        )}
        {state === "cooking" && (
          <div className="cooking-state">
            <div style={{ width: 36, height: 36, borderRadius: 999,
                           background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                           display: "grid", placeItems: "center", color: "var(--volt)",
                           boxShadow: "var(--bloom-volt-sm)" }}>
              <Icons.Sparkles size={16}/>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                           fontSize: 13, color: "var(--fg-0)" }}>
              cooking…
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                           color: "var(--fg-2)", letterSpacing: "0.05em" }}>
              ~ 40s left
            </div>
          </div>
        )}
        {state === "queued" && (
          <div className="cooking-state">
            <Icons.History size={18} className="muted"/>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                           color: "var(--fg-2)", letterSpacing: "0.05em",
                           textTransform: "uppercase" }}>
              queued
            </div>
          </div>
        )}
        <div className="channel-tag">{template}</div>
        <div className="more-btn" style={{
          position: "absolute", top: 10, right: 10,
          width: 26, height: 26, borderRadius: 999,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
          color: "#fff", display: "grid", placeItems: "center", cursor: "pointer",
        }}>
          <Icons.MoreHorizontal size={13}/>
        </div>
        {/* ratio mini-tag */}
        <div style={{ position: "absolute", bottom: 8, right: 8,
                       fontFamily: "var(--font-mono)", fontSize: 9,
                       background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
                       color: "#fff", padding: "2px 5px", borderRadius: 3,
                       letterSpacing: "0.06em" }}>
          {ratio}
        </div>
      </div>
      {done && (
        <div className="footer">
          <button className="cbtn" style={{ width: 26, height: 26 }} title="regenerate">
            <Icons.Refresh size={11}/>
          </button>
          <button className="cbtn" style={{ width: 26, height: 26 }} title="download">
            <Icons.Download size={11}/>
          </button>
          <span style={{ flex: 1 }}/>
          <Button variant="ghost" size="sm" icon={<Icons.Megaphone size={11}/>}>
            to campaign
          </Button>
        </div>
      )}
      {state === "cooking" && (
        <div className="footer" style={{ justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: "var(--fg-3)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>
            variant 2 of 4
          </span>
        </div>
      )}
      {state === "queued" && (
        <div className="footer" style={{ justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: "var(--fg-3)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>
            waiting
          </span>
        </div>
      )}
    </div>
  );
}

function ScreenPhotoshootResults() {
  const groups = [
    {
      template: "studio · clean", ratio: "4:5",
      variants: [
        { state: "done",    thumb: "thumb-g", headline: "precision in every drop." },
        { state: "done",    thumb: "thumb-e", headline: "small-batch · austin." },
        { state: "cooking", thumb: "thumb-h" },
        { state: "queued",  thumb: "thumb-a" },
      ],
    },
    {
      template: "in use", ratio: "1:1",
      variants: [
        { state: "done", thumb: "thumb-d", headline: "drizzle on everything." },
        { state: "done", thumb: "thumb-a", headline: "pair with pizza, eggs, popcorn." },
        { state: "done", thumb: "thumb-c", headline: "founder's pour." },
        { state: "done", thumb: "thumb-h", headline: "summer cookout staple." },
      ],
    },
    {
      template: "contextual · kitchen", ratio: "9:16",
      variants: [
        { state: "done",    thumb: "thumb-b", headline: "morning prep, warm light." },
        { state: "done",    thumb: "thumb-c", headline: "weekend kitchen." },
        { state: "cooking", thumb: "thumb-d" },
        { state: "queued",  thumb: "thumb-e" },
      ],
    },
  ];

  const total = groups.reduce((a, g) => a + g.variants.length, 0);
  const done = groups.reduce((a, g) => a + g.variants.filter(v => v.state === "done").length, 0);
  const cooking = total - done;

  return (
    <PSShell back="back to photoshoot">
      {/* Header — source / title / actions */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 280px",
                     gap: 24, alignItems: "start" }}>
        {/* source product card */}
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                       borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.Bag size={13} className="muted"/>
            <span className="eyebrow">// source product</span>
            <span style={{ flex: 1 }}/>
            <button className="cbtn" style={{ width: 24, height: 24 }}>
              <Icons.Pencil size={11}/>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div className={`thumb thumb-d`}
                 style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                           position: "relative" }}>
              <Icons.Bag size={16} style={{ position: "absolute", top: "50%", left: "50%",
                                              transform: "translate(-50%, -50%)",
                                              color: "rgba(255,255,255,0.6)" }}/>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                             fontSize: 14, letterSpacing: "-0.015em",
                             color: "var(--fg-0)", lineHeight: 1.2 }}>
                cherry-smoked chili oil
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                             color: "var(--fg-3)", letterSpacing: "0.05em",
                             marginTop: 3 }}>
                CSC-001 · 2 reference shots
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              // templates · 3
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip active>studio · clean</Chip>
              <Chip active>in use</Chip>
              <Chip active>contextual</Chip>
            </div>
          </div>
        </div>

        {/* center title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 999,
                         background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                         display: "grid", placeItems: "center", color: "var(--volt)",
                         margin: "0 auto 8px", boxShadow: "var(--bloom-volt-sm)" }}>
            <Icons.Camera size={20}/>
          </div>
          <span className="eyebrow">// step 3 · results</span>
          <h1 className="h1" style={{ marginTop: 4, fontSize: 36 }}>summer studio · chili oil.</h1>
          <p style={{ color: "var(--fg-2)", fontSize: 14, marginTop: 8,
                       maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            {done} of {total} shots ready · {cooking} still cooking. download any, regenerate any,
            push to a campaign.
          </p>
        </div>

        {/* right actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <Badge kind="gen">cooking · {cooking}</Badge>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="cbtn" title="regenerate all"><Icons.Refresh size={14}/></button>
            <button className="cbtn" title="download all"><Icons.Download size={14}/></button>
            <button className="cbtn" title="more"><Icons.MoreHorizontal size={14}/></button>
          </div>
          <Button variant="primary" icon={<Icons.Megaphone size={13}/>}
                   style={{ marginTop: 4 }}>
            send all to campaign
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 14 }}>
        <Chip active>all · {total}</Chip>
        {groups.map((g, i) => (
          <Chip key={i}>{g.template} · {g.variants.length}</Chip>
        ))}
        <span style={{ flex: 1 }}/>
        <Chip><Icons.Layers size={11}/> by template</Chip>
        <Chip><Icons.Image size={11}/> grid</Chip>
      </div>

      {/* Grouped rows */}
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: 14, letterSpacing: "-0.015em", color: "var(--fg-0)" }}>
              {g.template}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--fg-3)", letterSpacing: "0.04em" }}>
              · {g.variants.filter(v => v.state === "done").length}/{g.variants.length} ready
            </span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center",
                            gap: 5, color: "var(--fg-2)", fontSize: 12, cursor: "pointer" }}>
              <Icons.Refresh size={11}/> regenerate template
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                              color: "var(--buzz)", marginLeft: 2 }}>· 20 buzz</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14,
                         alignItems: "start" }}>
            {g.variants.map((v, vi) => (
              <ResultCard key={vi} template={g.template} ratio={g.ratio} {...v}/>
            ))}
          </div>
        </div>
      ))}
    </PSShell>
  );
}

/* ─────────────────────────────────────────
   App mount
   ───────────────────────────────────────── */
function App() {
  const screens = [
    { id: "list",    label: "01 · photoshoot · past + new",     node: <ScreenPhotoshootList />,    h: 900  },
    { id: "builder", label: "02 · builder · product + templates", node: <ScreenPhotoshootBuilder />, h: 1100 },
    { id: "results", label: "03 · results · cooking + ready",    node: <ScreenPhotoshootResults />, h: 1180 },
  ];
  return (
    <DesignCanvas
      title="vitrine · photoshoot (hi-fi)"
      subtitle="3 screens · dark theme · product → templates → variants"
    >
      <DCSection id="flow" title="photoshoot flow"
                 subtitle="single CTA, catalog-aware product, per-shot regenerate + send to campaign.">
        {screens.map(s => (
          <DCArtboard key={s.id} id={s.id} label={s.label} width={1280} height={s.h}>
            {s.node}
          </DCArtboard>
        ))}
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
