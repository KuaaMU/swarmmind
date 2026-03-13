"use client";

interface Trade {
  id: string;
  signalId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  txHash: string;
  status: string;
  timestamp: number;
}

const statusColors: Record<string, string> = {
  COMPLETED: "text-green-400",
  PENDING: "text-yellow-400",
  EXECUTING: "text-blue-400",
  FAILED: "text-red-400",
};

export function TradeHistory({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No trades yet</p>
        <p className="text-sm">Trades will appear after orchestration runs</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {trades.slice(0, 20).map((trade) => (
        <div
          key={trade.id}
          className="p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">
              {trade.tokenIn} → {trade.tokenOut}
            </span>
            <span className={`text-xs ${statusColors[trade.status] || "text-gray-400"}`}>
              {trade.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{trade.amountIn} → {trade.amountOut}</span>
            <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
          </div>
          {trade.txHash && (
            <a
              href={`https://www.oklink.com/xlayer/tx/${trade.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
            >
              View TX
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
