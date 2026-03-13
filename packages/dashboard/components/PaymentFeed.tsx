"use client";

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  serviceType: string;
  txHash: string;
  timestamp: number;
}

const agentLabels: Record<string, string> = {
  "portfolio-manager": "PM",
  "alpha-scout": "Scout",
  "risk-oracle": "Oracle",
  "trade-executor": "Exec",
};

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getLabel(addr: string): string {
  return agentLabels[addr] || shortenAddress(addr);
}

export function PaymentFeed({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No payments yet</p>
        <p className="text-sm">Payments will appear here when agents transact</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {payments.slice(0, 20).map((payment) => (
        <div
          key={payment.id}
          className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-xs font-medium text-purple-400 truncate">
              {getLabel(payment.from)}
            </span>
            <span className="text-gray-600 text-xs">→</span>
            <span className="text-xs font-medium text-blue-400 truncate">
              {getLabel(payment.to)}
            </span>
          </div>
          <span className="text-xs text-green-400 whitespace-nowrap">
            ${payment.amount}
          </span>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {new Date(payment.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
