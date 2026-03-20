"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_CASES } from "@/lib/cases";
import { useAnalysisStore } from "@/lib/analysis-store";

const riskStyle = {
  High:   "text-red-300",
  Medium: "text-amber-300",
  Low:    "text-cyan-300",
};

export function CaseSwitcher({ currentCaseId }: { currentCaseId: string }) {
  const router   = useRouter();
  const pathname = usePathname();

  // Guard against SSR/hydration mismatch --- store uses localStorage
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const realCases = useAnalysisStore((s) => s.cases);

  const navigate = (id: string, region: string) =>
    router.push(`${pathname}?case=${encodeURIComponent(id)}&region=${encodeURIComponent(region)}`);

  const CasePill = ({
    id, risk, region, isDemo = false,
  }: { id: string; risk: "High" | "Medium" | "Low"; region: string; isDemo?: boolean }) => {
    const isActive = id === currentCaseId;
    return (
      <button
        onClick={() => navigate(id, region)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition",
          isActive
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/[0.07] bg-white/[0.03] text-white/45 hover:border-white/15 hover:bg-white/[0.07] hover:text-white/80"
        )}
      >
        {id}
        <span className={cn("font-medium", isActive ? riskStyle[risk] : "text-white/25")}>
          {risk}
        </span>
        {isDemo && (
          <span className="text-[9px] text-white/20">demo</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Real cases --- newest first */}
      {ready && realCases.map((c) => (
        <CasePill key={c.id} id={c.id} risk={c.risk} region={c.region} />
      ))}

      {/* Divider */}
      {ready && realCases.length > 0 && (
        <span className="select-none px-0.5 text-white/15">--</span>
      )}

      {/* Demo cases */}
      {DASHBOARD_CASES.map((c) => (
        <CasePill key={c.id} id={c.id} risk={c.risk} region={c.region} isDemo />
      ))}
    </div>
  );
}
