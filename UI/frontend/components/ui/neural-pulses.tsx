// frontend/components/ui/neural-pulses.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Node = { x: number; y: number };
type Edge = { a: number; b: number };

function seededRand(seed: number) {
  // deterministic pseudo-random (so it looks stable across refresh)
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export default function NeuralPulses() {
  const [pulse, setPulse] = useState<{ x: number; y: number; t: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Build a stable network
  const { nodes, edges } = useMemo(() => {
    const rand = seededRand(1337);
    const N = 26; // keep modest for perf
    const nodes: Node[] = Array.from({ length: N }, () => ({
      x: Math.round(rand() * 1000) / 10, // 0..100 (% with 0.1 precision)
      y: Math.round(rand() * 1000) / 10,
    }));

    // connect each node to 2 nearest neighbors (simple + clean)
    const edges: Edge[] = [];
    for (let i = 0; i < N; i++) {
      const dists = nodes
        .map((p, j) => ({
          j,
          d: (p.x - nodes[i].x) ** 2 + (p.y - nodes[i].y) ** 2,
        }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);

      for (const k of dists) {
        const a = Math.min(i, k.j);
        const b = Math.max(i, k.j);
        if (!edges.some((e) => e.a === a && e.b === b)) edges.push({ a, b });
      }
    }

    return { nodes, edges };
  }, []);

  useEffect(() => {
    // Attach hover listeners to cards
    const selector = ".pulse-trigger";
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));

    const onEnter = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;

      // bump time so CSS animation restarts reliably
      setPulse({ x, y, t: Date.now() });

      // remove pulse after a short time
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const tick = (now: number) => {
        if (now - start > 900) {
          setPulse(null);
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      // optional: update pulse position while hovering (subtle)
      if (!pulse) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setPulse((p) => (p ? { ...p, x, y } : null));
    };

    els.forEach((el) => {
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointermove", onMove);
    });

    return () => {
      els.forEach((el) => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointermove", onMove);
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Static network */}
      <svg className="h-full w-full">
        <g className="neural-lines">
          {edges.map((e, idx) => {
            const a = nodes[e.a];
            const b = nodes[e.b];
            return (
              <line
                key={idx}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                className="neural-line"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="neural-nodes">
          {nodes.map((n, i) => (
            <circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r="1.4" className="neural-node" />
          ))}
        </g>

        {/* Pulse */}
        {pulse && (
          <g key={pulse.t} className="neural-pulse">
            <circle cx={`${pulse.x}%`} cy={`${pulse.y}%`} r="6" className="pulse-core" />
            <circle cx={`${pulse.x}%`} cy={`${pulse.y}%`} r="6" className="pulse-ring" />
          </g>
        )}
      </svg>

      {/* A super soft vignette to blend */}
      <div className={cn("absolute inset-0")} />
    </div>
  );
}