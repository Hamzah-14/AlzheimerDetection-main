"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Zap,
  Gauge,
  Activity,
  BarChart3,
  Clock3,
  MonitorCog,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

function CardPolish() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-white/[0.03] blur-3xl" />
    </>
  );
}

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const cpuLatency = 1.1;
  const fpgaLatency = 0.42;
  const speedup = (cpuLatency / fpgaLatency).toFixed(1);

  const trendData = [
    { day: "Mon", latency: 0.58, cases: 18 },
    { day: "Tue", latency: 0.54, cases: 21 },
    { day: "Wed", latency: 0.49, cases: 24 },
    { day: "Thu", latency: 0.46, cases: 26 },
    { day: "Fri", latency: 0.44, cases: 28 },
    { day: "Sat", latency: 0.43, cases: 25 },
    { day: "Sun", latency: 0.42, cases: 22 },
  ];

  const pipelineStages = [
    { name: "Upload", latency: 0.12, note: "MRI file intake + validation" },
    {
      name: "Preprocess",
      latency: 0.21,
      note: "Cropping, normalization, formatting",
    },
    {
      name: "Radiomics (3D GLCM)",
      latency: 0.05,
      note: "FPGA-accelerated texture extraction",
    },
    { name: "Classifier", latency: 0.04, note: "Final risk estimation" },
  ];

  const maxPipelineLatency = Math.max(...pipelineStages.map((s) => s.latency));

  const [fpgaLoad, setFpgaLoad] = useState(68);
  const [gpuLoad, setGpuLoad] = useState(51);
  const [boardTemp, setBoardTemp] = useState(47);
  const [throughputLive, setThroughputLive] = useState(3.2);
  const [activePoint, setActivePoint] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setFpgaLoad((v) => {
        const next = v + (Math.random() * 10 - 5);
        return Math.min(92, Math.max(54, Math.round(next)));
      });

      setGpuLoad((v) => {
        const next = v + (Math.random() * 10 - 5);
        return Math.min(88, Math.max(34, Math.round(next)));
      });

      setBoardTemp((v) => {
        const next = v + (Math.random() * 4 - 2);
        return Math.min(58, Math.max(42, Math.round(next)));
      });

      setThroughputLive((v) => {
        const next = v + (Math.random() * 0.4 - 0.2);
        return Math.min(4.1, Math.max(2.6, Number(next.toFixed(1))));
      });
    }, 1400);

    return () => clearInterval(id);
  }, []);

  const thermalRisk =
    boardTemp >= 55 ? "Elevated" : boardTemp >= 50 ? "Moderate" : "Low";

  const headroom =
    fpgaLoad >= 85 ? "Tight" : fpgaLoad >= 70 ? "Moderate" : "Good";

  const bottleneckStage = [...pipelineStages].sort(
    (a, b) => b.latency - a.latency
  )[0];

  const mostAcceleratedStage = "Radiomics (3D GLCM)";

  const chart = useMemo(() => {
    const chartWidth = 700;
    const chartHeight = 220;
    const paddingX = 26;
    const topPad = 18;
    const bottomPad = 34;

    const minLatency = Math.min(...trendData.map((d) => d.latency));
    const maxLatency = Math.max(...trendData.map((d) => d.latency));
    const range = Math.max(maxLatency - minLatency, 0.01);

    const points = trendData.map((item, index) => {
      const x =
        paddingX +
        (index * (chartWidth - paddingX * 2)) / (trendData.length - 1);

      const normalized = (item.latency - minLatency) / range;

      const y =
        chartHeight -
        bottomPad -
        normalized * (chartHeight - topPad - bottomPad);

      return { ...item, x, y };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const areaD = `${pathD} L ${points[points.length - 1].x} ${
      chartHeight - bottomPad
    } L ${points[0].x} ${chartHeight - bottomPad} Z`;

    return {
      chartWidth,
      chartHeight,
      paddingX,
      topPad,
      bottomPad,
      points,
      pathD,
      areaD,
    };
  }, [trendData]);

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            System Analytics
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Hardware acceleration metrics, AI pipeline timing, and clinical
            throughput performance.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
          Deployment: <span className="text-white/90">PYNQ-Z2</span> --- Mode:{" "}
          <span className="text-white/90">Edge inference</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass relative rounded-[28px] p-6">
          <CardPolish />
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Cpu className="h-4 w-4 text-white/50" />
            FPGA Acceleration
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-white/80">CPU baseline</span>
                <span className="text-white/50">{cpuLatency.toFixed(2)}s</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-white/40"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-white/80">FPGA (PYNQ-Z2)</span>
                <span className="text-white/50">{fpgaLatency.toFixed(2)}s</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${(fpgaLatency / cpuLatency) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Speedup</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {speedup}x
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Edge impact</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  Faster inference
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <div className="text-xs text-emerald-200/70">
                Performance takeaway
              </div>
              <p className="mt-1 text-sm leading-6 text-white/70">
                FPGA acceleration reduces inference latency from{" "}
                <span className="text-white/90">{cpuLatency.toFixed(2)}s</span>{" "}
                to{" "}
                <span className="text-white/90">{fpgaLatency.toFixed(2)}s</span>
                , improving responsiveness for clinician-facing workflows and
                edge deployment scenarios.
              </p>
            </div>
          </div>
        </div>

        <div className="glass relative rounded-[28px] p-6">
          <CardPolish />
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Gauge className="h-4 w-4 text-white/50" />
            Pipeline Breakdown
          </div>

          <div className="mt-5 space-y-4">
            {pipelineStages.map((stage) => (
              <div
                key={stage.name}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/80">{stage.name}</span>
                  <span className="text-white/50">
                    {stage.latency.toFixed(2)}s
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-purple-400"
                    style={{
                      width: `${(stage.latency / maxPipelineLatency) * 100}%`,
                    }}
                  />
                </div>

                <div className="mt-2 text-xs text-white/55">{stage.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass relative rounded-[28px] p-6">
        <CardPolish />
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Activity className="h-4 w-4 text-white/50" />
          Throughput
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Cases processed today</div>
            <div className="mt-1 text-2xl font-semibold text-white">28</div>
            <div className="mt-2 text-xs text-emerald-300/80">
              --- 12% vs yesterday
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Queue size</div>
            <div className="mt-1 text-2xl font-semibold text-white">3</div>
            <div className="mt-2 text-xs text-white/55">
              Stable low processing backlog
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Avg inference latency</div>
            <div className="mt-1 text-2xl font-semibold text-white">0.42s</div>
            <div className="mt-2 text-xs text-white/55">
              Clinical-ready response time
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="glass relative rounded-[28px] p-6">
            <CardPolish />
            <div className="flex items-center gap-2 text-sm text-white/70">
              <BarChart3 className="h-4 w-4 text-white/50" />
              Weekly Latency Trend
            </div>

            <div className="mt-5">
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <svg
                  viewBox={`0 0 ${chart.chartWidth} ${chart.chartHeight}`}
                  className="h-[250px] w-full"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="latencyLine" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="rgba(34,211,238,0.95)" />
                      <stop offset="50%" stopColor="rgba(56,189,248,0.95)" />
                      <stop offset="100%" stopColor="rgba(16,185,129,0.95)" />
                    </linearGradient>

                    <linearGradient id="latencyArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34,211,238,0.30)" />
                      <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
                    </linearGradient>

                    <filter id="lineGlow">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <filter id="pointGlow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {[0, 1, 2, 3].map((i) => {
                    const y =
                      chart.topPad +
                      (i * (chart.chartHeight - chart.topPad - chart.bottomPad)) /
                        3;
                    return (
                      <line
                        key={i}
                        x1={chart.paddingX}
                        x2={chart.chartWidth - chart.paddingX}
                        y1={y}
                        y2={y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="4 6"
                      />
                    );
                  })}

                  {activePoint !== null && (
                    <line
                      x1={chart.points[activePoint].x}
                      x2={chart.points[activePoint].x}
                      y1={chart.topPad}
                      y2={chart.chartHeight - chart.bottomPad}
                      stroke="rgba(34,211,238,0.35)"
                      strokeDasharray="5 6"
                    />
                  )}

                  <path d={chart.areaD} fill="url(#latencyArea)" />

                  <path
                    d={chart.pathD}
                    fill="none"
                    stroke="url(#latencyLine)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#lineGlow)"
                    className="animate-[drawLine_1.4s_ease-out_forwards]"
                    style={{
                      strokeDasharray: 2000,
                      strokeDashoffset: 2000,
                    }}
                  />

                  <path
                    d={chart.pathD}
                    fill="none"
                    stroke="url(#latencyLine)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-[drawLine_1.4s_ease-out_forwards]"
                    style={{
                      strokeDasharray: 2000,
                      strokeDashoffset: 2000,
                    }}
                  />

                  {chart.points.map((p, i) => (
                    <g key={p.day}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={activePoint === i ? "11" : "6"}
                        fill="rgba(34,211,238,0.14)"
                        filter={activePoint === i ? "url(#pointGlow)" : undefined}
                        className={
                          activePoint === i ? "animate-[pulse_1.6s_ease-in-out_infinite]" : ""
                        }
                        style={{
                          animationDelay: `${0.18 * i}s`,
                          opacity: activePoint === i ? 1 : 0.85,
                        }}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={activePoint === i ? "5.5" : "3.5"}
                        fill="rgba(34,211,238,0.95)"
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth="1"
                        className="animate-[fadePoint_0.5s_ease-out_forwards]"
                        style={{
                          animationDelay: `${0.18 * i}s`,
                          opacity: activePoint === i ? 1 : 0,
                        }}
                      />
                      <text
                        x={p.x}
                        y={chart.chartHeight - 10}
                        textAnchor="middle"
                        fontSize="12"
                        fill="rgba(255,255,255,0.58)"
                      >
                        {p.day}
                      </text>
                    </g>
                  ))}

                  {chart.points.map((p, i) => (
                    <g key={`${p.day}-hover`}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="14"
                        fill="transparent"
                        onMouseEnter={() => setActivePoint(i)}
                        onMouseLeave={() => setActivePoint(null)}
                        style={{ cursor: "pointer" }}
                      />
                    </g>
                  ))}

                  {activePoint !== null && (
                    <g>
                      <rect
                        x={Math.min(
                          chart.chartWidth - 126,
                          Math.max(8, chart.points[activePoint].x - 63)
                        )}
                        y={Math.max(8, chart.points[activePoint].y - 58)}
                        width="126"
                        height="42"
                        rx="12"
                        fill="rgba(8,12,16,0.92)"
                        stroke="rgba(255,255,255,0.12)"
                      />
                      <text
                        x={Math.min(
                          chart.chartWidth - 63,
                          Math.max(71, chart.points[activePoint].x)
                        )}
                        y={Math.max(31, chart.points[activePoint].y - 34)}
                        textAnchor="middle"
                        fontSize="11"
                        fill="rgba(255,255,255,0.55)"
                      >
                        {chart.points[activePoint].day}
                      </text>
                      <text
                        x={Math.min(
                          chart.chartWidth - 63,
                          Math.max(71, chart.points[activePoint].x)
                        )}
                        y={Math.max(49, chart.points[activePoint].y - 16)}
                        textAnchor="middle"
                        fontSize="14"
                        fill="rgba(255,255,255,0.95)"
                        fontWeight="600"
                      >
                        {chart.points[activePoint].latency.toFixed(2)}s
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Best latency</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    0.42s
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Weekly average</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    0.48s
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Trend</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-300">
                    Improving
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass relative rounded-[28px] p-6">
            <CardPolish />
            <div className="flex items-center gap-2 text-sm text-white/70">
              <FileText className="h-4 w-4 text-white/50" />
              Optimization Summary
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Biggest gain</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Radiomics
                </div>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  3D GLCM extraction shows the strongest acceleration benefit.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Best deployment fit</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Edge FPGA
                </div>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Low-latency execution makes the pipeline suitable for portable
                  demos.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Current outlook</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  Stable
                </div>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Metrics indicate consistent throughput with manageable thermal
                  load.
                </p>
              </div>
            </div>
          </div>

          <div className="glass relative rounded-[28px] p-5">
            <CardPolish />
            <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
              <AlertTriangle className="h-4 w-4 text-white/50" />
              Bottleneck Watch
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="text-[11px] text-white/50">
                  Current bottleneck
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {bottleneckStage.name}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-white/60">
                  Highest runtime share at {bottleneckStage.latency.toFixed(2)}s.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="text-[11px] text-white/50">
                  Most accelerated stage
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {mostAcceleratedStage}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-white/60">
                  Strongest hardware benefit during feature extraction.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="text-[11px] text-white/50">Thermal risk</div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    thermalRisk === "Elevated"
                      ? "text-red-300"
                      : thermalRisk === "Moderate"
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }`}
                >
                  {thermalRisk}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-white/60">
                  Board temp currently {boardTemp}--C.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="text-[11px] text-white/50">
                  System headroom
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    headroom === "Tight"
                      ? "text-red-300"
                      : headroom === "Moderate"
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }`}
                >
                  {headroom}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-white/60">
                  FPGA utilization suggests {headroom.toLowerCase()} margin.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass relative rounded-[28px] p-6">
            <CardPolish />
            <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
              <MonitorCog className="h-4 w-4 text-white/50" />
              Live Performance Meter
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/80">FPGA Utilization</span>
                  <span className="text-emerald-300">{fpgaLoad}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 transition-all duration-700"
                    style={{ width: `${fpgaLoad}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/80">GPU Assist Load</span>
                  <span className="text-blue-300">{gpuLoad}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 transition-all duration-700"
                    style={{ width: `${gpuLoad}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Board temp</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {boardTemp}--C
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Live throughput</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {throughputLive} scans/min
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass relative rounded-[28px] p-6">
            <CardPolish />
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Clock3 className="h-4 w-4 text-white/50" />
              System Notes
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-white/70">Deployment status</div>
                <div className="mt-1 text-xl font-semibold text-white">
                  Edge-ready inference
                </div>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  The current platform is optimized for low-latency scan analysis
                  using a PYNQ-Z2 FPGA target, making it suitable for edge-ready
                  deployment demonstrations and responsive inference workflows.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-white/70">Hardware insight</div>
                <div className="mt-1 text-xl font-semibold text-white">
                  Radiomics stage benefits most
                </div>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  The 3D GLCM radiomics extraction stage shows the strongest
                  acceleration benefit relative to CPU execution and remains the
                  most important contributor to overall hardware efficiency gains.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-white/70">Operational note</div>
                <div className="mt-1 text-xl font-semibold text-white">
                  Stable workflow performance
                </div>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  Low queue depth, steady latency, and controlled thermal behavior
                  indicate that the platform is suitable for smooth clinical
                  decision support demos without noticeable runtime instability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}