"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./icons/Logo";
import { DashboardIcon, AgentsIcon, PaymentsIcon } from "./icons/NavIcons";
import { WalletConnect } from "./WalletConnect";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/agents", label: "Agents", icon: AgentsIcon },
  { href: "/payments", label: "Payments", icon: PaymentsIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-gray-950 border-r border-gray-800/50 flex flex-col z-30 max-lg:w-[60px]">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-800/50 max-lg:px-3 max-lg:justify-center">
        <Link href="/">
          <span className="max-lg:hidden">
            <Logo size={28} />
          </span>
          <span className="lg:hidden">
            <Logo size={28} showText={false} />
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors max-lg:justify-center max-lg:px-2 ${
                isActive
                  ? "bg-purple-500/10 text-purple-400 border-l-2 border-purple-400 -ml-px"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <Icon size={18} className={isActive ? "text-purple-400" : "text-gray-500"} />
              <span className="max-lg:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Wallet at bottom */}
      <div className="p-4 border-t border-gray-800/50 max-lg:p-2 max-lg:flex max-lg:justify-center">
        <div className="max-lg:hidden">
          <WalletConnect />
        </div>
        <div className="lg:hidden">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="#6b7280" strokeWidth="1.2" />
              <path d="M1 6h12" stroke="#6b7280" strokeWidth="1.2" />
            </svg>
          </div>
        </div>
      </div>
    </aside>
  );
}
