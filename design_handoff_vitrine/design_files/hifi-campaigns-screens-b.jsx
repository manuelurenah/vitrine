/* Hi-fi campaigns — screens 4–7 (cooking, ready, editor, version history) + App mount */

const CHANNEL_THUMBS = {
  "ig · feed":  ["thumb-d", "thumb-a", "thumb-e"],
  "ig · story": ["thumb-c"],
  "reels":      ["thumb-b"],
  "tiktok":     ["thumb-f"],
  "linkedin":   ["thumb-g", "thumb-h"],
};

function CreativeCard({ ratio, channel, state, video, thumb, headline, subline }) {
  return (
    <div className="creative-card">
      <div className="creative-preview" style={{ aspectRatio: ratio }}>
        {state === "done" && (
          <div className={`thumb ${thumb}`} style={{ position: "absolute", inset: 0, borderRadius: 0 }}>
            <div style={{ position: "absolute", inset: 0, padding: 14,
                           display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                               textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
                               textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  {subline || "automated · zero variability"}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                             fontSize: 18, letterSpacing: "-0.025em", color: "#fff",
                             lineHeight: 1.05, maxWidth: "85%",
                             textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                {headline || "precision in every drop."}
              </div>
            </div>
            {video && (
              <div className="play-overlay">
                <Icons.Play size={16}/>
              </div>
            )}
          </div>
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
                           fontSize: 14, color: "var(--fg-0)" }}>
              cooking…
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                           color: "var(--fg-2)", letterSpacing: "0.05em" }}>
              ~ 2 min left
            </div>
          </div>
        )}
        {state === "queued" && (
          <div className="cooking-state">
            <Icons.History size={20} className="muted"/>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                           color: "var(--fg-2)", letterSpacing: "0.05em",
                           textTransform: "uppercase" }}>
              queued
            </div>
          </div>
        )}
        <div className="channel-tag">{channel}</div>
        <div className="more-btn"><Icons.MoreHorizontal size={13}/></div>
      </div>
      {state === "done" && (
        <div className="footer">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: "var(--fg-3)", letterSpacing: "0.06em",
                          textTransform: "uppercase" }}>
            v1
          </span>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={<Icons.Wand size={11}/>}>animate</Button>
          <button className="cbtn" style={{ width: 28, height: 28 }}>
            <Icons.Download size={12}/>
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignDetail({ mode }) {
  const creatives = [
    { id: 1, ratio: "4/5",  channel: "ig · feed",  state: "done", thumb: "thumb-d",
      headline: "precision in every drop.",     subline: "automated · zero variability" },
    { id: 2, ratio: "4/5",  channel: "ig · feed",  state: mode === "cooking" ? "cooking" : "done",
      thumb: "thumb-a", headline: "summer heat. cold-pressed.", subline: "festive · loud" },
    { id: 3, ratio: "9/16", channel: "ig · story", state: "done", thumb: "thumb-c",
      headline: "purity in every ingredient.",  subline: "clean-label · safety" },
    { id: 4, ratio: "9/16", channel: "reels",     state: mode === "cooking" ? "cooking" : "done",
      thumb: "thumb-b", video: true, headline: "engineered for compliance.", subline: "industrial · clean" },
    { id: 5, ratio: "1/1",  channel: "linkedin",  state: "done", thumb: "thumb-g",
      headline: "founder's table.",             subline: "story · warm" },
    { id: 6, ratio: "1/1",  channel: "linkedin",  state: mode === "cooking" ? "queued" : "done",
      thumb: "thumb-h", headline: "built for the sampler.",     subline: "case study · q3" },
    { id: 7, ratio: "9/16", channel: "tiktok",    state: "done", thumb: "thumb-f", video: true,
      headline: "pair with everything.",        subline: "use-case · loud" },
    { id: 8, ratio: "4/5",  channel: "ig · feed",  state: "done", thumb: "thumb-e",
      headline: "small-batch · austin.",        subline: "story · warm" },
  ];
  const cooking = creatives.filter(c => c.state !== "done").length;

  return (
    <Shell back="back to campaigns">
      {/* Header — brief sidecar / title / actions */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 280px",
                     gap: 24, alignItems: "start" }}>
        {/* brief */}
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                       borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.Megaphone size={14} className="muted"/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            color: "var(--fg-2)" }}>
              brief
            </span>
            <span style={{ flex: 1 }} />
            <button className="cbtn" style={{ width: 24, height: 24 }}>
              <Icons.Pencil size={11}/>
            </button>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                         fontSize: 16, letterSpacing: "-0.02em", marginTop: 8,
                         lineHeight: 1.2, color: "var(--fg-0)" }}>
            precision flavor in every drop.
          </div>
          <div style={{ color: "var(--fg-2)", fontSize: 12.5, lineHeight: 1.4, marginTop: 8,
                         display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
                         overflow: "hidden" }}>
            slow-smoked cherrywood + arbol chiles, jarred small-batch in austin. flagship oil, now in a four-piece summer sampler. festive, loud, perfect for cookouts.
          </div>
        </div>

        {/* center */}
        <div style={{ textAlign: "center" }}>
          <span className="eyebrow">// step 2 · creatives</span>
          <h1 className="h1" style={{ marginTop: 4, fontSize: 36 }}>summer heat sampler.</h1>
          <p style={{ color: "var(--fg-2)", fontSize: 14, marginTop: 8,
                       maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            {mode === "cooking"
              ? `${cooking} of ${creatives.length} still cooking. edit any that's ready, or wait it out.`
              : `${creatives.length} creatives ready. edit, regenerate, or animate any below.`}
          </p>
        </div>

        {/* right actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <Badge kind={mode === "cooking" ? "gen" : "live"}>
            {mode === "cooking" ? "cooking" : "ready"}
          </Badge>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="cbtn"><Icons.Share size={14}/></button>
            <button className="cbtn"><Icons.Download size={14}/></button>
            <button className="cbtn"><Icons.MoreHorizontal size={14}/></button>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 14 }}>
        <Chip active>all 8</Chip>
        <Chip>ig · feed  · 3</Chip>
        <Chip>ig · story · 1</Chip>
        <Chip>reels · 1</Chip>
        <Chip>tiktok · 1</Chip>
        <Chip>linkedin · 2</Chip>
        <span style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" icon={<Icons.Plus size={12}/>}>add creative</Button>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                     gap: 16, alignItems: "start" }}>
        {creatives.map(c => <CreativeCard key={c.id} {...c} />)}
      </div>
    </Shell>
  );
}

const ScreenCampaignGenerating = () => <CampaignDetail mode="cooking" />;
const ScreenCampaignReady      = () => <CampaignDetail mode="ready" />;

/* ─────────── 06 — single creative editor ─────────── */

function PanelRow({ label, expanded, eye, generate, children }) {
  return (
    <div className="panel-row">
      <div className="head">
        <Icons.ChevronRight size={11} className="chev"
          style={{ transform: expanded ? "rotate(90deg)" : "none",
                    transition: "transform 120ms" }}/>
        <span>{label}</span>
        <span style={{ flex: 1 }} />
        {generate && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                          color: "var(--volt)", letterSpacing: "0.05em", cursor: "pointer" }}>
            generate
          </span>
        )}
        {eye && <Icons.Eye size={13} className="muted"/>}
      </div>
      {expanded && children && <div>{children}</div>}
    </div>
  );
}

function ScreenCreativeEditor() {
  return (
    <Shell back="back to summer heat sampler">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px",
                     gap: 24, height: "100%", alignItems: "start" }}>
        {/* preview side */}
        <div style={{ display: "flex", flexDirection: "column",
                       alignItems: "center", gap: 14 }}>
          <div className="version-pill">
            <Icons.History size={13} className="muted"/>
            <span>version history</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--fg-2)", marginLeft: 4 }}>2 / 3</span>
            <span className="arrow"><Icons.ChevronLeft size={12}/></span>
            <span className="arrow"><Icons.ChevronRight size={12}/></span>
          </div>

          {/* canvas — 4:5 IG feed */}
          <div className="editor-canvas thumb thumb-d">
            <div className="canvas-overlay">
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                               letterSpacing: "0.08em", textTransform: "uppercase",
                               color: "rgba(255,255,255,0.7)" }}>
                  automated systems ensure zero caliber variability for industrial meat production.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                                 fontSize: 36, letterSpacing: "-0.04em", lineHeight: 1.0,
                                 color: "#fff", maxWidth: 260,
                                 textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                    precision in every drop.
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                 fontSize: 16, color: "#fff", marginTop: 14, opacity: 0.9 }}>
                    m&a chili oil.
                  </div>
                </div>
                <div style={{ background: "var(--volt)", color: "var(--fg-on-volt)",
                               borderRadius: 999, padding: "7px 14px",
                               fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                               boxShadow: "0 0 18px var(--volt-glow)" }}>
                  shop now
                </div>
              </div>
            </div>
          </div>

          {/* action bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button variant="primary" icon={<Icons.Sparkles size={14}/>}>
              fix layout
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                              opacity: 0.7, marginLeft: 4 }}>· 3 buzz</span>
            </Button>
            <button className="cbtn"><Icons.Refresh size={14}/></button>
            <button className="cbtn"><Icons.Download size={14}/></button>
            <button className="cbtn"><Icons.Share size={14}/></button>
            <button className="cbtn"><Icons.Wand size={14}/></button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            edit on the right · or click the canvas to inspect.
          </div>
        </div>

        {/* right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PanelRow label="image" expanded>
            <div className={`thumb thumb-d`} style={{ height: 110, position: "relative",
                                                       borderRadius: 8 }}>
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
                       style={{ flex: 1 }}>regenerate</Button>
              <Button variant="secondary" size="sm" icon={<Icons.Image size={11}/>}
                       style={{ flex: 1 }}>swap</Button>
            </div>
          </PanelRow>
          <PanelRow label="header" eye />
          <PanelRow label="description" eye />
          <PanelRow label="call to action" generate />
          <PanelRow label="logo" eye />
          <PanelRow label="background" />

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
        </div>
      </div>
    </Shell>
  );
}

/* ─────────── 07 — version history ─────────── */

const VERSIONS = [
  { n: 1, label: "first cook",       time: "2 days ago",  thumb: "thumb-c", on: false },
  { n: 2, label: "fixed layout",     time: "1 day ago",   thumb: "thumb-d", on: false },
  { n: 3, label: "shorter headline", time: "3 hrs ago",   thumb: "thumb-a", on: false },
  { n: 4, label: "current",          time: "just now",    thumb: "thumb-d", on: true },
];

function VersionThumb({ n, label, time, thumb, on }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div className={`version-thumb ${on ? "current" : ""} thumb ${thumb}`}>
        <span className="v-label">v{n}</span>
      </div>
      <div style={{ fontSize: 12, color: on ? "var(--fg-0)" : "var(--fg-1)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                     color: "var(--fg-3)", letterSpacing: "0.04em" }}>
        {time}
      </div>
    </div>
  );
}

function ScreenVersionHistory() {
  return (
    <Shell back="back to summer heat sampler">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div className="version-pill" style={{ borderColor: "var(--line-volt)",
                                                   background: "var(--volt-soft)" }}>
            <Icons.History size={13} style={{ color: "var(--volt)" }}/>
            <span>version history</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--volt)", marginLeft: 4 }}>4 / 4</span>
          </div>

          <div className="editor-canvas thumb thumb-d" style={{ boxShadow:
            "0 32px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px var(--volt), 0 0 60px -10px var(--volt-glow)" }}>
            <div className="canvas-overlay">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                             letterSpacing: "0.08em", textTransform: "uppercase",
                             color: "rgba(255,255,255,0.7)" }}>
                automated systems · zero variability.
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800,
                                 fontSize: 36, letterSpacing: "-0.04em", lineHeight: 1.0,
                                 color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                    precision in every drop.
                  </div>
                </div>
                <div style={{ background: "var(--volt)", color: "var(--fg-on-volt)",
                               borderRadius: 999, padding: "7px 14px",
                               fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                               boxShadow: "0 0 18px var(--volt-glow)" }}>
                  shop the sampler →
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", top: 10, right: 10,
                           background: "var(--volt)", color: "var(--fg-on-volt)",
                           padding: "3px 9px", borderRadius: 6,
                           fontFamily: "var(--font-mono)", fontSize: 10,
                           letterSpacing: "0.06em", textTransform: "uppercase" }}>
              v4 · current
            </div>
          </div>

          {/* strip */}
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
                         borderRadius: 14, padding: 16, width: "100%", maxWidth: 500, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Icons.History size={13} className="muted"/>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                              fontSize: 13.5, color: "var(--fg-0)" }}>
                all versions
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
                              color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                · {VERSIONS.length}
              </span>
              <span style={{ flex: 1 }} />
              <a style={{ color: "var(--fg-2)", fontSize: 12, display: "inline-flex",
                            alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Icons.Trash size={11}/> clear old
              </a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {VERSIONS.map(v => <VersionThumb key={v.n} {...v} />)}
            </div>
          </div>
        </div>

        {/* diff rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="panel-row">
            <span className="eyebrow">// what changed in v4</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              <div className="diff-row">
                <div className="field">header</div>
                <div className="was">automated systems ensure zero caliber variability for industrial meat production.</div>
                <div className="now">automated systems · zero variability.</div>
              </div>
              <div className="diff-row">
                <div className="field">description</div>
                <div style={{ color: "var(--fg-3)", fontSize: 12, fontStyle: "italic" }}>unchanged</div>
              </div>
              <div className="diff-row">
                <div className="field">cta</div>
                <div className="was">learn more</div>
                <div className="now">shop the sampler →</div>
              </div>
            </div>
          </div>

          <div className="panel-row">
            <span className="eyebrow">// actions</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              <Button variant="secondary" size="sm" icon={<Icons.Refresh size={12}/>}
                       style={{ justifyContent: "flex-start" }}>restore v3</Button>
              <Button variant="secondary" size="sm" icon={<Icons.Compare size={12}/>}
                       style={{ justifyContent: "flex-start" }}>compare v3 vs v4</Button>
              <Button variant="ghost" size="sm" icon={<Icons.Trash size={12}/>}
                       style={{ justifyContent: "flex-start", color: "var(--danger)" }}>
                delete this version
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ─────────── App mount ─────────── */
function App() {
  const screens = [
    { id: "list",    label: "01 · campaigns list",         node: <ScreenCampaignsList />,        h: 900 },
    { id: "empty",   label: "02 · empty state",            node: <ScreenCampaignsEmpty />,       h: 900 },
    { id: "brief",   label: "03 · brief modal",            node: <ScreenBriefModal />,           h: 1080 },
    { id: "cooking", label: "04 · campaign · cooking",     node: <ScreenCampaignGenerating />,   h: 900 },
    { id: "ready",   label: "05 · campaign · ready",       node: <ScreenCampaignReady />,        h: 900 },
    { id: "editor",  label: "06 · single creative editor", node: <ScreenCreativeEditor />,       h: 820 },
    { id: "history", label: "07 · version history",        node: <ScreenVersionHistory />,       h: 920 },
  ];
  return (
    <DesignCanvas
      title="vitrine · campaigns (hi-fi)"
      subtitle="7 screens · dark theme · brief → cook → edit"
    >
      <DCSection id="flow" title="campaigns flow"
                 subtitle="prompt-first brief, suggestion-fed creative grid, single-asset editor.">
        {screens.map(s => (
          <DCArtboard key={s.id} id={s.id} label={s.label} width={1280} height={s.h || 820}>
            {s.node}
          </DCArtboard>
        ))}
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
