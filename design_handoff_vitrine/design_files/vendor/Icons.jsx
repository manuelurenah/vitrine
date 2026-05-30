/* Icons.jsx — small inline Lucide-style icon set.
   Stroke 1.5, round caps/joins. Pass size + className for control. */

const Icon = ({ path, size = 18, className = "", strokeWidth = 1.6, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke="currentColor" strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round"
       className={className}>
    {typeof path === "string" ? <path d={path} /> : path}
  </svg>
);

// Icon set — minimal, draws each glyph inline.
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
  Settings:   (p) => <Icon {...p} path={<g><circle cx="12" cy="12" r="3"/><path d="M19.4 15 a1.65 1.65 0 0 0 .33 1.82 l.06 .06 a2 2 0 0 1 0 2.83 a2 2 0 0 1 -2.83 0 l-.06 -.06 a1.65 1.65 0 0 0 -1.82 -.33 a1.65 1.65 0 0 0 -1 1.51 V21 a2 2 0 0 1 -4 0 v-.09 a1.65 1.65 0 0 0 -1.08 -1.51 a1.65 1.65 0 0 0 -1.82 .33 l-.06 .06 a2 2 0 0 1 -2.83 -2.83 l.06 -.06 a1.65 1.65 0 0 0 .33 -1.82 a1.65 1.65 0 0 0 -1.51 -1 H3 a2 2 0 0 1 0 -4 h.09 A1.65 1.65 0 0 0 4.6 9 a1.65 1.65 0 0 0 -.33 -1.82 l-.06 -.06 a2 2 0 0 1 2.83 -2.83 l.06 .06 A1.65 1.65 0 0 0 9 4.6 a1.65 1.65 0 0 0 1 -1.51 V3 a2 2 0 0 1 4 0 v.09 a1.65 1.65 0 0 0 1 1.51 a1.65 1.65 0 0 0 1.82 -.33 l.06 -.06 a2 2 0 0 1 2.83 2.83 l-.06 .06 a1.65 1.65 0 0 0 -.33 1.82 V9 a1.65 1.65 0 0 0 1.51 1 H21 a2 2 0 0 1 0 4 h-.09 a1.65 1.65 0 0 0 -1.51 1 z"/></g>}/>,
  Plus:       (p) => <Icon {...p} path="M12 5 V19 M5 12 H19"/>,
  Check:      (p) => <Icon {...p} path="M5 12 L10 17 L20 7" strokeWidth={p?.strokeWidth ?? 2}/>,
  X:          (p) => <Icon {...p} path="M6 6 L18 18 M18 6 L6 18"/>,
  ChevronDown:(p) => <Icon {...p} path="M6 9 L12 15 L18 9"/>,
  ChevronRight:(p)=> <Icon {...p} path="M9 6 L15 12 L9 18"/>,
  Search:     (p) => <Icon {...p} path={<g><circle cx="11" cy="11" r="8"/><path d="M21 21 L16.65 16.65"/></g>}/>,
  Upload:     (p) => <Icon {...p} path={<g><path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15"/><path d="M17 8 L12 3 L7 8"/><path d="M12 3 V15"/></g>}/>,
  Download:   (p) => <Icon {...p} path={<g><path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15"/><path d="M7 10 L12 15 L17 10"/><path d="M12 15 V3"/></g>}/>,
  Globe:      (p) => <Icon {...p} path={<g><circle cx="12" cy="12" r="10"/><path d="M2 12 H22"/><path d="M12 2 a15 15 0 0 1 0 20 a15 15 0 0 1 0 -20"/></g>}/>,
  Eye:        (p) => <Icon {...p} path={<g><path d="M1 12 s4 -8 11 -8 s11 8 11 8 s-4 8 -11 8 s-11 -8 -11 -8"/><circle cx="12" cy="12" r="3"/></g>}/>,
  Heart:      (p) => <Icon {...p} path="M20.84 4.61 a5.5 5.5 0 0 0 -7.78 0 L12 5.67 l-1.06 -1.06 a5.5 5.5 0 0 0 -7.78 7.78 L12 21.23 l8.84 -8.84 a5.5 5.5 0 0 0 0 -7.78 z"/>,
  MessageCircle:(p)=><Icon {...p} path="M21 11.5 a8.38 8.38 0 0 1 -.9 3.8 a8.5 8.5 0 0 1 -7.6 4.7 a8.38 8.38 0 0 1 -3.8 -.9 L3 21 l1.9 -5.7 a8.38 8.38 0 0 1 -.9 -3.8 a8.5 8.5 0 0 1 4.7 -7.6 a8.38 8.38 0 0 1 3.8 -.9 h.5 a8.48 8.48 0 0 1 8 8 z"/>,
  Refresh:    (p) => <Icon {...p} path={<g><path d="M3 12 a9 9 0 0 1 15 -6.7 L21 8"/><path d="M21 3 V8 H16"/><path d="M21 12 a9 9 0 0 1 -15 6.7 L3 16"/><path d="M3 21 V16 H8"/></g>}/>,
  Copy:       (p) => <Icon {...p} path={<g><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15 H4 a2 2 0 0 1 -2 -2 V4 a2 2 0 0 1 2 -2 h9 a2 2 0 0 1 2 2 v1"/></g>}/>,
  Trash:      (p) => <Icon {...p} path={<g><path d="M3 6 H21 M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6 M9 6 V3 h6 v3"/></g>}/>,
  MoreHorizontal:(p)=><Icon {...p} path={<g><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></g>}/>,
  Send:       (p) => <Icon {...p} path="M22 2 L11 13 M22 2 L15 22 L11 13 L2 9 Z"/>,
  Calendar:   (p) => <Icon {...p} path={<g><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2 V6 M8 2 V6 M3 10 H21"/></g>}/>,
  Type:       (p) => <Icon {...p} path={<g><path d="M4 7 V4 H20 V7"/><path d="M9 20 H15"/><path d="M12 4 V20"/></g>}/>,
  Palette:    (p) => <Icon {...p} path={<g><path d="M12 2 a10 10 0 1 0 0 20 a3 3 0 0 1 0 -6 h2 a4 4 0 0 0 4 -4 a8 8 0 0 0 -6 -10 z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor"/><circle cx="12" cy="7" r="1" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1" fill="currentColor"/></g>}/>,
  ZapOff:     (p) => <Icon {...p} path={<g><path d="M12.41 6.75 L13 2 l-2.43 2.92"/><path d="M18.57 12.91 L21 10 h-5.34"/><path d="M8 8 L3 14 H12 L11 22 L16 16"/><path d="M1 1 L23 23"/></g>}/>,
  Grid:       (p) => <Icon {...p} path={<g><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></g>}/>,
  Sun:        (p) => <Icon {...p} path={<g><circle cx="12" cy="12" r="4"/><path d="M12 2 V4 M12 20 V22 M4.93 4.93 L6.34 6.34 M17.66 17.66 L19.07 19.07 M2 12 H4 M20 12 H22 M4.93 19.07 L6.34 17.66 M17.66 6.34 L19.07 4.93"/></g>}/>,
  Moon:       (p) => <Icon {...p} path="M21 12.79 A9 9 0 1 1 11.21 3 A7 7 0 0 0 21 12.79 z"/>,
};

Object.assign(window, { Icon, Icons });
