"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_CASES } from "@/lib/cases";

const riskStyle = {
  High: "text-red-300",
  Medium: "text-amber-300",
  Low: "text-cyan-300",
};

export function CaseSwitcher({ currentCaseId }: { currentCaseId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1.5">
      {DASHBOARD_CASES.map((c) => {
        const isActive = c.id === currentCaseId;
        return (
          <button
            key={c.id}
            onClick={() =>
              router.push(
                `${pathname}?case=${encodeURIComponent(c.id)}&region=${encodeURIComponent(c.region)}`
              )
            }
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition",
              isActive
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/[0.07] bg-white/[0.03] text-white/45 hover:border-white/15 hover:bg-white/[0.07] hover:text-white/80"
            )}
          >
            {c.id}
            <span
              className={cn(
                "font-medium",
                isActive ? riskStyle[c.risk] : "text-white/25"
              )}
            >
              {c.risk}
            </span>
          </button>
        );
      })}
    </div>
  );
}
