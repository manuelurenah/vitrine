/* Hi-fi campaigns — screens 1–3 (list, empty, brief modal) */

const SUGGESTIONS = [
  { t: "summer heat sampler",  s: "lean into seasonal cravings — bright, citrus-forward photography for the four-piece launch.",  thumb: "thumb-e" },
  { t: "founder's table",      s: "behind-the-scenes feel. how the oil gets made. warm, intimate, market-shot.",                  thumb: "thumb-d" },
  { t: "pair with everything", s: "use-case montage — eggs, pizza, pasta, popcorn. quick cuts, hungry energy. great for reels.", thumb: "thumb-a" },
];

const PAST_CAMPAIGNS = [
  { name: "spring sampler '26",  date: "2 days ago", count: "12 creatives", status: "live",     thumb: "thumb-a" },
  { name: "valentine's bundle",  date: "12 feb",     count: "8 creatives",  status: "live",     thumb: "thumb-d" },
  { name: "founder's table v1",  date: "8 feb",      count: "6 creatives",  status: "draft",    thumb: "thumb-c" },
  { name: "holiday gift box",    date: "20 dec",     count: "14 creatives", status: "archived", thumb: "thumb-b" },
];

function SuggestionCard({ title, sub, thumb }) {
  return (
    <div className="suggestion-card">
      <div className={`suggestion-thumb thumb ${thumb}`}>
        {/* mock layout: header block top, copy block bottom */}
        <div style={{ position: "absolute", inset: 0, padding: 14,
                      display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
                          letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.1,
                          textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
              {title}
            </div>
          </div>
          <div style={{ height: 4, width: "60%",
                        background: "rgba(255,255,255,0.5)", borderRadius: 2 }} />
        </div>
      </div>
      <div>
        <div className="tile-title">{title}</div>
        <div style={{ color: "var(--fg-2)", fontSize: 12.5, lineHeight: 1.4, marginTop: 4,
                       display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                       overflow: "hidden" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function PromptComposer({ value = "", placeholder = "describe the campaign you want to cook" }) {
  return (
    <div className="composer">
      <div style={{ display: "flex", gap: 12 }}>
        <textarea defaultValue={value} placeholder={placeholder} rows={2} />
        <button className="mic-btn"><Icons.Mic size={14}/></button>
      </div>
      <div className="row">
        <Chip><Icons.Bag size={12}/> product</Chip>
        <Chip><Icons.Image size={12}/> images</Chip>
        <Chip>aspect ratio <Icons.ChevronDown size={11}/></Chip>
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon={<Icons.Sparkles size={14}/>}>
          generate brief
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                          opacity: 0.7, marginLeft: 4 }}>· 8 buzz</span>
        </Button>
      </div>
    </div>
  );
}

function PastRow({ name, date, count, status, thumb, last }) {
  return (
    <div className="past-row" style={{ borderBottom: last ? 0 : undefined }}>
      <div className={`thumb-mini thumb ${thumb}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "var(--fg-0)",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                       color: "var(--fg-2)", marginTop: 2 }}>
          {date} · {count}
        </div>
      </div>
      <Badge kind={status}>{status}</Badge>
      <button className="cbtn" style={{ width: 28, height: 28 }}>
        <Icons.MoreHorizontal size={14}/>
      </button>
    </div>
  );
}

/* ─────────── 01 — list (populated) ─────────── */
function ScreenCampaignsList() {
  return (
    <Shell crumbs={["campaigns"]} bloom>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span className="eyebrow">// step 1 · brief</span>
        <h1 className="h1" style={{ marginTop: 6 }}>campaigns.</h1>
        <p style={{ color: "var(--fg-2)", fontSize: 15, marginTop: 6,
                     maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          start from a suggestion or describe what you want — we'll cook the brief, then the assets.
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
        <PromptComposer />
        <div style={{ textAlign: "center", fontSize: 12,
                       color: "var(--fg-3)", marginTop: 8 }}>
          we can be wrong — review every brief before generating.
        </div>
      </div>

      <div style={{ marginTop: 36 }}>
        <div className="section-head">
          <Icons.Dna size={15} className="muted"/>
          <span className="title">suggestions from your brand dna</span>
          <span className="count">· refreshed today</span>
          <a className="ml-auto"><Icons.Refresh size={12}/> refresh</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {SUGGESTIONS.map((x, i) => <SuggestionCard key={i} title={x.t} sub={x.s} thumb={x.thumb} />)}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <div className="section-head">
          <span className="title">past campaigns</span>
          <span className="count">· {PAST_CAMPAIGNS.length}</span>
          <a className="ml-auto">view all →</a>
        </div>
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                       borderRadius: 14, overflow: "hidden" }}>
          {PAST_CAMPAIGNS.map((p, i) =>
            <PastRow key={i} {...p} last={i === PAST_CAMPAIGNS.length - 1} />)}
        </div>
      </div>
    </Shell>
  );
}

/* ─────────── 02 — empty ─────────── */
function ScreenCampaignsEmpty() {
  return (
    <Shell crumbs={["campaigns"]} bloom>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <span className="eyebrow">// step 1 · brief</span>
        <h1 className="h1" style={{ marginTop: 6 }}>campaigns.</h1>
        <p style={{ color: "var(--fg-2)", fontSize: 15, marginTop: 6,
                     maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          start from a suggestion or describe what you want — we'll cook the brief, then the assets.
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
        <PromptComposer />
      </div>

      <div style={{ marginTop: 36 }}>
        <div className="section-head">
          <Icons.Dna size={15} className="muted"/>
          <span className="title">suggestions from your brand dna</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {SUGGESTIONS.map((x, i) => <SuggestionCard key={i} title={x.t} sub={x.s} thumb={x.thumb} />)}
        </div>
      </div>

      <div style={{ marginTop: 32, padding: 32,
                     background: "var(--bg-1)",
                     border: "1px dashed var(--line)",
                     borderRadius: 18,
                     display: "flex", flexDirection: "column",
                     alignItems: "center", gap: 10, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 999,
                       background: "var(--volt-soft)",
                       border: "1px solid var(--line-volt)",
                       display: "grid", placeItems: "center", color: "var(--volt)" }}>
          <Icons.Megaphone size={20}/>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                       fontSize: 18, color: "var(--fg-0)", letterSpacing: "-0.015em" }}>
          no campaigns yet.
        </div>
        <div style={{ color: "var(--fg-2)", fontSize: 13.5, maxWidth: 400 }}>
          pick a suggestion above or type your own prompt. first campaign runs end-to-end for{" "}
          <span style={{ color: "var(--buzz)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>60 buzz</span>.
        </div>
      </div>
    </Shell>
  );
}

/* ─────────── 03 — brief modal ─────────── */

const SOCIAL_PRESETS = [
  { id: "ig-feed",  label: "ig · feed",   ratio: "4:5",    w: 30, h: 38, glyph: <Icons.Image size={14}/>,   on: true  },
  { id: "ig-story", label: "ig · story",  ratio: "9:16",   w: 22, h: 38, glyph: <Icons.Image size={14}/>,   on: true  },
  { id: "reels",    label: "reels",       ratio: "9:16",   w: 22, h: 38, glyph: <Icons.Video size={14}/>,   on: false },
  { id: "tiktok",   label: "tiktok",      ratio: "9:16",   w: 22, h: 38, glyph: <Icons.Video size={14}/>,   on: false },
  { id: "fb",       label: "facebook",    ratio: "1.91:1", w: 38, h: 20, glyph: <Icons.Layers size={14}/>,  on: false },
  { id: "li",       label: "linkedin",    ratio: "1:1",    w: 34, h: 34, glyph: <Icons.Layers size={14}/>,  on: true  },
  { id: "x",        label: "x / twitter", ratio: "16:9",   w: 38, h: 22, glyph: <Icons.Layers size={14}/>,  on: false },
  { id: "yt",       label: "youtube",     ratio: "16:9",   w: 38, h: 22, glyph: <Icons.Play size={12}/>,    on: false },
];

function PresetCard({ label, ratio, w, h, glyph, on }) {
  return (
    <div className={`preset ${on ? "on" : ""}`}>
      <div className="preset-head">
        <span className="preset-glyph">{glyph}</span>
        {on && <span className="check"><Icons.Check size={11} strokeWidth={3}/></span>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div className="ratio" style={{ width: w, height: h }} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span className="label">{label}</span>
          <span className="sublabel">{ratio}</span>
        </div>
      </div>
    </div>
  );
}

function ScreenBriefModal() {
  return (
    <div className="app-shell" style={{ position: "relative" }}>
      <Sidebar />
      <div className="app-main">
        <TopBar crumbs={["campaigns"]} />
        <div className="app-content">
          {/* faded background content */}
          <div style={{ opacity: 0.35, pointerEvents: "none", textAlign: "center" }}>
            <span className="eyebrow">// step 1 · brief</span>
            <h1 className="h1" style={{ marginTop: 6 }}>campaigns.</h1>
            <div style={{ maxWidth: 720, margin: "20px auto 0", height: 90,
                           background: "var(--bg-2)", borderRadius: 18,
                           border: "1px solid var(--line-subtle)" }} />
            <div style={{ marginTop: 32, display: "grid",
                           gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ height: 220, background: "var(--bg-2)",
                                      border: "1px solid var(--line-subtle)",
                                      borderRadius: 14 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal pinned to whole shell */}
      <div className="scrim" style={{ position: "absolute" }}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "94%" }}>
          <div style={{ padding: 22, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <span className="eyebrow">// step 1 · brief</span>
                <div className="h2" style={{ marginTop: 4, fontSize: 22 }}>campaign brief</div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 480 }}>
                  based on your prompt + brand dna. tweak anything before we cook assets.
                </p>
              </div>
              <IconButton variant="ghost" icon={<Icons.X size={16}/>} ariaLabel="close"/>
            </div>

            <div style={{ marginTop: 14,
                           background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                           borderRadius: 10, padding: 10 }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>// submitted prompt</span>
              <div style={{ fontSize: 13.5, color: "var(--fg-0)", lineHeight: 1.4 }}>
                new state-of-the-art chili oil for the summer sampler — make it festive + a little loud.
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <Chip active><Icons.Bag size={12}/> cherry-smoked chili oil</Chip>
              <Chip><Icons.Image size={12}/> 4 images</Chip>
              <Chip className="ghost">+ add reference</Chip>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="field-label">title</label>
              <input className="input" defaultValue="precision flavor in every drop." />
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="field-label">description</label>
              <textarea className="textarea" rows={3}
                defaultValue="slow-smoked cherrywood + arbol chiles, jarred small-batch in austin. our flagship oil, now in a four-piece sampler with three seasonal heat levels. festive, loud, perfect for cookouts." />
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="field-label">goal</label>
                <div className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  promote a new product
                  <Icons.ChevronDown size={12} className="muted"/>
                </div>
              </div>
              <div>
                <label className="field-label">offer (optional)</label>
                <input className="input" placeholder="e.g. 10% off summer sampler" />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span className="eyebrow">// output formats</span>
                <span className="muted" style={{ fontSize: 12 }}>pick 1+ — we cook all selected</span>
              </div>
              <div className="preset-grid">
                {SOCIAL_PRESETS.map(p => <PresetCard key={p.id} {...p} />)}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                           marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-subtle)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)",
                              letterSpacing: "0.06em", textTransform: "uppercase" }}>
                est. cost · <span style={{ color: "var(--buzz)" }}>60 buzz</span>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost">cancel</Button>
                <Button variant="primary" icon={<Icons.Sparkles size={14}/>}>confirm + cook</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenCampaignsList, ScreenCampaignsEmpty, ScreenBriefModal,
  SOCIAL_PRESETS,
});
