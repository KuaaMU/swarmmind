"use client";

import type { Trade, TradeStatus } from "../lib/types";

const statusConfig: Record<string, { color: string; icon: string }> = {
  COMPLETED: { color: "text-green-400", icon: "M5 12l3 3 7-7" },
  PENDING: { color: "text-yellow-400", icon: "M12 6v6l4 2" },
  EXECUTING: { color: "text-blue-400", icon: "M13 2L4 14h7l-1 8" },
  FAILED: { color: "text-red-400", icon: "M6 6l12 12M18 6L6 18" },
};

function StatusSvg({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.PENDING;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`inline ${config.color}`}>
      <path d={config.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TradeHistory({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No trades yet</p>
        <p className="text-xs mt-1">Trades will appear after orchestration runs</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
      {trades.slice(0, 20).map((trade) => (
        <div
          key={trade.id}
          className="p-2.5 rounded-lg bg-gray-800/20 hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">
              {trade.tokenIn}
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="inline mx-1">
                <line x1="0" y1="4" x2="8" y2="4" stroke="#6b7280" strokeWidth="1" />
                <path d="M7 1l3 3-3 3" stroke="#6b7280" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              {trade.tokenOut}
            </span>
            <span className="flex items-center gap-1">
              <StatusSvg status={trade.status} />
              <span className={`text-xs ${statusConfig[trade.status]?.color || "text-gray-400"}`}>
                {trade.status}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-mono">{trade.amountIn} &rarr; {trade.amountOut}</span>
            <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
          </div>
          {trade.txHash && (
            <a
              href={`https://www.oklink.com/xlayer/tx/${trade.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400/70 hover:text-blue-400 mt-1 inline-flex items-center gap-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 1h6v6M9 1L4 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              View TX
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
