/* Vitrine assets screens — gallery, empty, add modal, lightbox. */

const { useState: useStateAs, useEffect: useEffectAs } = React;
const Ia = window.Icons;

/* ─────────────────────────────────────────
   Demo data — assets, grouped by collection
   ───────────────────────────────────────── */
const ASSETS = {
  logos: [
    { id: 'l1', name: 'lumen-primary',  type: 'logo',     fmt: 'svg', kind: 'gradient' },
    { id: 'l2', name: 'lumen-mono',     type: 'logo',     fmt: 'svg', kind: 'outline'  },
    { id: 'l3', name: 'lumen-mark',     type: 'logo',     fmt: 'svg', kind: 'volt'     },
    { id: 'l4', name: 'lumen-stamp',    type: 'logo',     fmt: 'png', kind: 'outline'  },
  ],
  partners: [
    { id: 'p1', name: 'fieldhouse',     type: 'partner',  partner: 'fieldhouse' },
    { id: 'p2', name: 'rancho-verde',   type: 'partner',  partner: 'rancho · verde' },
    { id: 'p3', name: 'austin-co-op',   type: 'partner',  partner: 'austin co-op' },
    { id: 'p4', name: 'pico-creamery',  type: 'partner',  partner: 'pico creamery' },
    { id: 'p5', name: 'kindling',       type: 'partner',  partner: 'kindling' },
    { id: 'p6', name: 'hilltop-mills',  type: 'partner',  partner: 'hilltop mills' },
  ],
  campaigns: [
    { id: 'c1', name: 'autumn-2025',    type: 'campaign', thumb: 'thumb-d' },
    { id: 'c2', name: 'market-launch',  type: 'campaign', thumb: 'thumb-c' },
    { id: 'c3', name: 'holiday-bundle', type: 'campaign', thumb: 'thumb-e' },
    { id: 'c4', name: 'midnight-drop',  type: 'campaign', thumb: 'thumb-f' },
    { id: 'c5', name: 'farmers-market', type: 'campaign', thumb: 'thumb-a' },
    { id: 'c6', name: 'reel-001',       type: 'campaign', thumb: 'thumb-b' },
  ],
};

const COLLECTIONS = [
  { id: 'logos',     label: 'logos',          icon: <Ia.Type   size={16} />, sub: 'your marks · partner marks' },
  { id: 'partners',  label: 'partners',       icon: <Ia.Folder size={16} />, sub: 'collaborator branding' },
  { id: 'campaigns', label: 'past campaigns', icon: <Ia.Image  size={16} />, sub: 'previous shoots, posts, ads' },
  { id: 'refs',      label: 'references',     icon: <Ia.Eye    size={16} />, sub: 'mood + visual direction' },
];

/* ─────────────────────────────────────────
   05 — Assets gallery (sectioned)
   ───────────────────────────────────────── */
function ScreenAssetsGallery({ onOpenAdd, onOpenAsset }) {
  const [filter, setFilter] = useStateAs('all');
  const sections = filter === 'all'
    ? [
        { key: 'logos',     title: 'logos',          icon: <Ia.Type size={16} />,   items: ASSETS.logos },
        { key: 'partners',  title: 'partners',       icon: <Ia.Folder size={16} />, items: ASSETS.partners },
        { key: 'campaigns', title: 'past campaigns', icon: <Ia.Image size={16} />,  items: ASSETS.campaigns },
      ]
    : [{
        key: filter,
        title: filter === 'campaigns' ? 'past campaigns' : filter,
        icon: filter === 'logos' ? <Ia.Type size={16} />
            : filter === 'partners' ? <Ia.Folder size={16} />
            : <Ia.Image size={16} />,
        items: ASSETS[filter] || [],
      }];
  const total = ASSETS.logos.length + ASSETS.partners.length + ASSETS.campaigns.length;

  return (
    <>
      <div className="content-bloom" aria-hidden="true" />
      <PageHead
        eyebrow=" brand DNA · assets"
        title="your asset library"
        sub="logos, past campaigns, partner marks, references — anything that isn't a product. campaigns + shoots can pull from here too."
        actions={
          <button className="btn btn-primary btn-lg" type="button" onClick={onOpenAdd}>
            <Ia.Upload size={16} />
            upload
          </button>
        }
      />

      <div className="toolbar">
        <Chip active={filter === 'all'}      onClick={() => setFilter('all')}>all · {total}</Chip>
        <Chip active={filter === 'logos'}    onClick={() => setFilter('logos')}    dashed={filter !== 'logos'}>logos · {ASSETS.logos.length}</Chip>
        <Chip active={filter === 'partners'} onClick={() => setFilter('partners')} dashed={filter !== 'partners'}>partners · {ASSETS.partners.length}</Chip>
        <Chip active={filter === 'campaigns'} onClick={() => setFilter('campaigns')} dashed={filter !== 'campaigns'}>past campaigns · {ASSETS.campaigns.length}</Chip>
        <Chip dashed onClick={() => {}}>references · 12</Chip>
        <span className="grow" />
        <span className="segmented">
          <button className="on"><Ia.Grid size={12} /> grid</button>
          <button><Ia.Layers size={12} /> list</button>
        </span>
      </div>

      <div className="asset-sections">
        {sections.map(s => (
          <section key={s.key} className="asset-section">
            <div className="sec-head">
              <h3>{s.icon}{s.title}</h3>
              <span className="count">· {s.items.length}</span>
              <button className="more" type="button">view all <Ia.ChevronRight size={12} /></button>
            </div>
            <div className="asset-grid">
              {s.items.map(item => (
                <AssetTile key={item.id} item={item} onClick={() => onOpenAsset(item)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function AssetTile({ item, onClick }) {
  // Render different content based on type
  let content;
  if (item.type === 'logo') {
    const cls = `asset-logo`;
    const markCls = item.kind === 'gradient' ? 'gradient' : item.kind === 'outline' ? 'outline' : item.kind === 'volt' ? 'volt' : '';
    content = (
      <div className={cls}>
        <span className={`mark ${markCls}`}>L</span>
      </div>
    );
  } else if (item.type === 'partner') {
    content = (
      <div className="asset-partner">
        <span className="partner-name">{item.partner}</span>
      </div>
    );
  } else {
    content = <div className={item.thumb || 'thumb-empty'} style={{ position: 'absolute', inset: 0 }} />;
  }

  return (
    <button className="asset-tile" type="button" onClick={onClick} aria-label={item.name}>
      {content}
      <button className="menu" type="button" onClick={e => e.stopPropagation()} aria-label="more">
        <Ia.MoreHorizontal size={12} />
      </button>
      <div className="label">
        <span className="name">{item.name}</span>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────
   06 — Assets empty
   ───────────────────────────────────────── */
function ScreenAssetsEmpty({ onOpenAdd, onJumpCatalog }) {
  return (
    <>
      <div className="content-bloom" aria-hidden="true" />
      <PageHead
        eyebrow=" brand DNA · assets"
        title="your asset library"
        sub="logos, past campaigns, partner marks, references — anything that isn't a product. campaigns + shoots can pull from here."
      />

      <div className="empty-state">
        <span className="glyph" aria-hidden="true">
          <Ia.Folder size={28} />
        </span>
        <h2>
          upload your first <span className="gradient-volt">asset</span>.
        </h2>
        <p className="lede">
          drop a file, or pick a collection to start. assets are loose — name + tags are all we need.
        </p>

        <div className="dropzone-big" onClick={onOpenAdd}>
          <span className="ico"><Ia.Upload size={26} /></span>
          <h3>drop files here</h3>
          <span className="sub">svg · png · jpg · pdf · mp4 — up to 20 mb each</span>
          <button className="btn btn-primary" type="button" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); onOpenAdd(); }}>
            <Ia.Upload size={14} />
            choose files
          </button>
        </div>

        <div className="or-row">
          <span className="line" />
          <span className="label">or pick a collection</span>
          <span className="line" />
        </div>

        <div className="collection-grid">
          {COLLECTIONS.map(c => (
            <button key={c.id} className="collection-tile" type="button" onClick={onOpenAdd}>
              <span className="ico">{c.icon}</span>
              <span className="name">{c.label}</span>
              <span className="sub">{c.sub}</span>
            </button>
          ))}
        </div>

        <p className="fallback-link">
          or jump to — <button type="button" onClick={onJumpCatalog}>add a product instead →</button>
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   07 — Add asset modal (bulk upload)
   ───────────────────────────────────────── */
function ModalAddAsset({ onClose }) {
  return (
    <Modal
      eyebrow=" upload to library"
      title="add assets"
      subtitle="drop multiple files at once — we'll handle the rest."
      onClose={onClose}
      foot={
        <>
          <span className="muted" style={{ fontSize: 13 }}>1 of 2 uploaded</span>
          <div className="btn-set">
            <button className="btn btn-secondary" type="button" onClick={onClose}>cancel</button>
            <button className="btn btn-primary" type="button" onClick={onClose}>add to library</button>
          </div>
        </>
      }
    >
      {/* dropzone */}
      <div className="dropzone-big" style={{ padding: '16px 18px', maxWidth: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <span className="ico" style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(0,255,157,0.18)', border: '1px solid var(--line-volt)',
            display: 'grid', placeItems: 'center', flex: '0 0 auto',
          }}>
            <Ia.Upload size={18} />
          </span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h3 style={{ margin: 0 }}>drop files here, or click to choose</h3>
            <span className="sub">svg · png · jpg · pdf · mp4 — up to 20 mb each</span>
          </div>
          <button className="btn btn-secondary" type="button">browse</button>
        </div>
      </div>

      {/* staged file list */}
      <div className="field">
        <label className="field-label">2 files staged</label>
        <div className="staged-list">
          <StagedFile
            name="lumen-primary-mark.svg"
            meta="svg · 12 kb · ready"
            done
            icon={<Ia.Type size={15} />}
          />
          <StagedFile
            name="autumn-2025-hero.mp4"
            meta="mp4 · 8.4 mb · uploading"
            progress={62}
            icon={<Ia.Video size={15} />}
          />
        </div>
      </div>

      {/* applied to all */}
      <div className="applied-all">
        <Eyebrow>applied to all 2 files</Eyebrow>
        <div className="row-grid">
          <div>
            <div className="label">collection</div>
            <div className="select">
              logos
              <Ia.ChevronDown size={14} className="chev" />
            </div>
          </div>
          <div>
            <div className="label">tags</div>
            <div className="field-tags" style={{ marginTop: 0 }}>
              <Chip>primary</Chip>
              <Chip>dark</Chip>
              <Chip className="add"><Ia.Plus size={11} /> add</Chip>
            </div>
          </div>
        </div>
        <div>
          <div className="label">description <span style={{ color: 'var(--fg-3)' }}>· optional</span></div>
          <textarea
            className="textarea"
            rows="2"
            placeholder='e.g. "primary mark on dark — use on packaging + collateral."'
          />
        </div>
      </div>
    </Modal>
  );
}

function StagedFile({ name, meta, progress, done, icon }) {
  return (
    <div className="staged">
      <div className="thumb-sm">{icon}</div>
      <div className="body">
        <div className="name">{name}</div>
        <div className="meta">{meta}</div>
        {progress != null && (
          <div className="progress"><div className="bar" style={{ width: `${progress}%` }} /></div>
        )}
      </div>
      {done ? (
        <span className="status done"><Ia.Check size={11} strokeWidth={3} /></span>
      ) : (
        <button className="status remove" type="button" aria-label="remove"><Ia.X size={11} /></button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   08 — Asset lightbox detail
   ───────────────────────────────────────── */
function AssetLightbox({ item, onClose }) {
  const [idx, setIdx] = useStateAs(0);
  // a few neighbor thumbs for the strip
  const strip = [
    { kind: 'gradient' },
    { kind: 'outline' },
    { kind: 'volt',    selected: true },
    { kind: 'gradient' },
    { kind: 'outline' },
  ];
  useEffectAs(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(strip.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="lightbox-top">
        <div className="crumbs">
          <span>assets</span><span style={{ color: 'var(--fg-3)' }}>/</span>
          <span>logos</span><span style={{ color: 'var(--fg-3)' }}>/</span>
          <span className="here">{(item && item.name) || 'lumen-primary'}.svg</span>
        </div>
        <div className="actions">
          <button type="button" aria-label="edit"><Ia.Wand size={15} /></button>
          <button type="button" aria-label="download"><Ia.Download size={15} /></button>
          <button type="button" className="danger" aria-label="delete"><Ia.Trash size={15} /></button>
          <button type="button" onClick={onClose} aria-label="close"><Ia.X size={15} /></button>
        </div>
      </div>

      <div className="lightbox-main">
        <div className="lightbox-view">
          <button className="nav prev" type="button" onClick={() => setIdx(i => Math.max(0, i - 1))} aria-label="previous">
            <Ia.ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div className="frame">
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 120, letterSpacing: '-0.05em',
              color: 'var(--volt)',
              textShadow: '0 0 60px var(--volt-glow)',
              fontVariationSettings: '"opsz" 48',
            }}>L</span>
          </div>
          <button className="nav next" type="button" onClick={() => setIdx(i => Math.min(strip.length - 1, i + 1))} aria-label="next">
            <Ia.ChevronRight size={18} />
          </button>
        </div>

        <aside className="lightbox-side">
          <Eyebrow>asset</Eyebrow>
          <h3>{(item && item.name) || 'lumen-primary'}.svg</h3>

          <div className="kv-list">
            <div className="kv"><span className="k">type</span><span className="v">logo · primary</span></div>
            <div className="kv"><span className="k">collection</span><span className="v">logos</span></div>
            <div className="kv"><span className="k">format</span><span className="v">svg · 12 kb</span></div>
            <div className="kv"><span className="k">uploaded</span><span className="v">3 days ago</span></div>
            <div className="kv"><span className="k">used in</span><span className="v">4 campaigns</span></div>
          </div>

          <div>
            <Eyebrow>description</Eyebrow>
            <p className="desc" style={{ marginTop: 6 }}>
              our primary mark. dark-on-light. use on packaging + collateral.
            </p>
          </div>

          <div>
            <Eyebrow>tags</Eyebrow>
            <div className="field-tags" style={{ marginTop: 6 }}>
              <Chip>logo</Chip>
              <Chip>primary</Chip>
              <Chip>dark</Chip>
              <Chip className="add"><Ia.Plus size={11} /> add</Chip>
            </div>
          </div>

          <div className="cta-row">
            <button className="btn btn-primary" type="button">
              <Ia.Sparkles size={14} />
              use in a campaign
            </button>
            <button className="btn btn-secondary" type="button">
              <Ia.Download size={14} />
              download
            </button>
          </div>
        </aside>
      </div>

      <div className="lightbox-strip">
        {strip.map((s, i) => (
          <button
            key={i}
            className={`thumb-cell ${i === idx ? 'selected' : ''}`}
            onClick={() => setIdx(i)}
            type="button"
            aria-label={`asset ${i + 1}`}
          >
            <div className="asset-logo" style={{ width: '100%', height: '100%' }}>
              <span className={`mark ${s.kind}`} style={{ fontSize: 18 }}>L</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenAssetsGallery, ScreenAssetsEmpty, ModalAddAsset, AssetLightbox,
  ASSETS, COLLECTIONS,
});
