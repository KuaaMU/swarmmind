import Link from "next/link";

const agents = [
  {
    name: "Alpha Scout",
    role: "SCOUT",
    description: "Scans markets for trading signals",
    color: "#3b82f6",
    cx: 200,
    cy: 60,
  },
  {
    name: "Risk Oracle",
    role: "ORACLE",
    description: "Assesses risk on every opportunity",
    color: "#eab308",
    cx: 340,
    cy: 180,
  },
  {
    name: "Trade Executor",
    role: "EXECUTOR",
    description: "Executes swaps on X Layer DEXs",
    color: "#22c55e",
    cx: 200,
    cy: 300,
  },
  {
    name: "Portfolio Manager",
    role: "MANAGER",
    description: "Orchestrates the agent swarm",
    color: "#a855f7",
    cx: 60,
    cy: 180,
  },
] as const;

const connections = [
  { from: 3, to: 0 },
  { from: 3, to: 1 },
  { from: 3, to: 2 },
  { from: 0, to: 1 },
];

function AgentNode({
  cx,
  cy,
  color,
  role,
}: {
  cx: number;
  cy: number;
  color: string;
  role: string;
}) {
  const iconPaths: Record<string, string> = {
    SCOUT: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 5v2M12 17v2M5 12h2M17 12h2",
    ORACLE: "M12 4L3 18h18L12 4z",
    EXECUTOR: "M13 3L5 13h6l-1 7 8-10h-6l1-7z",
    MANAGER: "M12 7a2 2 0 100-4 2 2 0 000 4zM7 15a2 2 0 100-4 2 2 0 000 4zM17 15a2 2 0 100-4 2 2 0 000 4zM12 21a2 2 0 100-4 2 2 0 000 4z",
  };

  return (
    <g>
      {/* Glow */}
      <circle cx={cx} cy={cy} r="32" fill={color} fillOpacity="0.06" />
      {/* Border */}
      <circle cx={cx} cy={cy} r="24" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Icon */}
      <g transform={`translate(${cx - 12}, ${cy - 12})`}>
        <path d={iconPaths[role]} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-4xl text-center relative z-10">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent mb-4">
          SwarmMind
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          Collective AI Intelligence for the Agentic Economy on X Layer
        </p>
        <p className="text-gray-500 mb-12 max-w-2xl mx-auto">
          An autonomous multi-agent DeFi intelligence network where specialized
          AI agents discover, assess, and execute trading opportunities,
          paying each other for services via x402 micropayments.
        </p>

        {/* SVG Agent Diagram */}
        <div className="flex justify-center mb-12">
          <svg
            viewBox="0 0 400 360"
            className="w-full max-w-[400px] h-auto"
            fill="none"
          >
            {/* Animated connection lines */}
            {connections.map(({ from, to }, i) => (
              <line
                key={i}
                x1={agents[from].cx}
                y1={agents[from].cy}
                x2={agents[to].cx}
                y2={agents[to].cy}
                stroke="#6b7280"
                strokeWidth="1"
                strokeDasharray="6 4"
                strokeOpacity="0.3"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-20"
                  dur={`${2 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              </line>
            ))}

            {/* Agent nodes */}
            {agents.map((agent) => (
              <AgentNode
                key={agent.role}
                cx={agent.cx}
                cy={agent.cy}
                color={agent.color}
                role={agent.role}
              />
            ))}

            {/* Labels */}
            {agents.map((agent) => (
              <g key={`label-${agent.role}`}>
                <text
                  x={agent.cx}
                  y={agent.cy + 38}
                  textAnchor="middle"
                  fill="#e5e7eb"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {agent.name}
                </text>
                <text
                  x={agent.cx}
                  y={agent.cy + 52}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  {agent.description}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/20"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
