// Vitrine — Welcome & Onboarding (hi-fi)
// Single interactive flow. Screens: welcome → input → generating → dna → (next-modal)

const { useState, useEffect, useRef, useCallback } = React;

/* ─────────────────────────────────────────
   Shell
   ───────────────────────────────────────── */
function Bloom() {
  return (
    <>
      <div className="blooms" aria-hidden="true">
        <div className="b bv" />
        <div className="b bu" />
      </div>
      <div className="grid-bg" aria-hidden="true" />
    </>
  );
}

function Topbar({ step, onSkip }) {
  // 4 visible dots: welcome=0, input=1, generating=2, dna=3
  const dots = [0, 1, 2, 3];
  return (
    <header className="topbar">
      <a className="wm" href="#" aria-label="vitrine home">
        <img src="assets/wordmark.svg" alt="vitrine" />
      </a>
      <div className="right">
        <div className="progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={4}>
          {dots.map(d => (
            <span key={d} className={
              "dot " + (d === step ? "active" : d < step ? "done" : "")
            } />
          ))}
          <span className="label">{Math.min(step + 1, 4)} / 4</span>
        </div>
        {onSkip && (
          <button className="skip" onClick={onSkip}>skip for now</button>
        )}
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────
   Screen 1 — Welcome
   ───────────────────────────────────────── */
function ScreenWelcome({ onNext }) {
  const steps = [
    {
      num: '1',
      title: 'build your brand DNA',
      copy: 'drop a URL, a logo, or just describe yourself — we extract palette, tone, audience.',
      thumb: 'thumb-dna',
      deco: <DnaDecoration />,
    },
    {
      num: '2',
      title: 'cook three reads',
      copy: 'we propose three distinct campaign directions — pick the one that clicks.',
      thumb: 'thumb-campaign',
      deco: <CampaignDecoration />,
    },
    {
      num: '3',
      title: 'shoot, post, ship',
      copy: 'phone photo → studio shot. one product → 12 posts, 3 ads, a hero reel.',
      thumb: 'thumb-shoot',
      deco: <ShootDecoration />,
    },
  ];
  return (
    <div className="stage">
      <section className="welcome-hero">
        <div className="dna-wrap"><IconDna size={28} /></div>
        <h1>
          welcome to <span className="reveal">vitrine.</span>
        </h1>
        <p>generate on-brand campaigns, photos, and reels — paid in Buzz. three steps to your first.</p>
      </section>

      <div className="step-grid">
        {steps.map(s => (
          <article key={s.num} className="step-card">
            <span className="num">{s.num}</span>
            <h3>{s.title}</h3>
            <p className="copy">{s.copy}</p>
            <div className={`thumb ${s.thumb}`}>{s.deco}</div>
          </article>
        ))}
      </div>

      <div className="welcome-foot">
        <button className="btn primary lg" onClick={onNext}>
          let's go <IconArrowRight size={18} />
        </button>
        <span className="meta">~2 minutes · skip anything you want</span>
      </div>
    </div>
  );
}

// Decorative SVGs for the welcome card thumbs
function DnaDecoration() {
  return (
    <svg className="deco" viewBox="0 0 320 100" preserveAspectRatio="none" fill="none">
      <path d="M20 50 C 80 20, 80 80, 160 50 C 240 20, 240 80, 300 50"
            stroke="rgba(0,255,157,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 50 C 80 80, 80 20, 160 50 C 240 80, 240 20, 300 50"
            stroke="rgba(25,240,255,0.45)" strokeWidth="1.5" strokeLinecap="round"/>
      {[40,80,120,160,200,240,280].map((x,i) => (
        <line key={i} x1={x} y1={i % 2 === 0 ? 36 : 64} x2={x} y2={i % 2 === 0 ? 64 : 36}
              stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
      ))}
    </svg>
  );
}
function CampaignDecoration() {
  return (
    <svg className="deco" viewBox="0 0 320 100" preserveAspectRatio="none" fill="none">
      <rect x="30" y="20" width="60" height="60" rx="6" fill="#c84a2e" />
      <rect x="100" y="14" width="60" height="72" rx="6" fill="#ffd966" />
      <rect x="170" y="20" width="60" height="60" rx="6" fill="#1a3d2a" />
      <rect x="240" y="28" width="60" height="48" rx="6" fill="rgba(124,92,255,0.5)" />
      <text x="60" y="58" fontSize="14" fontWeight="700" fontFamily="Bricolage Grotesque" fill="#fff" textAnchor="middle">HOT</text>
      <text x="130" y="58" fontSize="14" fontWeight="700" fontFamily="Bricolage Grotesque" fill="#0a0a0f" textAnchor="middle">NEW</text>
    </svg>
  );
}
function ShootDecoration() {
  return (
    <svg className="deco" viewBox="0 0 320 100" preserveAspectRatio="none" fill="none">
      <rect x="40" y="20" width="80" height="60" rx="6" fill="#1f1f2c" stroke="rgba(255,255,255,0.15)" />
      <circle cx="80" cy="58" r="14" fill="url(#g1)" />
      <defs>
        <radialGradient id="g1" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#d49060" />
          <stop offset="100%" stopColor="#5a2818" />
        </radialGradient>
      </defs>
      <rect x="140" y="20" width="36" height="28" rx="4" fill="#2a6fa8" />
      <rect x="180" y="20" width="36" height="28" rx="4" fill="#f5b8b8" />
      <rect x="140" y="52" width="36" height="28" rx="4" fill="#4a3a2e" />
      <rect x="180" y="52" width="36" height="28" rx="4" fill="#8ed0a8" />
      <line x1="125" y1="50" x2="138" y2="50" stroke="rgba(0,255,157,0.6)" strokeWidth="1.5" />
      <polyline points="134,46 138,50 134,54" fill="none" stroke="rgba(0,255,157,0.6)" strokeWidth="1.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────
   Screen 2 — Brand DNA input
   ───────────────────────────────────────── */
function ScreenInput({ onNext, onBack, state, setState }) {
  const anyFilled = state.url.trim() || state.description.trim() || state.logoName || state.colors.length > 0;

  return (
    <div className="stage">
      <div className="section-head">
        <span className="eyebrow">// step 1 of 3 · brand DNA</span>
        <h2>tell us who you are.</h2>
        <p className="lede">fill what you have. skip what you don't. any single field is enough — we'll figure out the rest together.</p>
      </div>

      <div className="input-grid">
        {/* LEFT — URL + describe */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card input-card">
            <div className="head">
              <h3>your website</h3>
              <span className="opt">optional</span>
            </div>
            <p className="help">we'll scrape it for palette, tone, and copy clues.</p>
            <div className="input-with-prefix">
              <span className="pf"><IconLink size={15} /></span>
              <input
                type="url"
                placeholder="your-shop.co"
                value={state.url}
                onChange={e => setState({ ...state, url: e.target.value })}
              />
            </div>
          </div>

          <div className="or-divider">or instead</div>

          <div className="card input-card">
            <div className="head">
              <h3>describe your business</h3>
              <span className="opt">in your own words</span>
            </div>
            <p className="help">like talking to a friend. what do you sell? who buys? what's the vibe?</p>
            <textarea
              className="textarea"
              rows="4"
              placeholder="we make small-batch chili oil — sold at three farmers markets in austin. customers are mostly food nerds in their 30s…"
              value={state.description}
              onChange={e => setState({ ...state, description: e.target.value })}
            />
          </div>
        </div>

        {/* RIGHT — logo + colors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card input-card">
            <div className="head">
              <h3>logo</h3>
              <span className="opt">optional</span>
            </div>
            <p className="help">we'll lift your palette and read your visual signature from this.</p>
            <button
              className="dropzone"
              type="button"
              onClick={() => setState({ ...state, logoName: 'lumen-logo.svg' })}
              style={state.logoName ? { borderStyle: 'solid', borderColor: 'var(--line-volt)' } : null}
            >
              {state.logoName ? (
                <>
                  <IconCheck size={20} />
                  <span className="dz-title">{state.logoName}</span>
                  <span className="dz-sub">click to replace</span>
                </>
              ) : (
                <>
                  <IconUpload size={22} />
                  <span className="dz-title">drop a logo, or click to upload</span>
                  <span className="dz-sub">SVG · PNG · JPG · up to 2 mb</span>
                </>
              )}
            </button>
          </div>

          <div className="card input-card">
            <div className="head">
              <h3>colors</h3>
              <span className="opt">auto · or pick yourself</span>
            </div>
            <p className="help">we'll extract from your logo or URL — or paint your own here.</p>
            <ColorPicker colors={state.colors} onChange={cs => setState({ ...state, colors: cs })} />
          </div>
        </div>
      </div>

      <div className="foot-bar">
        <button className="back-link" onClick={onBack}>
          <IconArrowLeft size={14} /> back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost" onClick={onNext}>skip — start blank</button>
          <button
            className="btn primary"
            onClick={onNext}
            disabled={!anyFilled}
            title={anyFilled ? '' : 'fill at least one field'}
          >
            analyze <IconArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ colors, onChange }) {
  // Seed a few suggested palettes the user can click to add
  const palette = ['#c84a2e', '#ffd966', '#1a3d2a', '#f6f1e6', '#3a2417'];
  const has = c => colors.includes(c);

  return (
    <div className="swatches">
      {palette.map(c => (
        <button
          key={c}
          className="swatch"
          aria-label={c}
          style={{
            background: c,
            outline: has(c) ? '2px solid var(--volt)' : 'none',
            outlineOffset: 2,
          }}
          onClick={() => onChange(has(c) ? colors.filter(x => x !== c) : [...colors, c])}
        />
      ))}
      <button className="swatch add" aria-label="add custom color"
              onClick={() => onChange([...colors, '#19f0ff'])}>
        <IconPlus size={14} />
      </button>
      <span className="hex">
        {colors.length > 0 ? `${colors.length} selected` : 'tap to add'}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────
   Screen 3 — Generating
   ───────────────────────────────────────── */
const GEN_TASKS = [
  'reading your site',
  'extracting palette',
  'tasting your tone of voice',
  'sketching your audience',
  'naming the read',
];

function ScreenGenerating({ onNext, autoAdvance = true }) {
  const [tick, setTick] = useState(0);
  const startedRef = useRef(false);

  // Step through tasks every ~800ms; auto-advance after the last.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTick(i);
      if (i > GEN_TASKS.length) {
        clearInterval(id);
        if (autoAdvance) setTimeout(onNext, 600);
      }
    }, 850);
    return () => clearInterval(id);
  }, [onNext, autoAdvance]);

  const currentLabel = tick < GEN_TASKS.length
    ? GEN_TASKS[tick]
    : 'finishing up';

  return (
    <div className="stage">
      <div className="gen-wrap">
        <div className="gen-orb">
          <IconDna size={44} />
        </div>

        <div className="gen-head">
          <h2>we're <span className="gradient-volt">cooking</span> your brand DNA.</h2>
          <p>~45 seconds. feel free to leave this tab — we'll save what we find.</p>
        </div>

        <div className="status-pill">
          <span className="sp-ico"><IconSparkle size={14} /></span>
          <span>{currentLabel}<span className="dots"></span></span>
        </div>

        <div className="gen-preview" aria-hidden="true">
          <div className="pv-head">
            <span className="light" /><span className="light" /><span className="light" />
            <span className="url"><IconLink size={11} /> &nbsp;your-shop.co</span>
          </div>
          <div className="pv-body">
            <div className="pv-skeleton">
              <div className="skel-line" style={{ width: '40%' }} />
              <div className="skel-line" style={{ width: '70%' }} />
              <div className="skel-block" />
              <div className="skel-line" style={{ width: '55%' }} />
            </div>
            <div className="scanner" />
          </div>
        </div>

        <div className="gen-checklist">
          {GEN_TASKS.map((t, i) => {
            const status = i < tick ? 'done' : i === tick ? 'active' : 'idle';
            return (
              <div key={t} className={`row ${status}`}>
                <span className="check">{status === 'done' && <IconCheck size={10} strokeWidth={3.5} />}</span>
                <span>{t}</span>
              </div>
            );
          })}
        </div>

        {/* dev skip */}
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onNext}>
          skip ahead <IconArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Screen 4 — DNA reveal
   ───────────────────────────────────────── */
function ScreenDna({ onNext, tab, setTab }) {
  return (
    <div className="stage dna-stage">
      <div className="section-head">
        <div className="dna-wrap" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <IconDna size={22} />
        </div>
        <h2>your <span className="gradient-volt">brand DNA</span>.</h2>
        <p className="lede">tweak anything that doesn't feel like you. this powers every campaign we run.</p>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" className={tab === 'overview' ? 'active' : ''}
                onClick={() => setTab('overview')}>brand overview</button>
        <button role="tab" className={tab === 'details' ? 'active' : ''}
                onClick={() => setTab('details')}>business details</button>
      </div>

      {tab === 'overview' ? <DnaOverview /> : <DnaDetails />}

      <div className="dna-foot">
        <div className="pct-wrap">
          <span className="pct">100% complete</span>
          <div className="bar"><div className="fill" style={{ width: '100%' }} /></div>
        </div>
        <button className="btn primary lg" onClick={onNext}>
          let's go <IconArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function DnaCardHead({ children }) {
  return (
    <div className="dna-card-head">
      <span className="eyebrow">// {children}</span>
      <button className="pen" aria-label="edit"><IconPencil size={13} /></button>
    </div>
  );
}

function DnaOverview() {
  return (
    <>
      {/* identity card */}
      <div className="card">
        <DnaCardHead>identity</DnaCardHead>
        <h3 className="brand-name">Lumen &amp; Co.</h3>
        <span className="brand-url"><IconLink size={13} /> https://lumen.co</span>
      </div>

      {/* logo + fonts */}
      <div className="dna-grid">
        <div className="card">
          <DnaCardHead>logo</DnaCardHead>
          <div className="logo-frame">
            <span className="logo-text">Lumen</span>
          </div>
        </div>
        <div className="card">
          <DnaCardHead>fonts</DnaCardHead>
          <div className="font-pair">
            <span className="Aa">Aa</span>
            <span className="name">Bricolage Grotesque</span>
            <span className="role">display · body pairs with Inter</span>
          </div>
        </div>
      </div>

      {/* palette */}
      <div className="card">
        <DnaCardHead>colors</DnaCardHead>
        <div className="palette-row">
          {[
            { c: '#c84a2e', hex: '#c84a2e' },
            { c: '#ffd966', hex: '#ffd966' },
            { c: '#1a3d2a', hex: '#1a3d2a' },
            { c: '#f6f1e6', hex: '#f6f1e6' },
          ].map(s => (
            <div className="swatch-big" key={s.hex}>
              <div className="dot" style={{ background: s.c }} />
              <span className="hex">{s.hex}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DnaDetails() {
  return (
    <>
      <div className="dna-grid">
        <div className="card">
          <DnaCardHead>tagline</DnaCardHead>
          <p className="tagline">small-batch heat, made with no shortcuts.</p>
        </div>
        <div className="card">
          <DnaCardHead>brand values</DnaCardHead>
          <div className="chip-row">
            {['craft', 'sourcing', 'transparency', 'heat', 'community'].map(v => (
              <span className="chip" key={v}>{v}</span>
            ))}
            <button className="chip add"><IconPlus size={12} /> add</button>
          </div>
        </div>
      </div>

      <div className="dna-grid">
        <div className="card">
          <DnaCardHead>aesthetic</DnaCardHead>
          <div className="chip-row">
            {['warm pantry', 'hand-labeled', 'rustic but tidy', 'sun-bleached', 'food-stylist clean'].map(v => (
              <span className="chip" key={v}>{v}</span>
            ))}
            <button className="chip add"><IconPlus size={12} /> add</button>
          </div>
        </div>
        <div className="card">
          <DnaCardHead>tone of voice</DnaCardHead>
          <div className="chip-row">
            {['friendly', 'confident', 'a little spicy', 'unfussy'].map(v => (
              <span className="chip" key={v}>{v}</span>
            ))}
            <button className="chip add"><IconPlus size={12} /> add</button>
          </div>
        </div>
      </div>

      <div className="card">
        <DnaCardHead>business overview</DnaCardHead>
        <p className="overview-blurb">
          a 2-person chili oil studio in east austin. small batches, three farmers' markets, ~400 jars/mo. customers skew 28–40, food-curious, swap recipes on instagram. ingredients are sourced direct from texas hill country growers — labels are letterpress-printed, capped by hand.
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   "What's next?" modal — Campaigns + Photoshoot
   ───────────────────────────────────────── */
function NextModal({ onClose, onChoose }) {
  return (
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="next-title">
      {/* faint app-shell hint behind the modal */}
      <AppShellHint />

      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="close">
          <IconClose size={14} />
        </button>

        <div className="modal-head">
          <h3 id="next-title">your <span className="reveal">brand DNA</span> is ready.</h3>
          <p>pick where to start — you can come back for the other any time.</p>
        </div>

        <div className="choice-grid">
          {/* CAMPAIGNS */}
          <button className="choice featured" onClick={() => onChoose('campaigns')}>
            <div className="ch-head">
              <div>
                <h4>campaigns</h4>
                <p className="ch-sub">12 posts, 3 ad creatives, a hero reel — all from one product shot, tuned to your DNA.</p>
              </div>
              <span className="recommend">recommended</span>
            </div>
            <div className="preview campaigns">
              <div className="post p1">
                <span className="ph">put the<br/>heat<br/>back in</span>
                <span className="tag">post · 1/12</span>
              </div>
              <div className="post p2">
                <span className="ph">small<br/>batch.<br/>big flavor.</span>
                <span className="tag">post · 2/12</span>
              </div>
              <div className="post p3">
                <span className="ph" style={{ color: '#ffd966' }}>cooked<br/>with<br/>care</span>
                <span className="tag">reel · hero</span>
              </div>
            </div>
            <div className="foot-row">
              <span className="buzz-pill"><IconBuzz size={11} /> 240 buzz</span>
              <span className="start">start <IconArrowRight size={14} /></span>
            </div>
          </button>

          {/* PHOTOSHOOT */}
          <button className="choice" onClick={() => onChoose('photoshoot')}>
            <div className="ch-head">
              <div>
                <h4>photoshoot</h4>
                <p className="ch-sub">turn one phone photo into studio, lifestyle, in-use, and hero variations.</p>
              </div>
            </div>
            <div className="preview photoshoot">
              <div className="pane input">
                <span className="lbl">your photo</span>
                <div className="obj" />
              </div>
              <div className="pane shots">
                <div className="s s1" />
                <div className="s s2" />
                <div className="s s3" />
                <div className="s s4" />
              </div>
            </div>
            <div className="foot-row">
              <span className="buzz-pill"><IconBuzz size={11} /> 60 buzz</span>
              <span className="start">start <IconArrowRight size={14} /></span>
            </div>
          </button>
        </div>

        <div className="modal-foot">
          <button className="alt-link" onClick={onClose}>or just drop me at the dashboard →</button>
        </div>
      </div>
    </div>
  );
}

function AppShellHint() {
  return (
    <div className="app-shell-hint" aria-hidden="true">
      <div className="side">
        <div className="item" />
        <div className="item active" />
        <div className="item" />
        <div className="item" />
        <div className="item" />
      </div>
      <div className="content">
        <div className="line" style={{ width: '40%' }} />
        <div className="tile-row">
          <div className="tile" /><div className="tile" /><div className="tile" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Dev scrubber (jump between screens)
   ───────────────────────────────────────── */
function Scrubber({ current, setCurrent }) {
  const screens = [
    { id: 'welcome',   label: '01 welcome' },
    { id: 'input',     label: '02 input' },
    { id: 'generating',label: '03 generating' },
    { id: 'dna',       label: '04 dna' },
    { id: 'next',      label: '05 modal' },
  ];
  return (
    <div className="scrubber" role="navigation" aria-label="onboarding screens">
      {screens.map(s => (
        <button key={s.id}
                className={s.id === current ? 'active' : ''}
                onClick={() => setCurrent(s.id)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   App — state + routing
   ───────────────────────────────────────── */
function App() {
  const [screen, setScreen] = useState('welcome');
  const [dnaTab, setDnaTab] = useState('overview');
  const [formState, setFormState] = useState({
    url: '',
    description: '',
    logoName: '',
    colors: [],
  });

  // Step index for the topbar (0..3). 'next' shows the modal over the dna screen, still step 3.
  const stepIndex = (
    screen === 'welcome'    ? 0 :
    screen === 'input'      ? 1 :
    screen === 'generating' ? 2 :
    3
  );

  // Keyboard nav: ←/→ to jump screens
  const order = ['welcome', 'input', 'generating', 'dna', 'next'];
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowRight') {
        const i = order.indexOf(screen);
        if (i < order.length - 1) setScreen(order[i + 1]);
      } else if (e.key === 'ArrowLeft') {
        const i = order.indexOf(screen);
        if (i > 0) setScreen(order[i - 1]);
      } else if (e.key === 'Escape' && screen === 'next') {
        setScreen('dna');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  return (
    <div className="app">
      <Bloom />
      <Topbar
        step={stepIndex}
        onSkip={screen === 'welcome' ? null : () => setScreen('dna')}
      />
      <main>
        {screen === 'welcome' && (
          <ScreenWelcome onNext={() => setScreen('input')} />
        )}
        {screen === 'input' && (
          <ScreenInput
            onNext={() => setScreen('generating')}
            onBack={() => setScreen('welcome')}
            state={formState}
            setState={setFormState}
          />
        )}
        {screen === 'generating' && (
          <ScreenGenerating onNext={() => setScreen('dna')} />
        )}
        {(screen === 'dna' || screen === 'next') && (
          <ScreenDna
            onNext={() => setScreen('next')}
            tab={dnaTab}
            setTab={setDnaTab}
          />
        )}
        {screen === 'next' && (
          <NextModal
            onClose={() => setScreen('dna')}
            onChoose={() => setScreen('dna')}
          />
        )}
      </main>

      <Scrubber current={screen} setCurrent={setScreen} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
