import type { AgentRole } from "../../lib/types";

interface AgentIconProps {
  role: AgentRole;
  size?: number;
  className?: string;
}

function ScoutIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="12" cy="12" r="4" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="8" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <line x1="12" y1="2" x2="12" y2="6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="#3b82f6" />
    </svg>
  );
}

function OracleIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M12 3L2 20h20L12 3z"
        stroke="#eab308"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="12" y1="6" x2="12" y2="20" stroke="#eab308" strokeWidth="1" opacity="0.4" />
      <circle cx="7" cy="17" r="1.5" fill="#eab308" opacity="0.6" />
      <circle cx="17" cy="17" r="1.5" fill="#eab308" opacity="0.6" />
      <circle cx="12" cy="9" r="1.5" fill="#eab308" />
    </svg>
  );
}

function ExecutorIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="#22c55e"
        fillOpacity="0.15"
      />
    </svg>
  );
}

function ManagerIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="12" cy="6" r="2" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="6" cy="14" r="2" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="18" cy="14" r="2" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="12" cy="20" r="2" stroke="#a855f7" strokeWidth="1.5" />
      <line x1="12" y1="8" x2="6" y2="12" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
      <line x1="12" y1="8" x2="18" y2="12" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
      <line x1="6" y1="16" x2="12" y2="18" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
      <line x1="18" y1="16" x2="12" y2="18" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
      <circle cx="12" cy="6" r="1" fill="#a855f7" fillOpacity="0.5" />
      <circle cx="6" cy="14" r="1" fill="#a855f7" fillOpacity="0.5" />
      <circle cx="18" cy="14" r="1" fill="#a855f7" fillOpacity="0.5" />
      <circle cx="12" cy="20" r="1" fill="#a855f7" fillOpacity="0.5" />
    </svg>
  );
}

export function AgentIcon({ role, size = 24, className }: AgentIconProps) {
  switch (role) {
    case "SCOUT":
      return <ScoutIcon size={size} className={className} />;
    case "ORACLE":
      return <OracleIcon size={size} className={className} />;
    case "EXECUTOR":
      return <ExecutorIcon size={size} className={className} />;
    case "MANAGER":
      return <ManagerIcon size={size} className={className} />;
    default:
      return <ScoutIcon size={size} className={className} />;
  }
}
