/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const agents = [
  { name: "Alpha Scout", role: "Market Intelligence", color: "blue" },
  { name: "Risk Oracle", role: "Risk Assessment", color: "yellow" },
  { name: "Trade Executor", role: "DEX Execution", color: "green" },
  { name: "Portfolio Manager", role: "Orchestrator", color: "purple" },
] as const;

const colorMap: Record<string, { border: string; text: string; dot: string }> = {
  blue: { border: "border-blue-500/30 hover:border-blue-400/50", text: "text-blue-400", dot: "bg-blue-400" },
  yellow: { border: "border-yellow-500/30 hover:border-yellow-400/50", text: "text-yellow-400", dot: "bg-yellow-400" },
  green: { border: "border-green-500/30 hover:border-green-400/50", text: "text-green-400", dot: "bg-green-400" },
  purple: { border: "border-purple-500/30 hover:border-purple-400/50", text: "text-purple-400", dot: "bg-purple-400" },
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-4xl text-center relative z-10">
        {/* Logo image */}
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="SwarmMind Logo"
            width={140}
            height={140}
            className="rounded-2xl"
          />
        </div>

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

        {/* Agent cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {agents.map((agent) => {
            const c = colorMap[agent.color];
            return (
              <div
                key={agent.name}
                className={`p-4 rounded-xl border ${c.border} bg-gray-900/50 transition-colors`}
              >
                <div className={`w-2 h-2 rounded-full ${c.dot} mb-3`} />
                <h3 className="font-semibold text-white">{agent.name}</h3>
                <p className={`text-sm ${c.text}`}>{agent.role}</p>
              </div>
            );
          })}
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
