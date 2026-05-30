/* Mobile campaigns — 7 screens: list, empty, brief sheet, cooking, ready, editor, history */

const M_SUGGESTIONS = [
  { t: "summer heat sampler",  s: "lean into seasonal cravings.",                  thumb: "thumb-e" },
  { t: "founder's table",      s: "behind-the-scenes. warm, intimate.",            thumb: "thumb-d" },
  { t: "pair with everything", s: "use-case montage — eggs, pizza, pasta.",        thumb: "thumb-a" },
];

const M_PAST_CAMPAIGNS = [
  { name: "spring sampler '26",  date: "2d ago",  count: "12 creatives", status: "live",     thumb: "thumb-a" },
  { name: "valentine's bundle",  date: "12 feb",  count: "8 creatives",  status: "live",     thumb: "thumb-d" },
  { name: "founder's table v1",  date: "8 feb",   count: "6 creatives",  status: "draft",    thumb: "thumb-c" },
  { name: "holiday gift box",    date: "20 dec",  count: "14 creatives", status: "archived", thumb: "thumb-b" },
];

/* ─── Mobile composer (compact) ─── */
function MCampComposer({ placeholder = "describe the campaign…" }) {
  return (
    <div className="m-composer">
      <textarea defaultValue="" placeholder={placeholder} rows={2}/>
      <div className="m-composer-row">
        <span className="chip" style={{ fontSize: 11, padding: "4px 9px" }}>
          <Icons.Bag size={11}/> product
        </span>
        <span className="chip" style={{ fontSize: 11, padding: "4px 9px" }}>
          <Icons.Image size={11}/> images
        </span>
        <span className="chip" style={{ fontSize: 11, padding: "4px 9px" }}>
          ratio <Icons.ChevronDown size={10}/>
        </span>
        <span style={{ flex: 1 }}/>
        <button style={{
          height: 34, padding: "0 12px", borderRadius: 10,
          background: "var(--volt)", color: "var(--fg-on-volt)",
          border: 0, fontFamily: "inherit", fontWeight: 700, fontSize: 12.5,
          display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
          boxShadow: "0 0 18px -4px var(--volt-glow)",
        }}>
          <Icons.Sparkles size={12}/> generate
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.75 }}>
            · 8
          </span>
        </button>
      </div>
    </div>
  );
}

/* ─── Suggestion card ─── */
function MSuggestionCard({ title, sub, thumb }) {
  return (
    <div className="m-card tap" style={{ padding: 12, minWidth: 220 }}>
      <div className={`thumb ${thumb}`} style={{ height: 120, borderRadius: 10, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, padding: 12,
                        display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                          fontSize: 13, letterSpacing: "-0.02em",
                          lineHeight: 1.1, color: "#fff",
                          textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
            {title}
          </div>
          <div style={{ height: 3, width: "55%",
                          background: "rgba(255,255,255,0.5)", borderRadius: 2 }}/>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="tile-title" style={{ fontSize: 13.5 }}>{title}</div>
        <div style={{ color: "var(--fg-2)", fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ─── Past campaign row ─── */
function MPastRow({ name, date, count, status, thumb }) {
  return (
    <div className="m-row">
      <div className={`thumb ${thumb}`} style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--fg-0)",
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                       color: "var(--fg-2)", marginTop: 2, letterSpacing: "0.04em" }}>
          {date} · {count}
        </div>
      </div>
      <Badge kind={status}>{status}</Badge>
    </div>
  );
}

/* ───────────── 01 — Campaigns list ───────────── */
function MobileCampaignsList() {
  return (
    <ScreenFrame bloom activeTab="campaigns">
      <MobileTopBar leadingLogo
        title="campaigns"
        action={<MobileBuzzPill amount={1240}/>}
      />

      <div style={{ paddingTop: 14 }}>
        <span className="m-eyebrow">// step 1 · brief</span>
        <h1 className="m-h1" style={{ marginTop: 8, fontSize: 36 }}>campaigns.</h1>
        <p className="m-lede">
          start from a suggestion or describe what you want — we'll cook the brief, then the assets.
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        <MCampComposer/>
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--fg-3)", marginTop: 8 }}>
          we can be wrong — review every brief before generating.
        </div>
      </div>

      <MobileSectionHead icon={<Icons.Dna size={14}/>} title="suggestions from your brand dna"
                          action={<><Icons.Refresh size={11}/> refresh</>}/>

      {/* Horizontal scroll of suggestions */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto",
                     margin: "0 -16px", padding: "0 16px 4px",
                     scrollbarWidth: "none" }}
            className="m-h-scroll">
        {M_SUGGESTIONS.map((x, i) => (
          <MSuggestionCard key={i} title={x.t} sub={x.s} thumb={x.thumb}/>
        ))}
      </div>

      <MobileSectionHead title="past campaigns" count={`· ${M_PAST_CAMPAIGNS.length}`}
                          action={<>view all →</>}/>
      <div className="m-card" style={{ padding: "0 14px" }}>
        {M_PAST_CAMPAIGNS.map((p, i) => <MPastRow key={i} {...p}/>)}
      </div>

      <div style={{ height: 100 }}/>
      <FAB icon={<Icons.Plus size={18}/>} label="new"/>
    </ScreenFrame>
  );
}

/* ───────────── 02 — Campaigns empty ───────────── */
function MobileCampaignsEmpty() {
  return (
    <ScreenFrame bloom activeTab="campaigns">
      <MobileTopBar leadingLogo
        title="campaigns"
        action={<MobileBuzzPill amount={1240}/>}
      />

      <div style={{ paddingTop: 14 }}>
        <span className="m-eyebrow">// step 1 · brief</span>
        <h1 className="m-h1" style={{ marginTop: 8, fontSize: 36 }}>campaigns.</h1>
        <p className="m-lede">
          first campaign runs end-to-end for{" "}
          <span style={{ color: "var(--buzz)", fontFamily: "var(--font-mono)", fontSize: 13 }}>60 buzz</span>.
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        <MCampComposer/>
      </div>

      <MobileSectionHead icon={<Icons.Dna size={14}/>} title="suggestions from your brand dna"/>
      <div style={{ display: "flex", gap: 10, overflowX: "auto",
                     margin: "0 -16px", padding: "0 16px 4px",
                     scrollbarWidth: "none" }}>
        {M_SUGGESTIONS.map((x, i) => (
          <MSuggestionCard key={i} title={x.t} sub={x.s} thumb={x.thumb}/>
        ))}
      </div>

      {/* Empty card */}
      <div style={{
        marginTop: 22,
        padding: "26px 18px",
        background: "var(--bg-1)",
        border: "1px dashed var(--line)",
        borderRadius: 18,
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 10,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 999,
                        background: "var(--volt-soft)",
                        border: "1px solid var(--line-volt)",
                        display: "grid", placeItems: "center", color: "var(--volt)" }}>
          <Icons.Megaphone size={22}/>
        </div>
        <div className="m-h3" style={{ fontSize: 17 }}>no campaigns yet.</div>
        <div style={{ color: "var(--fg-2)", fontSize: 13, lineHeight: 1.45,
                        maxWidth: 280 }}>
          pick a suggestion above or type your own prompt.
        </div>
      </div>

      <div style={{ height: 60 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 03 — Brief sheet ───────────── */
const M_SOCIAL_PRESETS = [
  { id: "ig-feed",  label: "ig · feed",   ratio: "4:5",    w: 22, h: 28, glyph: <Icons.Image size={11}/>,   on: true  },
  { id: "ig-story", label: "ig · story",  ratio: "9:16",   w: 16, h: 28, glyph: <Icons.Image size={11}/>,   on: true  },
  { id: "reels",    label: "reels",       ratio: "9:16",   w: 16, h: 28, glyph: <Icons.Video size={11}/>,   on: false },
  { id: "tiktok",   label: "tiktok",      ratio: "9:16",   w: 16, h: 28, glyph: <Icons.Video size={11}/>,   on: false },
  { id: "li",       label: "linkedin",    ratio: "1:1",    w: 24, h: 24, glyph: <Icons.Layers size={11}/>,  on: true  },
  { id: "x",        label: "x / twitter", ratio: "16:9",   w: 28, h: 16, glyph: <Icons.Layers size={11}/>,  on: false },
];

function MPresetCard({ label, ratio, w, h, glyph, on }) {
  return (
    <div style={{
      background: on ? "var(--volt-soft)" : "var(--bg-2)",
      border: on ? "1px solid var(--line-volt)" : "1px solid var(--line-subtle)",
      borderRadius: 10, padding: 10,
      cursor: "pointer",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ color: on ? "var(--volt)" : "var(--fg-2)" }}>{glyph}</span>
        {on && (
          <span style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: 999,
                          background: "var(--volt)", color: "var(--fg-on-volt)",
                          display: "grid", placeItems: "center" }}>
            <Icons.Check size={9} strokeWidth={3}/>
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 8 }}>
        <div style={{
          width: w, height: h, borderRadius: 3,
          background: on ? "var(--volt)" : "var(--bg-3)",
          opacity: on ? 0.4 : 1, flexShrink: 0,
          border: on ? "1px solid var(--volt)" : "1px solid var(--line-subtle)",
        }}/>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-0)",
                          whiteSpace: "nowrap" }}>{label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                          color: "var(--fg-3)", letterSpacing: "0.04em" }}>{ratio}</span>
        </div>
      </div>
    </div>
  );
}

function MobileBriefSheet() {
  return (
    <ScreenFrame bloom activeTab="campaigns">
      <MobileTopBar leadingLogo title="campaigns" action={<MobileBuzzPill amount={1240}/>}/>

      {/* Faded backdrop content */}
      <div style={{ opacity: 0.25, pointerEvents: "none", marginTop: 14 }}>
        <span className="m-eyebrow">// step 1 · brief</span>
        <h1 className="m-h1" style={{ marginTop: 8, fontSize: 36 }}>campaigns.</h1>
        <div style={{ height: 110, background: "var(--bg-2)", borderRadius: 16,
                        border: "1px solid var(--line-subtle)", marginTop: 14 }}/>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 10 }}>
          <div style={{ height: 110, background: "var(--bg-2)", borderRadius: 14,
                          border: "1px solid var(--line-subtle)" }}/>
          <div style={{ height: 110, background: "var(--bg-2)", borderRadius: 14,
                          border: "1px solid var(--line-subtle)" }}/>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="m-sheet-wrap">
        <div className="m-sheet-scrim"/>
        <div className="m-sheet" style={{ maxHeight: "88%" }}>
          <div className="m-sheet-handle"/>
          <div className="m-sheet-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="m-eyebrow-sm">// step 1 · brief</span>
              <div className="m-sheet-title">campaign brief</div>
            </div>
            <button className="m-icon-btn"><Icons.X size={14}/></button>
          </div>
          <div className="m-sheet-body">
            {/* Submitted prompt */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                            borderRadius: 10, padding: 10 }}>
              <span className="m-eyebrow-sm">// submitted prompt</span>
              <div style={{ fontSize: 13, color: "var(--fg-0)", marginTop: 4, lineHeight: 1.4 }}>
                new state-of-the-art chili oil for the summer sampler — make it festive + a little loud.
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <Chip active><Icons.Bag size={11}/> cherry-smoked chili oil</Chip>
              <Chip><Icons.Image size={11}/> 4 images</Chip>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="field-label">title</label>
              <input className="input" defaultValue="precision flavor in every drop."/>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="field-label">description</label>
              <textarea className="textarea" rows={3}
                defaultValue="slow-smoked cherrywood + arbol chiles, small-batch in austin. flagship oil, now a four-piece summer sampler."/>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="field-label">goal</label>
              <div className="input" style={{ display: "flex", alignItems: "center",
                                                justifyContent: "space-between" }}>
                promote a new product
                <Icons.ChevronDown size={12} className="muted"/>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span className="m-eyebrow-sm">// output formats</span>
                <span style={{ fontSize: 11, color: "var(--fg-2)" }}>pick 1+</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {M_SOCIAL_PRESETS.map(p => <MPresetCard key={p.id} {...p}/>)}
              </div>
            </div>

            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: "1px solid var(--line-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                              color: "var(--fg-2)", letterSpacing: "0.06em",
                              textTransform: "uppercase" }}>
                est · <span style={{ color: "var(--buzz)" }}>60 buzz</span>
              </span>
              <button className="m-cta" style={{ height: 44, width: "auto", padding: "0 18px",
                                                    fontSize: 14, borderRadius: 12 }}>
                <Icons.Sparkles size={14}/> confirm + cook
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

/* ─── Mobile creative card — full-bleed feed style ─── */
function MCreativeCard({ channel, ratio, state, thumb, headline, subline, video }) {
  const [w, h] = ratio.split(":").map(Number);
  return (
    <div className="creative-card" style={{ borderRadius: 14 }}>
      <div className="creative-preview" style={{ aspectRatio: `${w}/${h}` }}>
        {state === "done" && (
          <div className={`thumb ${thumb}`} style={{ position: "absolute", inset: 0, borderRadius: 0 }}>
            <div style={{ position: "absolute", inset: 0, padding: 14,
                            display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                              textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
                {subline}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                              fontSize: 22, letterSpacing: "-0.03em", color: "#fff",
                              lineHeight: 1.0, maxWidth: "85%",
                              textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                {headline}
              </div>
            </div>
            {video && (
              <div style={{ position: "absolute", top: "50%", left: "50%",
                              transform: "translate(-50%, -50%)",
                              width: 40, height: 40, borderRadius: 999,
                              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                              display: "grid", placeItems: "center", color: "#fff" }}>
                <Icons.Play size={14}/>
              </div>
            )}
          </div>
        )}
        {state === "cooking" && (
          <div className="cooking-state">
            <div style={{ width: 34, height: 34, borderRadius: 999,
                            background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                            display: "grid", placeItems: "center", color: "var(--volt)",
                            boxShadow: "var(--bloom-volt-sm)" }}>
              <Icons.Sparkles size={14}/>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: 13, color: "var(--fg-0)" }}>cooking…</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--fg-2)", letterSpacing: "0.04em" }}>~ 2 min</div>
          </div>
        )}
        {state === "queued" && (
          <div className="cooking-state">
            <Icons.History size={18} className="muted"/>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--fg-2)", letterSpacing: "0.04em",
                            textTransform: "uppercase" }}>queued</div>
          </div>
        )}
        <div className="channel-tag">{channel}</div>
        <div className="more-btn"><Icons.MoreHorizontal size={12}/></div>
      </div>
      {state === "done" && (
        <div className="footer">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: "var(--fg-3)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>v1</span>
          <span style={{ flex: 1 }}/>
          <Button variant="ghost" size="sm" icon={<Icons.Wand size={11}/>}>animate</Button>
          <button className="cbtn" style={{ width: 26, height: 26 }}>
            <Icons.Download size={11}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Campaign detail shared ─── */
function MCampaignDetail({ mode }) {
  const creatives = [
    { ratio: "4:5",  channel: "ig · feed",  state: "done", thumb: "thumb-d",
      headline: "precision in every drop.",     subline: "automated · zero variability" },
    { ratio: "4:5",  channel: "ig · feed",  state: mode === "cooking" ? "cooking" : "done",
      thumb: "thumb-a", headline: "summer heat. cold-pressed.", subline: "festive · loud" },
    { ratio: "9:16", channel: "ig · story", state: "done", thumb: "thumb-c",
      headline: "purity in every drop.",        subline: "clean · safety" },
    { ratio: "9:16", channel: "reels",     state: mode === "cooking" ? "cooking" : "done",
      thumb: "thumb-b", video: true,
      headline: "engineered for flavor.",       subline: "industrial · clean" },
    { ratio: "1:1",  channel: "linkedin",  state: "done", thumb: "thumb-g",
      headline: "founder's table.",             subline: "story · warm" },
    { ratio: "1:1",  channel: "linkedin",  state: mode === "cooking" ? "queued" : "done",
      thumb: "thumb-h", headline: "built for the sampler.",     subline: "case study · q3" },
  ];
  const cooking = creatives.filter(c => c.state !== "done").length;

  return (
    <ScreenFrame activeTab="campaigns">
      <MobileTopBar back title="summer heat sampler"
        action={<button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>}/>

      {/* hero */}
      <div style={{ marginTop: 8, textAlign: "center" }}>
        <span className="m-eyebrow">// step 2 · creatives</span>
        <h1 className="m-h1" style={{ marginTop: 6, fontSize: 28 }}>summer heat<br/>sampler.</h1>
        <div style={{ marginTop: 10, display: "inline-flex", gap: 6 }}>
          <Badge kind={mode === "cooking" ? "gen" : "live"}>
            {mode === "cooking" ? "cooking" : "ready"}
          </Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-2)", letterSpacing: "0.04em",
                          padding: "3px 8px", borderRadius: 6,
                          background: "var(--bg-2)", border: "1px solid var(--line-subtle)" }}>
            {creatives.length - cooking}/{creatives.length} ready
          </span>
        </div>
      </div>

      {/* Brief sidecar (collapsed) */}
      <div className="m-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Megaphone size={13} className="muted"/>
          <span className="m-eyebrow-sm">// brief</span>
          <span style={{ flex: 1 }}/>
          <button className="m-icon-btn" style={{ width: 26, height: 26 }}>
            <Icons.Pencil size={11}/>
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                        fontSize: 14, letterSpacing: "-0.02em", marginTop: 6,
                        color: "var(--fg-0)" }}>
          precision flavor in every drop.
        </div>
        <div style={{ color: "var(--fg-2)", fontSize: 12, lineHeight: 1.45, marginTop: 6,
                       display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                       overflow: "hidden" }}>
          slow-smoked cherrywood + arbol chiles, jarred small-batch in austin. flagship oil, now a four-piece summer sampler.
        </div>
      </div>

      {/* Channel filter */}
      <div className="m-pills" style={{ marginTop: 16 }}>
        <Chip active>all · {creatives.length}</Chip>
        <Chip>ig · feed</Chip>
        <Chip>ig · story</Chip>
        <Chip>reels</Chip>
        <Chip>linkedin</Chip>
      </div>

      {/* 2-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                     gap: 10, marginTop: 12 }}>
        {creatives.map((c, i) => <MCreativeCard key={i} {...c}/>)}
      </div>

      {/* download all */}
      <div style={{ marginTop: 14, marginBottom: 24,
                     display: "flex", gap: 8 }}>
        <button className="m-cta secondary sm" style={{ flex: 1 }}>
          <Icons.Share size={13}/> share
        </button>
        <button className="m-cta sm" style={{ flex: 1 }}>
          <Icons.Download size={13}/> download all
        </button>
      </div>
    </ScreenFrame>
  );
}

const MobileCampaignCooking = () => <MCampaignDetail mode="cooking"/>;
const MobileCampaignReady   = () => <MCampaignDetail mode="ready"/>;

/* ───────────── 06 — Mobile creative editor ───────────── */
function MEditPanel({ label, expanded, eye, generate, children }) {
  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
      borderRadius: 12, padding: 12, marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.ChevronRight size={11}
          style={{ color: "var(--fg-3)",
                    transform: expanded ? "rotate(90deg)" : "none",
                    transition: "transform 120ms" }}/>
        <span style={{ fontSize: 13.5, color: "var(--fg-0)", fontWeight: 500 }}>{label}</span>
        <span style={{ flex: 1 }}/>
        {generate && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                          color: "var(--volt)", letterSpacing: "0.04em", cursor: "pointer" }}>
            generate
          </span>
        )}
        {eye && <Icons.Eye size={12} className="muted"/>}
      </div>
      {expanded && children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function MobileCreativeEditor() {
  return (
    <ScreenFrame tabBar={false}>
      <MobileTopBar back title="precision flavor."
        action={<button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>}/>

      {/* version pill */}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
          padding: "6px 12px", borderRadius: 999,
          fontSize: 12, color: "var(--fg-1)",
        }}>
          <Icons.History size={12} className="muted"/>
          <span>version 2 of 3</span>
          <button className="m-icon-btn" style={{ width: 22, height: 22 }}><Icons.ChevronLeft size={11}/></button>
          <button className="m-icon-btn" style={{ width: 22, height: 22 }}><Icons.ChevronRight size={11}/></button>
        </div>
      </div>

      {/* canvas — 4:5 */}
      <div className="thumb thumb-d" style={{
        marginTop: 14, width: "100%", aspectRatio: "4/5",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7), 0 0 0 1px var(--line)",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, padding: 18,
                        display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "rgba(255,255,255,0.7)" }}>
            automated · zero variability.
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                            fontSize: 34, letterSpacing: "-0.04em", lineHeight: 1.0,
                            color: "#fff", maxWidth: 240,
                            textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              precision in every drop.
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: 14, color: "#fff", marginTop: 12, opacity: 0.9 }}>
              m&amp;a chili oil.
            </div>
            <div style={{ marginTop: 14,
                            display: "inline-block",
                            background: "var(--volt)", color: "var(--fg-on-volt)",
                            borderRadius: 999, padding: "6px 14px",
                            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                            boxShadow: "0 0 18px var(--volt-glow)" }}>
              shop now
            </div>
          </div>
        </div>
      </div>

      {/* primary action */}
      <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
        <button className="m-cta" style={{ flex: 1, height: 44, fontSize: 14, borderRadius: 12 }}>
          <Icons.Sparkles size={14}/> fix layout
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.7 }}>· 3</span>
        </button>
        <button className="m-icon-btn" style={{ width: 44, height: 44 }}><Icons.Refresh size={14}/></button>
        <button className="m-icon-btn" style={{ width: 44, height: 44 }}><Icons.Download size={14}/></button>
        <button className="m-icon-btn" style={{ width: 44, height: 44 }}><Icons.Wand size={14}/></button>
      </div>

      {/* edit panels */}
      <div style={{ marginTop: 14 }}>
        <span className="m-eyebrow">// edit elements</span>
        <div style={{ marginTop: 10 }}>
          <MEditPanel label="image" expanded>
            <div className="thumb thumb-d" style={{ height: 100, borderRadius: 8, position: "relative" }}>
              <span style={{ position: "absolute", top: 6, left: 6,
                                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                                fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff",
                                padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em",
                                textTransform: "uppercase" }}>
                image preview
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <Button variant="secondary" size="sm" icon={<Icons.Refresh size={11}/>}
                       style={{ flex: 1, justifyContent: "center" }}>regenerate</Button>
              <Button variant="secondary" size="sm" icon={<Icons.Image size={11}/>}
                       style={{ flex: 1, justifyContent: "center" }}>swap</Button>
            </div>
          </MEditPanel>
          <MEditPanel label="header" eye/>
          <MEditPanel label="description" eye/>
          <MEditPanel label="call to action" generate/>
          <MEditPanel label="logo" eye/>
          <MEditPanel label="background"/>
        </div>
      </div>

      <div style={{ marginTop: 4, padding: 14,
                     background: "var(--volt-soft)",
                     border: "1px solid var(--line-volt)",
                     borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icons.Sparkles size={13} style={{ color: "var(--volt)" }}/>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                          fontSize: 13, color: "var(--fg-0)" }}>
            fix layout
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)",
                          fontSize: 10, color: "var(--volt)" }}>3 buzz</span>
        </div>
        <div style={{ color: "var(--fg-1)", fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
          re-balance type, image, and CTA without changing the content.
        </div>
      </div>

      <div style={{ height: 24 }}/>
    </ScreenFrame>
  );
}

/* ───────────── 07 — Mobile version history ───────────── */
const M_VERSIONS = [
  { n: 1, label: "first cook",       time: "2d ago",  thumb: "thumb-c", on: false },
  { n: 2, label: "fixed layout",     time: "1d ago",  thumb: "thumb-d", on: false },
  { n: 3, label: "shorter headline", time: "3h ago",  thumb: "thumb-a", on: false },
  { n: 4, label: "current",          time: "just now", thumb: "thumb-d", on: true  },
];

function MobileVersionHistory() {
  return (
    <ScreenFrame tabBar={false}>
      <MobileTopBar back title="version history"
        action={<button className="m-icon-btn"><Icons.MoreHorizontal size={14}/></button>}/>

      {/* version pill */}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
          padding: "6px 12px", borderRadius: 999,
          fontSize: 12, color: "var(--fg-0)",
        }}>
          <Icons.History size={12} style={{ color: "var(--volt)" }}/>
          <span>4 of 4</span>
        </div>
      </div>

      {/* current */}
      <div className="thumb thumb-d" style={{
        marginTop: 14, width: "100%", aspectRatio: "4/5", borderRadius: 16,
        overflow: "hidden", position: "relative",
        boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7), 0 0 0 1px var(--volt), 0 0 60px -10px var(--volt-glow)",
      }}>
        <div style={{ position: "absolute", inset: 0, padding: 18,
                        display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "rgba(255,255,255,0.7)" }}>
            automated systems · zero variability.
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                            fontSize: 34, letterSpacing: "-0.04em", lineHeight: 1.0,
                            color: "#fff",
                            textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              precision in every drop.
            </div>
            <div style={{ marginTop: 14, display: "inline-block",
                            background: "var(--volt)", color: "var(--fg-on-volt)",
                            borderRadius: 999, padding: "6px 14px",
                            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                            boxShadow: "0 0 18px var(--volt-glow)" }}>
              shop the sampler →
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", top: 10, right: 10,
                        background: "var(--volt)", color: "var(--fg-on-volt)",
                        padding: "3px 8px", borderRadius: 6,
                        fontFamily: "var(--font-mono)", fontSize: 10,
                        letterSpacing: "0.06em", textTransform: "uppercase" }}>
          v4 · current
        </div>
      </div>

      {/* versions strip */}
      <div className="m-card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.History size={12} className="muted"/>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                          fontSize: 13, color: "var(--fg-0)" }}>all versions</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-3)", letterSpacing: "0.04em" }}>· {M_VERSIONS.length}</span>
          <span style={{ flex: 1 }}/>
          <span style={{ color: "var(--fg-2)", fontSize: 11.5,
                          display: "inline-flex", alignItems: "center", gap: 3,
                          cursor: "pointer" }}>
            <Icons.Trash size={10}/> clear
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 8, marginTop: 12 }}>
          {M_VERSIONS.map(v => (
            <div key={v.n} style={{ display: "flex", flexDirection: "column",
                                       alignItems: "center", gap: 4 }}>
              <div className={`thumb ${v.thumb}`} style={{
                width: "100%", aspectRatio: "4/5", borderRadius: 8,
                border: v.on ? "1px solid var(--volt)" : "1px solid var(--line-subtle)",
                boxShadow: v.on ? "0 0 0 1px var(--volt), 0 0 16px -4px var(--volt-glow)" : "none",
                position: "relative",
              }}>
                <span style={{ position: "absolute", top: 4, left: 4,
                                  fontFamily: "var(--font-mono)", fontSize: 9,
                                  color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                                  letterSpacing: "0.04em" }}>
                  v{v.n}
                </span>
              </div>
              <div style={{ fontSize: 11, color: v.on ? "var(--fg-0)" : "var(--fg-1)",
                              textAlign: "center" }}>{v.label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                              color: "var(--fg-3)", letterSpacing: "0.04em" }}>{v.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* diff */}
      <div className="m-card" style={{ marginTop: 12 }}>
        <span className="m-eyebrow-sm">// what changed in v4</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                            color: "var(--fg-3)", letterSpacing: "0.08em",
                            textTransform: "uppercase", marginBottom: 4 }}>header</div>
            <div style={{ fontSize: 12, color: "var(--danger)", textDecoration: "line-through",
                            lineHeight: 1.4 }}>
              automated systems ensure zero caliber variability for industrial meat production.
            </div>
            <div style={{ fontSize: 12, color: "var(--volt)", marginTop: 2, lineHeight: 1.4 }}>
              automated systems · zero variability.
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                            color: "var(--fg-3)", letterSpacing: "0.08em",
                            textTransform: "uppercase", marginBottom: 4 }}>cta</div>
            <div style={{ fontSize: 12, color: "var(--danger)", textDecoration: "line-through" }}>learn more</div>
            <div style={{ fontSize: 12, color: "var(--volt)", marginTop: 2 }}>shop the sampler →</div>
          </div>
        </div>
      </div>

      {/* actions */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <Button variant="secondary" size="sm" icon={<Icons.Refresh size={12}/>}
                 style={{ justifyContent: "center", height: 40 }}>restore v3</Button>
        <Button variant="secondary" size="sm" icon={<Icons.Compare size={12}/>}
                 style={{ justifyContent: "center", height: 40 }}>compare v3 vs v4</Button>
      </div>

      <div style={{ height: 30 }}/>
    </ScreenFrame>
  );
}

Object.assign(window, {
  MobileCampaignsList, MobileCampaignsEmpty, MobileBriefSheet,
  MobileCampaignCooking, MobileCampaignReady,
  MobileCreativeEditor, MobileVersionHistory,
});
