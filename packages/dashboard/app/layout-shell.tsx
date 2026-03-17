"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "../components/Sidebar";

const SHELL_ROUTES = ["/dashboard", "/agents", "/payments", "/consensus"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showShell = SHELL_ROUTES.some((r) => pathname.startsWith(r));

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[220px] max-lg:ml-[60px]">
        {children}
      </main>
    </div>
  );
}
