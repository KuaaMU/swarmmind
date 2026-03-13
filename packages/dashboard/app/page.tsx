import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl text-center">
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <AgentCard
            name="Alpha Scout"
            role="Market Intelligence"
            color="blue"
            icon="🔍"
          />
          <AgentCard
            name="Risk Oracle"
            role="Risk Assessment"
            color="yellow"
            icon="⚖️"
          />
          <AgentCard
            name="Trade Executor"
            role="DEX Execution"
            color="green"
            icon="⚡"
          />
          <AgentCard
            name="Portfolio Manager"
            role="Orchestrator"
            color="purple"
            icon="🧠"
          />
        </div>

        <Link
          href="/dashboard"
          className="inline-block px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-colors"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}

function AgentCard({
  name,
  role,
  color,
  icon,
}: {
  name: string;
  role: string;
  color: string;
  icon: string;
}) {
  const borderColors: Record<string, string> = {
    blue: "border-blue-500/30 hover:border-blue-400/50",
    yellow: "border-yellow-500/30 hover:border-yellow-400/50",
    green: "border-green-500/30 hover:border-green-400/50",
    purple: "border-purple-500/30 hover:border-purple-400/50",
  };

  return (
    <div
      className={`p-4 rounded-xl border ${borderColors[color]} bg-gray-900/50 transition-colors`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-white">{name}</h3>
      <p className="text-sm text-gray-400">{role}</p>
    </div>
  );
}
