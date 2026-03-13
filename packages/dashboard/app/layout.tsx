import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwarmMind - Autonomous DeFi Intelligence on X Layer",
  description: "Multi-agent AI network for DeFi trading on X Layer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
