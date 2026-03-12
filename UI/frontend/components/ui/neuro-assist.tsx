"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

// ── Page context map (keyed by actual Next.js route) ─────────────────────────
const PAGES: Record<string, { label: string; description: string }> = {
  "/": {
    label: "Home",
    description:
      "The home page introduces Synapse.PL — an FPGA-accelerated Alzheimer's detection platform. It explains the system's core capability: upload a raw MRI scan and receive a per-region risk score, Grad-CAM heatmap, and physician-ready PDF in under 500 ms.",
  },
  "/dashboard": {
    label: "Dashboard",
    description:
      "The Dashboard shows an overview of all cases, model performance metrics (accuracy, sensitivity, specificity, AUC), a Grad-CAM heatmap activity log, and recent case cards with quick-access links.",
  },
  "/upload": {
    label: "Upload MRI",
    description:
      "The Upload MRI page lets clinicians submit a raw T1-weighted MRI scan for processing. Users can drag-and-drop or browse for a DICOM or NIfTI file. Once submitted the FPGA pipeline processes the scan and returns results.",
  },
  "/viewer": {
    label: "MRI Viewer",
    description:
      "The MRI Viewer shows the 3D brain scan with slice navigation across axial, coronal, and sagittal planes. Users can scroll through slices of the hippocampal region to inspect the scan manually.",
  },
  "/explain": {
    label: "Explainable AI",
    description:
      "The Explainable AI page shows the Grad-CAM heatmap overlaid on the MRI scan, highlighting regions the model focused on. Feature importance bars show which GLCM texture features contributed most. The final AD/MCI/NC classification is shown with a confidence score.",
  },
  "/timeline": {
    label: "Timeline",
    description:
      "The Timeline page shows a chronological history of all cases processed for a patient, allowing clinicians to track disease progression over time.",
  },
  "/analytics": {
    label: "Analytics",
    description:
      "The Analytics page shows aggregate model performance data, batch processing statistics, and population-level trends across all cases in the system.",
  },
  "/reports": {
    label: "Reports",
    description:
      "The Reports page displays the full clinical report for a selected case — GLCM radiomic feature table, asymmetry scores, Grad-CAM findings, and recommended action. A physician-ready PDF can be exported directly from this page.",
  },
  "/settings": {
    label: "Settings",
    description:
      "The Settings page lets users configure their profile, notification preferences, model thresholds, and display options including light/dark theme.",
  },
  "/about": {
    label: "About",
    description:
      "The About page introduces the team behind Synapse.PL — four final-year engineering students: Vikram (FPGA hardware and web platform), Hamzah (ML and data pipeline), Ahmed (software integration), and Abderahman (software development). It also covers the project mission, the full tech stack from FPGA to browser, and a note that all patient data is synthetic.",
  },
};

function getPageKey(pathname: string) {
  if (PAGES[pathname]) return pathname;
  const match = Object.keys(PAGES).find(
    (k) => k !== "/" && pathname.startsWith(k)
  );
  return match ?? "/";
}

// ── System prompts ────────────────────────────────────────────────────────────
const TEAM_INFO = `Synapse.PL was built by a team of four final-year engineering students: Vikram, who designed the FPGA hardware pipeline on the PYNQ-Z2 and built the web platform; Hamzah, who handled the machine learning models and data pipeline; Ahmed, who led the software integration; and Abderahman, who contributed to the software development side of the project. If asked who built this, mention all four by name and their roles, and suggest the user visit the About page for more details.`;

const BASE_PROMPTS: Record<string, string> = {
  clinician: `You are NeuroAssist, an AI guide for Synapse.PL — an FPGA-accelerated Alzheimer's detection platform. You are speaking with a clinician or researcher. Be concise and technically precise. Keep answers to 2-4 sentences unless more detail is explicitly requested. Use proper medical and engineering terminology. You know about: GLCM features (energy, entropy, contrast, homogeneity, correlation, dissimilarity), the FPGA pipeline on PYNQ-Z2 Zynq-7020, hippocampal texture asymmetry as an AD biomarker, Grad-CAM heatmap interpretation, multi-scale analysis at d=1/2/4, block partitioning (2x2x2 sub-blocks of 32 cubed), and classification into AD/MCI/NC. If asked what is happening on this page, explain it technically. If asked something unrelated, politely redirect. ${TEAM_INFO}`,
  patient: `You are NeuroAssist, a friendly AI guide for Synapse.PL, an Alzheimer's detection system. You are speaking with a patient or general user. Use plain warm everyday language, no jargon. Keep answers to 2-3 sentences. Use simple analogies where helpful. You can explain what each page shows, what results mean, and always remind users that results should be discussed with a doctor. If asked what is happening on this page, explain it simply. Always be warm and reassuring. If asked something unrelated, politely redirect. ${TEAM_INFO}`,
};

const FOLLOWUP_PROMPT = `After answering, you MUST end every response with a block formatted EXACTLY like this:
SUGGESTIONS:
- [suggestion 1]
- [suggestion 2]
- [suggestion 3]
These should be 3 short natural follow-up questions based on what you just answered and the current page. Never repeat a question already asked in this conversation.`;

// ── Per-page initial suggestion chips ────────────────────────────────────────
const INITIAL_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  clinician: {
    "/":          ["How does the FPGA pipeline work?", "What GLCM features are extracted?", "Who built this?", "What is the classification pipeline?"],
    "/dashboard": ["What metrics are shown on the dashboard?", "How is AUC calculated here?", "What does the heatmap activity log show?", "How are cases ranked?"],
    "/upload":    ["What file formats are accepted?", "How is the scan preprocessed?", "What is the expected inference latency?", "How is the hippocampus segmented?"],
    "/viewer":    ["What preprocessing was done on this scan?", "Why is the hippocampus the target ROI?", "How is the volume quantized?", "What does the 64x64x64 crop represent?"],
    "/explain":   ["How is Grad-CAM applied here?", "Which features are most discriminative for AD?", "How reliable is the confidence score?", "What does a high contrast score indicate?"],
    "/timeline":  ["How is progression tracked over time?", "What features change most in early AD?", "How are longitudinal scans aligned?", "What triggers a clinical alert?"],
    "/analytics": ["What does sensitivity vs specificity show?", "How is the AUC computed?", "What is the batch processing throughput?", "How is population data anonymised?"],
    "/reports":   ["What does hippocampal asymmetry indicate?", "How are L/R features compared?", "What do d=1 vs d=4 features capture differently?", "How are block statistics aggregated?"],
    "/settings":  ["What model threshold is recommended?", "How does the confidence cutoff affect sensitivity?", "What do notification triggers mean?", "Can I customise which features are shown?"],
    "/about":     ["Who built Synapse.PL?", "What FPGA hardware is used?", "How does the ML pipeline work?", "What is the end-to-end inference latency?"],
  },
  patient: {
    "/":          ["What does this system do?", "Who built this?", "How accurate is it?", "Is this safe to use?"],
    "/dashboard": ["What am I looking at here?", "What do the percentages mean?", "How do I read my cases?", "What is a good accuracy score?"],
    "/upload":    ["How do I upload my scan?", "What file do I need?", "How long does it take?", "Is my scan kept private?"],
    "/viewer":    ["What am I looking at?", "What is the hippocampus?", "Why does the image look grey?", "Can I scroll through the brain?"],
    "/explain":   ["What do the red areas mean?", "What is the diagnosis shown here?", "What does the confidence score mean?", "Should I be worried about the result?"],
    "/timeline":  ["What does this timeline show?", "Is my condition getting worse?", "How often should I get a new scan?", "What should I tell my doctor?"],
    "/analytics": ["What do these charts mean?", "Is this data about me?", "What is a sensitivity score?", "What does a higher accuracy mean?"],
    "/reports":   ["What do these numbers mean?", "What is the difference between AD and MCI?", "What should I do with these results?", "What does the diagnosis mean for me?"],
    "/settings":  ["How do I change my profile?", "What are notifications for?", "How do I switch to light mode?", "Is my data stored securely?"],
    "/about":     ["Who built this?", "What does this system do?", "Is this data real?", "How does the AI work?"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseSuggestions(text: string) {
  const match = text.match(/SUGGESTIONS:\s*([\s\S]*)$/);
  if (!match) return { clean: text, suggestions: [] as string[] };
  const suggestions = match[1]
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);
  const clean = text.replace(/SUGGESTIONS:[\s\S]*$/, "").trim();
  return { clean, suggestions };
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function ChatIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path
        d="M13 2C7.477 2 3 6.477 3 12c0 1.89.523 3.656 1.432 5.163L3 23l5.837-1.432A9.96 9.96 0 0013 22c5.523 0 10-4.477 10-10S18.523 2 13 2z"
        fill="white"
        fillOpacity="0.15"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9"  cy="12" r="1.2" fill="white" />
      <circle cx="13" cy="12" r="1.2" fill="white" />
      <circle cx="17" cy="12" r="1.2" fill="white" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function ThumbIcon({ up }: { up: boolean }) {
  return up ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type UserType = "clinician" | "patient";
type ChatState = "closed" | "open" | "minimized";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  isSystem?: boolean;
  time: Date;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NeuroAssist() {
  const pathname = usePathname();
  const pageKey  = getPageKey(pathname);
  const page     = PAGES[pageKey];

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [chatState,      setChatState]      = useState<ChatState>("closed");
  const [userType,       setUserType]       = useState<UserType | null>(null);
  const [unread,         setUnread]         = useState(0);
  const [askedQuestions, setAskedQuestions] = useState(new Set<string>());
  const [copiedId,       setCopiedId]       = useState<number | null>(null);
  const [feedback,       setFeedback]       = useState<Record<number, "up" | "down" | null>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const prevPage  = useRef(pageKey);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatState === "open") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, chatState]);

  // Focus input when chat opens; clear unread badge
  useEffect(() => {
    if (chatState === "open") {
      setUnread(0);
      if (userType) setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [chatState, userType]);

  // Notify user when they navigate to a new page while chat has messages
  useEffect(() => {
    if (prevPage.current !== pageKey && messages.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Navigated to ${page.label}. Ask me what's happening here!`,
          isSystem: true,
          time: new Date(),
          id: Date.now(),
        },
      ]);
      if (chatState !== "open") setUnread((u) => u + 1);
    }
    prevPage.current = pageKey;
  }, [pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat actions ────────────────────────────────────────────────────────────
  function selectUserType(type: UserType) {
    setUserType(type);
    setMessages([]);
    setAskedQuestions(new Set());
  }

  function resetChat() {
    setUserType(null);
    setMessages([]);
    setInput("");
    setAskedQuestions(new Set());
    setFeedback({});
  }

  function clearChat() {
    setMessages([]);
    setAskedQuestions(new Set());
    setFeedback({});
  }

  function copyMessage(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  function setFeedbackFor(id: number, val: "up" | "down") {
    setFeedback((prev) => ({ ...prev, [id]: prev[id] === val ? null : val }));
  }

  function getInitialSuggestions() {
    if (!userType) return [];
    return (INITIAL_SUGGESTIONS[userType][pageKey] ?? []).filter(
      (s) => !askedQuestions.has(s)
    );
  }

  async function sendMessage(text?: string) {
    const userMsg = text ?? input.trim();
    if (!userMsg || !userType || loading) return;
    setInput("");
    setAskedQuestions((prev) => new Set([...prev, userMsg]));

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMsg, time: new Date(), id: Date.now() },
    ];
    setMessages(newMessages);
    setLoading(true);

    // Typing delay for a more human feel
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));

    const pageContext  = `\n\nCURRENT PAGE: "${page.label}". ${page.description}`;
    const systemPrompt = BASE_PROMPTS[userType] + pageContext + "\n\n" + FOLLOWUP_PROMPT;

    try {
      const res = await fetch("/api/neuroassist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages
            .filter((m) => !m.isSystem)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const raw  = data.content?.[0]?.text ?? "Sorry, I couldn't process that.";
      const { clean, suggestions } = parseSuggestions(raw);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: clean, suggestions, time: new Date(), id: Date.now() },
      ]);
      if (chatState !== "open") setUnread((u) => u + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again.", suggestions: [], time: new Date(), id: Date.now() },
      ]);
    }

    setLoading(false);
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const roleColor = userType === "clinician" ? "#7c3aed" : "#00c8b4";
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && !m.isSystem);
  const activeSuggestions = lastAssistantMsg?.suggestions?.filter((s) => !askedQuestions.has(s)) ?? null;
  const initialSuggestions = getInitialSuggestions();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes na-pulse    { 0%,100%{opacity:1;transform:scale(1)}   50%{opacity:.5;transform:scale(.92)} }
        @keyframes na-fadeUp   { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes na-slideIn  { from{opacity:0;transform:translateY(16px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes na-blink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes na-popIn    { from{opacity:0;transform:scale(.4)}  to{opacity:1;transform:scale(1)} }
        @keyframes na-chipIn   { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes na-minSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .na-msg  { animation: na-fadeUp   .22s ease forwards; }
        .na-win  { animation: na-slideIn  .28s cubic-bezier(.34,1.4,.64,1) forwards; }
        .na-min  { animation: na-minSlide .2s  ease forwards; }
        .na-chip { transition: all .15s; cursor: pointer; }
        .na-chip:hover { background: rgba(124,58,237,.12) !important; border-color: rgba(124,58,237,.4) !important; color: rgba(255,255,255,.85) !important; transform: translateY(-1px); }
        .na-chip-anim { opacity:0; animation: na-chipIn .2s ease forwards; }
        .na-fab  { transition: all .2s; }
        .na-fab:hover { transform: scale(1.07); }
        .na-badge { animation: na-popIn .3s cubic-bezier(.34,1.56,.64,1) forwards; }
        .na-grp .na-act { transition: all .15s; opacity:0; }
        .na-grp:hover .na-act { opacity:1; }
        .na-act:hover { color: white !important; transform: scale(1.1); }
        .na-ibtn { transition: all .15s; cursor: pointer; }
        .na-ibtn:hover { background: rgba(255,255,255,.08) !important; }
        .na-role { transition: all .18s; cursor: pointer; }
        .na-role:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.4); }
      `}</style>

      {/* ── MINIMIZED BAR ────────────────────────────────────────────────────── */}
      {chatState === "minimized" && (
        <div
          className="na-min"
          style={{ position:"fixed", bottom:"24px", right:"24px", background:"#0d1525", border:"1px solid rgba(255,255,255,.08)", borderRadius:"14px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"10px", boxShadow:"0 8px 30px rgba(0,0,0,.5)", zIndex:9999, cursor:"pointer" }}
          onClick={() => setChatState("open")}
        >
          <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:"linear-gradient(135deg,#7c3aed,#4f6ef7)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <ChatIcon size={16} />
          </div>
          <div>
            <div style={{ color:"#fff", fontSize:"12px", fontWeight:600 }}>NeuroAssist</div>
            <div style={{ color:"rgba(255,255,255,.3)", fontSize:"10px" }}>
              {userType ? `${userType.toUpperCase()} MODE` : "CLICK TO OPEN"}
            </div>
          </div>
          {unread > 0 && (
            <div style={{ background:"#ff5f5f", borderRadius:"10px", padding:"1px 7px", fontSize:"11px", color:"#fff", fontWeight:600 }}>
              {unread}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setChatState("closed"); }}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:"16px", padding:"0 2px", lineHeight:1 }}
          >×</button>
        </div>
      )}

      {/* ── FULL CHAT WINDOW ──────────────────────────────────────────────────── */}
      {chatState === "open" && (
        <div
          className="na-win"
          style={{ position:"fixed", bottom:"88px", right:"24px", width:"358px", maxHeight:"580px", background:"#0d1525", border:"1px solid rgba(255,255,255,.08)", borderRadius:"18px", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.7)", zIndex:9999 }}
        >
          {/* Header */}
          <div style={{ padding:"13px 15px", borderBottom:"1px solid rgba(255,255,255,.05)", display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,.015)", flexShrink:0 }}>
            <div style={{ width:"32px", height:"32px", borderRadius:"9px", background:"linear-gradient(135deg,#7c3aed,#4f6ef7)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <ChatIcon />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:"#fff", fontWeight:600, fontSize:"13px" }}>NeuroAssist</div>
              <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:userType ? roleColor : "#7c3aed", animation:"na-pulse 2s infinite", flexShrink:0 }} />
                <span style={{ color:userType ? roleColor : "rgba(124,58,237,.75)", fontSize:"10px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {userType ? `${userType.toUpperCase()} · ${page.label.toUpperCase()}` : "ONLINE"}
                </span>
              </div>
            </div>
            <div style={{ display:"flex", gap:"2px", flexShrink:0 }}>
              {userType && (
                <>
                  <button className="na-ibtn" onClick={clearChat} title="Clear chat" style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:"13px", padding:"4px 6px", borderRadius:"6px" }}>🗑</button>
                  <button className="na-ibtn" onClick={resetChat} title="Switch role" style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:"15px", padding:"4px 6px", borderRadius:"6px" }}>↺</button>
                </>
              )}
              <button className="na-ibtn" onClick={() => setChatState("minimized")} title="Minimise" style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:"15px", padding:"4px 6px", borderRadius:"6px", lineHeight:1 }}>─</button>
              <button className="na-ibtn" onClick={() => setChatState("closed")} style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:"18px", padding:"4px 6px", lineHeight:1, borderRadius:"6px" }}>×</button>
            </div>
          </div>

          {/* Message body */}
          <div style={{ flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:"10px" }}>

            {/* ── Role selection ── */}
            {!userType && (
              <div style={{ padding:"6px 2px" }}>
                <div style={{ textAlign:"center", marginBottom:"16px" }}>
                  <div style={{ width:"42px", height:"42px", borderRadius:"12px", background:"linear-gradient(135deg,#7c3aed,#4f6ef7)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
                    <ChatIcon />
                  </div>
                  <div style={{ color:"rgba(255,255,255,.85)", fontSize:"14px", fontWeight:600, marginBottom:"5px" }}>Hi, I'm NeuroAssist</div>
                  <div style={{ color:"rgba(255,255,255,.32)", fontSize:"12px", lineHeight:"1.6" }}>
                    Who are you? I'll tailor my answers accordingly.
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {(
                    [
                      { type:"clinician" as UserType, emoji:"🩺", label:"Clinician / Researcher", sub:"Technical detail — features, pipeline, clinical metrics" },
                      { type:"patient"   as UserType, emoji:"👤", label:"Patient / General User",  sub:"Plain language — what things mean, what to look at" },
                    ] as const
                  ).map(({ type, emoji, label, sub }) => (
                    <button
                      key={type}
                      className="na-role"
                      onClick={() => selectUserType(type)}
                      style={{ background:type==="clinician"?"rgba(124,58,237,.08)":"rgba(0,200,180,.05)", border:`1px solid ${type==="clinician"?"rgba(124,58,237,.3)":"rgba(0,200,180,.22)"}`, borderRadius:"12px", padding:"13px 14px", textAlign:"left" }}
                    >
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"20px" }}>{emoji}</span>
                        <div>
                          <div style={{ color:"#fff", fontWeight:600, fontSize:"13px" }}>{label}</div>
                          <div style={{ color:"rgba(255,255,255,.3)", fontSize:"11px", marginTop:"2px" }}>{sub}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── "What's on this page?" quick button + initial chips ── */}
            {userType && messages.length === 0 && (
              <div>
                <button
                  className="na-chip"
                  onClick={() => sendMessage(`What's happening on the ${page.label} page?`)}
                  style={{ width:"100%", background:"linear-gradient(135deg,rgba(124,58,237,.12),rgba(124,58,237,.04))", border:"1px solid rgba(124,58,237,.3)", borderRadius:"10px", padding:"11px 14px", color:"rgba(167,139,250,.9)", fontSize:"12px", fontWeight:600, cursor:"pointer", textAlign:"center", marginBottom:"10px" }}
                >
                  👁 What&apos;s happening on this page?
                </button>
                <div style={{ color:"rgba(255,255,255,.25)", fontSize:"11px", marginBottom:"8px", textAlign:"center" }}>
                  or ask something specific:
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                  {initialSuggestions.map((s, i) => (
                    <button
                      key={s}
                      className="na-chip na-chip-anim"
                      onClick={() => sendMessage(s)}
                      style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:"8px", padding:"7px 11px", color:"rgba(255,255,255,.45)", fontSize:"12px", cursor:"pointer", textAlign:"left", animationDelay:`${i * 0.05}s` }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Message list ── */}
            {messages.map((m, i) => (
              <div key={m.id} className="na-grp">
                {m.isSystem ? (
                  <div className="na-msg" style={{ display:"flex", justifyContent:"center" }}>
                    <div style={{ background:"rgba(124,58,237,.07)", border:"1px solid rgba(124,58,237,.15)", borderRadius:"7px", padding:"5px 11px", color:"rgba(167,139,250,.6)", fontSize:"10px" }}>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div
                    className="na-msg"
                    style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start", gap:"4px" }}
                  >
                    <div style={{ maxWidth:"85%", padding:"9px 13px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?`linear-gradient(135deg,${roleColor},${userType==="clinician"?"#3730a3":"#007a8a"})`:"rgba(255,255,255,.05)", color:"#fff", fontSize:"13px", lineHeight:"1.55", border:m.role==="user"?"none":"1px solid rgba(255,255,255,.07)" }}>
                      {m.content}
                    </div>

                    {/* Timestamp + action buttons */}
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", paddingLeft:m.role==="user"?"0":"2px", paddingRight:m.role==="user"?"2px":"0" }}>
                      <span style={{ color:"rgba(255,255,255,.18)", fontSize:"10px" }}>
                        {m.time ? formatTime(m.time) : ""}
                      </span>
                      {m.role === "assistant" && !m.isSystem && (
                        <>
                          <button className="na-act" onClick={() => copyMessage(m.content, m.id)} style={{ background:"none", border:"none", color:copiedId===m.id?"#7c3aed":"rgba(255,255,255,.25)", cursor:"pointer", padding:"2px", display:"flex", alignItems:"center" }}>
                            {copiedId === m.id ? <span style={{ fontSize:"10px" }}>✓</span> : <CopyIcon />}
                          </button>
                          <button className="na-act" onClick={() => setFeedbackFor(m.id, "up")} style={{ background:"none", border:"none", color:feedback[m.id]==="up"?"#7c3aed":"rgba(255,255,255,.25)", cursor:"pointer", padding:"2px", display:"flex", alignItems:"center" }}>
                            <ThumbIcon up={true} />
                          </button>
                          <button className="na-act" onClick={() => setFeedbackFor(m.id, "down")} style={{ background:"none", border:"none", color:feedback[m.id]==="down"?"#ff6b6b":"rgba(255,255,255,.25)", cursor:"pointer", padding:"2px", display:"flex", alignItems:"center" }}>
                            <ThumbIcon up={false} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Follow-up suggestion chips after last assistant message */}
                    {m.role === "assistant" && !m.isSystem && i === messages.length - 1 && activeSuggestions && activeSuggestions.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:"4px", width:"100%", maxWidth:"92%" }}>
                        {activeSuggestions.map((s, si) => (
                          <button
                            key={s}
                            className="na-chip na-chip-anim"
                            onClick={() => sendMessage(s)}
                            style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:"7px", padding:"6px 10px", color:"rgba(255,255,255,.38)", fontSize:"11px", cursor:"pointer", textAlign:"left", animationDelay:`${si * 0.06}s` }}
                          >
                            ↳ {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="na-msg" style={{ display:"flex" }}>
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.07)", display:"flex", gap:"4px", alignItems:"center" }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width:"5px", height:"5px", borderRadius:"50%", background:roleColor, animation:`na-blink 1.1s ${i * 0.18}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          {userType && (
            <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,.05)", display:"flex", gap:"7px", background:"rgba(0,0,0,.12)", flexShrink:0 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={`Ask about ${page.label}...`}
                style={{ flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:"9px", padding:"8px 12px", color:"#fff", fontSize:"12px", outline:"none" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{ background:`linear-gradient(135deg,${roleColor},#3730a3)`, border:"none", borderRadius:"9px", width:"34px", height:"34px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:loading || !input.trim() ? 0.3 : 1, transition:"opacity .2s", flexShrink:0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAB (hidden while minimized — the bar replaces it) ─────────────── */}
      {chatState !== "minimized" && (
        <button
          className="na-fab"
          onClick={() => setChatState((s) => (s === "open" ? "closed" : "open"))}
          style={{ position:"fixed", bottom:"24px", right:"24px", width:"52px", height:"52px", borderRadius:"15px", background:"linear-gradient(135deg,#7c3aed,#4f6ef7)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 24px rgba(124,58,237,.35)", zIndex:10000 }}
        >
          {chatState === "open" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          ) : (
            <ChatIcon />
          )}
          {unread > 0 && chatState === "closed" && (
            <div
              className="na-badge"
              style={{ position:"absolute", top:"7px", right:"7px", width:"18px", height:"18px", borderRadius:"50%", background:"#ff5f5f", border:"2px solid #0a0e1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", color:"#fff", fontWeight:700 }}
            >
              {unread}
            </div>
          )}
        </button>
      )}
    </>
  );
}
