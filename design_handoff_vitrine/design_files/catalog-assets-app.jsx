/* Vitrine catalog & assets — top-level app + routing.
   Screens are loaded from catalog-screens.jsx and assets-screens.jsx. */

const { useState: useStateApp, useEffect: useEffectApp } = React;

const SCREENS = [
  { id: 'cat-grid',     short: '01 catalog · grid',    section: 'catalog' },
  { id: 'cat-empty',    short: '02 catalog · empty',   section: 'catalog' },
  { id: 'cat-add',      short: '03 catalog · add',     section: 'catalog' },
  { id: 'cat-detail',   short: '04 catalog · detail',  section: 'catalog' },
  { id: 'assets-grid',  short: '05 assets · grid',     section: 'assets'  },
  { id: 'assets-empty', short: '06 assets · empty',    section: 'assets'  },
  { id: 'assets-add',   short: '07 assets · add',      section: 'assets'  },
  { id: 'asset-detail', short: '08 assets · lightbox', section: 'assets'  },
];

function App() {
  // Allow ?s=cat-grid in the URL so we can deep-link a screen.
  const initial = (() => {
    const m = new URLSearchParams(window.location.search).get('s');
    return SCREENS.find(s => s.id === m)?.id || 'cat-grid';
  })();
  const [screen, setScreen] = useStateApp(initial);

  // keep URL in sync without reload — restored after page refresh
  useEffectApp(() => {
    const url = new URL(window.location);
    url.searchParams.set('s', screen);
    window.history.replaceState(null, '', url);
  }, [screen]);

  // arrow-key navigation across screens
  useEffectApp(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea')) return;
      const i = SCREENS.findIndex(s => s.id === screen);
      if (e.key === 'ArrowRight' && i < SCREENS.length - 1) setScreen(SCREENS[i + 1].id);
      if (e.key === 'ArrowLeft' && i > 0)                   setScreen(SCREENS[i - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  // Compute the *active* sidebar item from the screen
  const sidebarActive = screen.startsWith('cat-') ? 'catalog'
                      : screen.startsWith('asset') ? 'assets'
                      : 'catalog';

  // Crumbs for the topbar
  const crumbs = (() => {
    if (screen === 'cat-detail') return ['brand DNA', 'catalog', 'cherry-smoked chili oil'];
    if (screen.startsWith('cat-')) return ['brand DNA', 'catalog'];
    if (screen === 'asset-detail') return ['brand DNA', 'assets', 'logos', 'lumen-primary.svg'];
    return ['brand DNA', 'assets'];
  })();

  // Sidebar nav handler: jumps to that section's primary screen
  const onSidebarNav = (id) => {
    if (id === 'catalog') setScreen('cat-grid');
    else if (id === 'assets') setScreen('assets-grid');
    // other items are non-functional in this prototype — they would normally route to their pages
  };

  return (
    <div className="app-shell">
      <Sidebar active={sidebarActive} onNav={onSidebarNav} />

      <div className="app-main">
        <TopBar crumbs={crumbs} />
        <main className="app-content">
          {screen === 'cat-grid' && (
            <ScreenCatalogGrid
              onOpenAdd={() => setScreen('cat-add')}
              onOpenDetail={() => setScreen('cat-detail')}
            />
          )}
          {screen === 'cat-empty' && (
            <ScreenCatalogEmpty
              onOpenAdd={() => setScreen('cat-add')}
              onJumpAssets={() => setScreen('assets-empty')}
            />
          )}
          {screen === 'cat-add' && (
            // show the grid behind the modal
            <>
              <ScreenCatalogGrid
                onOpenAdd={() => {}}
                onOpenDetail={() => {}}
              />
              <ModalAddProduct onClose={() => setScreen('cat-grid')} />
            </>
          )}
          {screen === 'cat-detail' && (
            <ScreenCatalogDetail onBack={() => setScreen('cat-grid')} />
          )}

          {screen === 'assets-grid' && (
            <ScreenAssetsGallery
              onOpenAdd={() => setScreen('assets-add')}
              onOpenAsset={() => setScreen('asset-detail')}
            />
          )}
          {screen === 'assets-empty' && (
            <ScreenAssetsEmpty
              onOpenAdd={() => setScreen('assets-add')}
              onJumpCatalog={() => setScreen('cat-empty')}
            />
          )}
          {screen === 'assets-add' && (
            <>
              <ScreenAssetsGallery
                onOpenAdd={() => {}}
                onOpenAsset={() => {}}
              />
              <ModalAddAsset onClose={() => setScreen('assets-grid')} />
            </>
          )}
          {screen === 'asset-detail' && (
            <>
              <ScreenAssetsGallery
                onOpenAdd={() => {}}
                onOpenAsset={() => {}}
              />
              <AssetLightbox
                item={{ name: 'lumen-primary' }}
                onClose={() => setScreen('assets-grid')}
              />
            </>
          )}
        </main>
      </div>

      <Scrubber screens={SCREENS} current={screen} setCurrent={setScreen} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
