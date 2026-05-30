/* Mobile photoshoot — 3 screens: list, builder, results */

const M_PAST_SHOOTS = [
  { name: "summer studio · chili oil",  date: "yesterday",  count: "8 shots",
    ratios: ["4:5", "1:1", "9:16"], thumbs: ["thumb-e", "thumb-a", "thumb-d", "thumb-c"] },
  { name: "in-use · lifestyle set",     date: "4 days ago", count: "6 shots",
    ratios: ["9:16", "4:5"],        thumbs: ["thumb-b", "thumb-g", "thumb-h", "thumb-a"] },
  { name: "founder's table",            date: "12 feb",     count: "4 shots",
    ratios: ["1:1"],                thumbs: ["thumb-d", "thumb-e", "thumb-c", "thumb-a"] },
  { name: "valentine's hero",           date: "6 feb",      count: "3 shots",
    ratios: ["16:9", "1:1"],        thumbs: ["thumb-d", "thumb-c", "thumb-a", "thumb-h"] },
];

function MPastShootCard({ name, date, count, ratios, thumbs }) {
  return (
    <div className="m-card tap" style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3,
                     borderRadius: 8, overflow: "hidden" }}>
        {thumbs.slice(0, 4).map((t, i) => (
          <div key={i} className={`thumb ${t}`}
               style={{ aspectRatio: "1/1", borderRadius: 2 }}>
            <div style={{ position: "absolute", inset: 0,
                            background: "radial-gradient(ellipse at 50% 90%, rgba(0,0,0,0.45), transparent 55%)" }}/>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="tile-title" style={{ fontSize: 13.5 }}>{name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                        color: "var(--fg-3)", letterSpacing: "0.04em", marginTop: 3 }}>
          {date} · {count}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {ratios.map((r, i) => (
            <span key={i} style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "2px 6px", borderRadius: 4,
              border: "1px solid var(--line-subtle)", color: "var(--fg-2)",
              letterSpacing: "0.04em",
            }}>{r}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── 01 — Photoshoot list ───────────── */
function MobilePhotoshootList() {
  return (
    <ScreenFrame bloom activeTab="photoshoot">
      <MobileTopBar leadingLogo title="photoshoot" action={<MobileBuzzPill amount={1240}/>}/>

      <div style={{ marginTop: 12, textAlign: "center" }}>
        <span className="m-eyebrow">// product photography, generated</span>
        <h1 className="m-h1" style={{ marginTop: 8, fontSize: 36 }}>photoshoot.</h1>
        <p className="m-lede" style={{ maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
          one product → studio, in-use, ingredient, hero. on-brand.
        </p>
      </div>

      {/* HERO CTA card */}
      <div className="m-card" style={{
        marginTop: 18, padding: 14,
        background: "linear-gradient(180deg, var(--bg-2), var(--bg-1))",
        position: "relative", overflow: "hidden",
        border: "1px solid var(--line-volt)",
      }}>
        <div style={{ position: "absolute", inset: 0,
                        background: "radial-gradient(ellipse at 100% 50%, rgba(0,255,157,0.12), transparent 60%)",
                        pointerEvents: "none" }}/>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12,
                          background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                          display: "grid", placeItems: "center", color: "var(--volt)",
                          boxShadow: "var(--bloom-volt-sm)", flexShrink: 0 }}>
            <Icons.Camera size={20}/>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: 16, letterSpacing: "-0.02em", color: "var(--fg-0)",
                            lineHeight: 1.15 }}>
              new photoshoot
            </div>
            <div style={{ color: "var(--fg-2)", fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
              pick a product · up to 4 templates · we cook variants.
            </div>
          </div>
          <Icons.ChevronRight size={16} className="muted"/>
        </div>
        <button className="m-cta" style={{ marginTop: 12, height: 44, borderRadius: 12, fontSize: 14 }}>
          <Icons.Plus size={14}/> start a shoot
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10,
                     fontSize: 11.5, color: "var(--fg-3)", flexWrap: "wrap" }}>
        <span>just one image?</span>
        <a style={{ color: "var(--fg-1)", textDecoration: "none", cursor: "pointer" }}>
          → assets · generate
        </a>
      </div>

      {/* Past shoots — 2-col grid */}
      <MobileSectionHead icon={<Icons.History size={13}/>}
                          title="past photoshoots"
                          count={`· ${M_PAST_SHOOTS.length}`}
                          action={<>view all →</>}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {M_PAST_SHOOTS.map((p, i) => <MPastShootCard key={i} {...p}/>)}
      </div>

      <div style={{ height: 60 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 02 — Photoshoot builder ───────────── */

const M_CATALOG_PRODUCTS = [
  { id: "csc-001", name: "cherry-smoked chili oil",  sku: "CSC-001",  thumb: "thumb-d", on: true },
  { id: "rh-04",   name: "reaper honey · 4oz",       sku: "RH-04",    thumb: "thumb-e", on: false },
  { id: "sum-s4",  name: "summer sampler box",       sku: "SUM-S4",   thumb: "thumb-a", on: false },
  { id: "gg-008",  name: "ginger gold sauce",        sku: "GG-008",   thumb: "thumb-h", on: false },
];

const M_TEMPLATE_GROUPS = [
  {
    id: "recommended", title: "recommended",
    badge: "based on brand dna",
    items: [
      { label: "studio · clean",  sub: "white sweep",    thumb: "thumb-g", ratio: "4:5",  on: true  },
      { label: "in use",          sub: "drizzle · hand", thumb: "thumb-d", ratio: "1:1",  on: true  },
      { label: "ingredient",      sub: "chiles, smoke",  thumb: "thumb-e", ratio: "1:1",  on: false },
      { label: "contextual",      sub: "kitchen scene",  thumb: "thumb-b", ratio: "9:16", on: true  },
    ],
  },
  {
    id: "studio", title: "studio",
    items: [
      { label: "hard shadow",  sub: "sun · acute",   thumb: "thumb-e", ratio: "4:5", on: false },
      { label: "floating",     sub: "no surface",    thumb: "thumb-h", ratio: "4:5", on: false },
      { label: "pedestal",     sub: "marble · low",  thumb: "thumb-g", ratio: "4:5", on: false },
      { label: "color block",  sub: "brand fill",    thumb: "thumb-a", ratio: "1:1", on: false },
    ],
  },
];

function MProductChip({ name, sku, thumb, on }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 10px 6px 6px",
      background: on ? "var(--volt-soft)" : "var(--bg-2)",
      border: on ? "1px solid var(--line-volt)" : "1px solid var(--line-subtle)",
      borderRadius: 999, flexShrink: 0,
      cursor: "pointer",
    }}>
      <div className={`thumb ${thumb}`}
           style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0,
                     position: "relative", overflow: "hidden" }}>
        <Icons.Bag size={10} style={{ position: "absolute", top: "50%", left: "50%",
                                         transform: "translate(-50%, -50%)",
                                         color: "rgba(255,255,255,0.6)" }}/>
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-0)",
                       whiteSpace: "nowrap" }}>{name}</span>
      {on && (
        <span style={{ width: 14, height: 14, borderRadius: 999,
                         background: "var(--volt)", color: "var(--fg-on-volt)",
                         display: "grid", placeItems: "center" }}>
          <Icons.Check size={9} strokeWidth={3}/>
        </span>
      )}
    </div>
  );
}

function MTemplateTile({ label, sub, thumb, ratio, on }) {
  const [w, h] = ratio.split(":").map(Number);
  return (
    <div style={{
      background: "var(--bg-2)",
      border: on ? "1px solid var(--volt)" : "1px solid var(--line-subtle)",
      borderRadius: 12, padding: 8, cursor: "pointer", position: "relative",
      boxShadow: on ? "0 0 0 1px var(--volt), 0 0 18px -6px var(--volt-glow)" : "none",
    }}>
      <div style={{ position: "relative", height: 110,
                     borderRadius: 8, overflow: "hidden",
                     background: "var(--bg-3)" }}>
        <MobileProductShot thumb={thumb}/>
        <div style={{ position: "absolute", bottom: 4, left: 4,
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                        borderRadius: 3, padding: "1px 5px",
                        fontFamily: "var(--font-mono)", fontSize: 8.5,
                        letterSpacing: "0.06em", color: "#fff" }}>
          {ratio}
        </div>
        {on && (
          <div style={{ position: "absolute", top: 4, right: 4,
                          width: 18, height: 18, borderRadius: 999,
                          background: "var(--volt)", color: "var(--fg-on-volt)",
                          display: "grid", placeItems: "center",
                          boxShadow: "0 0 10px var(--volt-glow)" }}>
            <Icons.Check size={10} strokeWidth={3}/>
          </div>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                        fontSize: 12, color: on ? "var(--fg-0)" : "var(--fg-1)",
                        letterSpacing: "-0.01em" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                        color: "var(--fg-3)", letterSpacing: "0.04em", marginTop: 1 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function MobilePhotoshootBuilder() {
  const selected = M_TEMPLATE_GROUPS.flatMap(g => g.items).filter(i => i.on).length;

  return (
    <ScreenFrame tabBar={false} stickyCTA={
      <>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                         letterSpacing: "0.06em", textTransform: "uppercase",
                         color: "var(--fg-2)" }}>3 templates × 4 variants</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                         color: "var(--buzz)", letterSpacing: "0.04em", marginTop: 2 }}>
            · 60 buzz
          </div>
        </div>
        <button className="m-cta" style={{ width: "auto", padding: "0 18px", height: 44,
                                              fontSize: 14, borderRadius: 12 }}>
          <Icons.Sparkles size={14}/> generate
        </button>
      </>
    }>
      <MobileTopBar back title="new photoshoot"/>

      {/* Step 1 — product */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="m-eyebrow">// step 1 · product</span>
          <a style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg-2)",
                       cursor: "pointer" }}>upload new</a>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto",
                       margin: "10px -16px 0", padding: "0 16px 4px",
                       scrollbarWidth: "none" }}>
          {M_CATALOG_PRODUCTS.map(p => <MProductChip key={p.id} {...p}/>)}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                       color: "var(--fg-3)", letterSpacing: "0.04em",
                       marginTop: 8 }}>
          1 selected · cherry-smoked chili oil · 2 reference shots
        </div>
      </div>

      {/* Step 2 — templates */}
      <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="m-eyebrow">// step 2 · templates</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11,
                         color: "var(--volt)",
                         background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                         padding: "3px 9px", borderRadius: 999, letterSpacing: "0.04em" }}>
          {selected}/4 selected
        </span>
      </div>
      <p style={{ color: "var(--fg-2)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        pick up to 4 looks. we cook a full set of variants per look.
      </p>

      {M_TEMPLATE_GROUPS.map(g => (
        <div key={g.id} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: 13.5, letterSpacing: "-0.015em",
                            color: "var(--fg-0)" }}>{g.title}</span>
            {g.badge && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                              letterSpacing: "0.08em", textTransform: "uppercase",
                              color: "var(--volt)", background: "var(--volt-soft)",
                              border: "1px solid var(--line-volt)",
                              padding: "2px 6px", borderRadius: 4 }}>
                {g.badge}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {g.items.map((t, i) => <MTemplateTile key={i} {...t}/>)}
          </div>
        </div>
      ))}

      {/* Step 3 — ratio + variants */}
      <div style={{ marginTop: 18 }}>
        <span className="m-eyebrow">// step 3 · settings</span>
        <div className="m-card" style={{ marginTop: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.Crop size={13} className="muted"/>
            <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>ratio</span>
            <span style={{ flex: 1 }}/>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { l: "feed",   r: "4:5",  on: true },
                { l: "story",  r: "9:16", on: false },
                { l: "square", r: "1:1",  on: false },
              ].map(x => (
                <span key={x.r} className={`chip ${x.on ? "active" : ""}`}
                       style={{ fontSize: 11, padding: "3px 9px" }}>
                  {x.l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: "var(--line-subtle)", margin: "10px 0" }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.Layers size={13} className="muted"/>
            <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>variants per template</span>
            <span style={{ flex: 1 }}/>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            background: "var(--bg-3)", border: "1px solid var(--line)",
                            borderRadius: 999, padding: "3px 10px",
                            fontSize: 12, color: "var(--fg-0)", cursor: "pointer" }}>
              4
              <Icons.ChevronDown size={10} className="muted"/>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 80 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 03 — Photoshoot results ───────────── */
function MResultCard({ template, ratio, state, thumb, headline }) {
  const [w, h] = ratio.split(":").map(Number);
  const done = state === "done";
  return (
    <div className="creative-card" style={{ borderRadius: 12 }}>
      <div className="creative-preview" style={{ aspectRatio: `${w}/${h}` }}>
        {done && (
          <>
            <MobileProductShot thumb={thumb}/>
            <div style={{ position: "absolute", inset: 0,
                            background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 40%)" }}/>
            {headline && (
              <div style={{ position: "absolute", bottom: 8, left: 10, right: 10,
                              fontFamily: "var(--font-display)", fontWeight: 700,
                              fontSize: 11, letterSpacing: "-0.02em",
                              color: "#fff", lineHeight: 1.15,
                              textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
                {headline}
              </div>
            )}
          </>
        )}
        {state === "cooking" && (
          <div className="cooking-state">
            <div style={{ width: 28, height: 28, borderRadius: 999,
                            background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                            display: "grid", placeItems: "center", color: "var(--volt)" }}>
              <Icons.Sparkles size={12}/>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                            color: "var(--fg-2)", letterSpacing: "0.05em" }}>cooking</div>
          </div>
        )}
        {state === "queued" && (
          <div className="cooking-state">
            <Icons.History size={16} className="muted"/>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                            color: "var(--fg-2)", letterSpacing: "0.05em",
                            textTransform: "uppercase" }}>queued</div>
          </div>
        )}
        <div className="channel-tag" style={{ fontSize: 8.5, padding: "2px 6px" }}>{template}</div>
      </div>
    </div>
  );
}

function MobilePhotoshootResults() {
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
        { state: "done", thumb: "thumb-a", headline: "pair with pizza." },
        { state: "done", thumb: "thumb-c", headline: "founder's pour." },
        { state: "done", thumb: "thumb-h", headline: "summer staple." },
      ],
    },
    {
      template: "kitchen · contextual", ratio: "9:16",
      variants: [
        { state: "done",    thumb: "thumb-b", headline: "morning prep." },
        { state: "done",    thumb: "thumb-c", headline: "weekend kitchen." },
        { state: "cooking", thumb: "thumb-d" },
        { state: "queued",  thumb: "thumb-e" },
      ],
    },
  ];
  const total = groups.reduce((a, g) => a + g.variants.length, 0);
  const done = groups.reduce((a, g) => a + g.variants.filter(v => v.state === "done").length, 0);

  return (
    <ScreenFrame activeTab="photoshoot">
      <MobileTopBar back title="summer studio"
        action={<button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>}/>

      {/* hero */}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <div style={{ width: 44, height: 44, borderRadius: 999,
                        background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                        display: "grid", placeItems: "center", color: "var(--volt)",
                        margin: "0 auto", boxShadow: "var(--bloom-volt-sm)" }}>
          <Icons.Camera size={18}/>
        </div>
        <span className="m-eyebrow" style={{ display: "block", marginTop: 8 }}>// step 3 · results</span>
        <h1 className="m-h1" style={{ marginTop: 4, fontSize: 26 }}>summer studio · chili oil.</h1>
        <div style={{ marginTop: 8, display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <Badge kind="gen">cooking · {total - done}</Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-2)", letterSpacing: "0.04em",
                          padding: "3px 8px", borderRadius: 6,
                          background: "var(--bg-2)", border: "1px solid var(--line-subtle)" }}>
            {done}/{total} ready
          </span>
        </div>
      </div>

      {/* source product card */}
      <div className="m-card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="thumb thumb-d" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                                                       position: "relative" }}>
            <Icons.Bag size={13} style={{ position: "absolute", top: "50%", left: "50%",
                                            transform: "translate(-50%, -50%)",
                                            color: "rgba(255,255,255,0.6)" }}/>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: 13.5, letterSpacing: "-0.015em",
                            color: "var(--fg-0)" }}>cherry-smoked chili oil</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--fg-3)", letterSpacing: "0.04em", marginTop: 2 }}>
              CSC-001 · 3 templates
            </div>
          </div>
          <button className="m-icon-btn" style={{ width: 30, height: 30 }}>
            <Icons.Pencil size={12}/>
          </button>
        </div>
      </div>

      {/* filter pills */}
      <div className="m-pills" style={{ marginTop: 14 }}>
        <Chip active>all · {total}</Chip>
        {groups.map((g, i) => (
          <Chip key={i}>{g.template} · {g.variants.length}</Chip>
        ))}
      </div>

      {/* groups */}
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: 13, letterSpacing: "-0.015em", color: "var(--fg-0)" }}>
              {g.template}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                            color: "var(--fg-3)", letterSpacing: "0.04em" }}>
              · {g.variants.filter(v => v.state === "done").length}/{g.variants.length}
            </span>
            <span style={{ marginLeft: "auto", color: "var(--fg-2)", fontSize: 11,
                            display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <Icons.Refresh size={10}/> regen
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--buzz)" }}>· 20</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {g.variants.map((v, vi) => <MResultCard key={vi} template={g.template} ratio={g.ratio} {...v}/>)}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        <button className="m-cta secondary sm" style={{ flex: 1 }}>
          <Icons.Download size={13}/> download
        </button>
        <button className="m-cta sm" style={{ flex: 1 }}>
          <Icons.Megaphone size={13}/> to campaign
        </button>
      </div>

      <div style={{ height: 30 }}/>
    </ScreenFrame>
  );
}

Object.assign(window, {
  MobilePhotoshootList, MobilePhotoshootBuilder, MobilePhotoshootResults,
});
