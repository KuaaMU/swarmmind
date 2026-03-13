interface StatusIconProps {
  status: "online" | "offline" | "warning";
  size?: number;
  className?: string;
}

export function StatusIcon({ status, size = 12, className }: StatusIconProps) {
  if (status === "online") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
        <circle cx="6" cy="6" r="5" stroke="#22c55e" strokeWidth="1.5" fill="none">
          <animate
            attributeName="opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="6" cy="6" r="2.5" fill="#22c55e" />
      </svg>
    );
  }

  if (status === "warning") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
        <path
          d="M6 1L1 10.5h10L6 1z"
          stroke="#f59e0b"
          strokeWidth="1.2"
          fill="#f59e0b"
          fillOpacity="0.2"
          strokeLinejoin="round"
        />
        <line x1="6" y1="4.5" x2="6" y2="7.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6" cy="9" r="0.6" fill="#f59e0b" />
      </svg>
    );
  }

  // offline
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <circle cx="6" cy="6" r="3" fill="#6b7280" />
    </svg>
  );
}
