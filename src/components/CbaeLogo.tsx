// Cbae logo — blue triangle with circle and stem
// Use size prop to scale. color variant: "full" (blue) | "mono" (current color)

export function CbaeLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="cbae-tri" x1="50" y1="6" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6b9fd6"/>
          <stop offset="100%" stopColor="#2a5fa8"/>
        </linearGradient>
        <linearGradient id="cbae-inner" x1="50" y1="16" x2="50" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a7ec3"/>
          <stop offset="100%" stopColor="#1e4d96"/>
        </linearGradient>
        <filter id="cbae-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outer triangle */}
      <path
        d="M50 6 L94 88 L6 88 Z"
        fill="url(#cbae-tri)"
        stroke="#1a3d7a"
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#cbae-glow)"
      />

      {/* Inner triangle */}
      <path
        d="M50 17 L83 81 L17 81 Z"
        fill="url(#cbae-inner)"
        stroke="#1a3d7a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Horizontal divider */}
      <line x1="27" y1="69" x2="73" y2="69" stroke="#1a3d7a" strokeWidth="1.8"/>

      {/* Circle outer */}
      <circle cx="50" cy="61" r="10" fill="#152e6e" stroke="#4a7ec3" strokeWidth="1.5"/>
      {/* Circle inner glow */}
      <circle cx="50" cy="61" r="5.5" fill="#4a7ec3" opacity="0.55"/>

      {/* Stem */}
      <line x1="50" y1="71" x2="50" y2="81" stroke="#1a3d7a" strokeWidth="2.2"/>
    </svg>
  )
}

// Animated version with glow pulse — used in welcome screen
export function CbaeLogoAnimated({ size = 64 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "radial-gradient(circle, rgba(74,126,195,0.25) 0%, transparent 70%)",
          animation: "pulse-glow 3s ease-in-out infinite",
        }}
      />
      <CbaeLogo size={size} />
    </div>
  )
}
