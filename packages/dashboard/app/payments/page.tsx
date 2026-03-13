"use client";

import { useEffect, useState, useCallback } from "react";
import { PaymentFeed } from "../../components/PaymentFeed";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  serviceType: string;
  txHash: string;
  timestamp: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/portfolio`);
      if (!res.ok) return;
      const data = await res.json();
      setPayments(data.data?.recentPayments || []);
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 5000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const totalVolume = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Payment Analytics</h1>
        <p className="text-gray-400">x402 micropayment history between agents</p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Total Payments</p>
          <p className="text-2xl font-bold text-white">{payments.length}</p>
        </div>
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Total Volume</p>
          <p className="text-2xl font-bold text-white">${totalVolume.toFixed(4)} USDC</p>
        </div>
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Network</p>
          <p className="text-2xl font-bold text-white">X Layer (196)</p>
        </div>
      </div>

      {/* Payment Flow Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Flow</h2>
          <div className="space-y-3">
            <FlowRow
              from="Portfolio Manager"
              to="Alpha Scout"
              service="Market Signals"
              price="$0.001"
            />
            <FlowRow
              from="Portfolio Manager"
              to="Risk Oracle"
              service="Risk Assessment"
              price="$0.002"
            />
            <FlowRow
              from="Portfolio Manager"
              to="Trade Executor"
              service="DEX Swap"
              price="Direct Call"
            />
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
          <PaymentFeed payments={payments} />
        </div>
      </div>
    </div>
  );
}

function FlowRow({
  from,
  to,
  service,
  price,
}: {
  from: string;
  to: string;
  service: string;
  price: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
      <span className="text-sm font-medium text-purple-400 w-36">{from}</span>
      <span className="text-gray-500">→</span>
      <span className="text-sm font-medium text-blue-400 w-28">{to}</span>
      <span className="text-xs text-gray-400 flex-1">{service}</span>
      <span className="text-xs text-green-400">{price}</span>
    </div>
  );
}
