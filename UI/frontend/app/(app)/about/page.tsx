"use client";

import { usePageTitle } from "@/lib/use-page-title";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Cpu,
  BrainCircuit,
  Code2,
  Layers,
  Github,
  Zap,
  Shield,
  Activity,
  Database,
  Globe,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial:   { opacity: 0, y: 18 },
  animate:   { opacity: 1, y: 0 },
  transition:{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay },
});

// ------ Team ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const TEAM = [
  {
    name:   "Vikram",
    role:   "FPGA Hardware & Web Platform",
    detail: "Designed and built the FPGA inference pipeline on the PYNQ-Z2 Zynq-7020. Also architected and developed the full Synapse.PL web platform.",
    icon:   Cpu,
    color:  "from-purple-500/20 to-violet-600/10",
    border: "border-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    name:   "Hamzah",
    role:   "Machine Learning & Data",
    detail: "Built the 3D GLCM feature extraction pipeline and trained the AD/MCI/NC classification model on hippocampal MRI data.",
    icon:   BrainCircuit,
    color:  "from-cyan-500/20 to-blue-600/10",
    border: "border-cyan-500/20",
    iconColor: "text-cyan-400",
  },
  {
    name:   "Ahmed",
    role:   "Software Integration",
    detail: "Led the integration between the FPGA hardware layer, the ML inference pipeline, and the platform frontend.",
    icon:   Layers,
    color:  "from-emerald-500/20 to-green-600/10",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    name:   "Abderahman",
    role:   "Software Development",
    detail: "Contributed to the software development side of the project, supporting the build-out of core platform components.",
    icon:   Code2,
    color:  "from-amber-500/20 to-orange-600/10",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
];

// ------ Tech stack ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const STACK = [
  { label: "FPGA Hardware",    value: "PYNQ-Z2 Zynq-7020",          icon: Cpu      },
  { label: "Feature Pipeline", value: "3D GLCM Radiomics",           icon: Database },
  { label: "ML Model",         value: "AD / MCI / NC Classifier",    icon: BrainCircuit },
  { label: "Explainability",   value: "Grad-CAM Heatmaps",           icon: Activity },
  { label: "Web Platform",     value: "Next.js 16 + Tailwind CSS",   icon: Globe    },
  { label: "Edge Inference",   value: "< 500 ms end-to-end",         icon: Zap      },
  { label: "Classification",   value: "Hippocampal Texture Asymmetry", icon: Shield },
  { label: "Multi-scale",      value: "d = 1 / 2 / 4 Analysis",     icon: Layers   },
];

export default function AboutPage() {
  usePageTitle("About");

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">

      {/* ------ Hero ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
      <motion.div {...fadeUp(0)} className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-purple-400">
            Final Year Project
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          About <span className="text-purple-400">Synapse.PL</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/55">
          Synapse.PL is an FPGA-accelerated Alzheimer's detection platform built as a
          final-year engineering senior design project. Upload a raw MRI scan and receive
          a per-region risk score, Grad-CAM heatmap, and physician-ready PDF --- processed
          at the edge in under 500 ms.
        </p>
      </motion.div>

      {/* ------ Mission --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */}
      <motion.div {...fadeUp(0.08)}>
        <Card className="border-white/8 bg-white/[0.03]">
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Edge-first",
                  desc: "FPGA inference runs locally on the PYNQ-Z2, eliminating cloud dependency and reducing latency to under 500 ms.",
                },
                {
                  icon: BrainCircuit,
                  title: "Explainable AI",
                  desc: "Every diagnosis comes with a Grad-CAM heatmap and feature importance breakdown so clinicians understand exactly why.",
                },
                {
                  icon: Shield,
                  title: "Clinician-ready",
                  desc: "Results are formatted as structured clinical reports --- exportable as PDFs suitable for direct physician review.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
                    <Icon className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-white">{title}</div>
                    <div className="text-sm leading-relaxed text-white/50">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ------ Team ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
      <motion.div {...fadeUp(0.12)} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">The Team</h2>
          <p className="mt-1 text-sm text-white/40">Four final-year engineering students.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {TEAM.map(({ name, role, detail, icon: Icon, color, border, iconColor }) => (
            <Card key={name} className={`border bg-gradient-to-br ${color} ${border}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${border} bg-black/20`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{name}</div>
                    <div className={`mb-2 text-xs font-medium ${iconColor}`}>{role}</div>
                    <div className="text-sm leading-relaxed text-white/50">{detail}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* ------ Tech stack ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
      <motion.div {...fadeUp(0.16)} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Tech Stack</h2>
          <p className="mt-1 text-sm text-white/40">The full system from hardware to browser.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STACK.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-purple-400/70" />
              <div>
                <div className="text-xs text-white/35">{label}</div>
                <div className="mt-0.5 text-sm font-medium text-white/80">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ------ Footer note --------------------------------------------------------------------------------------------------------------------------------------------------------------------- */}
      <motion.div {...fadeUp(0.2)}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
          <Github className="h-4 w-4 shrink-0 text-white/30" />
          <p className="text-sm text-white/35">
            Synapse.PL is a senior design project built for academic purposes.
            MRI data used in this platform is sourced from the Alzheimer's Disease Neuroimaging Initiative (ADNI) and is used strictly for academic research in accordance with ADNI's data use agreement.
          </p>
        </div>
      </motion.div>

    </div>
  );
}
