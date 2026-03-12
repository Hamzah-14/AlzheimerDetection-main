"use client";

import { motion } from "framer-motion";

type Node = { x: number; y: number; r: number };
type Edge = { a: number; b: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function NeuralLines({
  density = 18,
  opacity = 0.12,
}: {
  density?: number;
  opacity?: number;
}) {
  // Create deterministic-ish nodes without randomness (no hydration mismatch)
  const nodes: Node[] = Array.from({ length: density }, (_, i) => {
    const t = i / density;

    // Spread nodes across screen with slight curvature patterns
    const x = 10 + (t * 85) + (Math.sin(i * 1.7) * 6);
    const y = 12 + ((i * 37) % 78) + (Math.cos(i * 1.3) * 5);

    // Small node radius variance
    const r = 1.2 + (i % 4) * 0.25;

    return { x: clamp(x, 6, 94), y: clamp(y, 6, 94), r };
  });

  // Connect each node to a couple near it (simple pattern)
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (i + 3 < nodes.length) edges.push({ a: i, b: i + 3 });
    if (i + 5 < nodes.length) edges.push({ a: i, b: i + 5 });
    if (i % 4 === 0 && i + 7 < nodes.length) edges.push({ a: i, b: i + 7 });
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity }}
      animate={{
        // slow drift (subtle)
        x: [0, 14, -10, 0],
        y: [0, -8, 10, 0],
      }}
      transition={{
        duration: 24,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Soft glow for lines */}
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for lines */}
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.75)" />
            <stop offset="55%" stopColor="rgba(59,130,246,0.65)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0.55)" />
          </linearGradient>

          {/* Gradient for nodes */}
          <radialGradient id="nodeGrad">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="45%" stopColor="rgba(168,85,247,0.7)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.0)" />
          </radialGradient>
        </defs>

        {/* Edges */}
        <g filter="url(#softGlow)">
          {edges.map((e, idx) => {
            const A = nodes[e.a];
            const B = nodes[e.b];
            return (
              <line
                key={idx}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="url(#lineGrad)"
                strokeWidth="0.25"
                opacity="0.55"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g filter="url(#softGlow)">
          {nodes.map((n, idx) => (
            <circle
              key={idx}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="url(#nodeGrad)"
              opacity={idx % 3 === 0 ? 0.9 : 0.6}
            />
          ))}
        </g>
      </svg>
    </motion.div>
  );
}