type Props = { size?: number; className?: string };

export function BuzzGlyph({ size = 14, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="buzz"
      className={className}
    >
      <defs>
        <linearGradient id="vitrine-buzz-glyph" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe25a" />
          <stop offset="100%" stopColor="#ffce3d" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#vitrine-buzz-glyph)" />
      <path
        d="M13.2 5.5 L7.5 13 L11 13 L10.8 18.5 L16.5 11 L13 11 Z"
        fill="#0a0a0f"
        stroke="#0a0a0f"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
