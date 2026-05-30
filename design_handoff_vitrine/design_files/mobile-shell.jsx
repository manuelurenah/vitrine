/* Mobile shell — shared atoms + mobile-specific chrome.
   Builds on Icons/Atoms from hifi-campaigns-shell.jsx (window-scoped).
   Exposes mobile primitives on window. */

/* ─── ScreenFrame ───
   The visual container for a single 390-wide mobile screen.
   Owns scroll, dark bg, optional bloom, and the safe bottom-tab spacer. */
const ScreenFrame = ({ children, bloom = false, tabBar = true, activeTab = "campaigns", stickyCTA, style }) => (
  <div className="m-screen" style={style}>
    {bloom && <div className="m-bloom" />}
    <div className="m-screen-content" style={{ paddingBottom: (stickyCTA ? 76 : 0) + (tabBar ? 76 : 0) }}>
      {children}
    </div>
    {stickyCTA && (
      <div className="m-sticky-cta" style={{ bottom: tabBar ? 76 : 16 }}>
        {stickyCTA}
      </div>
    )}
    {tabBar && <MobileTabBar active={activeTab} />}
  </div>
);

/* ─── TopBar ─── */
const MobileTopBar = ({ title, back, eyebrow, action, leadingLogo, transparent }) => (
  <header className="m-topbar" style={{ borderBottom: transparent ? "0" : "1px solid var(--line-subtle)",
                                          background: transparent ? "transparent" : "rgba(10,10,15,0.92)" }}>
    {back ? (
      <button className="m-back" aria-label="back">
        <Icons.ArrowLeft size={16}/>
      </button>
    ) : leadingLogo ? (
      <span className="m-wordmark">
        <span className="wv">v</span>itrine
      </span>
    ) : <span style={{ width: 36 }}/>}

    <div className="m-topbar-title">
      {eyebrow && <span className="m-eyebrow-sm">{eyebrow}</span>}
      {title && <span className="m-title">{title}</span>}
    </div>

    <div className="m-topbar-action">
      {action || <span style={{ width: 36 }}/>}
    </div>
  </header>
);

/* ─── Bottom tab bar ─── */
const TAB_ITEMS = [
  { id: "campaigns",  label: "campaigns",  icon: <Icons.Megaphone size={20}/> },
  { id: "photoshoot", label: "shoot",      icon: <Icons.Camera size={20}/>    },
  { id: "animate",    label: "animate",    icon: <Icons.Video size={20}/>     },
  { id: "brand",      label: "brand",      icon: <Icons.Dna size={20}/>       },
];

const MobileTabBar = ({ active = "campaigns" }) => (
  <nav className="m-tabbar" aria-label="primary">
    {TAB_ITEMS.map(t => (
      <div key={t.id} className={`m-tab ${active === t.id ? "active" : ""}`}>
        <span className="m-tab-icon">{t.icon}</span>
        <span className="m-tab-label">{t.label}</span>
      </div>
    ))}
    {/* faux home indicator */}
    <span className="m-home-indicator" aria-hidden="true"/>
  </nav>
);

/* ─── Mobile BuzzPill (compact) ─── */
const MobileBuzzPill = ({ amount = 1240, compact = true }) => (
  <div className="m-buzz" style={{ padding: compact ? "4px 8px" : "5px 10px" }}>
    <img src="vitrine/buzz.svg" style={{ width: compact ? 12 : 14, height: compact ? 12 : 14 }} alt=""/>
    <span>{amount.toLocaleString()}</span>
  </div>
);

/* ─── BottomSheet ─── */
const BottomSheet = ({ title, eyebrow, onClose, children, height = "78%" }) => (
  <div className="m-sheet-wrap">
    <div className="m-sheet-scrim" />
    <div className="m-sheet" style={{ maxHeight: height }}>
      <div className="m-sheet-handle"/>
      <div className="m-sheet-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && <span className="m-eyebrow-sm">{eyebrow}</span>}
          {title && <div className="m-sheet-title">{title}</div>}
        </div>
        <button className="m-icon-btn" aria-label="close">
          <Icons.X size={14}/>
        </button>
      </div>
      <div className="m-sheet-body">{children}</div>
    </div>
  </div>
);

/* ─── FAB ─── */
const FAB = ({ icon, label, style }) => (
  <button className="m-fab" style={style}>
    <span className="m-fab-icon">{icon}</span>
    {label && <span className="m-fab-label">{label}</span>}
  </button>
);

/* ─── Section head ─── */
const MobileSectionHead = ({ icon, title, count, action }) => (
  <div className="m-section-head">
    {icon && <span className="m-section-icon">{icon}</span>}
    <span className="m-section-title">{title}</span>
    {count && <span className="m-section-count">{count}</span>}
    {action && <span className="m-section-action">{action}</span>}
  </div>
);

/* ─── ProductShot — bottle silhouette over thumb (mobile size) ─── */
function MobileProductShot({ thumb = "thumb-a", style }) {
  return (
    <div className={`thumb ${thumb}`}
         style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet"
           style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.85 }}>
        <defs>
          <linearGradient id="mbottleHL" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.35)"/>
            <stop offset="0.5" stopColor="rgba(255,255,255,0.05)"/>
            <stop offset="1" stopColor="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="118" rx="22" ry="3.5" fill="rgba(0,0,0,0.35)"/>
        <path d="M 42 30 V 18 H 58 V 30 C 58 30 64 36 64 48 V 104 C 64 110 60 114 54 114 H 46 C 40 114 36 110 36 104 V 48 C 36 36 42 30 42 30 Z"
              fill="rgba(20,12,8,0.65)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"/>
        <path d="M 42 30 V 18 H 58 V 30 C 58 30 64 36 64 48 V 104 C 64 110 60 114 54 114 H 46 C 40 114 36 110 36 104 V 48 C 36 36 42 30 42 30 Z"
              fill="url(#mbottleHL)"/>
        <rect x="40" y="58" width="20" height="22" fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"/>
        <rect x="44" y="62" width="12" height="2" fill="rgba(255,255,255,0.4)"/>
        <rect x="42" y="68" width="16" height="1" fill="rgba(255,255,255,0.2)"/>
      </svg>
    </div>
  );
}

Object.assign(window, {
  ScreenFrame, MobileTopBar, MobileTabBar, MobileBuzzPill,
  BottomSheet, FAB, MobileSectionHead, MobileProductShot,
});
