"use client";

interface TopBarProps {
  title: string;
  subtitle?: string;
  connectionStatus: "live" | "demo" | "offline";
}

const STATUS_CONFIG = {
  live: { color: "bg-green-400", ringColor: "ring-green-400/20", label: "Live", textColor: "text-green-400" },
  demo: { color: "bg-amber-400", ringColor: "ring-amber-400/20", label: "Demo", textColor: "text-amber-400" },
  offline: { color: "bg-red-400", ringColor: "ring-red-400/20", label: "Offline", textColor: "text-red-400" },
} as const;

export function TopBar({ title, subtitle, connectionStatus }: TopBarProps) {
  const status = STATUS_CONFIG[connectionStatus];

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 ring-1 ${status.ringColor}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${status.color} ${connectionStatus === "live" ? "animate-pulse-glow" : ""}`} />
        <span className={`text-xs font-medium ${status.textColor}`}>
          {status.label}
        </span>
      </div>
    </header>
  );
}
