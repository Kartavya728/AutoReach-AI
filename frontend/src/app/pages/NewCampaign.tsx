"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  EyeOff,
  Gavel,
  LoaderCircle,
  Pencil,
  Play,
  Search,
  Send,
  Sparkles,
  StopCircle,
  TrendingUp,
  User,
  XCircle,
  Zap,
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
  AgentTwinCard,
  AgentTwinCardStage,
  AgentTwinPersonaDecision,
} from "../../lib/types";

const DEFAULT_BRIEF =
  "Run email campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 percentage point higher returns than its competitors. Announce an additional 0.25 percentage point higher returns for female senior citizens. Optimise for open rate and click rate. Do not skip emails to customers marked inactive.";
const DEFAULT_CTA_LINK = "https://superbfsi.com/xdeposit/explore/";
const MAX_INTERACTIVE_OPTIMIZATION_ROUNDS = 10;
const INITIAL_VISIBLE_TWIN_CARDS = 3;
const INITIAL_VISIBLE_SEGMENTS = 3;
const INITIAL_VISIBLE_DRAFTS = 2;
const EMAIL_BODY_PREVIEW_LINES = 3;

type RunPhase = "idle" | "running" | "paused" | "complete" | "error";
type MessageRole = "user" | "agent" | "system";
type RunMode = "initial" | "optimization";
type ApprovalDecision = "pending" | "approved" | "rejected";

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
  if (value === "summary") return "Summary";
  return "Status";
}

function kindVisualConfig(kind?: string) {
  const value = (kind || "status").toLowerCase();
  switch (value) {
    case "thought":
      return {
        icon: BrainCircuit,
        badgeBg: "rgba(99,102,241,0.15)",
        badgeBorder: "1px solid rgba(129,140,248,0.3)",
        badgeColor: "#c7d2fe",
        bubbleBg: "rgba(30,27,75,0.45)",
        bubbleBorder: "1px solid rgba(99,102,241,0.18)",
        accentColor: "#818cf8",
      };
    case "action":
      return {
        icon: Zap,
        badgeBg: "rgba(245,158,11,0.15)",
        badgeBorder: "1px solid rgba(251,191,36,0.3)",
        badgeColor: "#fde68a",
        bubbleBg: "rgba(45,26,3,0.4)",
        bubbleBorder: "1px solid rgba(245,158,11,0.18)",
        accentColor: "#fbbf24",
      };
    case "observation":
      return {
        icon: Search,
        badgeBg: "rgba(20,184,166,0.15)",
        badgeBorder: "1px solid rgba(45,212,191,0.3)",
        badgeColor: "#99f6e4",
        bubbleBg: "rgba(4,47,46,0.35)",
        bubbleBorder: "1px solid rgba(20,184,166,0.18)",
        accentColor: "#2dd4bf",
      };
    case "metrics":
    case "summary":
      return {
        icon: BarChart3,
        badgeBg: "rgba(16,185,129,0.15)",
        badgeBorder: "1px solid rgba(52,211,153,0.3)",
        badgeColor: "#a7f3d0",
        bubbleBg: "rgba(6,78,59,0.3)",
        bubbleBorder: "1px solid rgba(16,185,129,0.2)",
        accentColor: "#34d399",
      };
    case "decision":
      return {
        icon: Gavel,
        badgeBg: "rgba(168,85,247,0.15)",
        badgeBorder: "1px solid rgba(192,132,252,0.3)",
        badgeColor: "#e9d5ff",
        bubbleBg: "rgba(59,7,100,0.3)",
        bubbleBorder: "1px solid rgba(168,85,247,0.18)",
        accentColor: "#c084fc",
      };
    case "final":
      return {
        icon: CheckCircle2,
        badgeBg: "rgba(34,197,94,0.18)",
        badgeBorder: "1px solid rgba(74,222,128,0.35)",
        badgeColor: "#bbf7d0",
        bubbleBg: "rgba(5,46,22,0.4)",
        bubbleBorder: "1px solid rgba(34,197,94,0.22)",
        accentColor: "#4ade80",
      };
    case "pause":
      return {
        icon: Clock3,
        badgeBg: "rgba(251,146,60,0.15)",
        badgeBorder: "1px solid rgba(251,146,60,0.3)",
        badgeColor: "#fed7aa",
        bubbleBg: "rgba(67,20,7,0.3)",
        bubbleBorder: "1px solid rgba(251,146,60,0.2)",
        accentColor: "#fb923c",
      };
    default:
      return {
        icon: Bot,
        badgeBg: "rgba(8,145,178,0.15)",
        badgeBorder: "1px solid rgba(34,211,238,0.25)",
        badgeColor: "#a5f3fc",
        bubbleBg: "rgba(15,23,42,0.72)",
        bubbleBorder: "1px solid rgba(148,163,184,0.16)",
        accentColor: "#22d3ee",
      };
  }
}

function formatPercent(value?: number | null) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatCount(value?: number | null) {
  return (Number(value ?? 0) || 0).toLocaleString();
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildPromptWithLink(prompt: string, ctaLink: string) {
  const cleanPrompt = prompt.trim();
  const cleanLink = ctaLink.trim();
  return `${cleanPrompt}\n\nRequired CTA Link: ${cleanLink}`;
}

function ensureDraftContainsLink(body: string, ctaLink: string) {
  const cleanBody = body.trim();
  const cleanLink = ctaLink.trim();
  if (!cleanLink || cleanBody.includes(cleanLink)) {
    return cleanBody;
  }
  return `${cleanBody}\n\nExplore now: ${cleanLink}`.trim();
}

function statusStyles(status: ApprovalDecision | "generating") {
  if (status === "approved") {
    return {
      label: "Accepted",
      background: "rgba(22,163,74,0.18)",
      border: "1px solid rgba(34,197,94,0.35)",
      color: "#dcfce7",
    };
  }
  if (status === "rejected") {
    return {
      label: "Rejected",
      background: "rgba(220,38,38,0.18)",
      border: "1px solid rgba(248,113,113,0.35)",
      color: "#fee2e2",
    };
  }
  if (status === "generating") {
    return {
      label: "Generating",
      background: "rgba(14,116,144,0.18)",
      border: "1px solid rgba(34,211,238,0.28)",
      color: "#cffafe",
    };
  }
  return {
    label: "Awaiting Review",
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(251,191,36,0.28)",
    color: "#fde68a",
  };
}

function twinStageStyles(stage: AgentTwinCardStage) {
  if (stage === "passed") {
    return {
      label: "Passed Twin Check",
      background: "rgba(22,163,74,0.18)",
      border: "1px solid rgba(34,197,94,0.35)",
      color: "#dcfce7",
    };
  }
  if (stage === "retrying") {
    return {
      label: "Retrying Draft",
      background: "rgba(234,88,12,0.18)",
      border: "1px solid rgba(251,146,60,0.35)",
      color: "#fed7aa",
    };
  }
  if (stage === "fallback") {
    return {
      label: "Using Last Draft",
      background: "rgba(148,163,184,0.18)",
      border: "1px solid rgba(148,163,184,0.35)",
      color: "#e2e8f0",
    };
  }
  if (stage === "testing") {
    return {
      label: "Personas Reviewing",
      background: "rgba(14,116,144,0.18)",
      border: "1px solid rgba(34,211,238,0.28)",
      color: "#cffafe",
    };
  }
  return {
    label: "Queued",
    background: "rgba(51,65,85,0.35)",
    border: "1px solid rgba(100,116,139,0.35)",
    color: "#cbd5e1",
  };
}

function personaStyles(decision: AgentTwinPersonaDecision) {
  if (decision === "click") {
    return {
      verdict: "Approved Click",
      detail: "Would click",
      background: "rgba(22,163,74,0.18)",
      border: "1px solid rgba(34,197,94,0.35)",
      color: "#dcfce7",
    };
  }
  if (decision === "open") {
    return {
      verdict: "Approved Open",
      detail: "Would open",
      background: "rgba(56,189,248,0.18)",
      border: "1px solid rgba(56,189,248,0.32)",
      color: "#dbeafe",
    };
  }
  if (decision === "ignore") {
    return {
      verdict: "Declined",
      detail: "Would ignore",
      background: "rgba(220,38,38,0.18)",
      border: "1px solid rgba(248,113,113,0.35)",
      color: "#fee2e2",
    };
  }
  return {
    verdict: "Reviewing",
    detail: "Pending",
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(251,191,36,0.28)",
    color: "#fde68a",
  };
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
    approved: segment.approved ?? true,
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
    ctaLink: draft.ctaLink ?? result.ctaLink,
    approved: true,
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

export default function NewCampaign() {
  const router = useRouter();
  const chatRef = useRef<HTMLDivElement>(null);
  const pauseResponderRef = useRef<AgentPauseResponder | null>(null);
  const latestThinkingRef = useRef<AgentThinkingStep | null>(null);

  const [brief, setBrief] = useState("");
  const [ctaLink, setCtaLink] = useState("");
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
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [latestPrompt, setLatestPrompt] = useState("");
  const [latestCtaLink, setLatestCtaLink] = useState("");
  const [completedMessageIds, setCompletedMessageIds] = useState<Set<string>>(new Set());
  const [baselineMetrics, setBaselineMetrics] = useState({ sent: 0, opened: 0, clicked: 0 });
  const baselineMetricsRef = useRef({ sent: 0, opened: 0, clicked: 0 });
  const [segmentApprovalStatus, setSegmentApprovalStatus] = useState<Record<string, ApprovalDecision>>({});
  const [draftApprovalStatus, setDraftApprovalStatus] = useState<Record<string, ApprovalDecision>>({});
  const [twinCards, setTwinCards] = useState<Record<string, AgentTwinCard>>({});
  const [visibleTwinCards, setVisibleTwinCards] = useState(INITIAL_VISIBLE_TWIN_CARDS);
  const [visibleSegments, setVisibleSegments] = useState(INITIAL_VISIBLE_SEGMENTS);
  const [visibleDrafts, setVisibleDrafts] = useState(INITIAL_VISIBLE_DRAFTS);
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Record<string,boolean>>({});
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs, showTerminal]);

  const thinkingMessages = useMemo(() => [
    "Agent thinking",
    "Revising prompt",
    "Reviewing tool list",
    "Analyzing context",
    "Formulating plan"
  ], []);
  const [thinkingMsgIndex, setThinkingMsgIndex] = useState(0);

  useEffect(() => {
    if (phase !== "running") {
      setThinkingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingMsgIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [phase, thinkingMessages]);

  const hasConversation = messages.length > 0 || phase !== "idle";
  const canStart =
    brief.trim().length > 0 &&
    isValidUrl(ctaLink) &&
    phase !== "running" &&
    phase !== "paused";

  const triggerScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    preloadAgentStream().catch(() => {
      // Preload is best-effort only.
    });
  }, []);

  useEffect(() => {
    triggerScroll();
  }, [messages, pendingPause, editingDrafts, triggerScroll]);

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

  const resetRunState = useCallback((isOptimization = false) => {
    pauseResponderRef.current = null;
    latestThinkingRef.current = null;
    setPendingPause(null);
    setSegmentCards([]);
    setDraftCards([]);
    setEditingDrafts(false);
    setEditedDrafts([]);
    setApprovalError(null);
    setSegmentApprovalStatus({});
    setDraftApprovalStatus({});
    setTwinCards({});
    setVisibleTwinCards(INITIAL_VISIBLE_TWIN_CARDS);
    setVisibleSegments(INITIAL_VISIBLE_SEGMENTS);
    setVisibleDrafts(INITIAL_VISIBLE_DRAFTS);
    setExpandedBodies(new Set());
    setCollapsedSections({});
    setTerminalLogs([]);
    setShowTerminal(false);
    
    setLatestMetrics((currentMetrics) => {
      if (isOptimization) {
        // When optimization starts, currentMetrics is whatever the last round finished at.
        const newBaseline = {
          sent: Math.max(baselineMetricsRef.current.sent, currentMetrics?.sent || 0),
          opened: baselineMetricsRef.current.opened + (currentMetrics?.opened || 0),
          clicked: baselineMetricsRef.current.clicked + (currentMetrics?.clicked || 0),
        };
        baselineMetricsRef.current = newBaseline;
        setBaselineMetrics(newBaseline);
      } else {
        setCompletedMessageIds(new Set());
        baselineMetricsRef.current = { sent: 0, opened: 0, clicked: 0 };
        setBaselineMetrics({ sent: 0, opened: 0, clicked: 0 });
      }
      return null;
    });

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
    setApprovalError(null);
    setPhase("running");
    responder(response);
  }, []);

  const handleApprove = useCallback(() => {
    if (!pendingPause) return;
    const effectiveCtaLink = pendingPause.ctaLink || latestCtaLink || ctaLink;

    if (pendingPause.pauseType === "next_round") {
      submitPauseResponse({ continueOptimization: true });
      pushMessage({ role: "user", text: "Continue with next optimization round." });
      return;
    }

    if (pendingPause.pauseType === "segment_approval") {
      const segmentApprovals = segmentCards.map((segment) => ({
        segmentId: segment.segmentId,
        approved: segmentApprovalStatus[segment.segmentId] !== "rejected",
      }));
      submitPauseResponse({
        approved: segmentApprovals.some((item) => item.approved),
        segmentApprovals,
      });
      pushMessage({ role: "user", text: "Submitted category approvals." });
      return;
    }

    if (pendingPause.pauseType === "content_approval") {
      const sourceDrafts = editingDrafts ? editedDrafts : draftCards;
      const variantApprovals = sourceDrafts.map((draft) => ({
        segmentId: draft.segmentId,
        approved: draftApprovalStatus[draft.segmentId] !== "rejected",
        subject: draft.subject,
        body: ensureDraftContainsLink(draft.body, effectiveCtaLink),
      }));

      const approvedDrafts = variantApprovals.filter((item) => item.approved);
      if (approvedDrafts.length === 0) {
        setApprovalError("Approve at least one email draft to continue.");
        return;
      }

      const hasMissingLink = approvedDrafts.some((item) => !item.body.includes(effectiveCtaLink));
      if (effectiveCtaLink && hasMissingLink) {
        setApprovalError("Every approved email must contain the required CTA link.");
        return;
      }

      submitPauseResponse({
        approved: true,
        variantApprovals,
      });
      pushMessage({ role: "user", text: editingDrafts ? "Approved email drafts with edits." : "Approved selected email drafts." });
      return;
    }

    submitPauseResponse({ approved: true });
    pushMessage({ role: "user", text: "Approved." });
  }, [ctaLink, draftApprovalStatus, draftCards, editedDrafts, editingDrafts, latestCtaLink, pendingPause, pushMessage, segmentApprovalStatus, segmentCards, submitPauseResponse]);

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

  const toggleSegmentApproval = useCallback((segmentId: string, decision: ApprovalDecision) => {
    setSegmentApprovalStatus((current) => ({ ...current, [segmentId]: decision }));
  }, []);

  const toggleDraftApproval = useCallback((segmentId: string, decision: ApprovalDecision) => {
    setDraftApprovalStatus((current) => ({ ...current, [segmentId]: decision }));
  }, []);

  const runAgent = useCallback(async (prompt: string, mode: RunMode) => {
    setPhase("running");

    try {
      const finalResult = await streamCampaignAgent(prompt, {
        rounds: MAX_INTERACTIVE_OPTIMIZATION_ROUNDS,
        interactive: true,
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
          setApprovalError(null);

          if (pause.segments && pause.segments.length > 0) {
            setSegmentCards(pause.segments);
            setSegmentApprovalStatus(
              Object.fromEntries(
                pause.segments.map((segment) => [
                  segment.segmentId,
                  segment.approved === false ? "rejected" : "pending",
                ])
              )
            );
          }
          if (pause.variants && pause.variants.length > 0) {
            setDraftCards(pause.variants);
            setDraftApprovalStatus(
              Object.fromEntries(
                pause.variants.map((draft) => [
                  draft.segmentId,
                  draft.approved === false ? "rejected" : "pending",
                ])
              )
            );
          }

          pushMessage({
            role: "system",
            kind: "pause",
            text: pause.message || "Approval required to continue.",
          });
        },
        onTwinUpdate: (card) => {
          setTwinCards((current) => ({
            ...current,
            [card.segmentId]: card,
          }));
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

            if (mode === "optimization") {
              const b = baselineMetricsRef.current;
              const totalSent = Math.max(b.sent, metrics.sent);
              const totalOpened = b.opened + metrics.uniqueOpened;
              const totalClicked = b.clicked + metrics.uniqueClicked;
              const aggOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
              const aggClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

              pushMessage({
                role: "system",
                kind: "metrics",
                text: `Round ${metrics.round}: sent ${formatCount(totalSent)}, open ${formatPercent(aggOpenRate)}, click ${formatPercent(aggClickRate)}.`,
              });
            }
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

          if (mode === "optimization") {
            const b = baselineMetricsRef.current;
            const metrics = round.summary;
            const openNum = metrics.uniqueOpened ?? Math.floor(metrics.audience * (metrics.openRate / 100));
            const clickNum = metrics.uniqueClicked ?? Math.floor(metrics.audience * (metrics.clickRate / 100));
            
            // `metrics.audience` is the final sum for just that current round that finished
            const totalSent = Math.max(b.sent, metrics.audience);
            const totalOpened = b.opened + openNum;
            const totalClicked = b.clicked + clickNum;
            const aggOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
            const aggClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

            pushMessage({
              role: "system",
              kind: "summary",
              text: `Round ${round.round} complete. Cumulative open ${formatPercent(aggOpenRate)} and click ${formatPercent(aggClickRate)}.`,
            });
          }
        },
        onTerminal: (text) => {
          setTerminalLogs((current) => [...current, text]);
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
    const link = ctaLink.trim();
    if (!prompt || !link || !canStart) return;

    resetRunState(false);
    setMessages([]);
    setLatestPrompt(prompt);
    setLatestCtaLink(link);
    const finalPrompt = buildPromptWithLink(prompt, link);
    pushMessage({ role: "user", text: `${prompt}\n\nCTA link: ${link}` });
    await runAgent(finalPrompt, "initial");
  }, [brief, canStart, ctaLink, pushMessage, resetRunState, runAgent]);

  const handlePerformOptimizationRound = useCallback(async () => {
    const prompt = latestPrompt || brief.trim();
    const link = latestCtaLink || ctaLink.trim();
    if (!prompt || phase === "running" || phase === "paused") {
      return;
    }

    resetRunState(true);
    pushMessage({
      role: "user",
      text: "Perform an optimization round and ask me before every next round.",
    });
    await runAgent(buildPromptWithLink(prompt, link), "optimization");
  }, [brief, ctaLink, latestCtaLink, latestPrompt, phase, pushMessage, resetRunState, runAgent]);

  const statusText = useMemo(() => {
    if (phase === "running") return "Agent is working";
    if (phase === "paused") return "Waiting for your approval";
    if (phase === "complete") return "Run complete";
    if (phase === "error") return "Run failed";
    return "Ready";
  }, [phase]);

  const approvalDrafts = editingDrafts ? editedDrafts : draftCards;
  const digitalTwinCards = useMemo(() => {
    const rejectedSegmentIds = new Set(
      Object.entries(segmentApprovalStatus)
        .filter(([, decision]) => decision === "rejected")
        .map(([segmentId]) => segmentId)
    );

    const cards = segmentCards
      .filter((segment) => segment.approved !== false && !rejectedSegmentIds.has(segment.segmentId))
      .map((segment) => {
      const matchedDraft =
        approvalDrafts.find((draft) => draft.segmentId === segment.segmentId) ||
        approvalDrafts.find((draft) => draft.segmentName === segment.name);
      const twinCard = twinCards[segment.segmentId];
      return {
        segment,
        draft: matchedDraft,
        twin:
          twinCard ??
          {
            segmentId: segment.segmentId,
            segmentName: segment.name,
            size: segment.size,
            attempt: 0,
            maxAttempts: 3,
            stage: "queued" as const,
            subject: matchedDraft?.subject || "",
            body: matchedDraft?.body || "",
            ctaLink: matchedDraft?.ctaLink || pendingPause?.ctaLink || latestCtaLink || ctaLink,
            openVotes: 0,
            clickVotes: 0,
            ignoreVotes: 0,
            personas: [],
          },
      };
    });

    const knownIds = new Set(cards.map((entry) => entry.segment.segmentId));
    Object.values(twinCards).forEach((card) => {
      if (knownIds.has(card.segmentId) || rejectedSegmentIds.has(card.segmentId)) {
        return;
      }
      cards.push({
        segment: {
          segmentId: card.segmentId,
          name: card.segmentName,
          size: card.size,
          approved: true,
        },
        draft: approvalDrafts.find((draft) => draft.segmentId === card.segmentId),
        twin: card,
      });
    });

    return cards;
  }, [approvalDrafts, ctaLink, latestCtaLink, pendingPause?.ctaLink, segmentApprovalStatus, segmentCards, twinCards]);
  const visibleDigitalTwinCards = useMemo(
    () => digitalTwinCards.slice(0, visibleTwinCards),
    [digitalTwinCards, visibleTwinCards]
  );
  
  let activeSent = latestMetrics?.sent || 0;
  let activeTotalOpened = latestMetrics?.opened || 0;
  let activeTotalClicked = latestMetrics?.clicked || 0;
  let activeUniqueOpened = latestMetrics?.uniqueOpened || latestMetrics?.opened || 0;
  let activeUniqueClicked = latestMetrics?.uniqueClicked || latestMetrics?.clicked || 0;

  // Between rounds, or at the end of the very first round, if latestMetrics isn't updating anymore
  // and we have a final result payload, fallback to calculating it off there so the UI doesn't zero out.
  if (!latestMetrics && result) {
    activeSent = result.customerCount;
    activeTotalOpened = result.finalTotalOpened ?? result.uniqueTotalOpened ?? Math.floor(result.customerCount * (result.finalOpenRate / 100));
    activeTotalClicked = result.finalTotalClicked ?? result.uniqueTotalClicked ?? Math.floor(result.customerCount * (result.finalClickRate / 100));
    activeUniqueOpened = result.uniqueTotalOpened ?? result.finalTotalOpened ?? Math.floor(result.customerCount * (result.finalOpenRate / 100));
    activeUniqueClicked = result.uniqueTotalClicked ?? result.finalTotalClicked ?? Math.floor(result.customerCount * (result.finalClickRate / 100));
  }
  
  const totalSent = Math.max(baselineMetrics.sent, activeSent);
  const totalOpened = baselineMetrics.opened + activeTotalOpened;
  const totalClicked = baselineMetrics.clicked + activeTotalClicked;
  const aggregateOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const aggregateClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

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
                  Enter your campaign brief, add the required CTA link, and review approvals in chat.
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
                <div className="px-3 pb-2">
                  <div className="text-slate-400 mb-1" style={{ fontSize: "0.72rem" }}>Required CTA link</div>
                  <input
                    value={ctaLink}
                    onChange={(event) => setCtaLink(event.target.value)}
                    className="w-full bg-slate-900/70 text-slate-100 placeholder:text-slate-500 outline-none px-3 py-2 rounded-xl"
                    placeholder="https://example.com/offer"
                    style={{ fontSize: "0.86rem", border: "1px solid rgba(148,163,184,0.24)" }}
                  />
                  {ctaLink.trim().length > 0 && !isValidUrl(ctaLink) && (
                    <div className="text-rose-300 mt-1" style={{ fontSize: "0.72rem" }}>
                      Enter a valid `http` or `https` link.
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center px-2 pb-1">
                  <button
                    onClick={() => {
                      setBrief(DEFAULT_BRIEF);
                      setCtaLink(DEFAULT_CTA_LINK);
                    }}
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
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";
                    const isSystem = message.role === "system";
                    const isMessageComplete = (msg: ChatMessage) => msg.role === "user" || completedMessageIds.has(msg.id);
                    const previousMessageComplete = index === 0 || isMessageComplete(messages[index - 1]);
                    const shouldStartRevealing = isUser || previousMessageComplete;
                    const isFullyRevealed = isUser || completedMessageIds.has(message.id);

                    if (!shouldStartRevealing) return null;

                    // Check if this is the start of a new agent (phase separator)
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showPhaseSeparator = !isUser && !isSystem && prevMsg && (
                      prevMsg.role === "user" ||
                      (prevMsg.agent && message.agent && prevMsg.agent !== message.agent)
                    );

                    // Same-agent consecutive message = compact mode (thinner, no header)
                    const isSameAgentContinuation = !isUser && !isSystem && prevMsg &&
                      prevMsg.role !== "user" && prevMsg.role !== "system" &&
                      prevMsg.agent === message.agent && !showPhaseSeparator;

                    const kindConfig = kindVisualConfig(message.kind);
                    const KindIcon = kindConfig.icon;

                    // User messages
                    if (isUser) {
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2 }}
                          className="flex justify-end"
                        >
                          <div
                            className="max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3"
                            style={{
                              background: "linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(14,116,144,0.9) 100%)",
                              border: "1px solid rgba(125,211,252,0.3)",
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <User className="w-3 h-3 text-blue-200" />
                              <span className="text-blue-100" style={{ fontSize: "0.7rem", fontWeight: 600 }}>You</span>
                            </div>
                            <p className="text-white whitespace-pre-wrap" style={{ fontSize: "0.86rem", lineHeight: 1.6 }}>
                              {message.text}
                            </p>
                          </div>
                        </motion.div>
                      );
                    }

                    // Agent / System messages - styled by kind
                    return (
                      <React.Fragment key={message.id}>
                        {showPhaseSeparator && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 py-2"
                          >
                            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.2), transparent)" }} />
                            <span className="text-slate-500 flex items-center gap-1.5" style={{ fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                              <Sparkles className="w-3 h-3" />
                              {message.agent || "Agent"}
                            </span>
                            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.2), transparent)" }} />
                          </motion.div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="flex justify-start"
                        >
                          <div
                            className={`max-w-[95%] md:max-w-[88%] rounded-xl ${isSameAgentContinuation ? "ml-6" : ""}`}
                            style={{
                              padding: isSameAgentContinuation ? "6px 12px" : "10px 14px",
                              background: kindConfig.bubbleBg,
                              border: kindConfig.bubbleBorder,
                            }}
                          >
                            {/* Header - shown only for first message in a group or different agents */}
                            {!isSameAgentContinuation && (
                              <div className="flex items-center gap-2 mb-1.5">
                                <div
                                  className="w-5 h-5 rounded-md flex items-center justify-center"
                                  style={{ background: kindConfig.badgeBg, border: kindConfig.badgeBorder }}
                                >
                                  <KindIcon className="w-3 h-3" style={{ color: kindConfig.accentColor }} />
                                </div>
                                <span className="text-slate-300" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                                  {message.agent || "Agent"}
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded-full"
                                  style={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    color: kindConfig.badgeColor,
                                    background: kindConfig.badgeBg,
                                    border: kindConfig.badgeBorder,
                                  }}
                                >
                                  {kindLabel(message.kind)}
                                </span>
                              </div>
                            )}
                            {/* Compact inline badge for continuation messages */}
                            {isSameAgentContinuation && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <KindIcon className="w-3 h-3" style={{ color: kindConfig.accentColor, opacity: 0.7 }} />
                                <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: "0.58rem", fontWeight: 600, color: kindConfig.badgeColor, background: kindConfig.badgeBg, border: kindConfig.badgeBorder, opacity: 0.8 }}>
                                  {kindLabel(message.kind)}
                                </span>
                              </div>
                            )}
                            <p className="text-slate-200 whitespace-pre-wrap" style={{ fontSize: isSameAgentContinuation ? "0.82rem" : "0.85rem", lineHeight: 1.55 }}>
                              {isFullyRevealed ? (
                                 message.text
                              ) : (
                                 <AnimatedMessage 
                                   text={message.text} 
                                   onUpdate={triggerScroll}
                                   onComplete={() => setCompletedMessageIds((current) => new Set(current).add(message.id))}
                                 />
                              )}
                            </p>
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>

                {phase === "running" && (messages.length === 0 || messages[messages.length - 1].role === "user" || completedMessageIds.has(messages[messages.length - 1].id)) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 justify-start w-full"
                  >
                    <div className="rounded-2xl px-4 py-3 self-start" style={{ background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.2)" }}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-slate-200" style={{ fontSize: "0.78rem" }}>
                          <Bot className="w-3.5 h-3.5" />
                          {thinkingMessages[thinkingMsgIndex]}
                          <TypingDots />
                        </div>
                        <button 
                          onClick={() => setShowTerminal(s => !s)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 focus:outline-none"
                        >
                          <span style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Logs</span>
                          {showTerminal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {showTerminal && terminalLogs.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="rounded-xl p-3 w-full bg-slate-900/80 border border-slate-700/50 overflow-y-auto"
                          style={{ maxHeight: "250px", fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8" }}
                        >
                          {terminalLogs.map((log, i) => (
                            <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap flex gap-2">
                              {log}
                            </div>
                          ))}
                          <div ref={terminalEndRef} />
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                      <div className="mt-3">
                        <button
                          onClick={() => setCollapsedSections(c => ({ ...c, segments: !c.segments }))}
                          className="flex items-center gap-2 w-full text-left mb-2"
                        >
                          {collapsedSections.segments ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="text-slate-300" style={{ fontSize: "0.74rem", fontWeight: 600 }}>Categories ({segmentCards.length})</span>
                        </button>
                        {!collapsedSections.segments && (
                          <>
                            <div className="grid gap-2">
                              {segmentCards.slice(0, visibleSegments).map((segment) => {
                                const tierColors: Record<string, { bg: string; border: string; text: string }> = {
                                  Diamond: { bg: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.35)", text: "#e9d5ff" },
                                  Gold: { bg: "rgba(245,158,11,0.18)", border: "1px solid rgba(251,191,36,0.35)", text: "#fde68a" },
                                  Silver: { bg: "rgba(100,116,139,0.22)", border: "1px solid rgba(148,163,184,0.35)", text: "#e2e8f0" },
                                  Reactivate: { bg: "rgba(244,63,94,0.15)", border: "1px solid rgba(251,113,133,0.3)", text: "#fecdd3" },
                                  Priority: { bg: "rgba(14,116,144,0.18)", border: "1px solid rgba(34,211,238,0.3)", text: "#cffafe" },
                                  Active: { bg: "rgba(22,163,74,0.15)", border: "1px solid rgba(34,197,94,0.3)", text: "#dcfce7" },
                                };
                                const tierStyle = tierColors[segment.tier || ""] || { bg: "rgba(51,65,85,0.3)", border: "1px solid rgba(100,116,139,0.3)", text: "#cbd5e1" };
                                return (
                                  <div key={segment.segmentId} className="rounded-xl p-3" style={{ background: "rgba(2,6,23,0.65)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{segment.name}</div>
                                        {segment.tier && (
                                          <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "0.62rem", fontWeight: 700, background: tierStyle.bg, border: tierStyle.border, color: tierStyle.text }}>
                                            {segment.tier}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-slate-300" style={{ fontSize: "0.72rem" }}>{formatCount(segment.size)} customers</div>
                                    </div>
                                    <p className="text-slate-300 mt-1" style={{ fontSize: "0.74rem" }}>{segment.criteria || segment.focus || "Segment details available."}</p>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={() => toggleSegmentApproval(segment.segmentId, "approved")}
                                        className="px-2.5 py-1 rounded-lg text-xs"
                                        style={{
                                          background: (segmentApprovalStatus[segment.segmentId] ?? "pending") === "approved" ? "rgba(22,163,74,0.22)" : "rgba(15,23,42,0.8)",
                                          border: "1px solid rgba(34,197,94,0.35)",
                                          color: "#dcfce7",
                                        }}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => toggleSegmentApproval(segment.segmentId, "rejected")}
                                        className="px-2.5 py-1 rounded-lg text-xs"
                                        style={{
                                          background: (segmentApprovalStatus[segment.segmentId] ?? "pending") === "rejected" ? "rgba(220,38,38,0.22)" : "rgba(15,23,42,0.8)",
                                          border: "1px solid rgba(248,113,113,0.35)",
                                          color: "#fee2e2",
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {segmentCards.length > visibleSegments && (
                              <button
                                onClick={() => setVisibleSegments(c => c + INITIAL_VISIBLE_SEGMENTS)}
                                className="w-full mt-2 py-2 rounded-lg text-slate-300 hover:text-white transition-colors"
                                style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(148,163,184,0.18)", fontSize: "0.76rem", fontWeight: 600 }}
                              >
                                View {Math.min(INITIAL_VISIBLE_SEGMENTS, segmentCards.length - visibleSegments)} more categories
                              </button>
                            )}
                            {visibleSegments > INITIAL_VISIBLE_SEGMENTS && (
                              <button
                                onClick={() => setVisibleSegments(INITIAL_VISIBLE_SEGMENTS)}
                                className="w-full mt-1 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                                style={{ fontSize: "0.72rem" }}
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {approvalDrafts.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => setCollapsedSections(c => ({ ...c, drafts: !c.drafts }))}
                          className="flex items-center gap-2 w-full text-left mb-2"
                        >
                          {collapsedSections.drafts ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="text-slate-300" style={{ fontSize: "0.74rem", fontWeight: 600 }}>Email Drafts ({approvalDrafts.length})</span>
                        </button>
                        {!collapsedSections.drafts && (
                          <>
                            <div className="grid gap-2">
                              {approvalDrafts.slice(0, visibleDrafts).map((draft, index) => {
                                const bodyExpanded = expandedBodies.has(draft.segmentId);
                                const bodyLines = draft.body.split("\n");
                                const isTruncated = bodyLines.length > EMAIL_BODY_PREVIEW_LINES;
                                const displayBody = bodyExpanded || !isTruncated ? draft.body : bodyLines.slice(0, EMAIL_BODY_PREVIEW_LINES).join("\n") + "...";
                                return (
                                  <div key={`${draft.segmentId}-${index}`} className="rounded-xl p-3" style={{ background: "rgba(2,6,23,0.65)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                    <div className="flex items-center justify-between">
                                      <div className="text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{draft.segmentName}</div>
                                      {draft.tone && (
                                        <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "0.62rem", background: "rgba(14,116,144,0.18)", border: "1px solid rgba(34,211,238,0.22)", color: "#a5f3fc" }}>
                                          {draft.tone}
                                        </span>
                                      )}
                                    </div>
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
                                        <>
                                          <p className="text-slate-300 mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.55 }}>{displayBody}</p>
                                          {isTruncated && (
                                            <button
                                              onClick={() => setExpandedBodies(prev => {
                                                const next = new Set(prev);
                                                if (next.has(draft.segmentId)) next.delete(draft.segmentId);
                                                else next.add(draft.segmentId);
                                                return next;
                                              })}
                                              className="inline-flex items-center gap-1 mt-1 text-cyan-300 hover:text-cyan-100 transition-colors"
                                              style={{ fontSize: "0.7rem" }}
                                            >
                                              {bodyExpanded ? <><EyeOff className="w-3 h-3" /> Hide full email</> : <><Eye className="w-3 h-3" /> View full email</>}
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                      <span className="text-sky-200" style={{ fontSize: "0.7rem" }}>
                                        CTA: {pendingPause.ctaLink || latestCtaLink || ctaLink}
                                      </span>
                                      {draft.tags && draft.tags.length > 0 && draft.tags.map((tag, ti) => (
                                        <span key={ti} className="px-1.5 py-0.5 rounded-full" style={{ fontSize: "0.6rem", background: "rgba(51,65,85,0.5)", border: "1px solid rgba(100,116,139,0.3)", color: "#94a3b8" }}>
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={() => toggleDraftApproval(draft.segmentId, "approved")}
                                        className="px-2.5 py-1 rounded-lg text-xs"
                                        style={{
                                          background: (draftApprovalStatus[draft.segmentId] ?? "pending") === "approved" ? "rgba(22,163,74,0.22)" : "rgba(15,23,42,0.8)",
                                          border: "1px solid rgba(34,197,94,0.35)",
                                          color: "#dcfce7",
                                        }}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => toggleDraftApproval(draft.segmentId, "rejected")}
                                        className="px-2.5 py-1 rounded-lg text-xs"
                                        style={{
                                          background: (draftApprovalStatus[draft.segmentId] ?? "pending") === "rejected" ? "rgba(220,38,38,0.22)" : "rgba(15,23,42,0.8)",
                                          border: "1px solid rgba(248,113,113,0.35)",
                                          color: "#fee2e2",
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {approvalDrafts.length > visibleDrafts && (
                              <button
                                onClick={() => setVisibleDrafts(c => c + INITIAL_VISIBLE_DRAFTS)}
                                className="w-full mt-2 py-2 rounded-lg text-slate-300 hover:text-white transition-colors"
                                style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(148,163,184,0.18)", fontSize: "0.76rem", fontWeight: 600 }}
                              >
                                View {Math.min(INITIAL_VISIBLE_DRAFTS, approvalDrafts.length - visibleDrafts)} more drafts
                              </button>
                            )}
                            {visibleDrafts > INITIAL_VISIBLE_DRAFTS && (
                              <button
                                onClick={() => setVisibleDrafts(INITIAL_VISIBLE_DRAFTS)}
                                className="w-full mt-1 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                                style={{ fontSize: "0.72rem" }}
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {approvalError && (
                      <div className="mt-3 text-rose-200" style={{ fontSize: "0.76rem" }}>
                        {approvalError}
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

            {(latestMetrics || roundHistory.length > 0 || (phase === "complete" && result) || digitalTwinCards.length > 0) && (
              <div className="mt-8 border-t border-slate-800/60 pt-6 w-full">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <span className="text-white text-lg font-bold">Insights & Analysis Dashboard</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  
                  {/* Left Column: Metrics */}
                  <div className="flex flex-col gap-4">
                    {(latestMetrics || roundHistory.length > 0 || (phase === "complete" && result)) && (
                      <div className="rounded-[20px] p-5 w-full" style={{ background: "rgba(15,23,42,0.4)", border: "1px solid rgba(148,163,184,0.15)" }}>
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-white" style={{ fontSize: "0.95rem", fontWeight: 700 }}>Campaign Performance</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(14,116,144,0.15) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(34,211,238,0.18)" }}>
                            <div className="text-cyan-300" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Audience Reached</div>
                            <div className="text-white mt-1" style={{ fontSize: "1.4rem", fontWeight: 800 }}>{formatCount(totalSent || 0)}</div>
                          </div>
                          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(34,197,94,0.18)" }}>
                            <div className="text-emerald-300" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Open Rate</div>
                            <div className="text-white mt-1" style={{ fontSize: "1.4rem", fontWeight: 800 }}>{formatPercent(aggregateOpenRate)}</div>
                            <div className="text-emerald-400/60 mt-0.5" style={{ fontSize: "0.68rem" }}>{formatCount(totalOpened)} opens</div>
                          </div>
                          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(59,130,246,0.18)" }}>
                            <div className="text-blue-300" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Click Rate</div>
                            <div className="text-white mt-1" style={{ fontSize: "1.4rem", fontWeight: 800 }}>{formatPercent(aggregateClickRate)}</div>
                            <div className="text-blue-400/60 mt-0.5" style={{ fontSize: "0.68rem" }}>{formatCount(totalClicked)} clicks</div>
                          </div>
                          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(168,85,247,0.18)" }}>
                            <div className="text-purple-300" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Unique Engagement</div>
                            <div className="text-white mt-1" style={{ fontSize: "1.4rem", fontWeight: 800 }}>{formatCount(activeUniqueOpened)}</div>
                            <div className="text-purple-400/60 mt-0.5" style={{ fontSize: "0.68rem" }}>{formatCount(activeUniqueClicked)} clicks</div>
                          </div>
                        </div>

                        {/* Round History Timeline */}
                        {roundHistory.length > 1 && (
                          <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.65)", border: "1px solid rgba(148,163,184,0.14)" }}>
                            <div className="text-slate-400 mb-2" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Round Progression</div>
                            <div className="flex items-end gap-2">
                              {roundHistory.map((round) => {
                                const maxRate = Math.max(...roundHistory.map(r => r.summary.openRate), 1);
                                const barHeight = Math.max(16, (round.summary.openRate / maxRate) * 56);
                                return (
                                  <div key={round.round} className="flex flex-col items-center gap-1 flex-1">
                                    <div className="text-emerald-300" style={{ fontSize: "0.62rem" }}>{formatPercent(round.summary.openRate)}</div>
                                    <div className="w-full rounded-t-md" style={{ height: `${barHeight}px`, background: "linear-gradient(180deg, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.15) 100%)", minWidth: "20px" }} />
                                    <div className="text-slate-500" style={{ fontSize: "0.6rem" }}>R{round.round}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Digital Twin */}
                  <div className="flex flex-col gap-4">
                    {digitalTwinCards.length > 0 && (
                      <div className="rounded-[20px] p-5 w-full" style={{ background: "rgba(8,18,33,0.96)", border: "1px solid rgba(148,163,184,0.2)" }}>
                        <button
                          onClick={() => setCollapsedSections(c => ({ ...c, twin: !c.twin }))}
                          className="flex items-center justify-between gap-3 w-full text-left"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              {collapsedSections.twin ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                              <span className="text-white" style={{ fontSize: "0.95rem", fontWeight: 700 }}>Digital Twin Review</span>
                            </div>
                            <div className="text-slate-400 mt-1 ml-6" style={{ fontSize: "0.76rem" }}>
                              Each category card shows the current email draft plus live persona approvals.
                            </div>
                          </div>
                          <div className="text-slate-400" style={{ fontSize: "0.76rem" }}>
                            {formatCount(digitalTwinCards.length)} categories
                          </div>
                        </button>

                        {!collapsedSections.twin && (
                          <>
                          <div className="grid grid-cols-1 gap-3 mt-4">
                  {visibleDigitalTwinCards.map(({ segment, draft, twin }) => {
                    const badge = twinStageStyles(twin.stage);
                    const activeDraft = draft ?? {
                      subject: twin.subject,
                      body: twin.body,
                      ctaLink: twin.ctaLink,
                    };
                    const personaApprovals = twin.personas.filter((persona) => persona.decision === "open" || persona.decision === "click").length;
                    return (
                      <div
                        key={segment.segmentId}
                        className="rounded-2xl p-4"
                        style={{
                          background: "rgba(15,23,42,0.75)",
                          border: "1px solid rgba(148,163,184,0.18)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white" style={{ fontSize: "0.84rem", fontWeight: 700 }}>
                              {segment.name}
                            </div>
                            <div className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                              {formatCount(segment.size)} customers
                            </div>
                          </div>
                          <div
                            className="px-2 py-1 rounded-full"
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              background: badge.background,
                              border: badge.border,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-slate-500" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Subject
                          </div>
                          <div className="text-slate-100 mt-1" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                            {activeDraft.subject || "Digital Twin is waiting for the first draft..."}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-slate-500" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Email
                          </div>
                          <div className="text-slate-300 mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.55 }}>
                            {activeDraft.body || "The simulator will show the generated email here as soon as this category enters review."}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <div className="px-2 py-1 rounded-full" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.22)", color: "#bae6fd" }}>
                            Attempt {Math.max(twin.attempt, 1)} / {twin.maxAttempts}
                          </div>
                          <div className="px-2 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#dcfce7" }}>
                            {formatCount(personaApprovals)} approved
                          </div>
                          <div className="px-2 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.22)", color: "#fee2e2" }}>
                            {formatCount(twin.ignoreVotes)} declined
                          </div>
                        </div>

                        <div className="mt-3 text-sky-200" style={{ fontSize: "0.7rem" }}>
                          CTA link: {activeDraft.ctaLink || twin.ctaLink || pendingPause?.ctaLink || latestCtaLink || ctaLink}
                        </div>

                        <div className="mt-4">
                          <div className="text-slate-500" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Persona Decisions
                          </div>
                          {twin.personas.length > 0 ? (
                            <div className="grid gap-2 mt-2">
                              {twin.personas.map((persona) => {
                                const personaBadge = personaStyles(persona.decision);
                                return (
                                  <div
                                    key={persona.personaId}
                                    className="rounded-xl p-3"
                                    style={{ background: "rgba(2,6,23,0.65)", border: "1px solid rgba(148,163,184,0.14)" }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-slate-100" style={{ fontSize: "0.76rem", fontWeight: 600 }}>
                                          {persona.name}
                                        </div>
                                        <div className="text-slate-400 mt-1" style={{ fontSize: "0.68rem" }}>
                                          {[persona.occupation, persona.city].filter(Boolean).join(" • ") || "Synthetic persona"}
                                        </div>
                                      </div>
                                      <div
                                        className="px-2 py-1 rounded-full"
                                        style={{
                                          fontSize: "0.64rem",
                                          fontWeight: 700,
                                          background: personaBadge.background,
                                          border: personaBadge.border,
                                          color: personaBadge.color,
                                        }}
                                      >
                                        {personaBadge.verdict}
                                      </div>
                                    </div>
                                    <div className="text-slate-300 mt-2" style={{ fontSize: "0.71rem", lineHeight: 1.5 }}>
                                      {persona.monologue || personaBadge.detail}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-slate-400 mt-2" style={{ fontSize: "0.74rem" }}>
                              This category is queued. Persona reactions will appear here as soon as simulation starts.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {(digitalTwinCards.length > visibleTwinCards || visibleTwinCards > INITIAL_VISIBLE_TWIN_CARDS) && (
                  <div className="flex justify-center gap-2 mt-4">
                    {digitalTwinCards.length > visibleTwinCards && (
                      <button
                        onClick={() => setVisibleTwinCards((current) => current + INITIAL_VISIBLE_TWIN_CARDS)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-slate-100"
                        style={{ background: "rgba(30,41,59,0.85)", border: "1px solid rgba(148,163,184,0.28)", fontSize: "0.78rem", fontWeight: 700 }}
                      >
                        View more
                      </button>
                    )}
                    {visibleTwinCards > INITIAL_VISIBLE_TWIN_CARDS && (
                      <button
                        onClick={() => setVisibleTwinCards(INITIAL_VISIBLE_TWIN_CARDS)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-slate-100"
                        style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(148,163,184,0.22)", fontSize: "0.78rem", fontWeight: 700 }}
                      >
                        View less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
)}

            {phase === "complete" && latestPrompt && (
              <div className="mt-4 flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handlePerformOptimizationRound()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", fontSize: "0.84rem", fontWeight: 700 }}
                >
                  <Play className="w-4 h-4" />
                  Perform Optimization Round
                </motion.button>
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
              <input
                value={ctaLink}
                onChange={(event) => setCtaLink(event.target.value)}
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 outline-none px-2 py-2"
                placeholder="Required CTA link"
                style={{ fontSize: "0.86rem", lineHeight: 1.5, borderTop: "1px solid rgba(148,163,184,0.14)" }}
              />
              <div className="flex justify-between items-center pt-1 px-1">
                <button
                  onClick={() => {
                    setBrief(DEFAULT_BRIEF);
                    setCtaLink(DEFAULT_CTA_LINK);
                  }}
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
