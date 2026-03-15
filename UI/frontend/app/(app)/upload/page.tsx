"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Scan, Cpu, Zap, Brain, FileText, Upload,
  CheckCircle2, ChevronRight, ChevronLeft,
  Info, X, Calendar,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";
import { runAnalysis } from "@/lib/uploadHandler";
import { useAnalysisStore } from "@/lib/analysis-store";

// ─── Types ────────────────────────────────────────────────────────────────────
type PipelineStage = { label: string; sub: string; icon: React.ElementType; fpga?: boolean };
type ScanEntry     = { id: number; file: File | null; date: Date | null };
type CalView       = "day" | "month" | "year";
type WizardStep    = 1 | 2 | 3;
type PipelineState = "idle" | "running" | "done" | "error";

interface Job {
  id:              string;
  label:           string;
  state:           PipelineState;
  activeStage:     number;
  completedStages: number[];
  result:          Record<string, unknown> | null;
  error:           string | null;
  caseId:          string | null;
}

const STAGES: PipelineStage[] = [
  { label: "Upload",       sub: "MRI volume received and validated",       icon: Scan                 },
  { label: "Preprocess",   sub: "N4 correction · MNI registration · crop", icon: Cpu                  },
  { label: "Radiomics",    sub: "3D GLCM feature extraction on PYNQ-Z2",   icon: Zap,   fpga: true    },
  { label: "Classify",     sub: "Stacking ensemble · cascade inference",    icon: Brain                },
  { label: "Report Ready", sub: "Clinical summary generated",               icon: FileText             },
];

const MONTHS_S  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS     = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const APOE_OPTS = ["e2/e2","e2/e3","e2/e4","e3/e3","e3/e4","e4/e4","Unknown"];
const RACE_OPTS = ["White","Black","Asian","Hispanic","Other"];

const INFO = {
  apoe: {
    title: "APOE Genotype",
    body: "APOE (Apolipoprotein E) is a gene that influences Alzheimer\'s risk. You inherit one copy from each parent.",
    examples: [
      { label: "e3/e3", note: "Most common — average population risk" },
      { label: "e3/e4", note: "One high-risk copy — roughly doubles risk" },
      { label: "e4/e4", note: "Two high-risk copies — up to 12× increased risk" },
      { label: "e2/e3", note: "e2 is protective — slightly below average risk" },
    ],
  },
  abeta42: {
    title: "Amyloid-beta 42 (Abeta42)",
    body: "In Alzheimer\'s, Abeta42 gets trapped in brain plaques, so CSF levels drop as disease progresses.",
    examples: [
      { label: "> 1000 pg/mL", note: "Normal — no amyloid concern" },
      { label: "700–1000 pg/mL", note: "Borderline — warrants monitoring" },
      { label: "< 700 pg/mL", note: "Concerning — strongly suggests amyloid pathology" },
    ],
  },
  tau: {
    title: "Total Tau",
    body: "Tau stabilises neurons. When brain cells are damaged, tau leaks into the CSF.",
    examples: [
      { label: "< 300 pg/mL", note: "Normal" },
      { label: "300–400 pg/mL", note: "Mildly elevated" },
      { label: "> 400 pg/mL", note: "Significantly elevated — active neuronal loss" },
    ],
  },
  ptau: {
    title: "Phosphorylated Tau (pTau-181)",
    body: "More specific for Alzheimer\'s than total tau. Reflects neurofibrillary tangle formation.",
    examples: [
      { label: "< 27 pg/mL", note: "Normal range" },
      { label: "27–40 pg/mL", note: "Borderline" },
      { label: "> 40 pg/mL", note: "Highly specific for Alzheimer\'s pathology" },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractDateFromFilename(filename: string): Date | null {
  // Match any YYYYMMDD sequence (e.g. 021_S_0753_20070315.nii → 2007-03-15)
  for (const [, y, m, d] of filename.matchAll(/(\d{4})(\d{2})(\d{2})/g)) {
    const year = parseInt(y), month = parseInt(m), day = parseInt(d);
    if (year < 1990 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) continue;
    return date;
  }
  return null;
}

function sortByDate(entries: ScanEntry[]): ScanEntry[] {
  return [...entries].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() - b.date.getTime();
  });
}

function DatePicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const [open,   setOpen]   = useState(false);
  const [view,   setView]   = useState<CalView>("day");
  const [cursor, setCursor] = useState<Date>(() => value ?? new Date());
  const fmt = (d: Date | null) =>
    d ? `${String(d.getDate()).padStart(2,"0")} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}` : "Select date";
  const firstDay    = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const decadeStart = Math.floor(cursor.getFullYear() / 10) * 10;
  const today       = new Date();
  const prev = () => {
    if (view==="day")   setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1));
    if (view==="month") setCursor(new Date(cursor.getFullYear()-1, 0, 1));
    if (view==="year")  setCursor(new Date(decadeStart-10, 0, 1));
  };
  const next = () => {
    if (view==="day")   setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1));
    if (view==="month") setCursor(new Date(cursor.getFullYear()+1, 0, 1));
    if (view==="year")  setCursor(new Date(decadeStart+10, 0, 1));
  };
  const headerLabel = () => {
    if (view==="day")   return `${MONTHS_L[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view==="month") return String(cursor.getFullYear());
    return `${decadeStart} – ${decadeStart+9}`;
  };
  const cycleView = () => setView(v => v==="day"?"month":v==="month"?"year":"day");
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition",
          open    ? "border-purple-400/40 bg-purple-400/10 text-white"
          : value ? "border-emerald-400/25 bg-emerald-400/[0.06] text-white"
          : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/70")}>
        <Calendar className="h-3 w-3 shrink-0" /><span>{fmt(value)}</span>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl border border-white/10 bg-[#0f0f18] p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prev} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white transition"><ChevronLeft className="h-3 w-3" /></button>
            <button type="button" onClick={cycleView} className="text-xs font-medium text-white/80 hover:text-purple-300 transition">{headerLabel()}</button>
            <button type="button" onClick={next} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white transition"><ChevronRight className="h-3 w-3" /></button>
          </div>
          {view==="day" && (<>
            <div className="mb-1.5 grid grid-cols-7 text-center">{WDAYS.map(d=><span key={d} className="text-[9px] text-white/25">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {Array.from({length:firstDay}).map((_,i)=><span key={`e${i}`}/>)}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const isSel=value?.getDate()===day&&value?.getMonth()===cursor.getMonth()&&value?.getFullYear()===cursor.getFullYear();
                const isToday=today.getDate()===day&&today.getMonth()===cursor.getMonth()&&today.getFullYear()===cursor.getFullYear();
                return(<button type="button" key={day} onClick={()=>{onChange(new Date(cursor.getFullYear(),cursor.getMonth(),day));setOpen(false);}} className={cn("mx-auto flex h-6 w-6 items-center justify-center rounded-lg text-[11px] transition",isSel?"bg-purple-500 text-white font-medium":isToday?"border border-purple-400/30 text-purple-300":"text-white/60 hover:bg-white/10 hover:text-white")}>{day}</button>);
              })}
            </div>
          </>)}
          {view==="month" && (<div className="grid grid-cols-3 gap-1.5">{MONTHS_S.map((m,i)=>(<button type="button" key={m} onClick={()=>{setCursor(new Date(cursor.getFullYear(),i,1));setView("day");}} className={cn("rounded-xl py-1.5 text-xs transition",cursor.getMonth()===i?"bg-purple-500 text-white font-medium":"text-white/60 hover:bg-white/10 hover:text-white")}>{m}</button>))}</div>)}
          {view==="year" && (<div className="grid grid-cols-3 gap-1.5">{Array.from({length:12}).map((_,i)=>{const yr=decadeStart+i-1;return(<button type="button" key={yr} onClick={()=>{setCursor(new Date(yr,cursor.getMonth(),1));setView("month");}} className={cn("rounded-xl py-1.5 text-xs transition",cursor.getFullYear()===yr?"bg-purple-500 text-white font-medium":"text-white/60 hover:bg-white/10 hover:text-white")}>{yr}</button>);})}</div>)}
        </div>
      </>)}
    </div>
  );
}

function InfoTooltip({ info }: { info: (typeof INFO)[keyof typeof INFO] }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const show = () => {
    if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.top, left: r.left + r.width/2 }); }
    setOpen(true);
  };
  const tooltip = open ? (
    <div className="pointer-events-none w-72 rounded-2xl border border-white/10 bg-[#0f0f18] p-3.5 shadow-2xl"
      style={{ position:"fixed", top:pos.top, left:pos.left, transform:"translateX(-50%) translateY(calc(-100% - 10px))", zIndex:9999 }}>
      <p className="mb-1.5 text-[11px] font-semibold text-white">{info.title}</p>
      <p className="mb-2.5 text-[10px] leading-relaxed text-white/55">{info.body}</p>
      <div className="space-y-1.5">{info.examples.map((ex,i)=>(
        <div key={i} className="flex items-start gap-2">
          <span className="shrink-0 rounded-md border border-purple-400/20 bg-purple-400/10 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 leading-tight">{ex.label}</span>
          <span className="text-[10px] text-white/45 leading-tight">{ex.note}</span>
        </div>
      ))}</div>
      <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%) rotate(45deg)", width:12, height:12, background:"#0f0f18", borderRight:"1px solid rgba(255,255,255,0.1)", borderBottom:"1px solid rgba(255,255,255,0.1)" }} />
    </div>
  ) : null;
  return (
    <div className="relative inline-flex">
      <button ref={btnRef} type="button" onMouseEnter={show} onMouseLeave={()=>setOpen(false)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/40 hover:border-purple-400/40 hover:text-purple-300 transition">
        <Info className="h-2 w-2" />
      </button>
      {typeof document!=="undefined" && tooltip && createPortal(tooltip, document.body)}
    </div>
  );
}

function StepIndicator({ step, step1Valid, step2Valid, setStep }: {
  step: WizardStep; step1Valid: boolean; step2Valid: boolean; setStep: (s: WizardStep) => void;
}) {
  const steps = [{ n:1 as WizardStep, label:"MRI Scans" }, { n:2 as WizardStep, label:"Demographics" }, { n:3 as WizardStep, label:"Biomarkers" }];
  const canNav = (s: WizardStep) => s<step||(s===2&&step1Valid)||(s===3&&step1Valid&&step2Valid);
  return (
    <div className="glass pulse-trigger rounded-[28px] p-4">
      <div className="flex items-center gap-1.5">
        {steps.map(({n,label},idx)=>(
          <div key={n} className="flex items-center gap-1.5">
            <button type="button" onClick={()=>canNav(n)&&setStep(n)} className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition",step===n?"border border-purple-400/30 bg-purple-500/15 text-purple-200":n<step?"text-emerald-400/70 hover:text-emerald-300":"cursor-not-allowed text-white/25")}>
              <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",step===n?"bg-purple-500 text-white":n<step?"bg-emerald-500 text-white":"bg-white/10 text-white/30")}>{n<step?"✓":n}</span>
              {label}
            </button>
            {idx<2&&<ChevronRight className="h-3 w-3 shrink-0 text-white/15"/>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UploadPage() {
  usePageTitle("Upload Case");
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const nextScanId = useRef(1);
  const [age,          setAge]         = useState("");
  const [sex,          setSex]         = useState<"M"|"F"|null>(null);
  const [education,    setEducation]   = useState("");
  const [race,         setRace]        = useState("");
  const [apoe,         setApoe]        = useState("");
  const [abeta42,      setAbeta42]     = useState("");
  const [tau,          setTau]         = useState("");
  const [ptau,         setPtau]        = useState("");
  const [noBiomarkers, setNoBiomarkers]= useState(false);
  const [stageProgress, setStageProgress] = useState<Record<number, number>>({});
  const stageIntervalsRef = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const [jobs,          setJobs]          = useState<Job[]>([]);
  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const jobCounter = useRef(1);
  const region = "Bilateral Hippocampus";

  const updateJob = (id: string, patch: Partial<Job>) =>
    setJobs(prev => prev.map(j => j.id===id ? {...j,...patch} : j));

  const step1Valid = scans.length >= 1 && scans.every(s => s.file && s.date);
  const step2Valid = !!age&&Number(age)>0&&!!sex&&!!education&&Number(education)>0&&!!race;
  const step3Valid = true;

  const updateDate  = (id: number, date: Date) => setScans(s => sortByDate(s.map(sc => sc.id===id ? {...sc, date} : sc)));
  const removeScan  = (id: number) => setScans(s => s.filter(sc => sc.id !== id));
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const existingNames = new Set(scans.map(s => s.file?.name));
    const toAdd = Array.from(files)
      .filter(f => (f.name.endsWith(".nii") || f.name.endsWith(".nii.gz")) && !existingNames.has(f.name))
      .slice(0, Math.max(0, 15 - scans.length));
    if (!toAdd.length) return;
    const newEntries: ScanEntry[] = toAdd.map(file => ({ id: nextScanId.current++, file, date: extractDateFromFilename(file.name) }));
    setScans(prev => sortByDate([...prev, ...newEntries]));
  };
  const gapMonths  = (a:Date,b:Date) => (b.getTime()-a.getTime())/(1000*60*60*24*30.44);

  const addCase    = useAnalysisStore((s) => s.addCase);
  const clearCases = useAnalysisStore((s) => s.clearCases);
  const savedCases = useAnalysisStore((s) => s.cases);

  const runPipeline = async () => {
    const jobId    = `job-${Date.now()}`;
    const jobLabel = `Run ${jobCounter.current++} — ${age}yo ${sex==="M"?"Male":"Female"}`;
    const newJob: Job = { id:jobId, label:jobLabel, state:"running", activeStage:0, completedStages:[], result:null, error:null, caseId:null };
    setJobs(prev=>[newJob,...prev]);
    setPipelineState("running");
    const scanEntries = scans.filter(s=>s.file&&s.date).map(s=>({ file:s.file!, date:s.date!.toISOString().split("T")[0] }));
    await runAnalysis(
      scanEntries,
      { age:Number(age), sex:sex??"M", education:Number(education), race,
        apoe:(apoe&&apoe!=="Unknown")?apoe:undefined,
        abeta42:(!noBiomarkers&&abeta42)?Number(abeta42):undefined,
        tau:(!noBiomarkers&&tau)?Number(tau):undefined,
        ptau:(!noBiomarkers&&ptau)?Number(ptau):undefined },
      {
        onStage:(index,status) => {
          if (status === "active") {
            setStageProgress(p => ({ ...p, [index]: 0 }));
            const iv = setInterval(() => {
              setStageProgress(p => {
                const cur = p[index] ?? 0;
                if (cur >= 90) return p;
                return { ...p, [index]: cur + 1.5 };
              });
            }, 100);
            stageIntervalsRef.current[index] = iv;
          } else {
            clearInterval(stageIntervalsRef.current[index]);
            delete stageIntervalsRef.current[index];
            setStageProgress(p => ({ ...p, [index]: 100 }));
          }
          updateJob(jobId,{
            activeStage: status==="active"?index:index+1<STAGES.length?index+1:-1,
            completedStages: status==="complete"
              ? Array.from(new Set([...(jobs.find(j=>j.id===jobId)?.completedStages??[]),index]))
              : jobs.find(j=>j.id===jobId)?.completedStages??[],
          });
        },
        onResult:(analysisCase) => {
          addCase(analysisCase);
          updateJob(jobId,{ state:"done", activeStage:-1, completedStages:STAGES.map((_,i)=>i), result:analysisCase.result as unknown as Record<string,unknown>, caseId:analysisCase.id });
          setPipelineState("done");
        },
        onError:(message) => {
          updateJob(jobId,{ state:"error", activeStage:-1, error:message });
          setPipelineState("error");
        },
      }
    );
  };

  const hasRunningJob = jobs.some(j => j.state === "running");

  const jobStageStatus = (job:Job,i:number):"complete"|"active"|"pending" =>
    job.completedStages.includes(i)?"complete":job.activeStage===i?"active":"pending";

  const csfStatus = (key:"abeta42"|"tau"|"ptau",val:number) => {
    if (key==="abeta42") return val>1000?{label:"Normal",cls:"emerald"}:val>700?{label:"Borderline",cls:"amber"}:{label:"Concerning",cls:"red"};
    if (key==="tau")     return val<300 ?{label:"Normal",cls:"emerald"}:val<400?{label:"Borderline",cls:"amber"}:{label:"Elevated",cls:"red"};
    return val<27?{label:"Normal",cls:"emerald"}:val<40?{label:"Borderline",cls:"amber"}:{label:"Elevated",cls:"red"};
  };
  const statusBadge = (cls:string,label:string) => (
    <span className={cn("text-[10px] rounded-lg px-2 py-0.5",cls==="emerald"?"bg-emerald-400/10 text-emerald-300":cls==="amber"?"bg-amber-400/10 text-amber-300":"bg-red-400/10 text-red-300")}>{label}</span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Upload MRI Scan</h1>
        <p className="mt-1 text-sm text-white/60">Submit bilateral hippocampal volumes with patient data for FPGA-accelerated radiomics and classification.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <StepIndicator step={step} step1Valid={step1Valid} step2Valid={step2Valid} setStep={setStep} />

          {/* STEP 1 */}
          {step===1 && (
            <div className="glass pulse-trigger space-y-4 rounded-[28px] p-6">
              <div>
                <div className="text-sm font-medium text-white">MRI Scans</div>
                <div className="mt-0.5 text-xs text-white/40">Upload 1–15 .nii / .nii.gz files · scan dates extracted automatically from filenames</div>
              </div>

              {/* Multi-file drop zone */}
              <div
                className={cn("relative cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition",
                  scans.length>0?"border-emerald-400/30 bg-emerald-400/[0.03] hover:border-emerald-400/40":"border-white/10 hover:border-white/20 hover:bg-white/[0.03]")}
                onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}}
                onDragOver={e=>e.preventDefault()}
              >
                <input type="file" multiple accept=".nii,.nii.gz" className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={e=>handleFiles(e.target.files)}/>
                <div className="pointer-events-none flex flex-col items-center gap-1.5">
                  <Upload className="h-5 w-5 text-white/30"/>
                  <span className="text-xs text-white/40">
                    {scans.length===0?"Drop files here or click to browse — select multiple at once":`${scans.length} file${scans.length>1?"s":""} loaded · drop or click to add more`}
                  </span>
                  <span className="text-[10px] text-white/25">.nii · .nii.gz · up to 15 files</span>
                </div>
              </div>

              {/* File list */}
              {scans.length>0&&(
                <div className="space-y-2">
                  {scans.map((scan,idx)=>{
                    const prevScan=idx>0?scans[idx-1]:null;
                    const gap=prevScan?.date&&scan.date?gapMonths(prevScan.date,scan.date):null;
                    const autoDate=scan.file?extractDateFromFilename(scan.file.name):null;
                    return (
                      <div key={scan.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[9px] font-mono text-white/40">{idx+1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-white/70">{scan.file?.name??"—"}</div>
                            {scan.file&&<div className="text-[10px] text-white/30">{(scan.file.size/1024/1024).toFixed(1)} MB</div>}
                          </div>
                          <button type="button" onClick={()=>removeScan(scan.id)} className="flex h-5 w-5 items-center justify-center rounded-lg border border-white/10 text-white/30 hover:border-red-400/30 hover:text-red-400 transition"><X className="h-3 w-3"/></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] text-white/40">Date</span>
                          <div className="flex-1"><DatePicker value={scan.date} onChange={d=>updateDate(scan.id,d)}/></div>
                          {scan.date&&<span className={cn("shrink-0 text-[10px]",autoDate?"text-emerald-400/50":"text-white/25")}>{autoDate?"auto":"manual"}</span>}
                        </div>
                        {!scan.date&&<div className="text-[10px] text-amber-300/70">⚠ Date not found in filename — enter manually</div>}
                        {gap!==null&&(
                          <div className={cn("flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px]",gap<3?"border border-amber-400/20 bg-amber-400/[0.06] text-amber-300":"border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300")}>
                            {gap<3?"⚠":"✓"}<span>{gap.toFixed(1)} months since scan {idx}{gap<3&&" — close together, slope estimate may be unreliable"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Follow-up summary */}
              {(()=>{
                const withDates=scans.filter(s=>s.date);
                if(withDates.length<2)return null;
                const totalMonths=gapMonths(withDates[0].date!,withDates[withDates.length-1].date!);
                return (
                  <div className="rounded-2xl border border-purple-400/15 bg-purple-400/[0.04] p-3">
                    <div className="mb-2 text-[10px] text-purple-300/60">Follow-up summary</div>
                    <div className="flex items-center gap-4">
                      <div><div className="text-xs font-medium text-white">{totalMonths.toFixed(1)} months</div><div className="text-[10px] text-white/35">total follow-up</div></div>
                      <div className="text-white/15">·</div>
                      <div><div className="text-xs font-medium text-white">{withDates.length} scans</div><div className="text-[10px] text-white/35">submitted</div></div>
                      {totalMonths<6&&<div className="ml-auto rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1 text-[10px] text-amber-300">⚠ Short follow-up</div>}
                    </div>
                  </div>
                );
              })()}

              {scans.length>=15&&<div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[10px] text-amber-300">Maximum 15 scans reached</div>}
              <button type="button" onClick={()=>step1Valid&&setStep(2)} disabled={!step1Valid}
                className={cn("flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",step1Valid?"border-white/10 bg-white/10 text-white hover:bg-white/15":"cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25")}>
                Next: Demographics <ChevronRight className="h-4 w-4"/>
              </button>
              {!step1Valid&&<p className="text-center text-[11px] text-white/30">
                {scans.length===0?"Upload at least 1 scan to continue":"All scans need a date to continue"}
              </p>}
            </div>
          )}

          {/* STEP 2 */}
          {step===2 && (
            <div className="glass pulse-trigger space-y-5 rounded-[28px] p-6">
              <div><div className="text-sm font-medium text-white">Patient Demographics</div><div className="mt-0.5 text-xs text-white/40">All fields required</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-white/50">Age (years)</label>
                  <input type="number" min={18} max={110} value={age} onChange={e=>setAge(e.target.value)} placeholder="e.g. 72" className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25 focus:bg-white/[0.08]"/>
                  {age&&Number(age)>0&&<div className="mt-1.5 text-[10px] text-white/35">{Number(age)>=65?"≥ 65 — elevated baseline risk":"< 65 — standard assessment"}</div>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-white/50">Education (years)</label>
                  <input type="number" min={0} max={30} value={education} onChange={e=>setEducation(e.target.value)} placeholder="e.g. 16" className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25 focus:bg-white/[0.08]"/>
                  {education&&Number(education)>0&&<div className="mt-1.5 text-[10px] text-white/35">{Number(education)>=16?"University level":Number(education)>=12?"Secondary level":"Primary level"}</div>}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Sex</label>
                <div className="flex gap-2">{(["M","F"] as const).map(s=>(<button type="button" key={s} onClick={()=>setSex(s)} className={cn("flex-1 rounded-2xl border py-2.5 text-sm font-medium transition",sex===s?"border-purple-400/40 bg-purple-400/15 text-purple-200":"border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white")}>{s==="M"?"Male":"Female"}</button>))}</div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Race</label>
                <div className="grid grid-cols-3 gap-2">{RACE_OPTS.map(r=>(<button type="button" key={r} onClick={()=>setRace(r)} className={cn("rounded-xl border py-2 text-xs transition",race===r?"border-purple-400/40 bg-purple-400/15 text-purple-200":"border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white")}>{r}</button>))}</div>
              </div>
              {age&&sex&&education&&race&&(
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
                  <div className="mb-1 text-[10px] text-emerald-300/60">Demographics confirmed</div>
                  <div className="text-xs text-white/60">{age}yo {sex==="M"?"male":"female"} · {education} yrs education · {race}</div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={()=>setStep(1)} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:text-white transition"><ChevronLeft className="h-4 w-4"/> Back</button>
                <button type="button" onClick={()=>step2Valid&&setStep(3)} disabled={!step2Valid} className={cn("flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",step2Valid?"border-white/10 bg-white/10 text-white hover:bg-white/15":"cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25")}>Next: Biomarkers <ChevronRight className="h-4 w-4"/></button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step===3 && (
            <div className="glass pulse-trigger space-y-5 rounded-[28px] p-6">
              <div><div className="text-sm font-medium text-white">Biomarkers</div><div className="mt-0.5 text-xs text-white/40">Optional — model imputes missing values</div></div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5"><span className="text-xs text-white/50">APOE Genotype</span><InfoTooltip info={INFO.apoe}/></div>
                <div className="grid grid-cols-3 gap-2">
                  {APOE_OPTS.map(opt=>{
                    const e4=(opt.match(/e4/g)||[]).length;
                    const unknown=opt==="Unknown";
                    return (
                      <button type="button" key={opt} onClick={()=>setApoe(opt)} className={cn("rounded-xl border py-2 text-xs font-mono transition",apoe===opt?unknown?"border-white/30 bg-white/10 text-white/80":e4===0?"border-emerald-400/40 bg-emerald-400/15 text-emerald-200":e4===1?"border-amber-400/40 bg-amber-400/15 text-amber-200":"border-red-400/40 bg-red-400/15 text-red-200":"border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white")}>{opt}</button>
                    );
                  })}
                </div>
                {apoe&&apoe!=="Unknown"&&(()=>{
                  const e4=(apoe.match(/e4/g)||[]).length;
                  const labels=["No e4 copies · Average risk","1 e4 copy · Elevated risk","2 e4 copies · High risk"];
                  return (<div className={cn("mt-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px]",e4===0?"border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300":e4===1?"border border-amber-400/20 bg-amber-400/[0.06] text-amber-300":"border border-red-400/20 bg-red-400/[0.06] text-red-300")}>{e4===0?"✓":"⚠"} {labels[e4]}</div>);
                })()}
              </div>
              <button type="button" onClick={()=>{ setNoBiomarkers(v=>{ if(!v){setAbeta42("");setTau("");setPtau("");} return !v; }); }}
                className={cn("flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs transition",noBiomarkers?"border-white/25 bg-white/10 text-white":"border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white")}>
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",noBiomarkers?"border-white/50 bg-white/20":"border-white/20 bg-transparent")}>{noBiomarkers&&<span className="text-[9px] text-white">✓</span>}</span>
                No biomarker values available
              </button>
              {!noBiomarkers&&([
                {key:"abeta42" as const,label:"Abeta42",unit:"pg/mL",placeholder:"e.g. 850",value:abeta42,set:setAbeta42,info:INFO.abeta42},
                {key:"tau"     as const,label:"Total Tau",unit:"pg/mL",placeholder:"e.g. 220",value:tau,set:setTau,info:INFO.tau},
                {key:"ptau"    as const,label:"pTau-181",unit:"pg/mL",placeholder:"e.g. 24",value:ptau,set:setPtau,info:INFO.ptau},
              ]).map(field=>{
                const numVal=parseFloat(field.value);
                const status=!isNaN(numVal)?csfStatus(field.key,numVal):null;
                return (
                  <div key={field.key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><span className="text-xs text-white/50">{field.label}</span><span className="text-[10px] text-white/25">{field.unit}</span><InfoTooltip info={field.info}/></div>
                      {status&&statusBadge(status.cls,status.label)}
                    </div>
                    <input type="number" value={field.value} onChange={e=>field.set(e.target.value)} placeholder={field.placeholder} className={cn("w-full rounded-2xl border px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition",status?.cls==="emerald"?"border-emerald-400/20 bg-emerald-400/[0.04] focus:border-emerald-400/35":status?.cls==="amber"?"border-amber-400/20 bg-amber-400/[0.04] focus:border-amber-400/35":status?.cls==="red"?"border-red-400/20 bg-red-400/[0.04] focus:border-red-400/35":"border-white/10 bg-white/5 focus:border-white/25 focus:bg-white/[0.08]")}/>
                  </div>
                );
              })}
              <div className="flex gap-3">
                <button type="button" onClick={()=>setStep(2)} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 hover:text-white transition"><ChevronLeft className="h-4 w-4"/> Back</button>
                <button type="button" onClick={()=>step3Valid&&!hasRunningJob&&runPipeline()} disabled={!step3Valid||hasRunningJob} className={cn("flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",hasRunningJob?"border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300/60 cursor-not-allowed":"border-white/10 bg-white/10 text-white hover:bg-white/15")}>
                  {hasRunningJob?(<><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400"/>Pipeline running…</>):(<><Zap className="h-4 w-4"/>Run Analysis Pipeline</>)}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="glass pulse-trigger rounded-[28px] p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Analysis Pipeline</div>
            {jobs.length>0&&<span className="text-[11px] text-white/30">{jobs.length} run{jobs.length>1?"s":""}</span>}
          </div>

          {jobs.length===0&&savedCases.length===0&&(
            <p className="mt-4 text-center text-xs text-white/30">Complete all steps above to begin the analysis pipeline.</p>
          )}

          {jobs.map((job)=>{
            const final       = job.result?.final as Record<string,unknown>|undefined;
            const pred        = final?.prediction as string|undefined;
            const conf        = final?.confidence as number|undefined;
            const convRisk    = final?.conversion_risk as number|undefined;
            const regQc       = job.result?.registration_qc as { ncc_per_scan: number[]; ncc_warnings: string[]; ncc_pass: boolean }|undefined;
            const isAD       = pred?.includes("Alzheimer");
            const isCN       = pred?.includes("Normal");
            const resultClass= isAD?"border-red-400/20 bg-red-400/[0.06] text-red-200":isCN?"border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200":"border-amber-400/20 bg-amber-400/[0.06] text-amber-200";
            return (
              <div key={job.id} className="rounded-[20px] border border-white/8 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/70">{job.label}</span>
                  <span className={cn("text-[10px] rounded-lg px-2 py-0.5",job.state==="done"?"bg-emerald-400/10 text-emerald-300":job.state==="error"?"bg-red-400/10 text-red-300":"bg-cyan-400/10 text-cyan-300")}>
                    {job.state==="done"?"Complete":job.state==="error"?"Error":"Running…"}
                  </span>
                </div>
                <div className="space-y-1">
                  {STAGES.map((stage,i)=>{
                    const status=jobStageStatus(job,i);
                    const Icon=stage.icon;
                    const isLast=i===STAGES.length-1;
                    return (
                      <div key={stage.label}>
                        <div className={cn("relative rounded-2xl border p-3 transition-all duration-500",status==="complete"?"border-emerald-400/20 bg-emerald-400/[0.06]":status==="active"?stage.fpga?"border-purple-400/30 bg-purple-400/[0.08]":"border-cyan-400/20 bg-cyan-400/[0.06]":"border-white/[0.06] bg-white/[0.02]")}>
                          <div className="flex items-center gap-2.5">
                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all duration-500",status==="complete"?"border-emerald-400/25 bg-emerald-400/15":status==="active"?stage.fpga?"border-purple-400/30 bg-purple-400/15":"border-cyan-400/25 bg-cyan-400/15":"border-white/10 bg-white/5")}>
                              {status==="complete"?<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400"/>:<Icon className={cn("h-3.5 w-3.5",status==="active"?stage.fpga?"text-purple-300":"text-cyan-300":"text-white/30")}/>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs font-medium",status==="complete"?"text-emerald-200":status==="active"?"text-white":"text-white/35")}>{stage.label}</span>
                                {stage.fpga&&<span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-1.5 py-0.5 text-[9px] text-purple-300">FPGA</span>}
                              </div>
                            </div>
                            <div className="shrink-0 w-8 text-right">
                              {status==="complete"&&<span className="text-[10px] text-emerald-400/70">Done</span>}
                              {status==="active"&&<span className={cn("block h-1.5 w-1.5 ml-auto animate-pulse rounded-full",stage.fpga?"bg-purple-400":"bg-cyan-400")}/>}
                            </div>
                          </div>
                          {status==="active"&&(
                            <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/5">
                              <div
                                className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-300 ease-out",stage.fpga?"from-purple-400 to-violet-400":"from-cyan-400 to-sky-400")}
                                style={{ width: `${stageProgress[i] ?? 0}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {!isLast&&<div className={cn("mx-4 my-0.5 h-2 w-px transition-colors duration-700",job.completedStages.includes(i)?"bg-emerald-400/30":"bg-white/8")}/>}
                      </div>
                    );
                  })}
                </div>
                {job.state==="error"&&job.error&&(
                  <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3">
                    <div className="text-[10px] font-medium text-red-300 mb-1">Pipeline error</div>
                    <div className="text-[10px] text-red-300/70 font-mono break-all">{job.error}</div>
                  </div>
                )}
                {job.state==="done"&&pred&&(
                  <div className={`rounded-xl border p-3 space-y-1.5 ${resultClass}`}>
                    <div className="text-[10px] opacity-60">Classification Result</div>
                    <div className="text-sm font-semibold">{pred}</div>
                    <div className="text-[11px] opacity-70">Confidence: {conf!==undefined?`${(conf*100).toFixed(1)}%`:"—"}</div>
                    {regQc?.ncc_warnings && regQc.ncc_warnings.length > 0 && regQc.ncc_warnings.map((w,i) => (
                      <div key={i} className="text-[10px] text-amber-300/80">⚠ {w}</div>
                    ))}
                    {regQc?.ncc_pass === true && (
                      <div className="text-[10px] text-emerald-300/60">✓ Registration quality good — NCC: {regQc.ncc_per_scan.map(n => n.toFixed(3)).join(', ')}</div>
                    )}
                    {convRisk!==undefined&&<div className="text-[11px] opacity-70">Conversion risk: {(convRisk*100).toFixed(1)}%</div>}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] opacity-40">Stopped at: {final?.cascade_stopped_at as string}</span>
                      <button onClick={()=>router.push(`/reports?case=${encodeURIComponent(job.caseId??"")}&region=${encodeURIComponent(region)}`)}
                        className="flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-400/15 transition">
                        View Report <ChevronRight className="h-3 w-3"/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Saved history */}
          {jobs.length===0&&savedCases.length>0&&(
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/50">{savedCases.length} saved run{savedCases.length>1?"s":""}</span>
                <button onClick={clearCases} className="text-[10px] text-red-400/60 hover:text-red-400 transition">Clear history</button>
              </div>
              <div className="space-y-2">
                {savedCases.slice(0,5).map((c, idx)=>{
                  const pred=c.result.final.prediction;
                  const conf=c.result.final.confidence;
                  const isAD=pred.includes("Alzheimer");
                  const isCN=pred.includes("Normal");
                  return (
                    <div key={`${c.id}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-white/70">{c.id}</div>
                        <div className={cn("text-[10px]",isAD?"text-red-300":isCN?"text-cyan-300":"text-amber-300")}>{pred} · {(conf*100).toFixed(1)}%</div>
                      </div>
                      <button onClick={()=>router.push(`/reports?case=${encodeURIComponent(c.id)}&region=${encodeURIComponent(c.region)}`)}
                        className="text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center gap-1">
                        Report <ChevronRight className="h-3 w-3"/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
