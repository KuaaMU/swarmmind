"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AgentStatus } from "../../lib/types";

interface AgentEarningsChartProps {
  agents: AgentStatus[];
}

export function AgentEarningsChart({ agents }: AgentEarningsChartProps) {
  const data = agents.map((a) => ({
    name: a.name.split(" ").pop() || a.name,
    earnings: parseFloat(a.totalEarnings || "0"),
    spending: parseFloat(a.totalSpending || "0"),
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-gray-500 text-sm">
        No agent data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="name"
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
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
        />
        <Bar dataKey="earnings" fill="#22c55e" radius={[4, 4, 0, 0]} name="Earnings" />
        <Bar dataKey="spending" fill="#ef4444" radius={[4, 4, 0, 0]} name="Spending" />
      </BarChart>
    </ResponsiveContainer>
  );
}
