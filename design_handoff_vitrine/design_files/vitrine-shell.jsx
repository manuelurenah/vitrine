/* Vitrine catalog & assets — shared shell + utilities. */

const { useState, useEffect, useRef, useMemo } = React;
const I = window.Icons;

/* ─────────────────────────────────────────
   Sidebar — Brand DNA group is parent of overview/catalog/assets
   ───────────────────────────────────────── */
function Sidebar({ active, onNav }) {
  const NavItem = ({ id, icon, label, indent, isNew, k }) => {
    const isActive = id === active;
    return (
      <button
        type="button"
        className={`sb-item ${isActive ? 'active' : ''}`}
        onClick={() => onNav(id)}
        style={indent ? { marginLeft: 24, paddingLeft: 8 } : null}
      >
        {icon && <span className="sb-icon">{icon}</span>}
        <span>{label}</span>
        {isNew && <span className="nu">new</span>}
        {k && !isNew && <span className="k">{k}</span>}
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="wordmark"><span className="wv">v</span>itrine</span>
      </div>

      <div className="sb-section">brand DNA</div>
      <NavItem id="overview" icon={<I.Palette size={16} />} label="overview" indent />
      <NavItem id="catalog"  icon={<I.Layers  size={16} />} label="catalog"  indent />
      <NavItem id="assets"   icon={<I.Folder  size={16} />} label="assets"   indent />

      <div className="sb-section">cook</div>
      <NavItem id="campaigns"  icon={<I.Layers size={16} />} label="campaigns"  k="⌘2" />
      <NavItem id="photoshoot" icon={<I.Camera size={16} />} label="photoshoot" k="⌘3" />
      <NavItem id="brand-book" icon={<I.Type   size={16} />} label="brand book" isNew />

      <div style={{ flex: 1 }} />

      <div className="buzz-card">
        <span className="lbl">buzz balance</span>
        <div className="row">
          <img src="assets/buzz.svg" style={{ width: 22, height: 22 }} alt="" />
          <span className="amt">1,240</span>
        </div>
        <button type="button">top up</button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 6px 4px',
        borderTop: '1px solid var(--line-subtle)', marginTop: 8,
      }}>
        <div className="avatar" style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg, var(--volt), var(--ion) 50%, var(--ultraviolet))',
          color: 'var(--fg-on-volt)',
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11,
          borderRadius: 999, display: 'grid', placeItems: 'center',
        }}>L</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg-0)' }}>Lumen &amp; Co.</span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>founder · trial</span>
        </div>
        <I.ChevronDown size={14} className="sb-icon" />
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────
   Topbar — crumbs + search + buzz pill + avatar
   ───────────────────────────────────────── */
function TopBar({ crumbs = [], rightSlot }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="actions">
        <div className="search">
          <I.Search size={13} />
          <span>search catalog, assets…</span>
          <span style={{
            marginLeft: 'auto', fontFamily: 'var(--font-mono)',
            fontSize: 10, color: 'var(--fg-3)',
          }}>⌘K</span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--buzz-soft)', border: '1px solid var(--buzz-border)',
          borderRadius: 999, padding: '5px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--buzz)',
        }}>
          <img src="assets/buzz.svg" style={{ width: 14, height: 14 }} alt="" />
          1,240
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────
   Shared bits — eyebrow, page-head
   ───────────────────────────────────────── */
function Eyebrow({ children }) {
  return <span className="eyebrow"><span className="slash">//</span>{children}</span>;
}

function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head">
      <div className="left">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────
   Modal scaffolding
   ───────────────────────────────────────── */
function Modal({ title, subtitle, eyebrow, onClose, children, foot, maxWidth }) {
  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={e => e.stopPropagation()} style={maxWidth ? { maxWidth } : null}>
        <div className="modal-head">
          <div>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h3 style={{ marginTop: eyebrow ? 4 : 0 }}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onClose && (
            <button className="modal-close" type="button" onClick={onClose} aria-label="close">
              <I.X size={14} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Chips
   ───────────────────────────────────────── */
function Chip({ children, active, dashed, onClick, className = '', ...rest }) {
  return (
    <span
      className={`chip ${active ? 'active' : ''} ${dashed ? 'dashed' : ''} ${className}`}
      onClick={onClick}
      {...rest}
    >
      {active && <I.Check size={12} strokeWidth={3} />}
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────
   Scrubber (dev nav between screens)
   ───────────────────────────────────────── */
function Scrubber({ screens, current, setCurrent }) {
  return (
    <nav className="scrubber" aria-label="screens">
      {screens.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && i % 4 === 0 && <span className="sep" />}
          <button
            type="button"
            className={s.id === current ? 'active' : ''}
            onClick={() => setCurrent(s.id)}
          >{s.short}</button>
        </React.Fragment>
      ))}
    </nav>
  );
}

Object.assign(window, {
  Sidebar, TopBar, Eyebrow, PageHead, Modal, Chip, Scrubber,
});
