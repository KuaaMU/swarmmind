"use client";

import type { ReasoningTrace, ReasoningStep } from "../lib/types";

const TOOL_ICONS: Record<string, string> = {
  get_market_signals: "SCAN",
  assess_risk: "RISK",
  assess_liquidity: "LIQ",
  execute_trade: "TRADE",
  get_portfolio_state: "PORT",
  check_agent_status: "CHECK",
};

const TOOL_COLORS: Record<string, string> = {
  get_market_signals: "#3b82f6",
  assess_risk: "#eab308",
  assess_liquidity: "#06b6d4",
  execute_trade: "#22c55e",
  get_portfolio_state: "#a855f7",
  check_agent_status: "#6b7280",
};

function StepCard({ step }: { step: ReasoningStep }) {
  const hasTools = step.toolCalls.length > 0;

  return (
    <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">
          Step {step.iteration + 1}
        </span>
        <span className="text-xs text-gray-600">
          {new Date(step.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {step.text && (
        <p className="text-sm text-gray-300 mb-2 leading-relaxed">
          {step.text}
        </p>
      )}

      {hasTools && (
        <div className="space-y-1.5">
          {step.toolCalls.map((tc, i) => {
            const color = TOOL_COLORS[tc.name] || "#6b7280";
            const icon = TOOL_ICONS[tc.name] || "TOOL";
            let resultSummary = "";
            try {
              const parsed = JSON.parse(tc.result);
              if (parsed.error) {
                resultSummary = `Error: ${parsed.error}`;
              } else if (parsed.count !== undefined) {
                resultSummary = `${parsed.count} result(s)`;
              } else if (parsed.riskScore !== undefined) {
                resultSummary = `Risk: ${parsed.riskScore}/10 - ${parsed.recommendation}`;
              } else if (parsed.tradeId) {
                resultSummary = `Trade ${parsed.status}`;
              } else if (parsed.liquidityScore !== undefined) {
                resultSummary = `Score: ${parsed.liquidityScore}/10 - ${parsed.recommendation}`;
              } else if (parsed.totalValue !== undefined) {
                resultSummary = `Value: $${parsed.totalValue}`;
              } else if (parsed.online !== undefined) {
                resultSummary = parsed.online ? "Online" : "Offline";
              } else {
                resultSummary = "OK";
              }
            } catch {
              resultSummary = tc.result.slice(0, 50);
            }

            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded px-2 py-1"
                style={{ backgroundColor: color + "10" }}
              >
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: color + "25", color }}
                >
                  {icon}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {tc.name}
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  {resultSummary}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!hasTools && (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-green-400">Cycle complete</span>
        </div>
      )}
    </div>
  );
}

export function ReasoningTrace({
  trace,
  isLive,
}: {
  trace: ReasoningTrace | null;
  isLive?: boolean;
}) {
  if (!trace) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No reasoning trace available. Run a ReAct cycle to see LLM reasoning.
      </div>
    );
  }

  const duration = trace.completedAt - trace.startedAt;
  const totalToolCalls = trace.steps.reduce(
    (sum, s) => sum + s.toolCalls.length,
    0,
  );

  return (
    <div className="space-y-3">
      {/* Header stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>
          {trace.steps.length} step{trace.steps.length !== 1 ? "s" : ""}
        </span>
        <span>{totalToolCalls} tool call{totalToolCalls !== 1 ? "s" : ""}</span>
        <span>{(duration / 1000).toFixed(1)}s</span>
        {isLive && (
          <span className="flex items-center gap-1 text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {trace.steps.map((step, i) => (
          <StepCard key={i} step={step} />
        ))}
      </div>

      {/* Summary */}
      {trace.summary && (
        <div className="border-t border-gray-700/50 pt-3">
          <p className="text-xs text-gray-400 italic">{trace.summary}</p>
        </div>
      )}
    </div>
  );
}
