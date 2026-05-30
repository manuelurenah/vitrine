/* Mobile catalog & assets — 8 screens.
   These live under the "brand" bottom-tab; the screen header carries
   an inner tab strip (dna · catalog · assets · book) for switching. */

const M_PRODUCTS = [
  { id: "cherry",   name: "cherry-smoked chili oil",  meta: "3 photos · 4 oz jar",  status: "live",  thumb: "thumb-g" },
  { id: "garlic",   name: "garlic confit chili oil",  meta: "2 photos · 4 oz jar",  status: "live",  thumb: "thumb-e" },
  { id: "trio",     name: "hot pepper trio gift box", meta: "5 photos · gift set",  status: "live",  thumb: "thumb-d" },
  { id: "midnight", name: "extra-spicy 'midnight'",    meta: "2 photos · seasonal", status: "draft", thumb: "thumb-c" },
  { id: "sampler",  name: "market sampler pack",      meta: "4 photos · sampler",   status: "live",  thumb: "thumb-f" },
  { id: "apron",    name: "merch · branded apron",    meta: "1 photo · merch",      status: "live",  thumb: "thumb-h" },
  { id: "cap",      name: "merch · cap",              meta: "no photos yet",        status: "draft", thumb: null      },
  { id: "holiday",  name: "holiday bundle",           meta: "3 photos · gift",      status: "live",  thumb: "thumb-a" },
];

/* Brand sub-tabs (under topbar) */
function BrandSubTabs({ active = "catalog" }) {
  const items = [
    { id: "dna",     label: "dna"     },
    { id: "catalog", label: "catalog" },
    { id: "assets",  label: "assets"  },
    { id: "book",    label: "book"    },
  ];
  return (
    <div className="m-pills" style={{ marginTop: 6, paddingBottom: 8 }}>
      {items.map(t => (
        <span key={t.id} className={`chip ${active === t.id ? "active" : ""}`}
               style={{ fontSize: 12.5, padding: "5px 12px" }}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

/* ───────────── 01 — Catalog grid ───────────── */
function MProductCard({ name, meta, status, thumb }) {
  return (
    <div className="m-card tap" style={{ padding: 10, position: "relative" }}>
      <div style={{ position: "relative", aspectRatio: "1/1",
                     borderRadius: 10, overflow: "hidden",
                     background: thumb ? undefined : "var(--bg-3)",
                     border: thumb ? "0" : "1px dashed var(--line)" }}>
        {thumb ? (
          <MobileProductShot thumb={thumb}/>
        ) : (
          <div style={{ position: "absolute", inset: 0,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 6,
                          color: "var(--fg-3)" }}>
            <Icons.Camera size={20}/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                              letterSpacing: "0.06em", textTransform: "uppercase" }}>
              no photo
            </span>
          </div>
        )}
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <Badge kind={status}>{status}</Badge>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                        fontSize: 13, letterSpacing: "-0.015em", color: "var(--fg-0)",
                        lineHeight: 1.2,
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                        color: "var(--fg-3)", letterSpacing: "0.04em", marginTop: 3 }}>
          {meta}
        </div>
      </div>
    </div>
  );
}

function MobileCatalogGrid() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand"
        action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="catalog"/>

      <div style={{ marginTop: 4 }}>
        <span className="m-eyebrow">// brand DNA · catalog</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>
          your products.
        </h1>
        <p className="m-lede">
          everything you sell. campaigns + shoots pick from this list.
        </p>
      </div>

      {/* search + add */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{
          flex: 1, height: 40, padding: "0 12px",
          background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
          borderRadius: 12,
          display: "flex", alignItems: "center", gap: 8,
          color: "var(--fg-2)", fontSize: 13,
        }}>
          <Icons.Search size={13}/> search products
        </div>
        <button className="m-icon-btn" style={{ width: 40, height: 40, borderRadius: 12 }}>
          <Icons.MoreHorizontal size={14}/>
        </button>
      </div>

      {/* filters */}
      <div className="m-pills" style={{ marginTop: 12 }}>
        <Chip active>all · {M_PRODUCTS.length}</Chip>
        <Chip>live · 6</Chip>
        <Chip>draft · 2</Chip>
        <Chip>merch · 2</Chip>
      </div>

      {/* grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                     gap: 10, marginTop: 14 }}>
        {M_PRODUCTS.map(p => <MProductCard key={p.id} {...p}/>)}
      </div>

      <div style={{ height: 90 }}/>
      <FAB icon={<Icons.Plus size={18}/>} label="add"/>
    </ScreenFrame>
  );
}

/* ───────────── 02 — Catalog empty ───────────── */
function MobileCatalogEmpty() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand"
        action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="catalog"/>

      <div style={{ marginTop: 4 }}>
        <span className="m-eyebrow">// brand DNA · catalog</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>
          your products.
        </h1>
        <p className="m-lede">
          add what you sell — once. campaigns and shoots can then pull from this list.
        </p>
      </div>

      {/* primary CTA */}
      <button className="m-cta" style={{ marginTop: 18 }}>
        <Icons.Plus size={16}/> add your first product
      </button>

      {/* big empty card */}
      <div style={{
        marginTop: 22,
        padding: "32px 22px",
        background: "var(--bg-1)",
        border: "1.5px dashed var(--line)",
        borderRadius: 18,
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 12,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                        background: "radial-gradient(ellipse at 50% 0%, rgba(0,255,157,0.10), transparent 60%)" }}/>
        <div style={{ width: 56, height: 56, borderRadius: 16,
                        background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                        display: "grid", placeItems: "center", color: "var(--volt)",
                        boxShadow: "var(--bloom-volt-sm)", position: "relative" }}>
          <Icons.Bag size={26}/>
        </div>
        <div className="m-h3" style={{ fontSize: 18, position: "relative" }}>
          no products yet.
        </div>
        <div style={{ color: "var(--fg-2)", fontSize: 13, lineHeight: 1.5,
                        maxWidth: 280, position: "relative" }}>
          a product is a name, photos, and tags. that's it — we'll handle the campaigns.
        </div>

        {/* What you get */}
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column",
                        gap: 8, position: "relative", width: "100%" }}>
          {[
            { icon: <Icons.Camera size={13}/>, t: "auto-generate studio shots" },
            { icon: <Icons.Megaphone size={13}/>, t: "reusable across campaigns" },
            { icon: <Icons.Dna size={13}/>, t: "tied to your brand DNA" },
          ].map((x, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", background: "var(--bg-2)",
              border: "1px solid var(--line-subtle)", borderRadius: 10,
              fontSize: 12.5, color: "var(--fg-1)",
            }}>
              <span style={{ color: "var(--volt)" }}>{x.icon}</span>
              {x.t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a style={{ color: "var(--fg-2)", fontSize: 12.5, cursor: "pointer" }}>
          → or jump to assets · logos &amp; references
        </a>
      </div>

      <div style={{ height: 50 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 03 — Catalog · add sheet ───────────── */
function MobileCatalogAdd() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand"
        action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="catalog"/>

      {/* faded grid behind */}
      <div style={{ opacity: 0.3, pointerEvents: "none", marginTop: 4 }}>
        <span className="m-eyebrow">// brand DNA · catalog</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>your products.</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 10, marginTop: 14 }}>
          {M_PRODUCTS.slice(0, 4).map(p => <MProductCard key={p.id} {...p}/>)}
        </div>
      </div>

      <div className="m-sheet-wrap">
        <div className="m-sheet-scrim"/>
        <div className="m-sheet" style={{ maxHeight: "86%" }}>
          <div className="m-sheet-handle"/>
          <div className="m-sheet-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="m-eyebrow-sm">// add to catalog</span>
              <div className="m-sheet-title">new product</div>
            </div>
            <button className="m-icon-btn"><Icons.X size={14}/></button>
          </div>
          <div className="m-sheet-body">
            {/* photo upload */}
            <button style={{
              width: "100%", background: "transparent",
              border: "1.5px dashed var(--line)", borderRadius: 14,
              padding: "20px 14px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              color: "var(--fg-1)", cursor: "pointer", fontFamily: "inherit",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12,
                              background: "var(--bg-2)", border: "1px solid var(--line)",
                              display: "grid", placeItems: "center", color: "var(--fg-2)" }}>
                <Icons.Upload size={20}/>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg-0)" }}>
                drop product photos
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                              color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                JPG · PNG · up to 10 mb each
              </div>
            </button>

            {/* fields */}
            <div style={{ marginTop: 14 }}>
              <label className="field-label">name</label>
              <input className="input" placeholder="e.g. cherry-smoked chili oil"
                      defaultValue="cherry-smoked chili oil"/>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="field-label">sku · optional</label>
              <input className="input" placeholder="CSC-001"/>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="field-label">notes</label>
              <textarea className="textarea" rows={3}
                placeholder="slow-smoked cherrywood + arbol chiles, jarred in 4 oz."
                defaultValue="slow-smoked cherrywood + arbol chiles, jarred in 4 oz."/>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="field-label">tags</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["flagship", "spicy", "small-batch"].map(t => (
                  <Chip key={t} active>{t} <Icons.X size={9}/></Chip>
                ))}
                <Chip className="ghost"><Icons.Plus size={10}/> add</Chip>
              </div>
            </div>

            <div style={{
              marginTop: 22, paddingTop: 14,
              borderTop: "1px solid var(--line-subtle)",
              display: "flex", gap: 8,
            }}>
              <button className="m-cta secondary sm" style={{ flex: 1 }}>cancel</button>
              <button className="m-cta sm" style={{ flex: 1.4 }}>
                <Icons.Check size={14}/> add product
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

/* ───────────── 04 — Catalog · detail ───────────── */
function MobileCatalogDetail() {
  return (
    <ScreenFrame activeTab="brand">
      <MobileTopBar back title="cherry-smoked chili oil"
        action={<button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>}/>

      {/* hero photo */}
      <div className="thumb thumb-g" style={{
        marginTop: 8, width: "100%", aspectRatio: "4/3",
        borderRadius: 16, overflow: "hidden", position: "relative",
      }}>
        <MobileProductShot thumb="thumb-g"/>
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <Badge kind="live">live</Badge>
        </div>
      </div>

      {/* thumb strip */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto",
                     scrollbarWidth: "none" }}>
        {["thumb-g", "thumb-d", "thumb-e"].map((t, i) => (
          <div key={i} className={`thumb ${t}`} style={{
            width: 64, height: 64, borderRadius: 8, flexShrink: 0,
            border: i === 0 ? "2px solid var(--volt)" : "1px solid var(--line-subtle)",
            position: "relative",
          }}/>
        ))}
        <div style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0,
                       border: "1px dashed var(--line)",
                       display: "grid", placeItems: "center",
                       color: "var(--fg-3)", cursor: "pointer" }}>
          <Icons.Plus size={16}/>
        </div>
      </div>

      {/* header */}
      <div style={{ marginTop: 16 }}>
        <h2 className="m-h1" style={{ fontSize: 26 }}>cherry-smoked<br/>chili oil.</h2>
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          {["flagship", "spicy", "small-batch", "4oz"].map(t => (
            <span key={t} style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5,
              padding: "2px 7px", borderRadius: 4,
              border: "1px solid var(--line-subtle)", color: "var(--fg-2)",
              letterSpacing: "0.04em",
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* meta */}
      <div className="m-card" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between",
                        fontFamily: "var(--font-mono)", fontSize: 10.5,
                        color: "var(--fg-3)", letterSpacing: "0.06em",
                        textTransform: "uppercase" }}>
          <span>sku</span><span style={{ color: "var(--fg-0)" }}>CSC-001</span>
        </div>
        <div style={{ height: 1, background: "var(--line-subtle)", margin: "8px 0" }}/>
        <div style={{ display: "flex", justifyContent: "space-between",
                        fontFamily: "var(--font-mono)", fontSize: 10.5,
                        color: "var(--fg-3)", letterSpacing: "0.06em",
                        textTransform: "uppercase" }}>
          <span>added</span><span style={{ color: "var(--fg-0)" }}>jan 14, 2026</span>
        </div>
        <div style={{ height: 1, background: "var(--line-subtle)", margin: "8px 0" }}/>
        <div style={{ display: "flex", justifyContent: "space-between",
                        fontFamily: "var(--font-mono)", fontSize: 10.5,
                        color: "var(--fg-3)", letterSpacing: "0.06em",
                        textTransform: "uppercase" }}>
          <span>used in</span>
          <span style={{ color: "var(--fg-0)" }}>4 campaigns · 2 shoots</span>
        </div>
      </div>

      {/* notes */}
      <div className="m-card" style={{ marginTop: 10, padding: 12 }}>
        <span className="m-eyebrow-sm">// notes</span>
        <p style={{ marginTop: 8, fontSize: 13, color: "var(--fg-1)", lineHeight: 1.5 }}>
          slow-smoked cherrywood + arbol chiles, jarred small-batch in austin. flagship oil.
        </p>
      </div>

      {/* used in */}
      <MobileSectionHead icon={<Icons.Megaphone size={13}/>}
                          title="used in campaigns" count="· 4"
                          action={<>view all →</>}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {["thumb-d", "thumb-a", "thumb-c"].map((t, i) => (
          <div key={i} className={`thumb ${t}`} style={{
            aspectRatio: "1/1", borderRadius: 8, position: "relative",
          }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                            padding: "4px 6px",
                            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                            fontFamily: "var(--font-mono)", fontSize: 8,
                            color: "#fff", letterSpacing: "0.04em",
                            textTransform: "uppercase" }}>
              campaign
            </div>
          </div>
        ))}
      </div>

      {/* CTA row */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="m-cta">
          <Icons.Camera size={14}/> new photoshoot
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.7 }}>· 60</span>
        </button>
        <button className="m-cta secondary sm">
          <Icons.Megaphone size={13}/> use in campaign
        </button>
      </div>

      <div style={{ height: 30 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 05 — Assets · gallery ───────────── */
const M_ASSETS = {
  logos: [
    { name: "lumen-primary",  fmt: "svg", kind: "gradient" },
    { name: "lumen-mono",     fmt: "svg", kind: "outline"  },
    { name: "lumen-mark",     fmt: "svg", kind: "volt"     },
    { name: "lumen-stamp",    fmt: "png", kind: "outline"  },
  ],
  partners: [
    { name: "fieldhouse" },
    { name: "rancho · verde" },
    { name: "austin co-op" },
    { name: "pico creamery" },
    { name: "kindling" },
    { name: "hilltop mills" },
  ],
  campaigns: [
    { name: "autumn-2025",    thumb: "thumb-d" },
    { name: "market-launch",  thumb: "thumb-c" },
    { name: "holiday-bundle", thumb: "thumb-e" },
    { name: "midnight-drop",  thumb: "thumb-f" },
  ],
};

function MLogoTile({ name, kind, fmt }) {
  return (
    <div className="m-card tap" style={{ padding: 8 }}>
      <div style={{ aspectRatio: "1/1", borderRadius: 8,
                     background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                     display: "grid", placeItems: "center", overflow: "hidden",
                     position: "relative" }}>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: 22, letterSpacing: "-0.04em",
          color: kind === "volt" ? "var(--volt)" :
                  kind === "outline" ? "var(--fg-0)" : undefined,
          background: kind === "gradient"
            ? "linear-gradient(135deg, var(--volt), var(--ion))"
            : undefined,
          WebkitBackgroundClip: kind === "gradient" ? "text" : undefined,
          backgroundClip: kind === "gradient" ? "text" : undefined,
          WebkitTextStroke: kind === "outline" ? "1px var(--fg-0)" : undefined,
          textFillColor: kind === "gradient" ? "transparent" : undefined,
          WebkitTextFillColor: kind === "gradient" ? "transparent" : undefined,
        }}>
          Lumen
        </span>
        {kind === "volt" && (
          <span style={{ position: "absolute", inset: 0,
                            boxShadow: "inset 0 0 30px var(--volt-glow)" }}/>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 11.5, color: "var(--fg-0)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                        color: "var(--fg-3)", letterSpacing: "0.06em",
                        textTransform: "uppercase" }}>{fmt}</div>
      </div>
    </div>
  );
}

function MPartnerTile({ name }) {
  return (
    <div className="m-card tap" style={{ padding: 8 }}>
      <div style={{ aspectRatio: "1/1", borderRadius: 8,
                     background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                     display: "grid", placeItems: "center",
                     fontFamily: "var(--font-display)", fontWeight: 600,
                     fontSize: 13, color: "var(--fg-1)",
                     letterSpacing: "-0.01em", padding: 4, textAlign: "center" }}>
        {name}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg-2)",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
    </div>
  );
}

function MCampaignTile({ name, thumb }) {
  return (
    <div className="m-card tap" style={{ padding: 8 }}>
      <div className={`thumb ${thumb}`} style={{ aspectRatio: "1/1", borderRadius: 8 }}>
        <div style={{ position: "absolute", bottom: 4, left: 6,
                        fontFamily: "var(--font-mono)", fontSize: 9,
                        color: "#fff", letterSpacing: "0.04em",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
          campaign
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg-1)",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
    </div>
  );
}

function MobileAssetsGrid() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand" action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="assets"/>

      <div style={{ marginTop: 4 }}>
        <span className="m-eyebrow">// brand DNA · assets</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>
          asset library.
        </h1>
        <p className="m-lede">
          logos, partners, past campaigns, references. anything that isn't a product.
        </p>
      </div>

      <div className="m-pills" style={{ marginTop: 14 }}>
        <Chip active>all · 16</Chip>
        <Chip>logos · 4</Chip>
        <Chip>partners · 6</Chip>
        <Chip>past campaigns · 4</Chip>
        <Chip>references · 12</Chip>
      </div>

      {/* Logos section */}
      <MobileSectionHead icon={<Icons.Type size={13}/>}
                          title="logos" count="· 4"
                          action={<>view all →</>}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {M_ASSETS.logos.map((a, i) => <MLogoTile key={i} {...a}/>)}
      </div>

      {/* Partners */}
      <MobileSectionHead icon={<Icons.Folder size={13}/>}
                          title="partners" count="· 6"
                          action={<>view all →</>}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {M_ASSETS.partners.slice(0, 6).map((a, i) => <MPartnerTile key={i} {...a}/>)}
      </div>

      {/* Past campaigns */}
      <MobileSectionHead icon={<Icons.Image size={13}/>}
                          title="past campaigns" count="· 4"
                          action={<>view all →</>}/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {M_ASSETS.campaigns.map((a, i) => <MCampaignTile key={i} {...a}/>)}
      </div>

      <div style={{ height: 90 }}/>
      <FAB icon={<Icons.Plus size={18}/>} label="upload"/>
    </ScreenFrame>
  );
}

/* ───────────── 06 — Assets · empty ───────────── */
function MobileAssetsEmpty() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand" action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="assets"/>

      <div style={{ marginTop: 4 }}>
        <span className="m-eyebrow">// brand DNA · assets</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>
          asset library.
        </h1>
        <p className="m-lede">
          logos, partners, references — anything that isn't a product.
        </p>
      </div>

      <button className="m-cta" style={{ marginTop: 18 }}>
        <Icons.Upload size={16}/> upload your first asset
      </button>

      {/* collections cards */}
      <MobileSectionHead title="start a collection"/>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { icon: <Icons.Type size={18}/>,    t: "logos",         s: "primary, mono, mark, stamp." },
          { icon: <Icons.Folder size={18}/>,  t: "partners",      s: "vendor and partner marks." },
          { icon: <Icons.Image size={18}/>,   t: "past campaigns", s: "old creatives for reuse." },
          { icon: <Icons.BookOpen size={18}/>,t: "references",    s: "moodboards, swatches, refs." },
        ].map((x, i) => (
          <div key={i} className="m-card tap" style={{
            display: "flex", alignItems: "center", gap: 12, padding: 14,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10,
                            background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                            display: "grid", placeItems: "center", color: "var(--fg-1)",
                            flexShrink: 0 }}>
              {x.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                              fontSize: 14, color: "var(--fg-0)", letterSpacing: "-0.01em" }}>
                {x.t}
              </div>
              <div style={{ color: "var(--fg-2)", fontSize: 12, marginTop: 2 }}>{x.s}</div>
            </div>
            <Icons.ChevronRight size={14} className="muted"/>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a style={{ color: "var(--fg-2)", fontSize: 12.5, cursor: "pointer" }}>
          → or jump to catalog · products
        </a>
      </div>

      <div style={{ height: 50 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 07 — Assets · add sheet ───────────── */
function MobileAssetsAdd() {
  return (
    <ScreenFrame bloom activeTab="brand">
      <MobileTopBar leadingLogo title="brand" action={<MobileBuzzPill amount={1240}/>}/>
      <BrandSubTabs active="assets"/>

      {/* faded grid behind */}
      <div style={{ opacity: 0.3, pointerEvents: "none" }}>
        <span className="m-eyebrow">// brand DNA · assets</span>
        <h1 className="m-h1" style={{ fontSize: 28, marginTop: 6 }}>asset library.</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 8, marginTop: 14 }}>
          {M_ASSETS.logos.map((a, i) => <MLogoTile key={i} {...a}/>)}
        </div>
      </div>

      <div className="m-sheet-wrap">
        <div className="m-sheet-scrim"/>
        <div className="m-sheet" style={{ maxHeight: "82%" }}>
          <div className="m-sheet-handle"/>
          <div className="m-sheet-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="m-eyebrow-sm">// upload to library</span>
              <div className="m-sheet-title">add assets</div>
            </div>
            <button className="m-icon-btn"><Icons.X size={14}/></button>
          </div>
          <div className="m-sheet-body">
            {/* drop zone */}
            <button style={{
              width: "100%", background: "transparent",
              border: "1.5px dashed var(--line)", borderRadius: 16,
              padding: "26px 14px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              color: "var(--fg-1)", cursor: "pointer", fontFamily: "inherit",
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 14,
                              background: "var(--volt-soft)",
                              border: "1px solid var(--line-volt)",
                              color: "var(--volt)",
                              display: "grid", placeItems: "center",
                              boxShadow: "var(--bloom-volt-sm)" }}>
                <Icons.Upload size={22}/>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                              fontSize: 15, color: "var(--fg-0)" }}>
                drop files or tap to choose
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                              color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                JPG · PNG · SVG · PDF · drop multiple
              </div>
            </button>

            {/* assign to collection */}
            <div style={{ marginTop: 18 }}>
              <label className="field-label">collection</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["logos", "partners", "past campaigns", "references"].map((c, i) => (
                  <Chip key={c} active={i === 0}>{c}</Chip>
                ))}
                <Chip className="ghost"><Icons.Plus size={10}/> new</Chip>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="field-label">tags · optional</label>
              <input className="input" placeholder="primary, mark, dark-mode"/>
            </div>

            <div style={{
              marginTop: 22, paddingTop: 14,
              borderTop: "1px solid var(--line-subtle)",
              display: "flex", gap: 8,
            }}>
              <button className="m-cta secondary sm" style={{ flex: 1 }}>cancel</button>
              <button className="m-cta sm" style={{ flex: 1.4 }}>
                <Icons.Upload size={14}/> upload
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

/* ───────────── 08 — Asset · lightbox (fullscreen) ───────────── */
function MobileAssetLightbox() {
  return (
    <div className="m-screen" style={{ background: "var(--bg-0)" }}>
      {/* top bar */}
      <header style={{
        height: 52, padding: "0 16px",
        display: "flex", alignItems: "center", gap: 8,
        borderBottom: "1px solid var(--line-subtle)",
        background: "rgba(10,10,15,0.94)",
        backdropFilter: "blur(14px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button className="m-icon-btn"><Icons.X size={14}/></button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-2)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>
            assets · logos
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                          fontSize: 14, letterSpacing: "-0.015em",
                          color: "var(--fg-0)", marginTop: 1,
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" }}>
            lumen-primary.svg
          </div>
        </div>
        <button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>
      </header>

      <div style={{ padding: "0 16px", flex: 1, overflowY: "auto",
                     position: "relative" }}>
        {/* preview */}
        <div style={{
          marginTop: 14, position: "relative",
          aspectRatio: "1/1", borderRadius: 14, overflow: "hidden",
          background: "radial-gradient(ellipse at center, rgba(0,255,157,0.10), transparent 60%), var(--bg-1)",
          border: "1px solid var(--line-subtle)",
          display: "grid", placeItems: "center",
        }}>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: 62, letterSpacing: "-0.045em",
            background: "linear-gradient(135deg, var(--volt), var(--ion))",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent",
          }}>
            Lumen
          </span>

          {/* nav arrows */}
          <button className="m-icon-btn" style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
          }}>
            <Icons.ChevronLeft size={16}/>
          </button>
          <button className="m-icon-btn" style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
          }}>
            <Icons.ChevronRight size={16}/>
          </button>
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
            padding: "3px 8px", borderRadius: 999,
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "#fff", letterSpacing: "0.06em",
          }}>3 / 6</div>
        </div>

        {/* strip */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto",
                       scrollbarWidth: "none" }}>
          {[ "gradient", "outline", "volt", "gradient", "outline", "outline" ].map((kind, i) => (
            <div key={i} style={{
              width: 56, height: 56, borderRadius: 8, flexShrink: 0,
              background: "var(--bg-2)",
              border: i === 2 ? "2px solid var(--volt)" : "1px solid var(--line-subtle)",
              boxShadow: i === 2 ? "0 0 12px -4px var(--volt-glow)" : "none",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12,
              letterSpacing: "-0.04em",
              color: kind === "volt" ? "var(--volt)" : "var(--fg-1)",
            }}>L</div>
          ))}
        </div>

        {/* meta */}
        <div className="m-card" style={{ marginTop: 14, padding: 12 }}>
          {[
            { k: "name", v: "lumen-primary" },
            { k: "format", v: "SVG · 12 kb" },
            { k: "added", v: "jan 14, 2026" },
            { k: "used in", v: "8 campaigns" },
          ].map((r, i) => (
            <React.Fragment key={i}>
              <div style={{ display: "flex", justifyContent: "space-between",
                              fontFamily: "var(--font-mono)", fontSize: 10.5,
                              color: "var(--fg-3)", letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              padding: "6px 0" }}>
                <span>{r.k}</span><span style={{ color: "var(--fg-0)" }}>{r.v}</span>
              </div>
              {i < 3 && <div style={{ height: 1, background: "var(--line-subtle)" }}/>}
            </React.Fragment>
          ))}
        </div>

        {/* tags */}
        <div style={{ marginTop: 14 }}>
          <span className="m-eyebrow-sm">// tags</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {["primary", "wordmark", "dark-bg", "approved"].map(t => (
              <Chip key={t}>{t}</Chip>
            ))}
            <Chip className="ghost"><Icons.Plus size={10}/> add</Chip>
          </div>
        </div>

        {/* actions */}
        <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
          <button className="m-cta secondary sm" style={{ flex: 1 }}>
            <Icons.Download size={13}/> download
          </button>
          <button className="m-cta sm" style={{ flex: 1.2 }}>
            <Icons.Megaphone size={13}/> use in campaign
          </button>
        </div>

        <div style={{ height: 30 }}/>
      </div>
    </div>
  );
}

Object.assign(window, {
  MobileCatalogGrid, MobileCatalogEmpty, MobileCatalogAdd, MobileCatalogDetail,
  MobileAssetsGrid, MobileAssetsEmpty, MobileAssetsAdd, MobileAssetLightbox,
});
