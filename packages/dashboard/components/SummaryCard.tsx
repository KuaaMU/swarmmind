"use client";

import type { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  glowColor?: "blue" | "yellow" | "green" | "purple";
  valueColor?: string;
}

const GLOW_CLASSES: Record<string, string> = {
  blue: "glow-border-blue",
  yellow: "glow-border-yellow",
  green: "glow-border-green",
  purple: "glow-border-purple",
};

export function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  glowColor,
  valueColor = "text-white",
}: SummaryCardProps) {
  return (
    <div
      className={`bg-gray-900/50 rounded-xl border border-gray-800/50 p-5 animate-fade-in ${
        glowColor ? GLOW_CLASSES[glowColor] : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="ml-3 opacity-60">{icon}</div>
        )}
      </div>
    </div>
  );
}
