/* Vitrine mobile hi-fi — DesignCanvas wiring for all 24 screens.
   Auth + Onboarding (6) · Campaigns (7) · Photoshoot (3) · Catalog & Assets (8) */

const W = 390;

function MobileApp() {
  const auth = [
    { id: "login",        label: "00 · sign in",                node: <MobileLogin/>,        h: 844 },
    { id: "onb-welcome",  label: "01 · onboarding · welcome",   node: <MobileOnbWelcome/>,   h: 844 },
    { id: "onb-input",    label: "02 · onboarding · input",     node: <MobileOnbInput/>,     h: 1120 },
    { id: "onb-generating", label: "03 · onboarding · cooking", node: <MobileOnbGenerating/>, h: 844 },
    { id: "onb-dna",      label: "04 · onboarding · dna ready", node: <MobileOnbDna/>,       h: 944 },
    { id: "onb-next",     label: "05 · onboarding · what next", node: <MobileOnbNext/>,      h: 844 },
  ];
  const campaigns = [
    { id: "camp-list",    label: "06 · campaigns · list",       node: <MobileCampaignsList/>,    h: 980 },
    { id: "camp-empty",   label: "07 · campaigns · empty",      node: <MobileCampaignsEmpty/>,   h: 880 },
    { id: "camp-brief",   label: "08 · campaign brief · sheet", node: <MobileBriefSheet/>,       h: 920 },
    { id: "camp-cooking", label: "09 · campaign · cooking",     node: <MobileCampaignCooking/>,  h: 1280 },
    { id: "camp-ready",   label: "10 · campaign · ready",       node: <MobileCampaignReady/>,    h: 1280 },
    { id: "camp-editor",  label: "11 · creative · editor",      node: <MobileCreativeEditor/>,   h: 1340 },
    { id: "camp-history", label: "12 · creative · history",     node: <MobileVersionHistory/>,   h: 1280 },
  ];
  const photoshoot = [
    { id: "ps-list",      label: "13 · photoshoot · list",      node: <MobilePhotoshootList/>,    h: 980 },
    { id: "ps-builder",   label: "14 · photoshoot · builder",   node: <MobilePhotoshootBuilder/>, h: 1240 },
    { id: "ps-results",   label: "15 · photoshoot · results",   node: <MobilePhotoshootResults/>, h: 1280 },
  ];
  const catalog = [
    { id: "cat-grid",     label: "16 · catalog · grid",         node: <MobileCatalogGrid/>,    h: 1060 },
    { id: "cat-empty",    label: "17 · catalog · empty",        node: <MobileCatalogEmpty/>,   h: 960 },
    { id: "cat-add",      label: "18 · catalog · add sheet",    node: <MobileCatalogAdd/>,     h: 980 },
    { id: "cat-detail",   label: "19 · catalog · detail",       node: <MobileCatalogDetail/>,  h: 1340 },
    { id: "ast-grid",     label: "20 · assets · gallery",       node: <MobileAssetsGrid/>,     h: 1180 },
    { id: "ast-empty",    label: "21 · assets · empty",         node: <MobileAssetsEmpty/>,    h: 1000 },
    { id: "ast-add",      label: "22 · assets · upload sheet",  node: <MobileAssetsAdd/>,      h: 980 },
    { id: "ast-detail",   label: "23 · asset · lightbox",       node: <MobileAssetLightbox/>,  h: 980 },
  ];

  const section = (id, title, sub, items) => (
    <DCSection id={id} title={title} subtitle={sub}>
      {items.map(s => (
        <DCArtboard key={s.id} id={s.id} label={s.label} width={W} height={s.h}>
          {s.node}
        </DCArtboard>
      ))}
    </DCSection>
  );

  return (
    <DesignCanvas
      title="vitrine · mobile (hi-fi)"
      subtitle="24 screens · 390px · bottom-tab nav · dark theme"
    >
      {section("auth", "auth + onboarding",
                "sign-in + first-run flow. no tab bar.",
                auth)}
      {section("campaigns-flow", "campaigns",
                "list → empty → brief sheet → cooking → ready → editor → history.",
                campaigns)}
      {section("photoshoot-flow", "photoshoot",
                "list → builder → results. sticky CTA · 2-col card grid.",
                photoshoot)}
      {section("brand-flow", "brand (catalog + assets)",
                "lives under 'brand' tab. inner sub-tabs for dna / catalog / assets / book.",
                catalog)}
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MobileApp/>);
