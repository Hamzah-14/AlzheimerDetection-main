"use client";

import { motion } from "framer-motion";
import NeuralLines from "@/components/ui/neural-lines";

export default function NeuralBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* faint neural line network */}
      <NeuralLines density={16} opacity={0.08} />

      {/* large purple glow */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.28), transparent 60%)",
          top: "-200px",
          left: "-200px",
        }}
        animate={{
          x: [0, 60, -40, 0],
          y: [0, 30, -20, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* blue neural glow */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.24), transparent 60%)",
          bottom: "-200px",
          right: "-200px",
        }}
        animate={{
          x: [0, -50, 40, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* center neural pulse */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.20), transparent 70%)",
          top: "30%",
          left: "40%",
        }}
        animate={{
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}