export function DiscordLogo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="dsc-atv" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff3d4d" />
          <stop offset="100%" stopColor="#9a0612" />
        </linearGradient>
        <linearGradient id="dsc-disc" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5865f2" />
          <stop offset="100%" stopColor="#7289da" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="80" height="80" rx="18" fill="#0c0c0e" stroke="url(#dsc-atv)" strokeWidth="2" />
      <path
        d="M24 52c4-8 12-14 20-14s16 6 20 14l-6 10c-3-5-8-8-14-8s-11 3-14 8l-6-10z"
        fill="url(#dsc-disc)"
        opacity={0.95}
      />
      <circle cx="34" cy="38" r="4" fill="#f2f0f7" />
      <circle cx="54" cy="38" r="4" fill="#f2f0f7" />
      <text
        x="44"
        y="74"
        textAnchor="middle"
        fill="#f2f0f7"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui,sans-serif"
        letterSpacing="0.06em"
      >
        ATV
      </text>
    </svg>
  )
}
