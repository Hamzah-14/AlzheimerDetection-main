"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: {
    wrap: "py-10",
    iconWrap: "h-12 w-12 rounded-2xl",
    icon: "h-5 w-5",
    title: "text-sm font-semibold",
    desc: "text-xs",
  },
  md: {
    wrap: "py-16",
    iconWrap: "h-16 w-16 rounded-3xl",
    icon: "h-7 w-7",
    title: "text-base font-semibold",
    desc: "text-sm",
  },
  lg: {
    wrap: "py-24",
    iconWrap: "h-20 w-20 rounded-3xl",
    icon: "h-9 w-9",
    title: "text-lg font-semibold",
    desc: "text-sm",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const s = sizes[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        s.wrap,
        className
      )}
    >
      <div
        className={cn(
          "mb-5 flex items-center justify-center border border-white/[0.07] bg-white/[0.04]",
          s.iconWrap
        )}
      >
        <Icon className={cn("text-white/25", s.icon)} />
      </div>

      <p className={cn("text-white/60", s.title)}>{title}</p>

      {description && (
        <p className={cn("mt-1.5 max-w-xs text-white/35 leading-relaxed", s.desc)}>
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-2.5 text-sm font-medium text-purple-300 transition hover:border-purple-400/50 hover:bg-purple-500/20 hover:text-purple-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
