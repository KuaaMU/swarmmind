interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 32, className, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className || ""}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        {/* Outer hexagon */}
        <path
          d="M16 2L28.66 9v14L16 30 3.34 23V9L16 2z"
          stroke="url(#logo-gradient)"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Inner mesh lines */}
        <line x1="16" y1="2" x2="16" y2="30" stroke="url(#logo-gradient)" strokeWidth="0.5" opacity="0.3" />
        <line x1="3.34" y1="9" x2="28.66" y2="23" stroke="url(#logo-gradient)" strokeWidth="0.5" opacity="0.3" />
        <line x1="28.66" y1="9" x2="3.34" y2="23" stroke="url(#logo-gradient)" strokeWidth="0.5" opacity="0.3" />
        {/* Center nodes */}
        <circle cx="16" cy="10" r="2" fill="#3b82f6" />
        <circle cx="10" cy="19" r="2" fill="#eab308" />
        <circle cx="22" cy="19" r="2" fill="#22c55e" />
        <circle cx="16" cy="24" r="2" fill="#a855f7" />
        {/* Connecting lines */}
        <line x1="16" y1="10" x2="10" y2="19" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
        <line x1="16" y1="10" x2="22" y2="19" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
        <line x1="10" y1="19" x2="16" y2="24" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
        <line x1="22" y1="19" x2="16" y2="24" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className="text-lg font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
          SwarmMind
        </span>
      )}
    </div>
  );
}
