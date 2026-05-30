/* Mobile auth + onboarding screens (6 total: login + 5 onboarding) */

/* ───────────── 01 — Login ───────────── */
function MobileLogin() {
  return (
    <div className="m-screen" style={{ background: "var(--bg-0)" }}>
      <div className="m-bloom"/>
      <div style={{ position: "relative", zIndex: 1, padding: "0 22px",
                     display: "flex", flexDirection: "column", height: "100%" }}>

        {/* topbar */}
        <header style={{ height: 56, display: "flex", alignItems: "center",
                          justifyContent: "space-between" }}>
          <span className="m-wordmark"><span className="wv">v</span>itrine</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono)", fontSize: 9.5,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--fg-2)",
            padding: "4px 9px", borderRadius: 999,
            border: "1px solid var(--line-subtle)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999,
                            background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }}/>
            buzz · live
          </span>
        </header>

        {/* pitch */}
        <div style={{ marginTop: 28 }}>
          <span className="m-eyebrow">// step 0 · sign in</span>
          <h1 className="m-h1" style={{ marginTop: 10, fontSize: 44, lineHeight: 0.98 }}>
            one door.<br/>
            <span style={{ background: "linear-gradient(135deg, var(--volt), var(--ion))",
                            WebkitBackgroundClip: "text", backgroundClip: "text",
                            color: "transparent" }}>all your buzz.</span>
          </h1>
          <p className="m-lede" style={{ maxWidth: 320 }}>
            vitrine runs on your Civitai account. your Buzz, brand DNA, and every campaign come along for the ride.
          </p>
        </div>

        {/* auth card */}
        <div style={{
          marginTop: 24, padding: 18,
          background: "linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 100%)",
          border: "1px solid var(--line)", borderRadius: 18,
          position: "relative", overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(circle at 50% -20%, rgba(0,255,157,0.10), transparent 50%)",
          }}/>
          <div style={{ position: "relative" }}>
            <span className="m-eyebrow-sm">// welcome back</span>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                            fontSize: 19, letterSpacing: "-0.02em",
                            color: "var(--fg-0)", marginTop: 4 }}>
              sign in to vitrine
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 2 }}>
              one click with your Civitai account
            </div>

            {/* SSO */}
            <button style={{
              marginTop: 16, width: "100%", height: 54, padding: "0 18px", borderRadius: 14,
              border: 0, background: "var(--volt)", color: "var(--fg-on-volt)",
              fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15,
              letterSpacing: "-0.01em",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
              cursor: "pointer",
              boxShadow: "0 0 0 1px var(--volt-glow), 0 0 32px -4px var(--volt-glow), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M16 3 L28.124 10 L28.124 22 L16 29 L3.876 22 L3.876 10 Z"
                      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
                <path d="M21.5 12.5 a6.5 6.5 0 1 0 0 7"
                      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
              continue with Civitai
              <Icons.ArrowLeft size={16} style={{ transform: "rotate(180deg)" }}/>
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 6, marginTop: 10,
                            color: "var(--fg-2)", fontSize: 12 }}>
              <img src="vitrine/buzz.svg" alt="" style={{ width: 12, height: 12 }}/>
              your Buzz &amp; brand DNA travel with you
            </div>

            {/* divider */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center", gap: 12, margin: "18px 0 12px" }}>
              <span style={{ height: 1, background: "var(--line-subtle)" }}/>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                              letterSpacing: "0.16em", textTransform: "uppercase",
                              color: "var(--fg-3)" }}>or</span>
              <span style={{ height: 1, background: "var(--line-subtle)" }}/>
            </div>

            {/* email disclosure */}
            <button style={{
              width: "100%",
              background: "transparent",
              border: "1px dashed var(--line)",
              borderRadius: 12, padding: "12px 14px",
              color: "var(--fg-1)", fontSize: 13, fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", gap: 8,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6,
                                  background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                                  display: "grid", placeItems: "center", color: "var(--fg-2)" }}>
                  @
                </span>
                sign in with email instead
              </span>
              <Icons.ChevronDown size={14} className="muted"/>
            </button>

            <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--fg-3)",
                          lineHeight: 1.5, textAlign: "center" }}>
              by continuing you agree to vitrine's <span style={{ color: "var(--fg-2)",
                                                                    borderBottom: "1px solid var(--line-subtle)" }}>terms</span> &amp; <span style={{ color: "var(--fg-2)",
                                                                    borderBottom: "1px solid var(--line-subtle)" }}>privacy</span>.
            </p>
          </div>
        </div>

        {/* travels-with */}
        <ul style={{ display: "flex", flexDirection: "column", gap: 10,
                       margin: "20px 0 0", padding: 0, listStyle: "none" }}>
          {[
            { b: "your Buzz balance", t: "spend it on shoots, posts, reels" },
            { b: "saved brand dna", t: "palette, tone, audience — ready" },
            { b: "every campaign shipped", t: "picks up where you left off" },
          ].map((x, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                                    fontSize: 12.5, color: "var(--fg-1)" }}>
              <span style={{ width: 20, height: 20, borderRadius: 999,
                                background: "var(--volt-soft)",
                                border: "1px solid var(--line-volt)",
                                display: "grid", placeItems: "center",
                                flexShrink: 0, color: "var(--volt)" }}>
                <Icons.Check size={10} strokeWidth={3}/>
              </span>
              <span><b style={{ color: "var(--fg-0)" }}>{x.b}</b> — {x.t}</span>
            </li>
          ))}
        </ul>

        <div style={{ flex: 1 }}/>
        <div style={{ padding: "20px 0 18px", color: "var(--fg-3)",
                        fontFamily: "var(--font-mono)", fontSize: 10.5,
                        letterSpacing: "0.06em",
                        display: "flex", justifyContent: "space-between" }}>
          <span>© 2026 vitrine</span>
          <span>v 0.4 · civitai</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Helpers for onboarding decorations ───────────── */
function MOnbProgress({ step, total = 4, onSkip }) {
  return (
    <header style={{ height: 56, padding: "0 4px",
                       display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span className="m-wordmark"><span className="wv">v</span>itrine</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 5 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 4,
              background: i === step ? "var(--volt)" : i < step ? "var(--fg-2)" : "var(--bg-3)",
              boxShadow: i === step ? "0 0 8px var(--volt-glow)" : "none",
              transition: "width 200ms var(--ease-out)",
            }}/>
          ))}
        </div>
        {onSkip && (
          <button style={{ background: "transparent", border: 0, color: "var(--fg-2)",
                            fontSize: 12, padding: 4, cursor: "pointer" }}>
            skip
          </button>
        )}
      </div>
    </header>
  );
}

/* ───────────── 02 — Onboarding · welcome ───────────── */
function MobileOnbWelcome() {
  const steps = [
    { num: "1", title: "build your brand DNA",
      copy: "drop a URL, a logo, or describe yourself — we extract palette, tone, audience." },
    { num: "2", title: "cook three reads",
      copy: "we propose three distinct campaign directions — pick the one that clicks." },
    { num: "3", title: "shoot, post, ship",
      copy: "phone photo → studio shot. one product → 12 posts, 3 ads, a reel." },
  ];
  return (
    <div className="m-screen">
      <div className="m-bloom"/>
      <div style={{ position: "relative", zIndex: 1, padding: "0 22px",
                     display: "flex", flexDirection: "column", flex: 1 }}>
        <MOnbProgress step={0} onSkip/>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16,
                          background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                          display: "grid", placeItems: "center", color: "var(--volt)",
                          margin: "0 auto", boxShadow: "var(--bloom-volt-sm)" }}>
            <Icons.Dna size={26}/>
          </div>
          <h1 className="m-h1" style={{ marginTop: 14 }}>
            welcome to<br/>
            <span style={{ background: "linear-gradient(135deg, var(--volt), var(--ion))",
                            WebkitBackgroundClip: "text", backgroundClip: "text",
                            color: "transparent" }}>vitrine.</span>
          </h1>
          <p className="m-lede" style={{ maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
            generate on-brand campaigns, photos, and reels — paid in Buzz. three steps to your first.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
          {steps.map(s => (
            <div key={s.num} style={{
              background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
              borderRadius: 14, padding: 14,
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                color: "var(--volt)", fontFamily: "var(--font-mono)", fontSize: 13,
                fontWeight: 700,
                display: "grid", placeItems: "center",
              }}>{s.num}</span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600,
                                fontSize: 14.5, letterSpacing: "-0.015em", color: "var(--fg-0)" }}>
                  {s.title}
                </div>
                <div style={{ color: "var(--fg-2)", fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
                  {s.copy}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}/>
        <div style={{ padding: "22px 0 24px" }}>
          <button className="m-cta">
            let's go <Icons.ArrowLeft size={16} style={{ transform: "rotate(180deg)" }}/>
          </button>
          <div style={{ textAlign: "center", marginTop: 10,
                          fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-3)", letterSpacing: "0.04em" }}>
            ~2 minutes · skip anything you want
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 03 — Onboarding · input ───────────── */
function MobileOnbInput() {
  return (
    <div className="m-screen">
      <div className="m-bloom"/>
      <div style={{ position: "relative", zIndex: 1, padding: "0 22px",
                     display: "flex", flexDirection: "column", flex: 1 }}>
        <MOnbProgress step={1} onSkip/>

        <div style={{ marginTop: 14 }}>
          <span className="m-eyebrow">// step 1 of 3 · brand DNA</span>
          <h2 className="m-h1" style={{ fontSize: 30, marginTop: 8 }}>
            tell us who you are.
          </h2>
          <p className="m-lede">
            fill what you have. skip what you don't. any single field is enough.
          </p>
        </div>

        {/* URL */}
        <div className="m-card" style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="m-h3">your website</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--fg-3)", letterSpacing: "0.04em" }}>optional</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-2)", margin: "4px 0 10px" }}>
            we'll scrape palette, tone, and copy clues.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 0,
                          background: "var(--bg-3)", border: "1px solid var(--line)",
                          borderRadius: 10, paddingLeft: 10, height: 44 }}>
            <Icons.Globe size={14} className="muted"/>
            <input style={{
              flex: 1, background: "transparent", border: 0, outline: 0,
              padding: "0 10px", fontSize: 14, color: "var(--fg-0)",
              fontFamily: "inherit",
            }} placeholder="your-shop.co"/>
          </div>
        </div>

        <div style={{ textAlign: "center", margin: "10px 0",
                        fontFamily: "var(--font-mono)", fontSize: 10,
                        letterSpacing: "0.14em", textTransform: "uppercase",
                        color: "var(--fg-3)" }}>or instead</div>

        {/* Describe */}
        <div className="m-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="m-h3">describe your business</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--fg-3)" }}>in your words</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-2)", margin: "4px 0 10px" }}>
            like talking to a friend. what do you sell? who buys?
          </p>
          <textarea style={{
            width: "100%", background: "var(--bg-3)", border: "1px solid var(--line)",
            borderRadius: 10, padding: "10px 12px",
            fontSize: 13.5, color: "var(--fg-0)", fontFamily: "inherit",
            resize: "none", minHeight: 90, lineHeight: 1.45,
          }} placeholder="we make small-batch chili oil — sold at three farmers markets in austin. customers are mostly food nerds in their 30s…"
          defaultValue="we make small-batch chili oil — sold at three farmers markets in austin. customers are mostly food nerds in their 30s."/>
        </div>

        {/* Logo upload */}
        <div className="m-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="m-h3">logo</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
              optional
            </span>
          </div>
          <button style={{
            marginTop: 10, width: "100%",
            background: "transparent", border: "1.5px dashed var(--line)",
            borderRadius: 12, padding: "18px 12px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: "var(--fg-1)", cursor: "pointer",
          }}>
            <Icons.Upload size={20} className="muted"/>
            <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>
              drop a logo, or tap to upload
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--fg-3)", letterSpacing: "0.04em" }}>
              SVG · PNG · JPG · up to 2 mb
            </span>
          </button>
        </div>

        {/* Colors */}
        <div className="m-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="m-h3">colors</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
              auto · or pick yourself
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
            {["#c84a2e", "#ffd966", "#1a3d2a", "#f6f1e6", "#3a2417"].map((c, i) => (
              <button key={c} style={{
                width: 36, height: 36, borderRadius: 10,
                background: c, border: 0,
                outline: i < 2 ? "2px solid var(--volt)" : "none",
                outlineOffset: 2, cursor: "pointer",
              }} aria-label={c}/>
            ))}
            <button style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--bg-3)", border: "1px dashed var(--line)",
              color: "var(--fg-2)", cursor: "pointer",
              display: "grid", placeItems: "center",
            }}><Icons.Plus size={14}/></button>
            <span style={{ marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--fg-2)" }}>2 selected</span>
          </div>
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="m-cta">
            analyze <Icons.ArrowLeft size={16} style={{ transform: "rotate(180deg)" }}/>
          </button>
          <button className="m-cta ghost">skip — start blank</button>
        </div>

        <div style={{ flex: 1, minHeight: 24 }}/>
      </div>
    </div>
  );
}

/* ───────────── 04 — Onboarding · generating ───────────── */
function MobileOnbGenerating() {
  const tasks = [
    { t: "reading your site", state: "done" },
    { t: "extracting palette", state: "done" },
    { t: "tasting your tone of voice", state: "active" },
    { t: "sketching your audience", state: "idle" },
    { t: "naming the read", state: "idle" },
  ];
  return (
    <div className="m-screen">
      <div className="m-bloom"/>
      <div style={{ position: "relative", zIndex: 1, padding: "0 22px",
                     display: "flex", flexDirection: "column", flex: 1, alignItems: "center" }}>
        <MOnbProgress step={2} onSkip={null}/>

        {/* orb */}
        <div style={{
          marginTop: 30, width: 92, height: 92, borderRadius: 999,
          background: "radial-gradient(circle at 30% 30%, rgba(0,255,157,0.5), transparent 60%), var(--bg-2)",
          border: "1px solid var(--line-volt)",
          display: "grid", placeItems: "center", color: "var(--volt)",
          boxShadow: "0 0 40px -4px var(--volt-glow), inset 0 0 30px rgba(0,255,157,0.15)",
          position: "relative",
        }}>
          <Icons.Dna size={38}/>
          <div style={{
            position: "absolute", inset: -8, borderRadius: 999,
            border: "1px solid var(--volt)", opacity: 0.4,
          }}/>
        </div>

        <h2 className="m-h1" style={{ fontSize: 28, marginTop: 22, textAlign: "center" }}>
          we're <span style={{ background: "linear-gradient(135deg, var(--volt), var(--ion))",
                                 WebkitBackgroundClip: "text", backgroundClip: "text",
                                 color: "transparent" }}>cooking</span><br/>
          your brand DNA.
        </h2>
        <p className="m-lede" style={{ textAlign: "center", maxWidth: 300 }}>
          ~45 seconds. feel free to leave — we'll save what we find.
        </p>

        {/* status pill */}
        <div style={{
          marginTop: 18,
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
          padding: "8px 14px", borderRadius: 999,
          color: "var(--volt)",
        }}>
          <Icons.Sparkles size={13}/>
          <span style={{ fontSize: 13, color: "var(--fg-0)" }}>tasting your tone of voice…</span>
        </div>

        {/* preview chrome */}
        <div style={{
          marginTop: 22, width: "100%", maxWidth: 340,
          background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
          borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 10px",
                          borderBottom: "1px solid var(--line-subtle)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#ff5f57" }}/>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#febc2e" }}/>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#28c840" }}/>
            <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 10,
                              color: "var(--fg-2)" }}>your-shop.co</span>
          </div>
          <div style={{ padding: 14, position: "relative", overflow: "hidden" }}>
            {[ "40%", "70%", "55%", "60%" ].map((w, i) => (
              <div key={i} style={{
                height: 8, width: w, borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                marginBottom: 8,
              }}/>
            ))}
            <div style={{ height: 60, borderRadius: 6,
                            background: "rgba(255,255,255,0.04)" }}/>
            {/* scanner line */}
            <div style={{
              position: "absolute", left: 0, right: 0, top: "60%", height: 2,
              background: "linear-gradient(90deg, transparent, var(--volt), transparent)",
              boxShadow: "0 0 12px var(--volt-glow)",
            }}/>
          </div>
        </div>

        {/* checklist */}
        <div style={{ width: "100%", marginTop: 20,
                        display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((row, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px",
              background: row.state === "active" ? "var(--volt-soft)" : "transparent",
              border: row.state === "active" ? "1px solid var(--line-volt)" : "1px solid transparent",
              borderRadius: 10,
              opacity: row.state === "idle" ? 0.5 : 1,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 999,
                background: row.state === "done" ? "var(--volt)" :
                            row.state === "active" ? "transparent" : "var(--bg-3)",
                border: row.state === "active" ? "2px solid var(--volt)" : "0",
                display: "grid", placeItems: "center",
                color: "var(--fg-on-volt)",
              }}>
                {row.state === "done" && <Icons.Check size={10} strokeWidth={3.5}/>}
              </span>
              <span style={{ fontSize: 13.5,
                              color: row.state === "active" ? "var(--fg-0)" : "var(--fg-1)",
                              fontWeight: row.state === "active" ? 600 : 400 }}>
                {row.t}
              </span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 24 }}/>
      </div>
    </div>
  );
}

/* ───────────── 05 — Onboarding · DNA reveal ───────────── */
function MobileOnbDna() {
  return (
    <div className="m-screen">
      <div className="m-bloom"/>
      <div style={{ position: "relative", zIndex: 1, padding: "0 22px",
                     display: "flex", flexDirection: "column", flex: 1 }}>
        <MOnbProgress step={3} onSkip={null}/>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14,
                          background: "var(--volt-soft)", border: "1px solid var(--line-volt)",
                          display: "grid", placeItems: "center", color: "var(--volt)",
                          margin: "0 auto", boxShadow: "var(--bloom-volt-sm)" }}>
            <Icons.Dna size={22}/>
          </div>
          <h2 className="m-h1" style={{ fontSize: 30, marginTop: 12 }}>
            your <span style={{ background: "linear-gradient(135deg, var(--volt), var(--ion))",
                                  WebkitBackgroundClip: "text", backgroundClip: "text",
                                  color: "transparent" }}>brand DNA</span>.
          </h2>
          <p className="m-lede" style={{ maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
            tweak anything that doesn't feel like you. this powers every campaign we run.
          </p>
        </div>

        {/* tab */}
        <div style={{
          marginTop: 18, padding: 3,
          background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
          borderRadius: 999,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
        }}>
          <button style={{
            background: "var(--bg-3)", border: 0, borderRadius: 999, height: 32,
            color: "var(--fg-0)", fontWeight: 600, fontSize: 12.5,
            fontFamily: "inherit", cursor: "pointer",
          }}>brand overview</button>
          <button style={{
            background: "transparent", border: 0, borderRadius: 999, height: 32,
            color: "var(--fg-2)", fontWeight: 500, fontSize: 12.5,
            fontFamily: "inherit", cursor: "pointer",
          }}>business details</button>
        </div>

        {/* identity */}
        <div className="m-card" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="m-eyebrow-sm">// identity</span>
            <button className="m-icon-btn" style={{ marginLeft: "auto", width: 28, height: 28 }}>
              <Icons.Pencil size={11}/>
            </button>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                          fontSize: 22, letterSpacing: "-0.02em", color: "var(--fg-0)",
                          marginTop: 6 }}>
            Lumen &amp; Co.
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 12, color: "var(--fg-2)", marginTop: 4 }}>
            <Icons.Globe size={11}/> https://lumen.co
          </div>
        </div>

        {/* logo + fonts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div className="m-card" style={{ padding: 12 }}>
            <span className="m-eyebrow-sm">// logo</span>
            <div style={{ marginTop: 8, height: 80, borderRadius: 8,
                            background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                            display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                fontSize: 22, letterSpacing: "-0.03em", color: "#c84a2e" }}>
                Lumen
              </span>
            </div>
          </div>
          <div className="m-card" style={{ padding: 12 }}>
            <span className="m-eyebrow-sm">// fonts</span>
            <div style={{ marginTop: 8, height: 80, borderRadius: 8,
                            background: "var(--bg-3)", border: "1px solid var(--line-subtle)",
                            padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                fontSize: 28, letterSpacing: "-0.03em", lineHeight: 1,
                                color: "var(--fg-0)" }}>
                Aa
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                                color: "var(--fg-2)", marginTop: "auto" }}>
                Bricolage / Space
              </span>
            </div>
          </div>
        </div>

        {/* palette */}
        <div className="m-card" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="m-eyebrow-sm">// colors</span>
            <button className="m-icon-btn" style={{ marginLeft: "auto", width: 28, height: 28 }}>
              <Icons.Pencil size={11}/>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 10 }}>
            {[ "#c84a2e", "#ffd966", "#1a3d2a", "#f6f1e6" ].map(c => (
              <div key={c} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ height: 40, borderRadius: 8, background: c,
                                border: "1px solid var(--line-subtle)" }}/>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                                  color: "var(--fg-2)", letterSpacing: "0.04em" }}>
                  {c}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* progress */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                          fontFamily: "var(--font-mono)", fontSize: 10.5,
                          color: "var(--fg-2)", letterSpacing: "0.04em",
                          textTransform: "uppercase", marginBottom: 6 }}>
            <span>100% complete</span>
            <span style={{ color: "var(--volt)" }}>ready</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--bg-2)",
                          border: "1px solid var(--line-subtle)", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%",
                            background: "linear-gradient(90deg, var(--volt), var(--ion))",
                            boxShadow: "0 0 10px var(--volt-glow)" }}/>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 16 }}/>

        <div style={{ padding: "14px 0 22px" }}>
          <button className="m-cta">
            let's go <Icons.ArrowLeft size={16} style={{ transform: "rotate(180deg)" }}/>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 06 — Onboarding · what's next sheet ───────────── */
function MobileOnbNext() {
  return (
    <div className="m-screen" style={{ position: "relative" }}>
      {/* faded dna behind */}
      <div style={{ opacity: 0.3, pointerEvents: "none", filter: "blur(2px)" }}>
        <MobileOnbDna/>
      </div>

      {/* scrim + sheet */}
      <div className="m-sheet-wrap">
        <div className="m-sheet-scrim"/>
        <div className="m-sheet" style={{ maxHeight: "82%" }}>
          <div className="m-sheet-handle"/>
          <div className="m-sheet-head">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="m-eyebrow-sm">// brand DNA · ready</span>
              <div className="m-sheet-title">where to start?</div>
            </div>
            <button className="m-icon-btn"><Icons.X size={14}/></button>
          </div>
          <div className="m-sheet-body">
            {/* campaigns choice */}
            <button style={{
              width: "100%", textAlign: "left",
              background: "linear-gradient(180deg, var(--bg-2), var(--bg-1))",
              border: "1px solid var(--line-volt)",
              borderRadius: 16, padding: 14,
              cursor: "pointer", color: "var(--fg-0)", fontFamily: "inherit",
              position: "relative", overflow: "hidden",
              boxShadow: "0 0 32px -8px var(--volt-glow)",
            }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                              background: "radial-gradient(ellipse at 100% 0%, rgba(0,255,157,0.12), transparent 60%)" }}/>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div className="m-h3">campaigns</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4,
                                    maxWidth: 240, lineHeight: 1.45 }}>
                      12 posts, 3 ads, a hero reel — all from one product shot.
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5,
                                    letterSpacing: "0.08em", textTransform: "uppercase",
                                    color: "var(--volt)", background: "var(--volt-soft)",
                                    border: "1px solid var(--line-volt)",
                                    padding: "3px 7px", borderRadius: 6 }}>
                    recommended
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 6, marginTop: 12 }}>
                  {[ "thumb-d", "thumb-a", "thumb-e" ].map((t, i) => (
                    <div key={i} className={`thumb ${t}`} style={{ height: 80, borderRadius: 8 }}>
                      <div style={{ position: "absolute", inset: 0,
                                      background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 50%)" }}/>
                      <div style={{ position: "absolute", bottom: 6, left: 8,
                                      fontFamily: "var(--font-display)", fontWeight: 700,
                                      fontSize: 10.5, color: "#fff",
                                      lineHeight: 1.05,
                                      textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                        {i === 0 ? "small\nbatch." : i === 1 ? "summer\nheat." : "cooked\nwith\ncare."}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center",
                                justifyContent: "space-between" }}>
                  <MobileBuzzPill amount={240} compact={false}/>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                                    color: "var(--volt)", fontSize: 13, fontWeight: 600 }}>
                    start <Icons.ArrowLeft size={14} style={{ transform: "rotate(180deg)" }}/>
                  </span>
                </div>
              </div>
            </button>

            {/* photoshoot choice */}
            <button style={{
              width: "100%", textAlign: "left", marginTop: 10,
              background: "var(--bg-2)", border: "1px solid var(--line-subtle)",
              borderRadius: 16, padding: 14,
              cursor: "pointer", color: "var(--fg-0)", fontFamily: "inherit",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div className="m-h3">photoshoot</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4,
                                  maxWidth: 240, lineHeight: 1.45 }}>
                    one phone photo → studio, lifestyle, in-use, hero.
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr",
                              gap: 6, marginTop: 12, height: 80 }}>
                <div style={{ background: "var(--bg-3)", borderRadius: 8,
                                border: "1px solid var(--line-subtle)",
                                display: "grid", placeItems: "center",
                                color: "var(--fg-3)", fontFamily: "var(--font-mono)",
                                fontSize: 9.5, letterSpacing: "0.04em" }}>
                  your photo
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                                gridTemplateRows: "1fr 1fr", gap: 4 }}>
                  {[ "thumb-d", "thumb-c", "thumb-e", "thumb-h" ].map((t, i) => (
                    <div key={i} className={`thumb ${t}`} style={{ borderRadius: 5 }}/>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center",
                              justifyContent: "space-between" }}>
                <MobileBuzzPill amount={60} compact={false}/>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                                  color: "var(--fg-1)", fontSize: 13, fontWeight: 600 }}>
                  start <Icons.ArrowLeft size={14} style={{ transform: "rotate(180deg)" }}/>
                </span>
              </div>
            </button>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span style={{ color: "var(--fg-2)", fontSize: 12, cursor: "pointer" }}>
                or just drop me at the dashboard →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MobileLogin,
  MobileOnbWelcome, MobileOnbInput, MobileOnbGenerating, MobileOnbDna, MobileOnbNext,
});
