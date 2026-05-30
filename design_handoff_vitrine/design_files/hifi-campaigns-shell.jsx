/* Vitrine icons + base atoms + shell — adapted for Hi-fi Campaigns.
   Exposes everything onto window for cross-file Babel sharing. */

const { useState, useRef, useEffect } = React;

/* ─── Icons ─── */
const Icon = ({ path, size = 18, className = "", strokeWidth = 1.6, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke="currentColor" strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round"
       className={className} style={style}>
    {typeof path === "string" ? <path d={path} /> : path}
  </svg>
);

const Icons = {
  Sparkles:   (p) => <Icon {...p} path={<g><path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z"/><path d="M19 16 L19.7 18.3 L22 19 L19.7 19.7 L19 22 L18.3 19.7 L16 19 L18.3 18.3 Z"/></g>}/>,
  Bolt:       (p) => <Icon {...p} path="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/>,
  Camera:     (p) => <Icon {...p} path={<g><path d="M23 19 a2 2 0 0 1 -2 2 H3 a2 2 0 0 1 -2 -2 V8 a2 2 0 0 1 2 -2 h4 l2 -3 h6 l2 3 h4 a2 2 0 0 1 2 2 z"/><circle cx="12" cy="13" r="4"/></g>}/>,
  Video:      (p) => <Icon {...p} path={<g><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10 L22 6 V18 L16 14 Z"/></g>}/>,
  Wand:       (p) => <Icon {...p} path={<g><path d="M15 4 V2 M15 16 V14 M8 9 H10 M20 9 H22 M17.8 11.8 L19 13 M17.8 6.2 L19 5 M3 21 L12 12 M12.2 6.2 L11 5"/></g>}/>,
  Image:      (p) => <Icon {...p} path={<g><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15 L16 10 L5 21"/></g>}/>,
  Home:       (p) => <Icon {...p} path={<g><path d="M3 11 L12 3 L21 11"/><path d="M5 9 V21 H19 V9"/></g>}/>,
  Layers:     (p) => <Icon {...p} path={<g><path d="M12 2 L2 7 L12 12 L22 7 Z"/><path d="M2 12 L12 17 L22 12"/><path d="M2 17 L12 22 L22 17"/></g>}/>,
  Folder:     (p) => <Icon {...p} path="M3 7 a2 2 0 0 1 2 -2 h4 l2 2 h8 a2 2 0 0 1 2 2 v9 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 Z"/>,
  Megaphone:  (p) => <Icon {...p} path={<g><path d="M3 11 L21 4 V18 L3 13 V11 Z"/><path d="M7 13 V20 a 2 2 0 0 0 4 0 V14"/></g>}/>,
  Dna:        (p) => <Icon {...p} path={<g><path d="M4 19 c 4 -4 12 -4 16 -16 M4 19 c 2 -2 6 -2 8 0 M16 5 c -2 2 -6 2 -8 0 M4 19 H 7 M17 5 H 20"/></g>}/>,
  BookOpen:   (p) => <Icon {...p} path={<g><path d="M2 5 a 2 2 0 0 1 2 -2 H 9 a 2 2 0 0 1 2 2 V 21 a 1 1 0 0 0 -1 -1 H 2 Z"/><path d="M22 5 a 2 2 0 0 0 -2 -2 H 15 a 2 2 0 0 0 -2 2 V 21 a 1 1 0 0 1 1 -1 H 22 Z"/></g>}/>,
  Bag:        (p) => <Icon {...p} path={<g><path d="M6 7 V 5 a 6 6 0 0 1 12 0 V 7 M3 7 H 21 L 19 22 H 5 Z"/></g>}/>,
  Plus:       (p) => <Icon {...p} path="M12 5 V19 M5 12 H19"/>,
  Check:      (p) => <Icon {...p} path="M5 12 L10 17 L20 7" strokeWidth={p?.strokeWidth ?? 2}/>,
  X:          (p) => <Icon {...p} path="M6 6 L18 18 M18 6 L6 18"/>,
  ChevronDown:(p) => <Icon {...p} path="M6 9 L12 15 L18 9"/>,
  ChevronRight:(p)=> <Icon {...p} path="M9 6 L15 12 L9 18"/>,
  ChevronLeft:(p) => <Icon {...p} path="M15 6 L9 12 L15 18"/>,
  ArrowLeft:  (p) => <Icon {...p} path="M19 12 H5 M12 19 L5 12 L12 5"/>,
  Search:     (p) => <Icon {...p} path={<g><circle cx="11" cy="11" r="8"/><path d="M21 21 L16.65 16.65"/></g>}/>,
  Upload:     (p) => <Icon {...p} path={<g><path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15"/><path d="M17 8 L12 3 L7 8"/><path d="M12 3 V15"/></g>}/>,
  Download:   (p) => <Icon {...p} path={<g><path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15"/><path d="M7 10 L12 15 L17 10"/><path d="M12 15 V3"/></g>}/>,
  Share:      (p) => <Icon {...p} path={<g><path d="M4 12 V 20 a 2 2 0 0 0 2 2 H 18 a 2 2 0 0 0 2 -2 V 12"/><path d="M16 6 L 12 2 L 8 6"/><path d="M12 2 V 15"/></g>}/>,
  Globe:      (p) => <Icon {...p} path={<g><circle cx="12" cy="12" r="10"/><path d="M2 12 H22"/><path d="M12 2 a15 15 0 0 1 0 20 a15 15 0 0 1 0 -20"/></g>}/>,
  Eye:        (p) => <Icon {...p} path={<g><path d="M1 12 s4 -8 11 -8 s11 8 11 8 s-4 8 -11 8 s-11 -8 -11 -8"/><circle cx="12" cy="12" r="3"/></g>}/>,
  EyeOff:     (p) => <Icon {...p} path={<g><path d="M9.88 9.88 a 3 3 0 0 0 4.24 4.24 M10.73 5.08 A 10.43 10.43 0 0 1 12 5 c 7 0 10 7 10 7 a 13.16 13.16 0 0 1 -1.67 2.68 M6.61 6.61 A 13.526 13.526 0 0 0 2 12 s 3 7 10 7 a 9.74 9.74 0 0 0 5.39 -1.61 M2 2 L 22 22"/></g>}/>,
  Mic:        (p) => <Icon {...p} path={<g><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11 a 7 7 0 0 0 14 0"/><path d="M12 18 V 22 M8 22 H 16"/></g>}/>,
  Refresh:    (p) => <Icon {...p} path={<g><path d="M3 12 a9 9 0 0 1 15 -6.7 L21 8"/><path d="M21 3 V8 H16"/><path d="M21 12 a9 9 0 0 1 -15 6.7 L3 16"/><path d="M3 21 V16 H8"/></g>}/>,
  Trash:      (p) => <Icon {...p} path={<g><path d="M3 6 H21 M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6 M9 6 V3 h6 v3"/></g>}/>,
  MoreHorizontal:(p)=><Icon {...p} path={<g><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></g>}/>,
  Pencil:     (p) => <Icon {...p} path={<g><path d="M12 20 H 21"/><path d="M16.5 3.5 a 2.121 2.121 0 0 1 3 3 L 7 19 L 3 20 L 4 16 Z"/></g>}/>,
  Send:       (p) => <Icon {...p} path="M22 2 L11 13 M22 2 L15 22 L11 13 L2 9 Z"/>,
  Play:       (p) => <Icon {...p} path="M5 3 L19 12 L5 21 Z" fill="currentColor" strokeWidth={0}/>,
  History:    (p) => <Icon {...p} path={<g><path d="M3 12 a 9 9 0 1 0 9 -9 M3 4 V 9 H 8 M12 7 V 12 L 15 14"/></g>}/>,
  Type:       (p) => <Icon {...p} path={<g><path d="M4 7 V4 H20 V7"/><path d="M9 20 H15"/><path d="M12 4 V20"/></g>}/>,
  AlignLeft:  (p) => <Icon {...p} path={<g><path d="M3 6 H 21 M3 12 H 15 M3 18 H 18"/></g>}/>,
  AlignCenter:(p) => <Icon {...p} path={<g><path d="M3 6 H 21 M6 12 H 18 M4 18 H 20"/></g>}/>,
  Crop:       (p) => <Icon {...p} path={<g><path d="M6 2 V 18 H 22"/><path d="M2 6 H 18 V 22"/></g>}/>,
  Compare:    (p) => <Icon {...p} path={<g><path d="M12 3 V 21"/><path d="M5 7 L 9 7 L 9 17 L 5 17 Z"/><path d="M15 7 H 19 V 13 L 15 13 Z"/></g>}/>,
};

/* ─── Atoms ─── */
const Button = ({ variant = "primary", size, icon, children, onClick, disabled, className = "", style }) => (
  <button
    className={`btn btn-${variant} ${size ? `btn-${size}` : ""} ${className}`}
    onClick={onClick} disabled={disabled} style={style}>
    {icon}
    {children}
  </button>
);
const IconButton = ({ icon, onClick, className = "", ariaLabel, variant = "ghost", style }) => (
  <button className={`btn btn-${variant} btn-icon ${className}`} onClick={onClick} aria-label={ariaLabel} style={style}>
    {icon}
  </button>
);
const Chip = ({ active, onClick, children, className = "" }) => (
  <span className={`chip ${active ? "active" : ""} ${className}`} onClick={onClick}>
    {active && <Icons.Check size={12} strokeWidth={3}/>}
    {children}
  </span>
);
const Badge = ({ kind = "draft", children }) => (
  <span className={`badge ${kind}`}>
    {(kind === "live" || kind === "gen" || kind === "draft" || kind === "archived") && <span className="dot"></span>}
    {children}
  </span>
);
const Avatar = ({ initials, brand, size = 32 }) => (
  <div className={`avatar ${brand ? "brand" : ""}`}
       style={{ width: size, height: size, fontSize: size * 0.4,
                background: brand ? undefined : "rgba(0,255,157,0.15)",
                color: brand ? undefined : "var(--volt)",
                border: brand ? undefined : "1px solid rgba(0,255,157,0.35)" }}>
    {initials}
  </div>
);
const BuzzPill = ({ amount = 1240 }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "var(--buzz-soft)", border: "1px solid var(--buzz-border)",
    borderRadius: 999, padding: "5px 10px",
    fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--buzz)",
  }}>
    <img src="vitrine/buzz.svg" style={{ width: 14, height: 14 }} alt=""/>
    {amount.toLocaleString()}
  </div>
);

/* ─── Sidebar (always 'campaigns' active) ─── */
const Sidebar = ({ active = "campaigns" }) => {
  const NavItem = ({ id, icon, label, indent, isNew, k }) => (
    <div className={`sb-item ${active === id ? "active" : ""} ${indent ? "indent" : ""}`}>
      {icon && <span className="sb-icon">{icon}</span>}
      <span>{label}</span>
      {isNew ? <span className="nu">new</span> : k ? <span className="k">{k}</span> : null}
    </div>
  );
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="wordmark"><span className="wv">v</span>itrine</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                       padding: "2px 6px", border: "1px solid var(--line)",
                       borderRadius: 4, color: "var(--fg-3)", textTransform: "uppercase" }}>
          beta
        </span>
      </div>

      <NavItem id="dna" icon={<Icons.Dna size={18}/>} label="brand dna" />
      <NavItem id="overview" label="overview" indent />
      <NavItem id="catalog"  label="catalog"  indent />
      <NavItem id="assets"   label="assets"   indent />

      <div style={{ height: 12 }} />

      <NavItem id="campaigns"  icon={<Icons.Megaphone size={18}/>} label="campaigns"  k="⌘2"/>
      <NavItem id="photoshoot" icon={<Icons.Camera size={18}/>}    label="photoshoot" k="⌘3"/>
      <NavItem id="animate"    icon={<Icons.Video size={18}/>}     label="animate"    isNew/>
      <NavItem id="brandbook"  icon={<Icons.BookOpen size={18}/>}  label="brand book" isNew/>

      <div className="buzz-card">
        <span className="lbl">buzz balance</span>
        <div className="row">
          <img src="vitrine/buzz.svg" style={{ width: 20, height: 20 }} alt=""/>
          <span className="amt">1,240</span>
        </div>
        <button>top up</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 6px 2px",
                    borderTop: "1px solid var(--line-subtle)", marginTop: 8 }}>
        <Avatar initials="MA" size={28}/>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>m&a chili oil co.</span>
          <span style={{ fontSize: 10.5, color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>founder · trial</span>
        </div>
        <Icons.ChevronDown size={14} className="sb-icon" style={{ marginLeft: "auto" }}/>
      </div>
    </aside>
  );
};

/* ─── Topbar ─── */
const TopBar = ({ crumbs = [], back }) => (
  <header className="topbar">
    {back ? (
      <div className="back-btn">
        <Icons.ArrowLeft size={14}/>
        <span>{back}</span>
      </div>
    ) : (
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
    )}
    <div className="actions">
      <div className="search">
        <Icons.Search size={14}/>
        <span>search</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>⌘K</span>
      </div>
      <BuzzPill amount={1240}/>
      <IconButton variant="secondary" icon={<Icons.MoreHorizontal size={16}/>} ariaLabel="more"/>
    </div>
  </header>
);

/* ─── Shell ─── */
const Shell = ({ crumbs, back, bloom, children }) => (
  <div className="app-shell">
    <Sidebar />
    <div className="app-main">
      <TopBar crumbs={crumbs} back={back}/>
      <div className="app-content">
        {bloom && <div className="bloom-bg" />}
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  useState, useRef, useEffect,
  Icon, Icons, Button, IconButton, Chip, Badge, Avatar, BuzzPill,
  Sidebar, TopBar, Shell,
});
