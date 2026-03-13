"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Pencil,
  Play,
  Send,
  Sparkles,
  StopCircle,
  User,
  XCircle,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { preloadAgentStream, streamCampaignAgent, type AgentPauseResponder } from "../../lib/agent-stream";
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
  "Run email campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 percentage point higher returns than its competitors. Announce an additional 0.25 percentage point higher returns for female senior citizens. Optimise for open rate and click rate. Do not skip emails to customers marked inactive. Include the call to action: https://superbfsi.com/xdeposit/explore/";
const DEFAULT_ROUNDS = 3;

type RunPhase = "idle" | "running" | "paused" | "complete" | "error";
type MessageRole = "user" | "agent" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  kind?: string;
  agent?: string;
  timestamp: number;
}

function kindLabel(kind?: string) {
  const value = (kind || "status").toLowerCase();
  if (value === "thought") return "Thought";
  if (value === "action") return "Action";
  if (value === "observation") return "Observation";
  if (value === "pause") return "Pause";
  if (value === "resume") return "Resume";
  if (value === "final") return "Final";
  if (value === "metrics") return "Metrics";
  if (value === "decision") return "Decision";
  return "Status";
}

function formatPercent(value?: number | null) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatCount(value?: number | null) {
  return (Number(value ?? 0) || 0).toLocaleString();
}

function toSegmentCardsFromResult(result: AgentRunResult | null): AgentSegmentCard[] {
  if (!result) return [];
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
  if (!result) return [];
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

function sameThinkingStep(a: AgentThinkingStep | null, b: AgentThinkingStep) {
  if (!a) return false;
  return (a.agent || "Agent") === (b.agent || "Agent") && (a.step || "") === (b.step || "") && (a.kind || "status") === (b.kind || "status");
}

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="w-1.5 h-1.5 rounded-full bg-emerald-300"
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.14 }}
        />
      ))}
    </div>
  );
}

export default function NewCampaign() {
  const router = useRouter();
  const chatRef = useRef<HTMLDivElement>(null);
  const pauseResponderRef = useRef<AgentPauseResponder | null>(null);
  const latestThinkingRef = useRef<AgentThinkingStep | null>(null);

  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingPause, setPendingPause] = useState<AgentPausePayload | null>(null);
  const [segmentCards, setSegmentCards] = useState<AgentSegmentCard[]>([]);
  const [draftCards, setDraftCards] = useState<AgentDraftCard[]>([]);
  const [editingDrafts, setEditingDrafts] = useState(false);
  const [editedDrafts, setEditedDrafts] = useState<AgentDraftCard[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<AgentLiveMetrics | null>(null);
  const [roundHistory, setRoundHistory] = useState<AgentRoundComplete[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasConversation = messages.length > 0 || phase !== "idle";
  const canStart = brief.trim().length > 0 && phase !== "running" && phase !== "paused";

  useEffect(() => {
    preloadAgentStream().catch(() => {
      // Preload is best-effort only.
    });
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, pendingPause, editingDrafts]);

  const pushMessage = useCallback((message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...message,
      },
    ]);
  }, []);

  const resetRunState = useCallback(() => {
    pauseResponderRef.current = null;
    latestThinkingRef.current = null;
    setPendingPause(null);
    setSegmentCards([]);
    setDraftCards([]);
    setEditingDrafts(false);
    setEditedDrafts([]);
    setLatestMetrics(null);
    setRoundHistory([]);
    setResult(null);
    setError(null);
  }, []);

  const submitPauseResponse = useCallback((response: Record<string, unknown>) => {
    const responder = pauseResponderRef.current;
    if (!responder) return;

    pauseResponderRef.current = null;
    setPendingPause(null);
    setEditingDrafts(false);
    setEditedDrafts([]);
    setPhase("running");
    responder(response);
  }, []);

  const handleApprove = useCallback(() => {
    if (!pendingPause) return;

    if (pendingPause.pauseType === "next_round") {
      submitPauseResponse({ continueOptimization: true });
      pushMessage({ role: "user", text: "Continue with next optimization round." });
      return;
    }

    if (pendingPause.pauseType === "content_approval" && editingDrafts && editedDrafts.length > 0) {
      submitPauseResponse({
        approved: true,
        editedVariants: editedDrafts.map((draft) => ({
          segmentId: draft.segmentId,
          subject: draft.subject,
          body: draft.body,
        })),
      });
      pushMessage({ role: "user", text: "Approved with edits." });
      return;
    }

    submitPauseResponse({ approved: true });
    pushMessage({ role: "user", text: "Approved." });
  }, [editedDrafts, editingDrafts, pendingPause, pushMessage, submitPauseResponse]);

  const handleReject = useCallback(() => {
    if (!pendingPause) return;

    if (pendingPause.pauseType === "next_round") {
      submitPauseResponse({ continueOptimization: false });
      pushMessage({ role: "user", text: "Stop optimization after this round." });
      return;
    }

    submitPauseResponse({ approved: false });
    pushMessage({ role: "user", text: "Rejected." });
  }, [pendingPause, pushMessage, submitPauseResponse]);

  const handleEditDrafts = useCallback(() => {
    setEditedDrafts(draftCards.map((draft) => ({ ...draft })));
    setEditingDrafts(true);
  }, [draftCards]);

  const handleCancelEdit = useCallback(() => {
    setEditingDrafts(false);
    setEditedDrafts([]);
  }, []);

  const updateEditedDraft = useCallback((index: number, field: "subject" | "body", value: string) => {
    setEditedDrafts((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }, []);

  const runAgent = useCallback(async (prompt: string) => {
    setPhase("running");

    try {
      const finalResult = await streamCampaignAgent(prompt, {
        rounds: DEFAULT_ROUNDS,
        onThinking: (step) => {
          if (sameThinkingStep(latestThinkingRef.current, step)) return;
          latestThinkingRef.current = step;

          pushMessage({
            role: "agent",
            agent: step.agent || "Agent",
            kind: step.kind || "status",
            text: step.step || "",
          });
        },
        onPause: (pause, respond) => {
          pauseResponderRef.current = respond;
          setPendingPause(pause);
          setPhase("paused");

          if (pause.segments && pause.segments.length > 0) {
            setSegmentCards(pause.segments);
          }
          if (pause.variants && pause.variants.length > 0) {
            setDraftCards(pause.variants);
          }

          pushMessage({
            role: "system",
            kind: "pause",
            text: pause.message || "Approval required to continue.",
          });
        },
        onLiveMetrics: (metrics) => {
          setLatestMetrics((previous) => {
            if (
              previous &&
              previous.round === metrics.round &&
              previous.sent === metrics.sent &&
              previous.opened === metrics.opened &&
              previous.clicked === metrics.clicked
            ) {
              return previous;
            }

            pushMessage({
              role: "system",
              kind: "metrics",
              text: `Round ${metrics.round}: sent ${formatCount(metrics.sent)}, open ${formatPercent(metrics.openRate)}, click ${formatPercent(metrics.clickRate)}.`,
            });
            return metrics;
          });
          setPhase("running");
        },
        onRoundComplete: (round) => {
          setRoundHistory((current) => {
            const previous = current[current.length - 1];
            if (previous && previous.round === round.round) {
              return [...current.slice(0, -1), round];
            }
            return [...current, round];
          });

          pushMessage({
            role: "system",
            kind: "summary",
            text: `Round ${round.round} complete. Open ${formatPercent(round.summary.openRate)} and click ${formatPercent(round.summary.clickRate)}.`,
          });
        },
        onTerminal: () => {
          // Intentionally ignored for chat-style UI.
        },
      });

      setResult(finalResult);
      setSegmentCards((current) => (current.length > 0 ? current : toSegmentCardsFromResult(finalResult)));
      setDraftCards((current) => (current.length > 0 ? current : toDraftCardsFromResult(finalResult)));
      setPendingPause(null);
      pauseResponderRef.current = null;
      setPhase("complete");

      pushMessage({
        role: "agent",
        agent: "Orchestrator",
        kind: "final",
        text: `Campaign plan is ready. Final open rate ${formatPercent(finalResult.finalOpenRate)} and click rate ${formatPercent(finalResult.finalClickRate)}.`,
      });
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Campaign agent execution failed.";
      setError(message);
      setPhase("error");
      setPendingPause(null);
      pauseResponderRef.current = null;

      pushMessage({
        role: "system",
        kind: "final",
        text: message,
      });
    }
  }, [pushMessage]);

  const handleStart = useCallback(async () => {
    const prompt = brief.trim();
    if (!prompt || !canStart) return;

    resetRunState();
    setMessages([]);
    pushMessage({ role: "user", text: prompt });
    await runAgent(prompt);
  }, [brief, canStart, pushMessage, resetRunState, runAgent]);

  const statusText = useMemo(() => {
    if (phase === "running") return "Agent is working";
    if (phase === "paused") return "Waiting for your approval";
    if (phase === "complete") return "Run complete";
    if (phase === "error") return "Run failed";
    return "Ready";
  }, [phase]);

  const approvalDrafts = editingDrafts ? editedDrafts : draftCards;

  return (
    <div className="min-h-screen pt-20 pb-10 px-4" style={{ background: "linear-gradient(180deg, #070f19 0%, #0b1624 100%)" }}>
      <Navbar />

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            style={{ fontSize: "0.86rem" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(15,23,42,0.75)",
              border: "1px solid rgba(148,163,184,0.2)",
              color: "#cbd5e1",
              fontSize: "0.76rem",
            }}
          >
            {phase === "running" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
            {statusText}
          </div>
        </div>

        {!hasConversation ? (
          <div className="min-h-[68vh] flex items-center justify-center">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-[30px] p-6 md:p-8"
              style={{
                background: "linear-gradient(135deg, rgba(8,18,33,0.96) 0%, rgba(12,25,42,0.95) 100%)",
                border: "1px solid rgba(148,163,184,0.2)",
                boxShadow: "0 30px 80px rgba(2, 6, 23, 0.45)",
              }}
            >
              <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sky-200" style={{ background: "rgba(14,116,144,0.2)", fontSize: "0.74rem" }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Campaign Assistant
                </div>
                <h1 className="text-white mt-4" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.6rem)", fontWeight: 800 }}>
                  Start with one prompt
                </h1>
                <p className="text-slate-300 mt-2" style={{ fontSize: "0.95rem" }}>
                  Enter your campaign brief and watch the agent thinking and approvals in chat.
                </p>
              </div>

              <div className="rounded-[20px] p-3" style={{ background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.2)" }}>
                <textarea
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  rows={5}
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 outline-none resize-none px-3 py-2"
                  placeholder="Describe the campaign goal, audience, constraints, and CTA."
                  style={{ fontSize: "0.94rem", lineHeight: 1.65 }}
                />
                <div className="flex justify-between items-center px-2 pb-1">
                  <button
                    onClick={() => setBrief(DEFAULT_BRIEF)}
                    className="text-slate-400 hover:text-white transition-colors"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Use sample prompt
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void handleStart()}
                    disabled={!canStart}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)", fontSize: "0.84rem", fontWeight: 700 }}
                  >
                    <Send className="w-4 h-4" />
                    Send prompt
                  </motion.button>
                </div>
              </div>
            </motion.section>
          </div>
        ) : (
          <>
            <div
              ref={chatRef}
              className="rounded-[28px] p-4 md:p-6 h-[66vh] overflow-y-auto"
              style={{
                background: "linear-gradient(180deg, rgba(8,18,33,0.94) 0%, rgba(11,24,40,0.95) 100%)",
                border: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="max-w-[92%] md:max-w-[80%] rounded-2xl px-4 py-3"
                          style={{
                            background: isUser
                              ? "linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(14,116,144,0.9) 100%)"
                              : "rgba(15,23,42,0.82)",
                            border: isUser ? "1px solid rgba(125,211,252,0.3)" : "1px solid rgba(148,163,184,0.2)",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 text-slate-200" style={{ fontSize: "0.72rem" }}>
                              {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                              {isUser ? "You" : message.agent || "Agent"}
                            </span>
                            {!isUser && (
                              <span
                                className="px-2 py-0.5 rounded-full"
                                style={{
                                  fontSize: "0.66rem",
                                  color: "#a5f3fc",
                                  background: "rgba(8,145,178,0.2)",
                                  border: "1px solid rgba(34,211,238,0.28)",
                                }}
                              >
                                {kindLabel(message.kind)}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-100 whitespace-pre-wrap" style={{ fontSize: "0.87rem", lineHeight: 1.65 }}>
                            {message.text}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {phase === "running" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.2)" }}>
                      <div className="flex items-center gap-2 text-slate-200" style={{ fontSize: "0.78rem" }}>
                        <Bot className="w-3.5 h-3.5" />
                        Agent thinking
                        <TypingDots />
                      </div>
                    </div>
                  </motion.div>
                )}

                {pendingPause && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-4"
                    style={{
                      background: "rgba(124,45,18,0.22)",
                      border: "1px solid rgba(251,146,60,0.35)",
                    }}
                  >
                    <div className="text-amber-200" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                      {pendingPause.title || "Approval required"}
                    </div>
                    {pendingPause.message && (
                      <p className="text-amber-100 mt-1" style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
                        {pendingPause.message}
                      </p>
                    )}

                    {segmentCards.length > 0 && (
                      <div className="grid gap-2 mt-3">
                        {segmentCards.map((segment) => (
                          <div key={segment.segmentId} className="rounded-xl p-3" style={{ background: "rgba(2,6,23,0.65)", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{segment.name}</div>
                              <div className="text-slate-300" style={{ fontSize: "0.72rem" }}>{formatCount(segment.size)} customers</div>
                            </div>
                            <p className="text-slate-300 mt-1" style={{ fontSize: "0.74rem" }}>{segment.criteria || segment.focus || "Segment details available."}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {approvalDrafts.length > 0 && (
                      <div className="grid gap-2 mt-3">
                        {approvalDrafts.map((draft, index) => (
                          <div key={`${draft.segmentId}-${index}`} className="rounded-xl p-3" style={{ background: "rgba(2,6,23,0.65)", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <div className="text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{draft.segmentName}</div>
                            <div className="mt-2">
                              <div className="text-slate-400" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Subject</div>
                              {editingDrafts ? (
                                <input
                                  value={draft.subject}
                                  onChange={(event) => updateEditedDraft(index, "subject", event.target.value)}
                                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-100 outline-none"
                                  style={{ border: "1px solid rgba(148,163,184,0.35)", fontSize: "0.78rem" }}
                                />
                              ) : (
                                <div className="text-slate-100 mt-1" style={{ fontSize: "0.78rem", fontWeight: 600 }}>{draft.subject}</div>
                              )}
                            </div>
                            <div className="mt-2">
                              <div className="text-slate-400" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Body</div>
                              {editingDrafts ? (
                                <textarea
                                  value={draft.body}
                                  onChange={(event) => updateEditedDraft(index, "body", event.target.value)}
                                  rows={4}
                                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-200 outline-none resize-y"
                                  style={{ border: "1px solid rgba(148,163,184,0.35)", fontSize: "0.76rem", lineHeight: 1.5 }}
                                />
                              ) : (
                                <p className="text-slate-300 mt-1 line-clamp-4" style={{ fontSize: "0.75rem", lineHeight: 1.55 }}>{draft.body}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      {pendingPause.pauseType === "next_round" ? (
                        <>
                          <button
                            onClick={handleApprove}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white"
                            style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", fontSize: "0.76rem", fontWeight: 700 }}
                          >
                            <Play className="w-4 h-4" />
                            Continue
                          </button>
                          <button
                            onClick={handleReject}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white"
                            style={{ background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)", fontSize: "0.76rem", fontWeight: 700 }}
                          >
                            <StopCircle className="w-4 h-4" />
                            Stop here
                          </button>
                        </>
                      ) : (
                        <>
                          {pendingPause.pauseType === "content_approval" && (
                            <button
                              onClick={editingDrafts ? handleCancelEdit : handleEditDrafts}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-slate-100"
                              style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.35)", fontSize: "0.76rem", fontWeight: 700 }}
                            >
                              <Pencil className="w-4 h-4" />
                              {editingDrafts ? "Cancel edit" : "Edit drafts"}
                            </button>
                          )}
                          <button
                            onClick={handleApprove}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white"
                            style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", fontSize: "0.76rem", fontWeight: 700 }}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={handleReject}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white"
                            style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", fontSize: "0.76rem", fontWeight: 700 }}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {(latestMetrics || roundHistory.length > 0 || (phase === "complete" && result)) && (
              <div className="grid md:grid-cols-3 gap-3 mt-4">
                <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.2)" }}>
                  <div className="text-slate-400" style={{ fontSize: "0.72rem" }}>Latest Sent</div>
                  <div className="text-white mt-1" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{formatCount(latestMetrics?.sent || 0)}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.2)" }}>
                  <div className="text-slate-400" style={{ fontSize: "0.72rem" }}>Open Rate</div>
                  <div className="text-white mt-1" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{formatPercent(result?.finalOpenRate ?? latestMetrics?.openRate ?? 0)}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.2)" }}>
                  <div className="text-slate-400" style={{ fontSize: "0.72rem" }}>Click Rate</div>
                  <div className="text-white mt-1" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{formatPercent(result?.finalClickRate ?? latestMetrics?.clickRate ?? 0)}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(127,29,29,0.25)", border: "1px solid rgba(248,113,113,0.35)" }}>
                <div className="text-rose-200" style={{ fontSize: "0.84rem", fontWeight: 700 }}>Run failed</div>
                <p className="text-rose-100 mt-1" style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>{error}</p>
              </div>
            )}

            <div className="mt-4 rounded-[24px] p-3" style={{ background: "rgba(8,18,33,0.96)", border: "1px solid rgba(148,163,184,0.2)" }}>
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={3}
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 outline-none resize-none px-2 py-2"
                placeholder="Enter a new campaign prompt"
                style={{ fontSize: "0.9rem", lineHeight: 1.6 }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleStart();
                  }
                }}
              />
              <div className="flex justify-between items-center pt-1 px-1">
                <button
                  onClick={() => setBrief(DEFAULT_BRIEF)}
                  className="text-slate-400 hover:text-white transition-colors"
                  style={{ fontSize: "0.76rem" }}
                >
                  Load sample
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleStart()}
                  disabled={!canStart}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)", fontSize: "0.82rem", fontWeight: 700 }}
                >
                  <Send className="w-4 h-4" />
                  {phase === "complete" || phase === "error" ? "Send new prompt" : "Send prompt"}
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
