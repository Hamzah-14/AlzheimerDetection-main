"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Brain,
  Cpu,
  Zap,
  ArrowRight,
  Activity,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  GripHorizontal,
  Upload,
  FileText,
  TrendingUp,
  TrendingDown,
  Scan,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

/* -------------------------------------------------------------
   Local theme hook --- reads data-theme directly (ThemeProvider
   only lives inside (app)/layout; this page is outside it).
------------------------------------------------------------- */
function useLocalTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const read = () => {
      setTheme(
        (document.documentElement.getAttribute("data-theme") as
          | "dark"
          | "light") ?? "dark"
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("synapse-theme", next);
    } catch {}
  };

  return { theme, toggle };
}

/* -------------------------------------------------------------
   3-D Neural-Network Canvas
------------------------------------------------------------- */
interface Node3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  pulsePhase: number;
}

interface Pulse {
  edgeIdx: number;
  t: number;
  speed: number;
  color: string;
}

const PULSE_COLORS = [
  "rgba(168,85,247,",
  "rgba(59,130,246,",
  "rgba(16,185,129,",
  "rgba(139,92,246,",
];

function NeuralCanvas({ theme }: { theme: "dark" | "light" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node3D[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const rotRef = useRef({ x: 0.3, y: 0.5 });
  const velRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  /* Build Fibonacci sphere nodes once */
  useEffect(() => {
    const COUNT = 60;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const nodes: Node3D[] = [];

    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      nodes.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    nodesRef.current = nodes;

    /* Edges: connect each node to its 3 nearest neighbours */
    const edges: [number, number][] = [];
    const edgeSet = new Set<string>();
    for (let i = 0; i < COUNT; i++) {
      const dists = nodes.map((n, j) => ({
        j,
        d: Math.hypot(nodes[i].x - n.x, nodes[i].y - n.y, nodes[i].z - n.z),
      }));
      dists.sort((a, b) => a.d - b.d);
      for (let k = 1; k <= 3; k++) {
        const key = [Math.min(i, dists[k].j), Math.max(i, dists[k].j)].join("-");
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([i, dists[k].j]);
        }
      }
    }
    edgesRef.current = edges;
  }, []);

  /* Pointer drag handlers */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    velRef.current.y += dx * 0.006;
    velRef.current.x += dy * 0.006;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  }, []);
  const onMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    dragRef.current = { active: true, lastX: t.clientX, lastY: t.clientY };
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.active) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.lastX;
    const dy = t.clientY - dragRef.current.lastY;
    velRef.current.y += dx * 0.006;
    velRef.current.x += dy * 0.006;
    dragRef.current.lastX = t.clientX;
    dragRef.current.lastY = t.clientY;
  }, []);

  /* Render loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dark = theme === "dark";

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* Project 3-D point --- 2-D screen with perspective */
    const project = (x: number, y: number, z: number) => {
      const cx = rotRef.current.x;
      const cy = rotRef.current.y;
      const x1 = x * Math.cos(cy) - z * Math.sin(cy);
      const z1 = x * Math.sin(cy) + z * Math.cos(cy);
      const y2 = y * Math.cos(cx) - z1 * Math.sin(cx);
      const z2 = y * Math.sin(cx) + z1 * Math.cos(cx);
      const fov = 2.8;
      const scale = fov / (fov + z2 + 1.6);
      const w = canvas.width;
      const h = canvas.height;
      return {
        sx: w / 2 + x1 * scale * (w * 0.38),
        sy: h / 2 + y2 * scale * (h * 0.38),
        scale,
        depth: z2,
      };
    };

    const draw = () => {
      frameRef.current++;
      const t = frameRef.current;

      /* Auto-rotate */
      if (!dragRef.current.active) {
        velRef.current.y += 0.0003;
        velRef.current.x += Math.sin(t * 0.0008) * 0.00012;
      }
      velRef.current.x *= 0.94;
      velRef.current.y *= 0.94;
      rotRef.current.x += velRef.current.x;
      rotRef.current.y += velRef.current.y;

      /* Breathing scale */
      const nodes = nodesRef.current;
      nodes.forEach((n) => {
        const s = 1 + 0.018 * Math.sin(t * 0.04 + n.pulsePhase);
        n.x = n.baseX * s;
        n.y = n.baseY * s;
        n.z = n.baseZ * s;
      });

      /* Spawn pulses */
      if (t % 18 === 0) {
        const edges = edgesRef.current;
        const idx = Math.floor(Math.random() * edges.length);
        pulsesRef.current.push({
          edgeIdx: idx,
          t: 0,
          speed: 0.012 + Math.random() * 0.016,
          color: PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)],
        });
      }

      /* Tick pulses */
      pulsesRef.current = pulsesRef.current
        .map((p) => ({ ...p, t: p.t + p.speed }))
        .filter((p) => p.t < 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const projected = nodes.map((n, i) => ({ i, ...project(n.x, n.y, n.z) }));
      projected.sort((a, b) => a.depth - b.depth);

      /* A fast lookup: nodeIndex --- projected data */
      const projMap = new Map(projected.map((p) => [p.i, p]));

      const edgeAlpha = dark ? 0.22 : 0.14;
      const edgeColor = dark
        ? `rgba(139,92,246,${edgeAlpha})`
        : `rgba(79,70,229,${edgeAlpha})`;

      /* Draw edges */
      edgesRef.current.forEach(([a, b]) => {
        const pA = projMap.get(a);
        const pB = projMap.get(b);
        if (!pA || !pB) return;
        ctx.beginPath();
        ctx.moveTo(pA.sx, pA.sy);
        ctx.lineTo(pB.sx, pB.sy);
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      /* Draw pulse dots */
      pulsesRef.current.forEach((pulse) => {
        const [a, b] = edgesRef.current[pulse.edgeIdx];
        const pA = projMap.get(a);
        const pB = projMap.get(b);
        if (!pA || !pB) return;
        const px = pA.sx + (pB.sx - pA.sx) * pulse.t;
        const py = pA.sy + (pB.sy - pA.sy) * pulse.t;
        const alpha = Math.sin(pulse.t * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color + alpha + ")";
        ctx.fill();
      });

      /* Draw nodes */
      projected.forEach(({ i, sx, sy, scale, depth }) => {
        const depth01 = (depth + 1.6) / 3.2;
        const r = scale * 7;
        const alpha = 0.35 + depth01 * 0.55;

        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
        grd.addColorStop(0, `rgba(168,85,247,${alpha * 0.35})`);
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? `rgba(192,132,252,${alpha})`
          : `rgba(124,58,237,${alpha})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onMouseUp}
    />
  );
}

/* -------------------------------------------------------------
   Scroll-reveal wrapper
------------------------------------------------------------- */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
      transition={{
        duration: 0.7,
        delay: inView ? delay : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------
   Animated counter
------------------------------------------------------------- */
function StatCounter({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-40px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) {
      setCount(0);
      return;
    }
    let cur = 0;
    const steps = 60;
    const step = value / steps;
    const id = setInterval(() => {
      cur += step;
      if (cur >= value) {
        setCount(value);
        clearInterval(id);
      } else {
        setCount(Math.floor(cur));
      }
    }, 18);
    return () => clearInterval(id);
  }, [inView, value]);

  return (
    <Reveal delay={delay} className="text-center">
      <div ref={ref} className="text-5xl font-bold text-white/90 tabular-nums">
        {count}
        <span className="text-purple-400">{suffix}</span>
      </div>
      <div className="mt-2 text-sm text-white/50 uppercase tracking-widest">
        {label}
      </div>
    </Reveal>
  );
}

/* -------------------------------------------------------------
   Animated Dashboard Mockup
------------------------------------------------------------- */
const MOCK_CASES = [
  { id: "SYN-0041", region: "Hippocampus",    risk: "High",   lat: "0.41 s", conf: "91%" },
  { id: "SYN-0040", region: "Entorhinal",     risk: "Medium", lat: "0.38 s", conf: "76%" },
  { id: "SYN-0039", region: "Prefrontal",     risk: "Low",    lat: "0.44 s", conf: "88%" },
];

function DashboardMockup() {
  const { theme } = useLocalTheme();
  const [phase, setPhase] = useState<"loading" | "ready" | "alert">("loading");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("ready"), 900);
    const t2 = setTimeout(() => setPhase("alert"), 3200);
    const t3 = setTimeout(() => { setPhase("loading"); setCycle(c => c + 1); }, 5800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cycle]);

  const ready = phase !== "loading";
  const isLight = theme === "light";

  return (
    /* outer browser-chrome frame */
    <div
      className="w-full overflow-hidden rounded-[20px] border transition-colors duration-300"
      style={{
        background: isLight ? "rgba(252, 251, 255, 0.97)" : "#07070b",
        borderColor: isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.10)",
        boxShadow: isLight
          ? "0 20px 60px rgba(0,0,0,0.10), 0 4px 20px rgba(100,60,220,0.08)"
          : "0 40px 100px rgba(0,0,0,0.70)",
      }}
    >

      {/* window chrome bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500/60" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
        <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
        <div className="mx-auto flex w-52 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          synapse.pl/dashboard
        </div>
      </div>

      <div className="flex h-[340px]">
        {/* mini sidebar */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-white/[0.07] bg-black/40 py-4">
          <Brain className="h-5 w-5 text-purple-400" />
          <div className="mt-2 flex flex-col gap-3">
            {[Activity, Cpu, FileText, Scan].map((Icon, i) => (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${i === 0 ? "bg-purple-500/20 text-purple-300" : "text-white/25"}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* mini topbar */}
          <div className="flex items-center gap-2 border-b border-white/[0.07] bg-black/20 px-4 py-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-white/30">
              <Activity className="h-3 w-3" />
              Search cases---
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Online
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-3">
            {/* stat cards row */}
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { label: "Cases",   val: 28, trend: +12, color: "text-purple-300" },
                { label: "Latency", val: "0.42s", trend: -62, color: "text-white/80" },
                { label: "High Risk", val: 6, trend: +50, color: "text-purple-300" },
                { label: "Queue",   val: 3, trend: -25, color: "text-emerald-300" },
              ].map(({ label, val, trend, color }, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-2 transition-opacity duration-500"
                  style={{ opacity: ready ? 1 : 0, transitionDelay: `${i * 80}ms` }}
                >
                  <div className="text-[9px] text-white/35">{label}</div>
                  {ready ? (
                    <>
                      <div className={`mt-0.5 text-sm font-bold ${color}`}>{val}</div>
                      <div className={`mt-0.5 flex items-center gap-0.5 text-[9px] ${trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {trend > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {Math.abs(trend)}%
                      </div>
                    </>
                  ) : (
                    <div className="mt-1.5 h-4 w-10 animate-pulse rounded bg-white/10" />
                  )}
                </div>
              ))}
            </div>

            {/* case table */}
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              <div className="grid grid-cols-5 bg-white/[0.04] px-3 py-1.5 text-[9px] text-white/30">
                {["Case ID", "Region", "Risk", "Latency", "Confidence"].map(h => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              {MOCK_CASES.map((row, i) => (
                <div
                  key={row.id}
                  className="grid grid-cols-5 items-center border-t border-white/[0.05] px-3 py-2 text-[9px] transition-all duration-700"
                  style={{
                    opacity: ready ? 1 : 0,
                    transitionDelay: `${i * 100 + 200}ms`,
                    background: phase === "alert" && row.risk === "High"
                      ? "rgba(239,68,68,0.08)"
                      : "transparent",
                  }}
                >
                  <span className="text-white/60">{row.id}</span>
                  <span className="text-white/50">{row.region}</span>
                  <span className={
                    "w-fit rounded-lg px-1.5 py-0.5 text-[8px] font-medium " +
                    (row.risk === "High"
                      ? "bg-red-400/15 text-red-300"
                      : row.risk === "Medium"
                      ? "bg-amber-400/15 text-amber-300"
                      : "bg-cyan-400/15 text-cyan-300")
                  }>
                    {row.risk}
                    {phase === "alert" && row.risk === "High" && " ---"}
                  </span>
                  <span className="text-white/45">{row.lat}</span>
                  <span className="text-white/45">{row.conf}</span>
                </div>
              ))}
            </div>

            {/* status bar */}
            <div className="mt-2 flex items-center justify-between text-[9px] text-white/25">
              <span>
                {phase === "loading" && "Loading data---"}
                {phase === "ready" && "28 cases processed -- Last sync: just now"}
                {phase === "alert" && "--- High-risk case detected -- Review recommended"}
              </span>
              <span className={`transition-colors duration-500 ${phase === "alert" ? "text-red-400" : "text-emerald-400"}`}>
                {phase === "loading" ? "Syncing---" : "Live"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   How It Works --- 3 visual steps
------------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Upload,
      title: "Upload MRI Scan",
      desc: "Drop a NIfTI or DICOM file. The platform handles skull-stripping, normalisation, and registration automatically.",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      glow: "rgba(168,85,247,0.15)",
      delay: 0,
    },
    {
      num: "02",
      icon: Cpu,
      title: "FPGA AI Analysis",
      desc: "A PYNQ-Z2 FPGA offloads the convolutional pipeline. 3-D GLCM radiomics + deep classifier returns per-region risk in under 500 ms.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      glow: "rgba(59,130,246,0.15)",
      delay: 0.14,
    },
    {
      num: "03",
      icon: FileText,
      title: "Clinical Report",
      desc: "Grad-CAM heatmaps, SHAP attribution, and a plain-language risk summary --- ready to export to PDF or share with a specialist.",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "rgba(16,185,129,0.15)",
      delay: 0.28,
    },
  ] as const;

  return (
    <section className="relative z-10 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 text-center">
          <span className="mb-4 inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-purple-300">
            How It Works
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Three steps. Under 500 ms.
          </h2>
          <p className="mt-4 text-white/50">
            From raw scan to actionable clinical insight --- no manual configuration required.
          </p>
        </Reveal>

        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* connecting line between cards */}
          <div className="pointer-events-none absolute left-[calc(33.3%+1rem)] right-[calc(33.3%+1rem)] top-14 hidden h-px bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-emerald-500/30 sm:block" />

          {steps.map(({ num, icon: Icon, title, desc, color, bg, border, glow, delay }) => (
            <Reveal key={num} delay={delay}>
              <div
                className={`relative h-full rounded-3xl border ${border} bg-white/[0.03] p-8 backdrop-blur transition duration-300 hover:bg-white/[0.055]`}
                style={{ boxShadow: `0 0 40px ${glow}` }}
              >
                {/* big step number watermark */}
                <span className="pointer-events-none absolute right-6 top-4 select-none text-6xl font-black text-white/[0.04]">
                  {num}
                </span>

                {/* icon bubble */}
                <div className={`mb-5 inline-flex items-center justify-center rounded-2xl ${bg} p-4`}>
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>

                <h3 className="mb-3 text-lg font-semibold text-white/90">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{desc}</p>

                {/* step number badge */}
                <div className={`mt-6 inline-flex items-center gap-1 rounded-full border ${border} ${bg} px-2.5 py-1 text-[11px] font-semibold ${color} uppercase tracking-widest`}>
                  Step {num}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------
   Landing Page
------------------------------------------------------------- */
export default function LandingPage() {
  usePageTitle("Synapse.PL");
  const router = useRouter();
  const { theme, toggle } = useLocalTheme();
  const dark = theme === "dark";

  /* Drag hint fades out after 3.5 s */
  const [showDragHint, setShowDragHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowDragHint(false), 3500);
    return () => clearTimeout(t);
  }, []);

  /* Navigate to dashboard --- always set the tour flag so the auto-tour
     fires every time the user enters from the landing page.
     The sessionStorage key is consumed (removed) the moment the dashboard
     reads it, so navigating around inside the app never re-triggers it. */
  const goToDashboard = () => {
    try {
      sessionStorage.setItem("synapse-show-tour", "1");
    } catch {}
    router.push("/dashboard");
  };

  return (
    <div className={`relative min-h-screen overflow-x-hidden font-sans ${dark ? "text-white" : "text-[#0f0e1a]"}`}>

      {/* -- Navbar --------------------------------------------- */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.07] bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-400" />
            <span className="text-lg font-semibold tracking-tight text-white">
              Synapse<span className="text-purple-400">.PL</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={() => goToDashboard()}
              className="flex items-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 transition hover:border-purple-400/60 hover:bg-purple-500/20 hover:text-purple-200"
            >
              Open Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* -- Hero ----------------------------------------------- */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16">
        {/* Interactive 3-D canvas */}
        <div className="absolute inset-0 z-0">
          <NeuralCanvas theme={theme} />
        </div>

        {/* Vignette softens canvas edges */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,transparent_30%,rgba(3,3,9,0.75)_100%)]" />

        {/* Copy */}
        <div className="relative z-[2] flex flex-col items-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300 uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              FPGA-Accelerated -- Live Inference
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Detect Alzheimer&apos;s
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Before It Progresses
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/60"
          >
            Upload a raw MRI scan. Get a{" "}
            <span className="text-white/85">per-region risk score</span>,{" "}
            <span className="text-white/85">Grad-CAM heatmap</span>, and{" "}
            <span className="text-white/85">physician-ready PDF</span> ---
            FPGA-processed at the edge in{" "}
            <span className="text-emerald-400">under 500 ms</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <button
              onClick={() => goToDashboard()}
              className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-purple-500/40 hover:from-purple-500 hover:to-blue-500"
            >
              Enter Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <a
              href="#features"
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              See how it works
            </a>
          </motion.div>
        </div>

        {/* Drag-to-rotate hint --- fades out after 3.5 s */}
        <AnimatePresence>
          {showDragHint && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="absolute bottom-24 right-8 z-[3] flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/45 backdrop-blur-sm"
            >
              <GripHorizontal className="h-3.5 w-3.5" />
              Drag to rotate
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-10 z-[2] flex flex-col items-center gap-2"
        >
          <span className="text-xs uppercase tracking-widest text-white/30">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <ChevronDown className="h-4 w-4 text-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* -- Stats strip ---------------------------------------- */}
      <section className="relative z-10 border-y border-white/[0.06] bg-black/20 backdrop-blur-sm">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 px-8 py-16 sm:grid-cols-4">
          <StatCounter value={94}   suffix="%" label="Diagnostic Accuracy"  delay={0}    />
          <StatCounter value={420}  suffix="ms" label="Inference Latency"    delay={0.1}  />
          <StatCounter value={12}   suffix="k+" label="MRI Scans Processed"  delay={0.2}  />
          <StatCounter value={6}    suffix="x"  label="Faster than CPU"      delay={0.3}  />
        </div>
      </section>

      {/* -- Animated demo -------------------------------------- */}
      <section className="relative z-10 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              See it in action
            </h2>
            <p className="mt-4 text-white/50">
              Watch the platform detect a high-risk case in real time.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <DashboardMockup />
          </Reveal>
        </div>
      </section>

      {/* -- How it works --------------------------------------- */}
      <HowItWorks />

      {/* -- Features ------------------------------------------- */}
      <section id="features" className="relative z-10 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for Clinical Precision
            </h2>
            <p className="mt-4 text-white/50">
              Every layer of the pipeline --- from scan to report --- is engineered
              for speed and interpretability.
            </p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-3">
            {([
              {
                icon: Brain,
                title: "3-D MRI Analysis",
                desc: "Multi-region volumetric analysis across hippocampus, entorhinal cortex, and prefrontal regions with sub-millimetre precision.",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
                delay: 0,
              },
              {
                icon: Cpu,
                title: "FPGA Acceleration",
                desc: "PYNQ-Z2 FPGA offloads convolutional inference, slashing latency from seconds to milliseconds with deterministic timing guarantees.",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                delay: 0.12,
              },
              {
                icon: ShieldCheck,
                title: "Explainable AI",
                desc: "Grad-CAM heatmaps, SHAP feature attribution, and plain-language clinical summaries so every prediction is fully auditable.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
                delay: 0.24,
              },
            ] as const).map(({ icon: Icon, title, desc, color, bg, border, delay }) => (
              <Reveal key={title} delay={delay}>
                <div className={`glass glow-hover pulse-trigger h-full rounded-3xl border ${border} p-8`}>
                  <div className={`mb-5 inline-flex rounded-2xl ${bg} p-3`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-white/90">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -- Pipeline ------------------------------------------- */}
      <section className="relative z-10 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From Scan to Insight
            </h2>
            <p className="mt-4 text-white/50">Five stages, under 500 ms.</p>
          </Reveal>

          <div className="relative">

            <div className="flex flex-col gap-10">
              {([
                { step: "01", title: "DICOM Ingestion",       desc: "NIfTI / DICOM upload with on-the-fly skull-stripping and intensity normalisation.",                                                              icon: Activity,    color: "text-purple-400", delay: 0    },
                { step: "02", title: "FPGA Preprocessing",    desc: "Hardware-accelerated registration and histogram equalisation streamed directly to the inference engine.",                                          icon: Cpu,         color: "text-blue-400",   delay: 0.1  },
                { step: "03", title: "Deep Network Inference", desc: "3-D CNN scores Braak stages across six cortical regions, returning a probability vector per voxel cluster.",                                      icon: Brain,       color: "text-violet-400", delay: 0.2  },
                { step: "04", title: "Explainability Layer",  desc: "Grad-CAM + SHAP attribution overlaid on the original scan, highlighting which regions drove the prediction.",                                     icon: ShieldCheck, color: "text-emerald-400",delay: 0.3  },
                { step: "05", title: "Clinical Report",       desc: "Auto-generated PDF report with risk tier, confidence intervals, and region-by-region breakdown for the physician.",                              icon: Zap,         color: "text-amber-400",  delay: 0.4  },
              ] as const).map(({ step, title, desc, icon: Icon, color, delay }) => (
                <Reveal key={step} delay={delay} className="flex items-start gap-6 sm:pl-16">
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/60 backdrop-blur">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="pt-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/25">Step {step}</span>
                    <h3 className="mt-1 text-base font-semibold text-white/85">{title}</h3>
                    <p className="mt-1 text-sm text-white/45">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- CTA ------------------------------------------------ */}
      <section className="relative z-10 py-32">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[420px] w-[600px] rounded-full bg-purple-600/10 blur-[100px]" />
        </div>

        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to accelerate
            <br />
            your diagnostics?
          </h2>
          <p className="mt-6 text-lg text-white/50">
            Open the dashboard to analyse your first case --- no setup required.
          </p>

          <button
            onClick={() => goToDashboard()}
            className="group mt-10 inline-flex items-center gap-3 rounded-3xl bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-500 px-10 py-4 text-base font-semibold text-white shadow-2xl shadow-purple-500/20 transition-all hover:shadow-purple-500/40 hover:scale-[1.03]"
          >
            Open Dashboard
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </Reveal>
      </section>

      {/* -- Footer --------------------------------------------- */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 text-center text-xs text-white/25">
        -- {new Date().getFullYear()} Synapse.PL -- Hybrid AI + Clinical Diagnostic System
      </footer>
    </div>
  );
}
