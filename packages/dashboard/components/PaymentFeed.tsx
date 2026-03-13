"use client";

import type { Payment } from "../lib/types";
import { AGENT_LABELS, AGENT_IDS } from "../lib/types";

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getLabel(addr: string): string {
  return AGENT_LABELS[addr] || shortenAddress(addr);
}

function getRoleDot(addr: string): string {
  const role = AGENT_IDS[addr];
  if (!role) return "bg-gray-500";
  const dots: Record<string, string> = {
    SCOUT: "bg-blue-400",
    ORACLE: "bg-yellow-400",
    EXECUTOR: "bg-green-400",
    MANAGER: "bg-purple-400",
  };
  return dots[role] || "bg-gray-500";
}

export function PaymentFeed({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No payments yet</p>
        <p className="text-xs mt-1">Payments will appear here when agents transact</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
      {payments.slice(0, 20).map((payment, index) => (
        <div
          key={payment.id}
          className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/20 hover:bg-gray-800/40 transition-colors animate-slide-in"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${getRoleDot(payment.from)} shrink-0`} />
          <span className="text-xs font-medium text-purple-400 truncate min-w-[36px]">
            {getLabel(payment.from)}
          </span>
          {/* SVG arrow */}
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="shrink-0">
            <line x1="0" y1="4" x2="10" y2="4" stroke="#4b5563" strokeWidth="1" />
            <path d="M9 1l3 3-3 3" stroke="#4b5563" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span className={`w-1.5 h-1.5 rounded-full ${getRoleDot(payment.to)} shrink-0`} />
          <span className="text-xs font-medium text-blue-400 truncate min-w-[36px]">
            {getLabel(payment.to)}
          </span>
          <span className="flex-1" />
          <span className="text-xs text-green-400 whitespace-nowrap font-mono">
            ${payment.amount}
          </span>
          <span className="text-[10px] text-gray-500 whitespace-nowrap">
            {new Date(payment.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
