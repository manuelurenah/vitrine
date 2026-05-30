// Onboarding icons + tiny primitives.
// Keep stroke 1.6, round caps to match Lucide-style icons in the kit.

function IconDna({ size = 24 }) {
  // Lucide's "dna" icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M2 15c6.667-6 13.333 0 20-6" />
      <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
      <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
      <path d="m17 6-2.5-2.5" />
      <path d="m14 8-1-1" />
      <path d="m7 18 2.5 2.5" />
      <path d="m3.5 14.5.5.5" />
      <path d="m20 9 .5.5" />
      <path d="m6.5 12.5 1 1" />
      <path d="m16.5 10.5 1 1" />
      <path d="m10 16 1.5 1.5" />
    </svg>
  );
}

function IconArrowRight({ size = 18 }) {
  return (
    <svg className="arrow-r" width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconArrowLeft({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconCheck({ size = 12, strokeWidth = 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

function IconSparkle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 L 13.6 9 L 21 10.6 L 13.6 12.2 L 12 19.4 L 10.4 12.2 L 3 10.6 L 10.4 9 Z" />
      <path d="M19 3 L 19.6 5.4 L 22 6 L 19.6 6.6 L 19 9 L 18.4 6.6 L 16 6 L 18.4 5.4 Z" opacity="0.7" />
    </svg>
  );
}

function IconUpload({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M12 16 V 4" />
      <path d="M7 9 L 12 4 L 17 9" />
      <path d="M4 16 V 19 a 1 1 0 0 0 1 1 H 19 a 1 1 0 0 0 1 -1 V 16" />
    </svg>
  );
}

function IconLink({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M10 14 a4 4 0 0 0 5.66 0 L 19 11 a4 4 0 0 0 -5.66 -5.66 L 12 6.5" />
      <path d="M14 10 a4 4 0 0 0 -5.66 0 L 5 13 a4 4 0 0 0 5.66 5.66 L 12 17.5" />
    </svg>
  );
}

function IconClose({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconPlus({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPencil({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M12 20 H 21" />
      <path d="M16.5 3.5 a 2.121 2.121 0 0 1 3 3 L 7 19 L 3 20 L 4 16 Z" />
    </svg>
  );
}

function IconCamera({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <path d="M3 9 a2 2 0 0 1 2 -2 h 3 l 2 -3 h 4 l 2 3 h 3 a 2 2 0 0 1 2 2 v 9 a 2 2 0 0 1 -2 2 H 5 a 2 2 0 0 1 -2 -2 Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function IconLayers({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true">
      <polygon points="12 2 22 8.5 12 15 2 8.5 12 2" />
      <polyline points="2 14 12 20.5 22 14" />
    </svg>
  );
}

// Buzz currency glyph — small flame-spark, matches assets/buzz.svg vibe
function IconBuzz({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L 5 13 H 11 L 9 22 L 19 10 H 13 Z" />
    </svg>
  );
}

// Make icons globally available
Object.assign(window, {
  IconDna, IconArrowRight, IconArrowLeft, IconCheck, IconSparkle,
  IconUpload, IconLink, IconClose, IconPlus, IconPencil,
  IconCamera, IconLayers, IconBuzz,
});
