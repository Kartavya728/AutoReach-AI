"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  Activity,
  Brain,
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  Gauge,
  Hand,
  Mail,
  Radar,
  Sparkles,
  Target,
} from "lucide-react";

interface AIProcessingProps {
  steps: { step: string; agent: string; kind?: string }[];
  isComplete?: boolean;
  title?: string;
  mode?: "timeline" | "terminal";
  terminalText?: string;
  isIdle?: boolean;
}

const kindConfig: Record<string, { label: string; color: string; border: string }> = {
  thought: { label: "Thought", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
  action: { label: "Action", color: "#38bdf8", border: "rgba(56, 189, 248, 0.3)" },
  observation: { label: "Observation", color: "#34d399", border: "rgba(52, 211, 153, 0.3)" },
  final: { label: "Final", color: "#fb7185", border: "rgba(251, 113, 133, 0.3)" },
  pause: { label: "Pause", color: "#f97316", border: "rgba(249, 115, 22, 0.3)" },
  resume: { label: "Resume", color: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
  metrics: { label: "Metrics", color: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  dispatch: { label: "Dispatch", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.3)" },
  summary: { label: "Summary", color: "#f43f5e", border: "rgba(244, 63, 94, 0.3)" },
  decision: { label: "Decision", color: "#14b8a6", border: "rgba(20, 184, 166, 0.3)" },
  status: { label: "Status", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" },
};

const agentIcons: Record<string, ElementType> = {
  Orchestrator: Compass,
  "ReAct-Agent": Brain,
  "Tool-Executor": Cpu,
  Analyzer: Eye,
  "Human-Gate": Hand,
  "Dispatch-Agent": Mail,
  "Metrics-Agent": Gauge,
  Optimizer: Target,
};

function Dots({ active }: { active: boolean }) {
  const frames = useMemo(() => [".", "..", "...", "..", "."], []);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % frames.length);
    }, 240);

    return () => window.clearInterval(timer);
  }, [active, frames]);

  return <span className="inline-block min-w-4 text-left">{active ? frames[index] : ""}</span>;
}

function AnimatedMessage({
  text,
  onComplete,
  onUpdate,
}: {
  text: string;
  onComplete: () => void;
  onUpdate?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const hasCompleted = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let index = 0;
    
    // Quick typing effect
    const interval = setInterval(() => {
      index += 1; // reveal 1 char at a time for slower speed
      setDisplayedText(text.slice(0, index));
      onUpdateRef.current?.();
      
      if (index >= text.length) {
        clearInterval(interval);
        if (!hasCompleted.current) {
          hasCompleted.current = true;
          onCompleteRef.current();
        }
      }
    }, 15);

    return () => clearInterval(interval);
  }, [text]);

  return <>{displayedText}</>;
}

export function AIProcessing({
  steps,
  isComplete,
  title,
  isIdle,
}: AIProcessingProps) {
  const latest = steps[steps.length - 1];
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [completedStepIndices, setCompletedStepIndices] = useState<Set<number>>(new Set());

  const thinkingMessages = useMemo(() => [
    "Agent thinking",
    "Revising prompt",
    "Reviewing tool list",
    "Analyzing context",
    "Formulating plan"
  ], []);
  const [thinkingMsgIndex, setThinkingMsgIndex] = useState(0);

  const triggerScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setThinkingMsgIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [isComplete, thinkingMessages]);

  useEffect(() => {
    triggerScroll();
  }, [steps.length, triggerScroll]);

  return (
    <section
      className="rounded-[28px] overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(7,17,31,0.92) 0%, rgba(4,10,19,0.98) 100%)",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 24px 80px rgba(2, 6, 23, 0.45)",
      }}
    >
      <div
        className="px-6 py-5 border-b"
        style={{
          borderColor: "rgba(148,163,184,0.14)",
          background: "linear-gradient(90deg, rgba(15,23,42,0.9) 0%, rgba(17,94,89,0.18) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 30% 30%, rgba(45,212,191,0.34), rgba(15,23,42,0.92))",
              border: "1px solid rgba(45,212,191,0.24)",
            }}
          >
            <motion.div
              animate={!isComplete ? { rotate: 360 } : { rotate: 0 }}
              transition={!isComplete ? { duration: 10, repeat: Infinity, ease: "linear" } : {}}
            >
              <Radar className="w-5 h-5 text-teal-300" />
            </motion.div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-white tracking-[0.18em] uppercase" style={{ fontSize: "0.68rem" }}>
              Live reasoning stream
            </div>
            <h2 className="text-white mt-1" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              {title || "Campaign Agent Thinking"}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div
              className="px-3 py-1.5 rounded-full flex items-center gap-2"
              style={{
                background: isComplete ? "rgba(16,185,129,0.12)" : "rgba(45,212,191,0.1)",
                border: `1px solid ${isComplete ? "rgba(16,185,129,0.24)" : "rgba(45,212,191,0.24)"}`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: isComplete ? "#10b981" : "#2dd4bf" }}
              />
              <span style={{ fontSize: "0.74rem", color: isComplete ? "#6ee7b7" : "#99f6e4" }}>
                {isComplete ? "Run complete" : thinkingMessages[thinkingMsgIndex]}
                {!isComplete && <Dots active={Boolean(isIdle)} />}
              </span>
            </div>
            <div
              className="px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(15,23,42,0.82)",
                border: "1px solid rgba(148,163,184,0.18)",
                color: "#cbd5e1",
                fontSize: "0.74rem",
              }}
            >
              {steps.length} steps
            </div>
          </div>
        </div>

        {latest && (
          <div className="mt-4 flex items-center gap-2 text-slate-300" style={{ fontSize: "0.78rem" }}>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="line-clamp-1">{latest.step}</span>
          </div>
        )}
      </div>

      <div ref={scrollAreaRef} className="px-5 py-5 max-h-[32rem] overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
        {steps.length === 0 ? (
          <div
            className="rounded-[22px] px-5 py-8 text-center"
            style={{
              background: "rgba(15,23,42,0.52)",
              border: "1px dashed rgba(148,163,184,0.2)",
            }}
          >
            <div className="flex items-center justify-center gap-2 text-slate-300" style={{ fontSize: "0.92rem" }}>
              <Activity className="w-4 h-4 text-teal-300" />
              Agent is preparing the first reasoning step
              <Dots active />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((item, idx) => {
              const previousStepComplete = idx === 0 || completedStepIndices.has(idx - 1);
              if (!previousStepComplete && idx > 0) return null;

              const Icon = agentIcons[item.agent] || Cpu;
              const config = kindConfig[item.kind ?? "status"] || kindConfig.status;
              const isLatest = idx === steps.length - 1 && !isComplete;
              const isFullyRevealed = completedStepIndices.has(idx);

              return (
                <motion.div
                  key={`${item.agent}-${item.kind ?? "status"}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="relative rounded-[24px] p-4"
                  style={{
                    background: isLatest
                      ? "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(8,47,73,0.7))"
                      : "rgba(15,23,42,0.58)",
                    border: `1px solid ${isLatest ? "rgba(45,212,191,0.25)" : "rgba(148,163,184,0.12)"}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${config.color}18`,
                        border: `1px solid ${config.border}`,
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                          {item.agent}
                        </span>
                        <span
                          className="px-2 py-1 rounded-full"
                          style={{
                            fontSize: "0.68rem",
                            color: config.color,
                            background: `${config.color}14`,
                            border: `1px solid ${config.border}`,
                          }}
                        >
                          {config.label}
                        </span>
                        {isLatest && (
                          <span className="text-teal-300" style={{ fontSize: "0.68rem" }}>
                            live
                          </span>
                        )}
                      </div>

                      <p className="text-slate-200 leading-6 whitespace-pre-wrap" style={{ fontSize: "0.84rem" }}>
                        {isFullyRevealed ? (
                          item.step
                        ) : (
                          <AnimatedMessage
                            text={item.step}
                            onUpdate={triggerScroll}
                            onComplete={() => setCompletedStepIndices((prev) => new Set(prev).add(idx))}
                          />
                        )}
                      </p>
                    </div>

                    <div className="pt-1 flex-shrink-0">
                      {(isLatest && !isFullyRevealed) ? (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.55, 1, 0.55] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="w-3 h-3 rounded-full bg-teal-300"
                        />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
