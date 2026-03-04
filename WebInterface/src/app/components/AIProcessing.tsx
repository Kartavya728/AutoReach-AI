"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Brain, Cpu, Database, Zap, Network, Search } from "lucide-react";

interface AIProcessingProps {
  steps: { step: string; agent: string }[];
  isComplete?: boolean;
  title?: string;
}

const agentIcons: Record<string, React.ElementType> = {
  Orchestrator: Cpu,
  "RAG-Retriever": Database,
  "ReAct-Planner": Brain,
  "Content-Generator": Zap,
  "Strategy-Agent": Network,
  "Performance-Monitor": Search,
};

const agentColors: Record<string, string> = {
  Orchestrator: "#7c3aed",
  "RAG-Retriever": "#0891b2",
  "ReAct-Planner": "#059669",
  "Content-Generator": "#d97706",
  "Strategy-Agent": "#dc2626",
  "Performance-Monitor": "#7c3aed",
};

export function AIProcessing({ steps, isComplete, title }: AIProcessingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState<typeof steps>([]);

  useEffect(() => {
    if (steps.length === 0) return;
    setVisibleSteps([]);
    setCurrentStep(0);

    steps.forEach((step, i) => {
      setTimeout(() => {
        setVisibleSteps((prev) => [...prev, step]);
        setCurrentStep(i + 1);
      }, i * 650);
    });
  }, [steps]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(5, 5, 20, 0.9)",
        border: "1px solid rgba(139, 92, 246, 0.3)",
        boxShadow: "0 0 40px rgba(139, 92, 246, 0.1)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{
          background: "rgba(139, 92, 246, 0.1)",
          borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
        }}
      >
        <motion.div
          animate={!isComplete ? { rotate: 360 } : { rotate: 0 }}
          transition={
            !isComplete ? { duration: 2, repeat: Infinity, ease: "linear" } : {}
          }
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(139, 92, 246, 0.3)" }}
        >
          <Brain className="w-4 h-4 text-violet-400" />
        </motion.div>
        <div>
          <div className="text-white" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {title || "AI Agent Processing"}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {!isComplete ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400" style={{ fontSize: "0.7rem" }}>
                  Running LangGraph ReAct + RAG Pipeline
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="text-violet-400" style={{ fontSize: "0.7rem" }}>
                  Pipeline Complete
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="ml-auto flex items-center gap-3">
          <div
            className="px-2 py-1 rounded-lg text-xs font-mono"
            style={{
              background: "rgba(139, 92, 246, 0.2)",
              color: "#a78bfa",
              fontSize: "0.7rem",
            }}
          >
            {currentStep}/{steps.length} steps
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full"
          style={{
            background: "linear-gradient(90deg, #7c3aed, #ec4899)",
          }}
          initial={{ width: "0%" }}
          animate={{
            width: steps.length > 0 ? `${(currentStep / steps.length) * 100}%` : "0%",
          }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Steps */}
      <div className="p-4 space-y-2 max-h-72 overflow-y-auto font-mono">
        <AnimatePresence>
          {visibleSteps.map((item, idx) => {
            const Icon = agentIcons[item.agent] || Cpu;
            const color = agentColors[item.agent] || "#7c3aed";
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 p-2 rounded-lg"
                style={{
                  background:
                    idx === visibleSteps.length - 1 && !isComplete
                      ? "rgba(139, 92, 246, 0.08)"
                      : "transparent",
                  border:
                    idx === visibleSteps.length - 1 && !isComplete
                      ? "1px solid rgba(139, 92, 246, 0.15)"
                      : "1px solid transparent",
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}25`, border: `1px solid ${color}40` }}
                >
                  <Icon className="w-3 h-3" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        background: `${color}20`,
                        color,
                        fontSize: "0.65rem",
                      }}
                    >
                      {item.agent}
                    </span>
                    {idx === visibleSteps.length - 1 && !isComplete && (
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="flex gap-1"
                      >
                        {[0, 1, 2].map((d) => (
                          <div
                            key={d}
                            className="w-1 h-1 rounded-full bg-violet-400"
                            style={{ animationDelay: `${d * 0.2}s` }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </div>
                  <p className="text-gray-300" style={{ fontSize: "0.75rem" }}>
                    {item.step}
                  </p>
                </div>
                <div className="flex-shrink-0 mt-1">
                  {idx < visibleSteps.length - 1 || isComplete ? (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(16, 185, 129, 0.2)" }}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                  ) : (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-4 h-4 rounded-full"
                      style={{ background: "rgba(139, 92, 246, 0.4)" }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visibleSteps.length === 0 && (
          <div className="text-center py-6">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-gray-500 text-sm"
            >
              Initializing AI agents...
            </motion.div>
          </div>
        )}
      </div>

      {/* Neural network visualization */}
      <div
        className="px-6 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex gap-4">
          {["ReAct", "RAG", "LangGraph", "Gemini 2.0"].map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <motion.div
                animate={!isComplete ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
                transition={{ duration: 1.5, repeat: !isComplete ? Infinity : 0 }}
                className="w-1.5 h-1.5 rounded-full bg-violet-400"
              />
              <span className="text-gray-500" style={{ fontSize: "0.65rem" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div
          className="text-gray-600"
          style={{ fontSize: "0.65rem", fontFamily: "monospace" }}
        >
          v1.0.0 · LangGraph 0.2
        </div>
      </div>
    </div>
  );
}
