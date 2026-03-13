"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AgentStatus {
  name: string;
  role: string;
  isOnline: boolean;
}

interface Payment {
  id: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
}

interface Node {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isOnline: boolean;
  volume: number;
}

interface Edge {
  source: string;
  target: string;
  active: boolean;
  activatedAt: number;
}

const ROLE_COLORS: Record<string, string> = {
  SCOUT: "#3b82f6",
  ORACLE: "#eab308",
  EXECUTOR: "#22c55e",
  MANAGER: "#a855f7",
};

const AGENT_NODES = [
  { id: "portfolio-manager", label: "Portfolio\nManager", role: "MANAGER" },
  { id: "alpha-scout", label: "Alpha\nScout", role: "SCOUT" },
  { id: "risk-oracle", label: "Risk\nOracle", role: "ORACLE" },
  { id: "trade-executor", label: "Trade\nExecutor", role: "EXECUTOR" },
];

const EDGES: Edge[] = [
  { source: "portfolio-manager", target: "alpha-scout", active: false, activatedAt: 0 },
  { source: "portfolio-manager", target: "risk-oracle", active: false, activatedAt: 0 },
  { source: "portfolio-manager", target: "trade-executor", active: false, activatedAt: 0 },
];

export function SwarmVisualization({
  agents,
  payments,
}: {
  agents: AgentStatus[];
  payments: Payment[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([...EDGES]);
  const animFrameRef = useRef<number>(0);
  const [size, setSize] = useState({ width: 600, height: 400 });

  // Initialize nodes
  useEffect(() => {
    const cx = size.width / 2;
    const cy = size.height / 2;
    const radius = Math.min(cx, cy) * 0.6;

    nodesRef.current = AGENT_NODES.map((def, i) => {
      const angle = (i / AGENT_NODES.length) * Math.PI * 2 - Math.PI / 2;
      const agentStatus = agents.find(
        (a) => a.name.toLowerCase().replace(/\s+/g, "-") === def.id || a.role === def.role
      );
      return {
        ...def,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        isOnline: agentStatus?.isOnline || false,
        volume: 0,
      };
    });
  }, [agents, size]);

  // Animate payment pulses
  useEffect(() => {
    if (payments.length === 0) return;
    const latest = payments[0];
    const now = Date.now();

    edgesRef.current = edgesRef.current.map((edge) => {
      const matches =
        (latest.from.includes(edge.source) && latest.to.includes(edge.target)) ||
        (latest.from.includes(edge.target) && latest.to.includes(edge.source));

      if (matches) {
        return { ...edge, active: true, activatedAt: now };
      }
      return edge;
    });
  }, [payments]);

  // Canvas rendering loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = Date.now();
    ctx.clearRect(0, 0, size.width, size.height);

    // Draw edges
    edgesRef.current.forEach((edge) => {
      const source = nodesRef.current.find((n) => n.id === edge.source);
      const target = nodesRef.current.find((n) => n.id === edge.target);
      if (!source || !target) return;

      const timeSinceActive = now - edge.activatedAt;
      const isGlowing = edge.active && timeSinceActive < 2000;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isGlowing) {
        const progress = timeSinceActive / 2000;
        ctx.strokeStyle = `rgba(168, 85, 247, ${1 - progress})`;
        ctx.lineWidth = 3 + (1 - progress) * 3;

        // Pulse particle along edge
        const px = source.x + (target.x - source.x) * progress;
        const py = source.y + (target.y - source.y) * progress;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${1 - progress})`;
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(75, 85, 99, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (edge.active && timeSinceActive >= 2000) {
          edge.active = false;
        }
      }
    });

    // Draw nodes
    nodesRef.current.forEach((node) => {
      const color = ROLE_COLORS[node.role] || "#6b7280";
      const nodeRadius = 30;

      // Glow effect for online nodes
      if (node.isOnline) {
        const gradient = ctx.createRadialGradient(
          node.x, node.y, nodeRadius,
          node.x, node.y, nodeRadius * 2
        );
        gradient.addColorStop(0, color + "30");
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = node.isOnline ? color + "20" : "#1f293720";
      ctx.fill();
      ctx.strokeStyle = node.isOnline ? color : "#4b5563";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Status dot
      ctx.beginPath();
      ctx.arc(node.x + nodeRadius * 0.6, node.y - nodeRadius * 0.6, 4, 0, Math.PI * 2);
      ctx.fillStyle = node.isOnline ? "#22c55e" : "#6b7280";
      ctx.fill();

      // Label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      const lines = node.label.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, node.x, node.y + 4 + (i - (lines.length - 1) / 2) * 14);
      });
    });

    animFrameRef.current = requestAnimationFrame(draw);
  }, [size]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 300),
        });
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className="w-full h-full min-h-[300px]"
    />
  );
}
