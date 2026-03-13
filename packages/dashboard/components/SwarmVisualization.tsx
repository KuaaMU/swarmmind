"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentStatus, Payment } from "../lib/types";

interface Node {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  isOnline: boolean;
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

const ROLE_LABELS: Record<string, string> = {
  SCOUT: "Scout",
  ORACLE: "Oracle",
  EXECUTOR: "Executor",
  MANAGER: "Manager",
};

const AGENT_NODES = [
  { id: "portfolio-manager", label: "Portfolio Manager", role: "MANAGER" },
  { id: "alpha-scout", label: "Alpha Scout", role: "SCOUT" },
  { id: "risk-oracle", label: "Risk Oracle", role: "ORACLE" },
  { id: "trade-executor", label: "Trade Executor", role: "EXECUTOR" },
];

const INITIAL_EDGES: Edge[] = [
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
  const edgesRef = useRef<Edge[]>(INITIAL_EDGES.map((e) => ({ ...e })));
  const animFrameRef = useRef<number>(0);
  const dashOffsetRef = useRef(0);
  const [size, setSize] = useState({ width: 600, height: 460 });

  // Initialize/update nodes
  useEffect(() => {
    const cx = size.width / 2;
    const cy = size.height / 2;
    const radius = Math.min(cx, cy) * 0.55;

    nodesRef.current = AGENT_NODES.map((def, i) => {
      const angle = (i / AGENT_NODES.length) * Math.PI * 2 - Math.PI / 2;
      const agentStatus = agents.find(
        (a) => a.name.toLowerCase().replace(/\s+/g, "-") === def.id || a.role === def.role
      );
      return {
        ...def,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        isOnline: agentStatus?.isOnline || false,
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
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size.width, size.height);

    // Background grid
    ctx.strokeStyle = "rgba(75, 85, 99, 0.08)";
    ctx.lineWidth = 1;
    const gridSpacing = 30;
    for (let x = 0; x < size.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    for (let y = 0; y < size.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }

    dashOffsetRef.current = (dashOffsetRef.current + 0.15) % 20;

    // Draw edges
    edgesRef.current.forEach((edge) => {
      const source = nodesRef.current.find((n) => n.id === edge.source);
      const target = nodesRef.current.find((n) => n.id === edge.target);
      if (!source || !target) return;

      const timeSinceActive = now - edge.activatedAt;
      const isGlowing = edge.active && timeSinceActive < 2500;

      // Dashed default edge
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -dashOffsetRef.current;

      if (isGlowing) {
        const progress = timeSinceActive / 2500;
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 * alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Multiple particles along edge
        ctx.setLineDash([]);
        for (let p = 0; p < 3; p++) {
          const particleProgress = ((progress * 3 + p * 0.3) % 1);
          const px = source.x + (target.x - source.x) * particleProgress;
          const py = source.y + (target.y - source.y) * particleProgress;
          const particleAlpha = Math.max(0, alpha * (1 - particleProgress * 0.5));

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168, 85, 247, ${particleAlpha})`;
          ctx.fill();

          // Particle glow
          const pGrad = ctx.createRadialGradient(px, py, 0, px, py, 10);
          pGrad.addColorStop(0, `rgba(168, 85, 247, ${particleAlpha * 0.4})`);
          pGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fillStyle = pGrad;
          ctx.fill();
        }

        if (timeSinceActive >= 2500) {
          edge.active = false;
        }
      } else {
        ctx.strokeStyle = "rgba(75, 85, 99, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });

    // Draw nodes
    const nodeRadius = 36;
    nodesRef.current.forEach((node) => {
      const color = ROLE_COLORS[node.role] || "#6b7280";

      // Outer glow halo for online nodes
      if (node.isOnline) {
        const glowGrad = ctx.createRadialGradient(
          node.x, node.y, nodeRadius * 0.8,
          node.x, node.y, nodeRadius * 2.5
        );
        glowGrad.addColorStop(0, color + "15");
        glowGrad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Node circle with fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      const fillGrad = ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, nodeRadius
      );
      fillGrad.addColorStop(0, node.isOnline ? color + "18" : "#1f293712");
      fillGrad.addColorStop(1, node.isOnline ? color + "08" : "#1f293708");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Node border
      ctx.strokeStyle = node.isOnline ? color + "80" : "#4b556340";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pulsing ring for online nodes
      if (node.isOnline) {
        const pulsePhase = (Math.sin(now / 1000) + 1) / 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4 + pulsePhase * 3, 0, Math.PI * 2);
        ctx.strokeStyle = color + Math.round(20 * (1 - pulsePhase)).toString(16).padStart(2, "0");
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Role label inside node
      ctx.fillStyle = node.isOnline ? "#e5e7eb" : "#6b7280";
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ROLE_LABELS[node.role] || node.role, node.x, node.y);

      // Agent name below node
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillText(node.label, node.x, node.y + nodeRadius + 14);

      // Status dot
      ctx.beginPath();
      ctx.arc(node.x + nodeRadius * 0.65, node.y - nodeRadius * 0.65, 4, 0, Math.PI * 2);
      ctx.fillStyle = node.isOnline ? "#22c55e" : "#6b7280";
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1.5;
      ctx.stroke();
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
      style={{ width: size.width, height: size.height }}
      className="w-full h-full min-h-[300px]"
    />
  );
}
