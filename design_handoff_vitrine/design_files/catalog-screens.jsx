/* Vitrine catalog screens — grid, empty, add modal, detail. */

const { useState: useStateCat } = React;
const Ic = window.Icons;

/* ─────────────────────────────────────────
   Demo data
   ───────────────────────────────────────── */
const PRODUCTS = [
  { id: 'cherry',   name: 'cherry-smoked chili oil', meta: '3 photos · 4 oz jar',  status: 'live',  thumb: 'thumb-g' },
  { id: 'garlic',   name: 'garlic confit chili oil', meta: '2 photos · 4 oz jar',  status: 'live',  thumb: 'thumb-e' },
  { id: 'trio',     name: 'hot pepper trio gift box', meta: '5 photos · gift set', status: 'live',  thumb: 'thumb-d' },
  { id: 'midnight', name: "extra-spicy 'midnight'",   meta: '2 photos · seasonal', status: 'draft', thumb: 'thumb-c' },
  { id: 'sampler',  name: 'market sampler pack',     meta: '4 photos · sampler',   status: 'live',  thumb: 'thumb-f' },
  { id: 'apron',    name: 'merch · branded apron',   meta: '1 photo · merch',      status: 'live',  thumb: 'thumb-h' },
  { id: 'cap',      name: 'merch · cap',             meta: 'no photos yet',        status: 'draft', thumb: null },
  { id: 'holiday',  name: 'holiday bundle',          meta: '3 photos · gift',      status: 'live',  thumb: 'thumb-a' },
];

const STATUS_BADGE = {
  live:  { cls: 'live',  label: 'live' },
  draft: { cls: 'draft', label: 'draft' },
};

/* ─────────────────────────────────────────
   01 — Catalog grid
   ───────────────────────────────────────── */
function ScreenCatalogGrid({ onOpenAdd, onOpenDetail }) {
  const [filter, setFilter] = useStateCat('all');
  const filtered = PRODUCTS.filter(p =>
    filter === 'all' ? true : filter === 'live' ? p.status === 'live' : p.status === 'draft'
  );
  return (
    <>
      <div className="content-bloom" aria-hidden="true" />
      <PageHead
        eyebrow=" brand DNA · catalog"
        title="your products"
        sub="drop the products you sell — name, photos, description. these feed every campaign we cook."
        actions={
          <button className="btn btn-primary btn-lg" type="button" onClick={onOpenAdd}>
            <Ic.Plus size={16} />
            add product
          </button>
        }
      />

      <div className="toolbar">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>all · {PRODUCTS.length}</Chip>
        <Chip active={filter === 'live'} onClick={() => setFilter('live')}>active · 6</Chip>
        <Chip active={filter === 'draft'} dashed={filter !== 'draft'} onClick={() => setFilter('draft')}>drafts · 2</Chip>
        <span className="grow" />
        <span className="sort">
          <span style={{ color: 'var(--fg-2)' }}>sort:</span> recent <Ic.ChevronDown size={12} />
        </span>
        <span className="segmented">
          <button className="on"><Ic.Grid size={12} /> grid</button>
          <button><Ic.Layers size={12} /> list</button>
        </span>
      </div>

      <div className="cat-grid">
        {filtered.map(p => (
          <ProductCard key={p.id} product={p} onClick={() => onOpenDetail(p.id)} />
        ))}
      </div>
    </>
  );
}

function ProductCard({ product, onClick }) {
  const photoCount = (product.meta.match(/(\d+)\s+photo/) || [])[1];
  return (
    <article
      className={`product-card ${product.status === 'draft' ? 'draft' : ''}`}
      onClick={onClick}
      role="button" tabIndex={0}
    >
      <div className={`image ${product.thumb || 'thumb-empty'}`}>
        <div className="badges">
          <span className={`badge ${STATUS_BADGE[product.status].cls}`}>
            <span className="dot" />
            {STATUS_BADGE[product.status].label}
          </span>
        </div>
        <button className="menu" type="button" onClick={e => { e.stopPropagation(); }} aria-label="more">
          <Ic.MoreHorizontal size={14} />
        </button>
        {photoCount && (
          <span className="photo-count">
            <Ic.Image size={11} />
            {photoCount}
          </span>
        )}
        {!photoCount && product.status === 'draft' && (
          <span className="photo-count" style={{ background: 'rgba(10,10,15,0.65)' }}>
            <Ic.Upload size={11} />
            add a photo
          </span>
        )}
      </div>
      <div className="meta">
        <span className="name">{product.name}</span>
        <span className="sub">{product.meta}</span>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────
   02 — Catalog empty
   ───────────────────────────────────────── */
function ScreenCatalogEmpty({ onOpenAdd, onJumpAssets }) {
  return (
    <>
      <div className="content-bloom" aria-hidden="true" />
      <PageHead
        eyebrow=" brand DNA · catalog"
        title="your products"
        sub="we don't have any yet — let's add the first."
      />

      <div className="empty-state" style={{ marginTop: 12 }}>
        <span className="glyph" aria-hidden="true">
          <Ic.Layers size={28} />
        </span>
        <h2>
          add your first <span className="gradient-volt">product</span>.
        </h2>
        <p className="lede">
          pick one: pull from a URL (Shopify, Square, your own site), or upload photos by hand.
        </p>

        <div className="choice-pair">
          <button className="choice" type="button" onClick={onOpenAdd}>
            <span className="ico"><Ic.Globe size={16} /></span>
            <h4>add from URL</h4>
            <p>paste a product page — we'll scrape title, photos, description.</p>
            <span className="arrow">paste a URL →</span>
          </button>
          <button className="choice featured" type="button" onClick={onOpenAdd}>
            <span className="ico"><Ic.Plus size={16} /></span>
            <h4>add from scratch</h4>
            <p>upload photos, name, description by hand. most control.</p>
            <span className="arrow">start blank →</span>
          </button>
        </div>

        <p className="fallback-link" style={{ marginTop: 6 }}>
          or skip for now — <button type="button" onClick={onJumpAssets}>upload to assets instead →</button>
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   03 — Add product modal (URL / scratch tabs)
   ───────────────────────────────────────── */
function ModalAddProduct({ onClose }) {
  const [mode, setMode] = useStateCat('scratch'); // 'url' | 'scratch'

  return (
    <Modal
      eyebrow=" new catalog item"
      title="add a product"
      subtitle="we'll use this to cook campaigns + shoots."
      onClose={onClose}
      foot={
        <>
          <button className="btn btn-ghost" type="button">save as draft</button>
          <div className="btn-set">
            <button className="btn btn-secondary" type="button" onClick={onClose}>cancel</button>
            <button className="btn btn-primary" type="button" onClick={onClose}>
              {mode === 'url' ? 'import →' : 'create product'}
            </button>
          </div>
        </>
      }
    >
      <div className="mode-tabs" role="tablist">
        <button
          type="button" role="tab"
          className={`mode-tab ${mode === 'url' ? 'active' : ''}`}
          onClick={() => setMode('url')}
        >
          <span className="ico"><Ic.Globe size={14} /></span>
          <span>
            <div className="label">from URL</div>
            <div className="sub">paste a product page</div>
          </span>
        </button>
        <button
          type="button" role="tab"
          className={`mode-tab ${mode === 'scratch' ? 'active' : ''}`}
          onClick={() => setMode('scratch')}
        >
          <span className="ico"><Ic.Plus size={14} /></span>
          <span>
            <div className="label">from scratch</div>
            <div className="sub">upload photos manually</div>
          </span>
        </button>
      </div>

      {mode === 'url' ? <UrlMode /> : <ScratchMode />}
    </Modal>
  );
}

function UrlMode() {
  return (
    <>
      <div className="field">
        <label className="field-label">product URL</label>
        <div className="input-prefix">
          <span className="pfx"><Ic.Globe size={15} /></span>
          <input type="url" placeholder="your-shop.co/products/chili-oil" />
        </div>
        <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          works with Shopify, Square, Etsy, plain HTML product pages, and most ecommerce platforms.
        </span>
      </div>

      <div className="autofill">
        <div className="head">we'll auto-fill</div>
        <div className="preview-thumbs">
          <div className="t" /><div className="t" /><div className="t" /><div className="t" />
        </div>
        <ul>
          <li><span className="chk"><Ic.Check size={9} strokeWidth={3.5} /></span> product name</li>
          <li><span className="chk"><Ic.Check size={9} strokeWidth={3.5} /></span> description</li>
          <li><span className="chk"><Ic.Check size={9} strokeWidth={3.5} /></span> up to 8 photos</li>
          <li><span className="chk"><Ic.Check size={9} strokeWidth={3.5} /></span> price + size tags (if listed)</li>
        </ul>
        <div className="footnote">you can edit everything after the import.</div>
      </div>
    </>
  );
}

function ScratchMode() {
  return (
    <>
      <div>
        <label className="field-label">photos</label>
        <div className="photo-grid">
          <div className="photo-cell dropzone cover">
            <Ic.Upload size={22} />
            <div className="title">drop photos</div>
            <div className="sub">or click to choose</div>
          </div>
          <div className="photo-cell thumb-a">
            <span className="cover-tag">cover</span>
          </div>
          <div className="photo-cell thumb-b" />
          <div className="photo-cell empty"><Ic.Plus size={14} /></div>
          <div className="photo-cell empty"><Ic.Plus size={14} /></div>
        </div>
        <span className="muted" style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>
          upload up to 8. first one becomes the cover.
        </span>
      </div>

      <div className="field">
        <label className="field-label">name</label>
        <input className="input" placeholder="e.g. cherry-smoked chili oil" />
      </div>

      <div className="field">
        <label className="field-label">description</label>
        <textarea
          className="textarea"
          rows="3"
          placeholder="what is it? what's the size, the heat level, the price? campaigns get sharper with detail."
        />
      </div>

      <div className="field-tags">
        <span className="label">tags</span>
        <Chip>condiment</Chip>
        <Chip>limited</Chip>
        <Chip className="add"><Ic.Plus size={11} /> add tag</Chip>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   04 — Product detail
   ───────────────────────────────────────── */
function ScreenCatalogDetail({ onBack }) {
  const [activeImg, setActiveImg] = useStateCat(0);
  const photos = ['thumb-g', 'thumb-e', 'thumb-a'];
  return (
    <>
      <div className="content-bloom" aria-hidden="true" />

      <div className="detail-head">
        <button className="back" type="button" onClick={onBack}>
          <Ic.ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
          catalog
        </button>
        <span className="badge live"><span className="dot" /> live</span>
        <div className="actions">
          <button className="btn btn-secondary" type="button">
            <Ic.Camera size={14} />
            start photoshoot
          </button>
          <button className="btn-volt-tonal" type="button">
            <Ic.Sparkles size={14} />
            cook a campaign
          </button>
          <button className="btn btn-icon btn-secondary" type="button" aria-label="more">
            <Ic.MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="detail-grid">
        {/* LEFT — gallery */}
        <div className="gallery">
          <div className={`hero ${photos[activeImg]}`}>
            <div className="ctrl">
              <button type="button" aria-label="edit photo"><Ic.Wand size={14} /></button>
              <button type="button" aria-label="delete photo"><Ic.Trash size={14} /></button>
            </div>
            <span className="pos">{activeImg + 1} / {photos.length} {activeImg === 0 ? '· cover' : ''}</span>
          </div>
          <div className="strip">
            {photos.map((t, i) => (
              <div
                key={i}
                className={`cell ${t} ${i === activeImg ? 'selected' : ''}`}
                onClick={() => setActiveImg(i)}
                role="button" tabIndex={0}
              />
            ))}
            <div className="cell add" role="button" tabIndex={0}>
              <Ic.Plus size={16} />
            </div>
            <div className="cell upload" role="button" tabIndex={0}>
              <Ic.Upload size={14} />
            </div>
          </div>
        </div>

        {/* RIGHT — info cards */}
        <div className="detail-side">
          <div className="info-card">
            <div className="head">
              <Eyebrow>product name</Eyebrow>
              <button className="pen" type="button" aria-label="edit name"><Ic.Wand size={13} /></button>
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 24, letterSpacing: '-0.025em', color: 'var(--fg-0)',
              fontVariationSettings: '"opsz" 24',
            }}>cherry-smoked chili oil</div>
          </div>

          <div className="info-card">
            <div className="head">
              <Eyebrow>description</Eyebrow>
              <button className="pen" type="button" aria-label="edit description"><Ic.Wand size={13} /></button>
            </div>
            <div className="value">
              a slow-smoked blend of texas hill country cherrywood + arbol chiles. 4 oz jar. medium-hot. pairs with fried eggs, pizza, basically everything.
            </div>
          </div>

          <div className="info-card">
            <div className="head"><Eyebrow>details</Eyebrow></div>
            <div className="kv"><span className="k">size</span><span className="v">4 oz · 118 ml</span></div>
            <div className="kv"><span className="k">price</span><span className="v">$14</span></div>
            <div className="kv"><span className="k">heat</span><span className="v">medium-hot</span></div>
            <div className="kv"><span className="k">added</span><span className="v">3 days ago</span></div>
          </div>

          <div className="info-card">
            <div className="head"><Eyebrow>tags</Eyebrow></div>
            <div className="field-tags" style={{ marginTop: -2 }}>
              <Chip>condiment</Chip>
              <Chip>flagship</Chip>
              <Chip>texas-made</Chip>
              <Chip className="add"><Ic.Plus size={11} /> add</Chip>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  ScreenCatalogGrid, ScreenCatalogEmpty, ModalAddProduct, ScreenCatalogDetail,
  PRODUCTS,
});
