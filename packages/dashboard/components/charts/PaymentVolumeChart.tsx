"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Payment } from "../../lib/types";

interface PaymentVolumeChartProps {
  payments: Payment[];
}

export function PaymentVolumeChart({ payments }: PaymentVolumeChartProps) {
  // Group payments into time buckets and compute cumulative volume
  const sorted = [...payments].sort((a, b) => a.timestamp - b.timestamp);
  let cumulative = 0;
  const data = sorted.map((p) => {
    cumulative += parseFloat(p.amount || "0");
    return {
      time: new Date(p.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      volume: parseFloat(cumulative.toFixed(4)),
    };
  });

  // Take at most 20 data points, evenly spaced
  const sampled =
    data.length <= 20
      ? data
      : data.filter((_, i) => i % Math.ceil(data.length / 20) === 0 || i === data.length - 1);

  if (sampled.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-gray-500 text-sm">
        No payment data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={sampled}>
        <defs>
          <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          itemStyle={{ color: "#a855f7" }}
        />
        <Area
          type="monotone"
          dataKey="volume"
          stroke="#a855f7"
          strokeWidth={2}
          fill="url(#volumeGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
