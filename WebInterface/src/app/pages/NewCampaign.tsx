"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  Mail,
  PauseCircle,
  Play,
  Radar,
  RefreshCw,
  Terminal,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { AIProcessing } from "../components/AIProcessing";
import { streamCampaignAgent, type AgentPauseResponder } from "../../lib/agent-stream";
import type {
  AgentDraftCard,
  AgentLiveMetrics,
  AgentPausePayload,
  AgentRoundComplete,
  AgentRunResult,
  AgentSegmentCard,
  AgentThinkingStep,
} from "../../lib/types";

const DEFAULT_BRIEF =
  "Run email campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 percentage point higher returns than its competitors. Announce an additional 0.25 percentage point higher returns for female senior citizens. Optimise for open rate and click rate. Don't skip emails to customers marked 'inactive'. Include the call to action: https://superbfsi.com/xdeposit/explore/";
const DEFAULT_ROUNDS = 3;
const IDLE_THRESHOLD_MS = 950;

type RunPhase = "idle" | "running" | "paused" | "complete" | "error";

function formatPercent(value?: number | null) {
  const safe = Number(value ?? 0);
  return `${safe.toFixed(1)}%`;
}

function formatCount(value?: number | null) {
  return (Number(value ?? 0) || 0).toLocaleString();
}

function phaseLabel(phase: RunPhase) {
  switch (phase) {
    case "running":
      return "Streaming live";
    case "paused":
      return "Waiting for approval";
    case "complete":
      return "Completed";
    case "error":
      return "Run failed";
    default:
      return "Ready";
  }
}

function phaseColor(phase: RunPhase) {
  switch (phase) {
    case "running":
      return { text: "#99f6e4", bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.28)" };
    case "paused":
      return { text: "#fdba74", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.28)" };
    case "complete":
      return { text: "#86efac", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.28)" };
    case "error":
      return { text: "#fca5a5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)" };
    default:
      return { text: "#cbd5e1", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.22)" };
  }
}

function toSegmentCardsFromResult(result: AgentRunResult | null): AgentSegmentCard[] {
  if (!result) {
    return [];
  }

  return result.segments.map((segment, index) => ({
    segmentId: `segment-${index + 1}`,
    name: segment.name,
    size: segment.size,
    criteria: segment.criteria,
    tone: segment.tone,
    focus: segment.focus,
    tier: index === 0 ? "Priority" : "Active",
  }));
}

function toDraftCardsFromResult(result: AgentRunResult | null): AgentDraftCard[] {
  if (!result) {
    return [];
  }

  return result.contentVariants.map((draft, index) => ({
    segmentId: `draft-${index + 1}`,
    segmentName: draft.variant || `Audience ${index + 1}`,
    size: 0,
    subject: draft.subject,
    body: draft.body,
    tone: draft.tone,
    tags: draft.tags,
  }));
}

function pushUniqueStep(
  current: AgentThinkingStep[],
  next: AgentThinkingStep,
  limit = 48
): AgentThinkingStep[] {
  const normalized = {
    agent: next.agent || "Agent",
    step: next.step || "",
    kind: next.kind || "status",
  };
  const last = current[current.length - 1];
  if (last && last.agent === normalized.agent && last.step === normalized.step && last.kind === normalized.kind) {
    return current;
  }
  return [...current, normalized].slice(-limit);
}

function Surface({
  title,
  eyebrow,
  right,
  children,
}: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[30px] p-5 md:p-6"
      style={{
        background: "linear-gradient(180deg, rgba(6,14,25,0.92) 0%, rgba(9,16,30,0.98) 100%)",
        border: "1px solid rgba(148,163,184,0.14)",
        boxShadow: "0 24px 80px rgba(2, 6, 23, 0.35)",
      }}
    >
      <div className="flex items-start gap-4 justify-between mb-5">
        <div>
          {eyebrow && (
            <div className="uppercase tracking-[0.2em] text-slate-500" style={{ fontSize: "0.68rem" }}>
              {eyebrow}
            </div>
          )}
          <h3 className="text-white mt-1" style={{ fontSize: "1rem", fontWeight: 700 }}>
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  icon: ElementType;
}) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: `${accent}12`,
        border: `1px solid ${accent}24`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-300" style={{ fontSize: "0.75rem" }}>
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center"
          style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}
        >
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
        {value}
      </div>
      <div className="mt-1" style={{ color: accent, fontSize: "0.72rem" }}>
        {hint}
      </div>
    </div>
  );
}

export default function NewCampaign() {
  const router = useRouter();
  const pauseResponderRef = useRef<AgentPauseResponder | null>(null);
  const lastActivityAtRef = useRef(Date.now());

  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [isIdle, setIsIdle] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<AgentThinkingStep[]>([]);
  const [pendingPause, setPendingPause] = useState<AgentPausePayload | null>(null);
  const [segmentCards, setSegmentCards] = useState<AgentSegmentCard[]>([]);
  const [draftCards, setDraftCards] = useState<AgentDraftCard[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<AgentLiveMetrics[]>([]);
  const [roundHistory, setRoundHistory] = useState<AgentRoundComplete[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [displayedTerminal, setDisplayedTerminal] = useState("");
  const terminalRef = useRef<HTMLPreElement>(null);
  const pendingCharsRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const TERMINAL_MAX = 32_000;
  const CHARS_PER_FRAME = 3;

  // Typewriter reveal loop — pulls chars from buffer into displayed state
  const startTypewriter = useCallback(() => {
    if (rafIdRef.current !== null) return; // already running

    const tick = () => {
      const pending = pendingCharsRef.current;
      if (pending.length === 0) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const batch = pending.splice(0, CHARS_PER_FRAME).join("");
      setDisplayedTerminal((prev) => {
        const next = prev + batch;
        return next.length > TERMINAL_MAX ? next.slice(-TERMINAL_MAX) : next;
      });

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTypewriter = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Flush remaining buffer immediately
    if (pendingCharsRef.current.length > 0) {
      const remaining = pendingCharsRef.current.splice(0).join("");
      setDisplayedTerminal((prev) => {
        const next = prev + remaining;
        return next.length > TERMINAL_MAX ? next.slice(-TERMINAL_MAX) : next;
      });
    }
  }, []);

  const enqueueTerminal = useCallback((text: string) => {
    for (const ch of text) {
      pendingCharsRef.current.push(ch);
    }
  }, []);

  // Start/stop typewriter based on phase
  useEffect(() => {
    if (phase === "running") {
      startTypewriter();
    } else {
      stopTypewriter();
    }
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [phase, startTypewriter, stopTypewriter]);

  // Auto-scroll terminal when new text is revealed
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [displayedTerminal]);

  useEffect(() => {
    if (phase !== "running") {
      setIsIdle(false);
      return;
    }

    const timer = window.setInterval(() => {
      setIsIdle(Date.now() - lastActivityAtRef.current > IDLE_THRESHOLD_MS);
    }, 180);

    return () => window.clearInterval(timer);
  }, [phase]);

  const latestMetrics = useMemo(
    () => metricsHistory[metricsHistory.length - 1] ?? null,
    [metricsHistory]
  );

  const displayedSegments = useMemo(() => {
    if (segmentCards.length > 0) {
      return segmentCards;
    }
    return toSegmentCardsFromResult(result);
  }, [result, segmentCards]);

  const displayedDrafts = useMemo(() => {
    if (draftCards.length > 0) {
      return draftCards;
    }
    return toDraftCardsFromResult(result);
  }, [draftCards, result]);

  const currentPalette = phaseColor(phase);
  const canStart = brief.trim().length > 0 && phase !== "running" && phase !== "paused";

  const touchActivity = (syncIdle = false) => {
    lastActivityAtRef.current = Date.now();
    if (syncIdle) {
      setIsIdle(false);
    }
  };

  const resetRun = () => {
    pauseResponderRef.current = null;
    setPhase("idle");
    setIsIdle(false);
    setThinkingSteps([]);
    setPendingPause(null);
    setSegmentCards([]);
    setDraftCards([]);
    setMetricsHistory([]);
    setRoundHistory([]);
    setResult(null);
    setError(null);
    setDisplayedTerminal("");
    pendingCharsRef.current = [];
    setTerminalOpen(true);
    touchActivity(true);
  };

  const answerCheckpoint = (response: Record<string, unknown>) => {
    const responder = pauseResponderRef.current;
    if (!responder) {
      return;
    }
    pauseResponderRef.current = null;
    setPendingPause(null);
    setPhase("running");
    touchActivity(true);
    responder(response);
  };

  const handleApprove = () => {
    if (!pendingPause) {
      return;
    }
    if (pendingPause.pauseType === "next_round") {
      answerCheckpoint({ continueOptimization: true });
      return;
    }
    answerCheckpoint({ approved: true });
  };

  const handleStopOptimization = () => {
    answerCheckpoint({ continueOptimization: false });
  };

  const handleStart = async () => {
    if (!brief.trim()) {
      return;
    }

    pauseResponderRef.current = null;
    setPhase("running");
    setIsIdle(false);
    setThinkingSteps([]);
    setPendingPause(null);
    setSegmentCards([]);
    setDraftCards([]);
    setMetricsHistory([]);
    setRoundHistory([]);
    setResult(null);
    setError(null);
    setDisplayedTerminal("");
    pendingCharsRef.current = [];
    touchActivity(true);

    try {
      const finalResult = await streamCampaignAgent(brief, {
        rounds: DEFAULT_ROUNDS,
        onHeartbeat: () => {
          touchActivity();
        },
        onThinking: (step) => {
          touchActivity(true);
          setThinkingSteps((current) => pushUniqueStep(current, step));
        },
        onPause: (pause, respond) => {
          touchActivity(true);
          pauseResponderRef.current = respond;
          setPendingPause(pause);
          if (pause.segments && pause.segments.length > 0) {
            setSegmentCards(pause.segments);
          }
          if (pause.variants && pause.variants.length > 0) {
            setDraftCards(pause.variants);
          }
          setPhase("paused");
        },
        onLiveMetrics: (metrics) => {
          touchActivity(true);
          setPhase("running");
          setMetricsHistory((current) => {
            const previous = current[current.length - 1];
            if (
              previous &&
              previous.round === metrics.round &&
              previous.sent === metrics.sent &&
              previous.opened === metrics.opened &&
              previous.clicked === metrics.clicked
            ) {
              return current;
            }
            return [...current, metrics].slice(-24);
          });
        },
        onTerminal: (text) => {
          touchActivity();
          enqueueTerminal(text);
        },
        onRoundComplete: (round) => {
          touchActivity(true);
          setRoundHistory((current) => {
            const previous = current[current.length - 1];
            if (previous && previous.round === round.round) {
              return [...current.slice(0, -1), round];
            }
            return [...current, round];
          });
        },
      });

      setResult(finalResult);
      setSegmentCards((current) => (current.length > 0 ? current : toSegmentCardsFromResult(finalResult)));
      setDraftCards((current) => (current.length > 0 ? current : toDraftCardsFromResult(finalResult)));
      setPendingPause(null);
      pauseResponderRef.current = null;
      setPhase("complete");
      touchActivity(true);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Campaign agent execution failed.";
      setError(message);
      setThinkingSteps((current) =>
        pushUniqueStep(current, {
          agent: "Orchestrator",
          step: message,
          kind: "final",
        })
      );
      setPendingPause(null);
      pauseResponderRef.current = null;
      setPhase("error");
    }
  };

  return (
    <div
      className="min-h-screen pt-20 pb-14 px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #020617 0%, #07111f 45%, #0b1729 100%)" }}
    >
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-20 left-[-8%] w-[32rem] h-[32rem] rounded-full blur-3xl"
          style={{ background: "rgba(20, 184, 166, 0.14)" }}
        />
        <div
          className="absolute top-[28%] right-[-12%] w-[34rem] h-[34rem] rounded-full blur-3xl"
          style={{ background: "rgba(249, 115, 22, 0.12)" }}
        />
        <div
          className="absolute bottom-[-12rem] left-[24%] w-[28rem] h-[28rem] rounded-full blur-3xl"
          style={{ background: "rgba(56, 189, 248, 0.08)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 justify-between mb-8"
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            style={{ fontSize: "0.86rem" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(15,23,42,0.86)",
                border: "1px solid rgba(148,163,184,0.16)",
                color: "#cbd5e1",
                fontSize: "0.76rem",
              }}
            >
              WebSocket transport only
            </div>
            <div
              className="px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(15,23,42,0.86)",
                border: "1px solid rgba(148,163,184,0.16)",
                color: "#cbd5e1",
                fontSize: "0.76rem",
              }}
            >
              Default optimization rounds: {DEFAULT_ROUNDS}
            </div>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[36px] p-6 md:p-8 mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(10,25,47,0.96) 0%, rgba(15,23,42,0.96) 42%, rgba(8,47,73,0.88) 100%)",
            border: "1px solid rgba(148,163,184,0.18)",
            boxShadow: "0 30px 90px rgba(2, 6, 23, 0.45)",
          }}
        >
          <div className="grid xl:grid-cols-[1.2fr,0.8fr] gap-8 items-start">
            <div>
              <div className="uppercase tracking-[0.24em] text-teal-300" style={{ fontSize: "0.72rem" }}>
                Agent control room
              </div>
              <h1
                className="text-white mt-3 max-w-3xl"
                style={{ fontSize: "clamp(2rem, 4vw, 3.6rem)", lineHeight: 1.02, fontWeight: 800 }}
              >
                Frontend now brokers only the live agent stream.
              </h1>
              <p className="text-slate-300 mt-4 max-w-2xl" style={{ fontSize: "0.98rem", lineHeight: 1.75 }}>
                The browser no longer generates content, picks models, or runs LangGraph logic. It opens the agent
                websocket, renders reasoning, pauses at human checkpoints, sends your approval back, and shows final
                campaign output when the agents runtime is done.
              </p>
            </div>

            <div
              className="rounded-[28px] p-5"
              style={{
                background: "rgba(3, 10, 20, 0.74)",
                border: `1px solid ${currentPalette.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-slate-400 uppercase tracking-[0.18em]" style={{ fontSize: "0.64rem" }}>
                    Current run state
                  </div>
                  <div className="text-white mt-2" style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    {phaseLabel(phase)}
                  </div>
                </div>
                <div
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    background: currentPalette.bg,
                    border: `1px solid ${currentPalette.border}`,
                    color: currentPalette.text,
                    fontSize: "0.76rem",
                  }}
                >
                  {phase.toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <StatTile
                  label="Audience"
                  value={formatCount(result?.customerCount ?? latestMetrics?.sent)}
                  hint="Tracked from agents"
                  accent="#2dd4bf"
                  icon={Users}
                />
                <StatTile
                  label="Open rate"
                  value={formatPercent(result?.finalOpenRate ?? latestMetrics?.openRate)}
                  hint="Live performance"
                  accent="#38bdf8"
                  icon={TrendingUp}
                />
                <StatTile
                  label="Click rate"
                  value={formatPercent(result?.finalClickRate ?? latestMetrics?.clickRate)}
                  hint="Live performance"
                  accent="#fb7185"
                  icon={Activity}
                />
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid xl:grid-cols-[1.25fr,0.75fr] gap-6 items-start">
          <div className="space-y-6">
            <Surface
              eyebrow="Mission brief"
              title="Campaign objective"
              right={
                <div className="flex items-center gap-2 text-slate-300" style={{ fontSize: "0.74rem" }}>
                  <ShieldCheck className="w-4 h-4 text-teal-300" />
                  agents/.env only
                </div>
              }
            >
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                disabled={phase === "running" || phase === "paused"}
                className="w-full min-h-[12rem] resize-none rounded-[24px] p-5 outline-none"
                style={{
                  background: "rgba(2, 6, 23, 0.86)",
                  border: "1px solid rgba(148,163,184,0.16)",
                  color: "#e2e8f0",
                  fontSize: "0.95rem",
                  lineHeight: 1.8,
                }}
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <motion.button
                  whileHover={canStart ? { scale: 1.02 } : {}}
                  whileTap={canStart ? { scale: 0.98 } : {}}
                  onClick={handleStart}
                  disabled={!canStart}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[18px] text-white"
                  style={{
                    background: canStart
                      ? "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)"
                      : "rgba(51,65,85,0.55)",
                    border: "1px solid rgba(148,163,184,0.16)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: canStart ? "pointer" : "not-allowed",
                    opacity: canStart ? 1 : 0.6,
                  }}
                >
                  <Play className="w-4 h-4" />
                  Start agent run
                </motion.button>

                <button
                  onClick={resetRun}
                  disabled={phase === "running" || phase === "paused"}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[18px] text-slate-200"
                  style={{
                    background: "rgba(15,23,42,0.82)",
                    border: "1px solid rgba(148,163,184,0.16)",
                    fontSize: "0.9rem",
                    opacity: phase === "running" || phase === "paused" ? 0.5 : 1,
                    cursor: phase === "running" || phase === "paused" ? "not-allowed" : "pointer",
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset board
                </button>
              </div>
            </Surface>

            <AIProcessing
              steps={thinkingSteps}
              isComplete={phase === "complete"}
              isIdle={isIdle}
              title="Campaign Agent Thinking"
            />

            {(phase !== "idle" || displayedTerminal) && (
              <section
                className="rounded-[28px] overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, rgba(2,6,15,0.96) 0%, rgba(4,10,19,0.99) 100%)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  boxShadow: "0 16px 60px rgba(2, 6, 23, 0.3)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setTerminalOpen((o) => !o)}
                  className="w-full px-6 py-4 flex items-center justify-between"
                  style={{
                    borderBottom: terminalOpen ? "1px solid rgba(148,163,184,0.1)" : "none",
                    background: "rgba(15,23,42,0.6)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.2)" }}
                    >
                      <Terminal className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-white tracking-[0.14em] uppercase" style={{ fontSize: "0.68rem" }}>
                        Live process output
                      </div>
                      <div className="text-slate-300 mt-0.5" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                        Agent Terminal
                      </div>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: terminalOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {terminalOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <pre
                        ref={terminalRef}
                        className="px-5 py-4 max-h-[24rem] overflow-y-auto"
                        style={{
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                          fontSize: "0.78rem",
                          lineHeight: 1.7,
                          color: "#94a3b8",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          margin: 0,
                          background: "transparent",
                        }}
                      >
                        {displayedTerminal ? (
                          <>
                            {displayedTerminal}
                            {phase === "running" && (
                              <motion.span
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                style={{ color: "#2dd4bf" }}
                              >
                                ▋
                              </motion.span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#475569" }}>
                            Waiting for agent process output...
                          </span>
                        )}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {result && (
              <Surface
                eyebrow="Final output"
                title="Strategy and campaign result"
                right={
                  result.savedCampaignId ? (
                    <button
                      onClick={() => router.push(`/campaign/${result.savedCampaignId}/analysis`)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[16px] text-slate-100"
                      style={{
                        background: "rgba(20,184,166,0.14)",
                        border: "1px solid rgba(20,184,166,0.24)",
                        fontSize: "0.76rem",
                      }}
                    >
                      Open analysis
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : null
                }
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div
                    className="rounded-[24px] p-5"
                    style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.14)" }}
                  >
                    <div className="flex items-center gap-2 text-teal-300 mb-3" style={{ fontSize: "0.74rem" }}>
                      <BrainCircuit className="w-4 h-4" />
                      Strategy summary
                    </div>
                    <p className="text-slate-100 whitespace-pre-wrap" style={{ fontSize: "0.88rem", lineHeight: 1.8 }}>
                      {result.strategyReasoning ||
                        result.strategy ||
                        "The agent completed the workflow and returned the final campaign package."}
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div
                      className="rounded-[24px] p-5"
                      style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.14)" }}
                    >
                      <div className="text-slate-400 uppercase tracking-[0.16em]" style={{ fontSize: "0.64rem" }}>
                        Final rates
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <div className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                            {formatPercent(result.finalOpenRate)}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            Final open rate
                          </div>
                        </div>
                        <div>
                          <div className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                            {formatPercent(result.finalClickRate)}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            Final click rate
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-[24px] p-5"
                      style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.14)" }}
                    >
                      <div className="text-slate-400 uppercase tracking-[0.16em]" style={{ fontSize: "0.64rem" }}>
                        Delivery footprint
                      </div>
                      <div className="flex items-end gap-6 mt-4">
                        <div>
                          <div className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                            {formatCount(result.customerCount)}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            Total customers
                          </div>
                        </div>
                        <div>
                          <div className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                            {formatCount(result.metricsProgression.length)}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            Completed rounds
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Surface>
            )}
          </div>

          <div className="space-y-6">
            <Surface
              eyebrow="Run telemetry"
              title="Mission state"
              right={
                <div
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    background: currentPalette.bg,
                    border: `1px solid ${currentPalette.border}`,
                    color: currentPalette.text,
                    fontSize: "0.74rem",
                  }}
                >
                  {phaseLabel(phase)}
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Reasoning steps"
                  value={formatCount(thinkingSteps.length)}
                  hint="Structured events"
                  accent="#2dd4bf"
                  icon={Workflow}
                />
                <StatTile
                  label="Live rounds"
                  value={formatCount(roundHistory.length)}
                  hint="Closed rounds"
                  accent="#f59e0b"
                  icon={Clock3}
                />
                <StatTile
                  label="Categories"
                  value={formatCount(displayedSegments.length)}
                  hint="Approval-ready groups"
                  accent="#38bdf8"
                  icon={Layers3}
                />
                <StatTile
                  label="Drafts"
                  value={formatCount(displayedDrafts.length)}
                  hint="Audience messages"
                  accent="#fb7185"
                  icon={Mail}
                />
              </div>
            </Surface>

            <AnimatePresence initial={false}>
              {pendingPause && (
                <motion.div
                  key={pendingPause.pauseType}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Surface
                    eyebrow="Human checkpoint"
                    title={pendingPause.title || "Approval required"}
                    right={<PauseCircle className="w-5 h-5 text-orange-300" />}
                  >
                    <p className="text-slate-300" style={{ fontSize: "0.86rem", lineHeight: 1.7 }}>
                      {pendingPause.message ||
                        "The agent has paused and is waiting for your decision before continuing."}
                    </p>

                    {pendingPause.pauseType === "next_round" && pendingPause.metrics && (
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <StatTile
                          label="Audience"
                          value={formatCount(pendingPause.metrics.audience)}
                          hint="Current round"
                          accent="#2dd4bf"
                          icon={Users}
                        />
                        <StatTile
                          label="Open"
                          value={formatPercent(pendingPause.metrics.openRate)}
                          hint="Current round"
                          accent="#38bdf8"
                          icon={TrendingUp}
                        />
                        <StatTile
                          label="Click"
                          value={formatPercent(pendingPause.metrics.clickRate)}
                          hint="Current round"
                          accent="#fb7185"
                          icon={Activity}
                        />
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleApprove}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-[18px] text-white"
                        style={{
                          background: "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)",
                          fontSize: "0.88rem",
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {pendingPause.pauseType === "next_round" ? "Run next round" : "Approve all"}
                      </motion.button>

                      {pendingPause.pauseType === "next_round" && (
                        <button
                          onClick={handleStopOptimization}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-[18px] text-slate-100"
                          style={{
                            background: "rgba(127,29,29,0.22)",
                            border: "1px solid rgba(248,113,113,0.24)",
                            fontSize: "0.88rem",
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                          Stop here
                        </button>
                      )}
                    </div>
                  </Surface>
                </motion.div>
              )}
            </AnimatePresence>

            <Surface
              eyebrow="Audience map"
              title="Customer categories"
              right={<Users className="w-5 h-5 text-teal-300" />}
            >
              {displayedSegments.length === 0 ? (
                <div
                  className="rounded-[24px] p-5 text-slate-400"
                  style={{ background: "rgba(15,23,42,0.56)", border: "1px dashed rgba(148,163,184,0.16)" }}
                >
                  Categories appear here after the segment approval checkpoint.
                </div>
              ) : (
                <div className="grid gap-3">
                  {displayedSegments.map((segment) => (
                    <div
                      key={segment.segmentId}
                      className="rounded-[24px] p-4"
                      style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.12)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                            {segment.name}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            {formatCount(segment.size)} customers
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {segment.tier && (
                            <span
                              className="px-2 py-1 rounded-full"
                              style={{ background: "rgba(20,184,166,0.12)", color: "#99f6e4", fontSize: "0.68rem" }}
                            >
                              {segment.tier}
                            </span>
                          )}
                          {segment.tone && (
                            <span
                              className="px-2 py-1 rounded-full"
                              style={{ background: "rgba(56,189,248,0.12)", color: "#7dd3fc", fontSize: "0.68rem" }}
                            >
                              {segment.tone}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-300 mt-3" style={{ fontSize: "0.8rem", lineHeight: 1.7 }}>
                        {segment.criteria || segment.focus || "Criteria not provided by the agent."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Surface>

            <Surface
              eyebrow="Content approval"
              title="Audience drafts"
              right={<Send className="w-5 h-5 text-rose-300" />}
            >
              {displayedDrafts.length === 0 ? (
                <div
                  className="rounded-[24px] p-5 text-slate-400"
                  style={{ background: "rgba(15,23,42,0.56)", border: "1px dashed rgba(148,163,184,0.16)" }}
                >
                  Drafts appear here when the agent reaches the content approval checkpoint.
                </div>
              ) : (
                <div className="grid gap-3">
                  {displayedDrafts.map((draft, index) => (
                    <div
                      key={`${draft.segmentId}-${index}`}
                      className="rounded-[24px] p-4"
                      style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.12)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                            {draft.segmentName}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.74rem" }}>
                            Subject line ready for approval
                          </div>
                        </div>
                        {draft.tone && (
                          <span
                            className="px-2 py-1 rounded-full"
                            style={{ background: "rgba(251,113,133,0.12)", color: "#fda4af", fontSize: "0.68rem" }}
                          >
                            {draft.tone}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 rounded-[20px] p-4" style={{ background: "rgba(2,6,23,0.78)" }}>
                        <div className="text-slate-500 uppercase tracking-[0.16em]" style={{ fontSize: "0.64rem" }}>
                          Subject
                        </div>
                        <div className="text-slate-100 mt-2" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                          {draft.subject}
                        </div>
                        <div
                          className="text-slate-500 uppercase tracking-[0.16em] mt-4"
                          style={{ fontSize: "0.64rem" }}
                        >
                          Body preview
                        </div>
                        <p
                          className="text-slate-300 mt-2 whitespace-pre-wrap line-clamp-5"
                          style={{ fontSize: "0.8rem", lineHeight: 1.7 }}
                        >
                          {draft.body}
                        </p>
                      </div>

                      {draft.tags && draft.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {draft.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 rounded-full"
                              style={{ background: "rgba(45,212,191,0.1)", color: "#99f6e4", fontSize: "0.66rem" }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1fr,0.9fr] gap-6 mt-6">
          <Surface
            eyebrow="Live telemetry"
            title="Performance stream"
            right={<Radar className="w-5 h-5 text-cyan-300" />}
          >
            {!latestMetrics ? (
              <div
                className="rounded-[24px] p-5 text-slate-400"
                style={{ background: "rgba(15,23,42,0.56)", border: "1px dashed rgba(148,163,184,0.16)" }}
              >
                Live open and click updates will land here once the agent starts dispatching.
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  <StatTile
                    label="Sent"
                    value={formatCount(latestMetrics.sent)}
                    hint={`Round ${latestMetrics.round}`}
                    accent="#2dd4bf"
                    icon={Send}
                  />
                  <StatTile
                    label="Opened"
                    value={formatCount(latestMetrics.opened)}
                    hint={formatPercent(latestMetrics.openRate)}
                    accent="#38bdf8"
                    icon={TrendingUp}
                  />
                  <StatTile
                    label="Clicked"
                    value={formatCount(latestMetrics.clicked)}
                    hint={formatPercent(latestMetrics.clickRate)}
                    accent="#fb7185"
                    icon={Activity}
                  />
                </div>

                <div className="grid gap-3">
                  {latestMetrics.bySegment.map((segment) => (
                    <div
                      key={`${latestMetrics.round}-${segment.segmentName}`}
                      className="rounded-[24px] p-4"
                      style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.12)" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-white" style={{ fontSize: "0.86rem", fontWeight: 600 }}>
                            {segment.segmentName}
                          </div>
                          <div className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                            {formatCount(segment.sent)} delivered in this stream snapshot
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-slate-100" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                              {formatPercent(segment.openRate)}
                            </div>
                            <div className="text-slate-500" style={{ fontSize: "0.66rem" }}>
                              Open
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-slate-100" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                              {formatPercent(segment.clickRate)}
                            </div>
                            <div className="text-slate-500" style={{ fontSize: "0.66rem" }}>
                              Click
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Surface>

          <Surface
            eyebrow="Optimization trace"
            title="Round history"
            right={<Sparkles className="w-5 h-5 text-amber-300" />}
          >
            {roundHistory.length === 0 ? (
              <div
                className="rounded-[24px] p-5 text-slate-400"
                style={{ background: "rgba(15,23,42,0.56)", border: "1px dashed rgba(148,163,184,0.16)" }}
              >
                Completed round summaries appear here after each optimization pass.
              </div>
            ) : (
              <div className="space-y-3">
                {roundHistory.map((round) => (
                  <div
                    key={round.round}
                    className="rounded-[24px] p-4"
                    style={{ background: "rgba(15,23,42,0.58)", border: "1px solid rgba(148,163,184,0.12)" }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-white" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                          Optimization round {round.round}
                        </div>
                        <div className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                          {formatCount(round.summary.audience)} audience across {round.summary.segments} groups
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div
                        className="rounded-[18px] p-3"
                        style={{ background: "rgba(14,116,144,0.12)", border: "1px solid rgba(56,189,248,0.16)" }}
                      >
                        <div className="text-white" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                          {formatPercent(round.summary.openRate)}
                        </div>
                        <div className="text-sky-300 mt-1" style={{ fontSize: "0.68rem" }}>
                          Open rate
                        </div>
                      </div>
                      <div
                        className="rounded-[18px] p-3"
                        style={{ background: "rgba(159,18,57,0.12)", border: "1px solid rgba(251,113,133,0.16)" }}
                      >
                        <div className="text-white" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                          {formatPercent(round.summary.clickRate)}
                        </div>
                        <div className="text-rose-300 mt-1" style={{ fontSize: "0.68rem" }}>
                          Click rate
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-[28px] p-5"
            style={{
              background: "rgba(127,29,29,0.2)",
              border: "1px solid rgba(248,113,113,0.24)",
            }}
          >
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-rose-200" style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                  Agent run failed
                </div>
                <p className="text-rose-100/90 mt-1" style={{ fontSize: "0.82rem", lineHeight: 1.7 }}>
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
