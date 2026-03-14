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
  CreateCampaignRunPayload,
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

function deriveCampaignName(prompt: string) {
  const firstLine = prompt.trim().split("\n").find((line) => line.trim().length > 0) || "";
  return firstLine.slice(0, 80) || "Untitled Campaign";
}

function buildRoundImprovements(roundHistory: AgentRoundComplete[]) {
  const optimizationRounds = roundHistory.filter((round) =>
    (round.phase || round.summary.phase || "").toLowerCase() === "optimization" ||
    Number(round.optimizationRound ?? round.summary.optimizationRound ?? 0) > 0
  );

  return optimizationRounds.map((round, index) => {
    const previous = index > 0 ? optimizationRounds[index - 1] : null;
    const openDelta = previous ? round.summary.openRate - previous.summary.openRate : 0;
    const clickDelta = previous ? round.summary.clickRate - previous.summary.clickRate : 0;
    return {
      round: round.optimizationRound ?? round.summary.optimizationRound ?? round.displayRound ?? round.round,
      open_rate: Number(round.summary.openRate || 0),
      click_rate: Number(round.summary.clickRate || 0),
      open_rate_delta: Number(openDelta.toFixed(2)),
      click_rate_delta: Number(clickDelta.toFixed(2)),
    };
  });
}

function countOptimizationRounds(rounds: Array<AgentRoundComplete | AgentRunResult["metricsProgression"][number]>) {
  return rounds.filter((round) =>
    String(round.phase || "").toLowerCase() === "optimization" ||
    Number(round.optimizationRound ?? 0) > 0
  ).length;
}

function getRoundLabel(round: {
  round: number;
  phase?: string;
  phaseLabel?: string;
  displayRound?: number;
  optimizationRound?: number;
  virtualPredictionRound?: number;
  summary?: {
    phase?: string;
    phaseLabel?: string;
    displayRound?: number;
    optimizationRound?: number;
    virtualPredictionRound?: number;
  };
}) {
  const phase = (round.phase || round.summary?.phase || "").toLowerCase();
  const phaseLabel = round.phaseLabel || round.summary?.phaseLabel;
  const displayRound =
    round.displayRound ??
    round.summary?.displayRound ??
    (phase === "optimization"
      ? round.optimizationRound ?? round.summary?.optimizationRound
      : round.virtualPredictionRound ?? round.summary?.virtualPredictionRound) ??
    round.round;

  if (phase === "virtual_prediction") {
    return `${phaseLabel || "Virtual Rate Prediction Tool"} ${displayRound}`;
  }
  if (phase === "optimization") {
    return `${phaseLabel || "Optimization"} ${displayRound}`;
  }
  return `Round ${displayRound}`;
}

function getRoundChipLabel(round: {
  round: number;
  phase?: string;
  displayRound?: number;
  optimizationRound?: number;
  virtualPredictionRound?: number;
  summary?: {
    phase?: string;
    displayRound?: number;
    optimizationRound?: number;
    virtualPredictionRound?: number;
  };
}) {
  const phase = (round.phase || round.summary?.phase || "").toLowerCase();
  const displayRound =
    round.displayRound ??
    round.summary?.displayRound ??
    (phase === "optimization"
      ? round.optimizationRound ?? round.summary?.optimizationRound
      : round.virtualPredictionRound ?? round.summary?.virtualPredictionRound) ??
    round.round;

  if (phase === "virtual_prediction") return `VR${displayRound}`;
  if (phase === "optimization") return `O${displayRound}`;
  return `R${displayRound}`;
}

function buildAgentCategories(messages: ChatMessage[]) {
  const bucket = new Map<string, { message_count: number; thought_count: number; action_count: number; observation_count: number }>();

  messages.forEach((message) => {
    if (message.role === "user") return;
    const agent = message.agent || "Agent";
    const kind = (message.kind || "status").toLowerCase();
    const current = bucket.get(agent) || {
      message_count: 0,
      thought_count: 0,
      action_count: 0,
      observation_count: 0,
    };

    current.message_count += 1;
    if (kind === "thought") current.thought_count += 1;
    if (kind === "action") current.action_count += 1;
    if (kind === "observation") current.observation_count += 1;
    bucket.set(agent, current);
  });

  return Array.from(bucket.entries())
    .map(([agent, value]) => ({ agent, ...value }))
    .sort((a, b) => b.message_count - a.message_count);
}

function extractToolsUsed(terminalLogs: string[], messages: ChatMessage[]) {
  const tools = new Set<string>();
  const knownTools = [
    "open_clicks_preditor",
    "fetch_campaign_report",
    "fetch_customer_cohort",
    "send_campaign",
    "virtual_rate_prediction_tool",
    "match_documents",
    "search",
    "retriever",
  ];

  terminalLogs.forEach((line) => {
    const lowered = line.toLowerCase();
    knownTools.forEach((tool) => {
      if (lowered.includes(tool)) tools.add(tool);
    });
    const toolMatch = line.match(/tool(?:\s+used)?[:=]\s*([a-zA-Z0-9_.-]+)/i);
    if (toolMatch?.[1]) {
      tools.add(toolMatch[1].toLowerCase());
    }
  });

  messages.forEach((message) => {
    if ((message.kind || "").toLowerCase() !== "action") return;
    if ((message.agent || "").toLowerCase().includes("virtual rate prediction")) {
      tools.add("virtual_rate_prediction_tool");
    }
    const actionMatch = message.text.match(/action[:\s]+([a-zA-Z0-9_.-]+)/i);
    if (actionMatch?.[1]) {
      tools.add(actionMatch[1].toLowerCase());
    }
  });

  return Array.from(tools).sort();
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

function normalizeAgentKey(agent?: string) {
  const value = (agent || "").toLowerCase();
  if (value.includes("virtual rate prediction")) return "predictor";
  if (value.includes("war room") || value.includes("warroom") || value.includes("war_room")) return "war_room";
  if (value.includes("copywriter") || value.includes("psychologist") || value.includes("controller") || value.includes("advisor")) return "war_room";
  if (value.includes("simulator") || value.includes("twin")) return "simulator";
  if (value.includes("bandit")) return "bandit";
  if (value.includes("predictor")) return "predictor";
  if (value.includes("strateg")) return "strategist";
  if (value.includes("hitl") || value.includes("human")) return "hitl";
  if (value.includes("segment") || value.includes("cohort")) return "segment";
  if (value.includes("content") || value.includes("copy")) return "content";
  if (value.includes("planner")) return "planner";
  return "agent";
}

function getAgentProfile(agent?: string) {
  const key = normalizeAgentKey(agent);
  if (key === "war_room") {
    return {
      key,
      label: "War Room",
      description: "Coordinates cross-agent decisions and resolves strategy conflicts.",
      icon: Gavel,
      badgeBg: "rgba(168,85,247,0.14)",
      badgeBorder: "1px solid rgba(192,132,252,0.35)",
      badgeColor: "#e9d5ff",
      bubbleBg: "rgba(59,7,100,0.3)",
      bubbleBorder: "1px solid rgba(168,85,247,0.24)",
    };
  }
  if (key === "simulator") {
    return {
      key,
      label: "Simulator",
      description: "Tests content with digital-twin personas before campaign decisions.",
      icon: Eye,
      badgeBg: "rgba(14,116,144,0.16)",
      badgeBorder: "1px solid rgba(34,211,238,0.3)",
      badgeColor: "#a5f3fc",
      bubbleBg: "rgba(4,47,46,0.32)",
      bubbleBorder: "1px solid rgba(45,212,191,0.24)",
    };
  }
  if (key === "bandit") {
    return {
      key,
      label: "Bandit",
      description: "Explores and exploits variants to improve open and click outcomes.",
      icon: TrendingUp,
      badgeBg: "rgba(16,185,129,0.16)",
      badgeBorder: "1px solid rgba(52,211,153,0.3)",
      badgeColor: "#a7f3d0",
      bubbleBg: "rgba(6,78,59,0.3)",
      bubbleBorder: "1px solid rgba(16,185,129,0.24)",
    };
  }
  if (key === "predictor") {
    return {
      key,
      label: "Virtual Rate Prediction Tool",
      description: "Runs automatic forecast rounds before human-approved optimization begins.",
      icon: BarChart3,
      badgeBg: "rgba(14,116,144,0.18)",
      badgeBorder: "1px solid rgba(56,189,248,0.32)",
      badgeColor: "#bae6fd",
      bubbleBg: "rgba(8,47,73,0.26)",
      bubbleBorder: "1px solid rgba(56,189,248,0.24)",
    };
  }
  if (key === "hitl") {
    return {
      key,
      label: "HITL",
      description: "Human-in-the-loop checkpoint for approvals, rejections, and edits.",
      icon: User,
      badgeBg: "rgba(251,146,60,0.15)",
      badgeBorder: "1px solid rgba(251,146,60,0.32)",
      badgeColor: "#fed7aa",
      bubbleBg: "rgba(67,20,7,0.3)",
      bubbleBorder: "1px solid rgba(251,146,60,0.24)",
    };
  }
  if (key === "strategist") {
    return {
      key,
      label: "Strategist",
      description: "Builds messaging strategy, positioning, and optimization direction.",
      icon: BrainCircuit,
      badgeBg: "rgba(99,102,241,0.15)",
      badgeBorder: "1px solid rgba(129,140,248,0.32)",
      badgeColor: "#c7d2fe",
      bubbleBg: "rgba(30,27,75,0.32)",
      bubbleBorder: "1px solid rgba(99,102,241,0.24)",
    };
  }
  if (key === "segment") {
    return {
      key,
      label: "Segment Engine",
      description: "Finds customer segments and targeting criteria.",
      icon: Search,
      badgeBg: "rgba(56,189,248,0.15)",
      badgeBorder: "1px solid rgba(56,189,248,0.3)",
      badgeColor: "#bae6fd",
      bubbleBg: "rgba(15,23,42,0.7)",
      bubbleBorder: "1px solid rgba(56,189,248,0.24)",
    };
  }
  if (key === "content") {
    return {
      key,
      label: "Content Agent",
      description: "Generates email subjects, bodies, and variant refinements.",
      icon: Pencil,
      badgeBg: "rgba(244,114,182,0.15)",
      badgeBorder: "1px solid rgba(244,114,182,0.3)",
      badgeColor: "#fbcfe8",
      bubbleBg: "rgba(80,7,36,0.25)",
      bubbleBorder: "1px solid rgba(244,114,182,0.24)",
    };
  }
  if (key === "planner") {
    return {
      key,
      label: "Planner",
      description: "Plans execution order and manages step-by-step workflow.",
      icon: Sparkles,
      badgeBg: "rgba(245,158,11,0.15)",
      badgeBorder: "1px solid rgba(251,191,36,0.32)",
      badgeColor: "#fde68a",
      bubbleBg: "rgba(45,26,3,0.35)",
      bubbleBorder: "1px solid rgba(245,158,11,0.24)",
    };
  }
  return {
    key,
    label: agent || "Agent",
    description: "General orchestration and execution updates.",
    icon: Bot,
    badgeBg: "rgba(15,23,42,0.45)",
    badgeBorder: "1px solid rgba(148,163,184,0.3)",
    badgeColor: "#cbd5e1",
    bubbleBg: "rgba(15,23,42,0.72)",
    bubbleBorder: "1px solid rgba(148,163,184,0.2)",
  };
}

function shouldAttachTwinInsights(agent?: string) {
  const key = normalizeAgentKey(agent);
  return key === "war_room" || key === "simulator";
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
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [campaignRunId, setCampaignRunId] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const campaignRunIdRef = useRef<string | null>(null);
  const activeRunAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

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

  useEffect(() => {
    campaignRunIdRef.current = campaignRunId;
  }, [campaignRunId]);

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
    const abortController = new AbortController();
    activeRunAbortRef.current = abortController;
    setPhase("running");

    try {
      const finalResult = await streamCampaignAgent(prompt, {
        rounds: MAX_INTERACTIVE_OPTIMIZATION_ROUNDS,
        interactive: true,
        signal: abortController.signal,
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
              const roundLabel = getRoundLabel(metrics);

              pushMessage({
                role: "system",
                kind: "metrics",
                text: `${roundLabel}: sent ${formatCount(totalSent)}, open ${formatPercent(aggOpenRate)}, click ${formatPercent(aggClickRate)}.`,
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
            const roundLabel = getRoundLabel(round);

            pushMessage({
              role: "system",
              kind: "summary",
              text: `${roundLabel} complete. Cumulative open ${formatPercent(aggOpenRate)} and click ${formatPercent(aggClickRate)}.`,
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
      const isAbort = runError instanceof Error && runError.name === "AbortError";
      if (isAbort) {
        setPendingPause(null);
        pauseResponderRef.current = null;
        setError(null);
        setPhase("complete");
        pushMessage({
          role: "system",
          kind: "final",
          text: "Campaign run ended by user.",
        });
        return;
      }

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
    } finally {
      if (activeRunAbortRef.current === abortController) {
        activeRunAbortRef.current = null;
      }
    }
  }, [pushMessage]);

  const handleStart = useCallback(async () => {
    const prompt = brief.trim();
    const link = ctaLink.trim();
    if (!prompt || !link || !canStart) return;

    activeRunAbortRef.current?.abort();
    activeRunAbortRef.current = null;
    campaignRunIdRef.current = null;
    setCampaignRunId(null);
    setSaveError(null);

    resetRunState(false);
    setMessages([]);
    setLatestPrompt(prompt);
    setLatestCtaLink(link);
    const initialPayload: CreateCampaignRunPayload = {
      campaign_name: deriveCampaignName(prompt),
      prompt,
      cta_link: link || undefined,
      phase: "running",
      total_rounds: 0,
      total_sent: 0,
      total_opened: 0,
      total_clicked: 0,
      open_rate: 0,
      click_rate: 0,
      metrics: null,
      round_history: [],
      improvements: [],
      agent_categories: [],
      final_mails: [],
      tools_used: [],
      terminal_logs: [],
      messages: [],
      segments: [],
      twin_cards: [],
      raw_payload: null,
    };

    try {
      const createResponse = await fetch("/api/campaign-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initialPayload),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData?.message || "Failed to initialize campaign run.");
      }

      const created = await createResponse.json();
      const createdId = String(created?.id || "");
      if (createdId) {
        campaignRunIdRef.current = createdId;
        setCampaignRunId(createdId);
      }
    } catch (createError) {
      setSaveError(createError instanceof Error ? createError.message : "Unable to initialize campaign run storage.");
    }

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
  const hasCampaignData = messages.length > 0 || roundHistory.length > 0 || !!result;

  const buildCampaignRunPayload = useCallback((
    phaseOverride?: RunPhase,
    promptOverride?: string,
    ctaOverride?: string
  ): CreateCampaignRunPayload | null => {
    const prompt = (promptOverride ?? latestPrompt ?? brief).trim();
    if (!prompt) {
      return null;
    }

    const resolvedCta = (ctaOverride ?? latestCtaLink ?? ctaLink).trim();

    return {
      campaign_name: deriveCampaignName(prompt),
      prompt,
      cta_link: resolvedCta || undefined,
      phase: phaseOverride ?? phase,
      total_rounds: Math.max(
        countOptimizationRounds(roundHistory),
        latestMetrics?.optimizationRound ?? 0,
        countOptimizationRounds(result?.metricsProgression ?? [])
      ),
      total_sent: Math.max(0, totalSent),
      total_opened: Math.max(0, totalOpened),
      total_clicked: Math.max(0, totalClicked),
      open_rate: Number(aggregateOpenRate.toFixed(2)),
      click_rate: Number(aggregateClickRate.toFixed(2)),
      metrics: latestMetrics,
      round_history: roundHistory,
      improvements: buildRoundImprovements(roundHistory),
      agent_categories: buildAgentCategories(messages),
      final_mails: approvalDrafts.map((draft) => ({
        segment_id: draft.segmentId,
        segment_name: draft.segmentName,
        subject: draft.subject,
        body: ensureDraftContainsLink(draft.body, resolvedCta),
        tone: draft.tone || null,
        tags: draft.tags || [],
        cta_link: draft.ctaLink || resolvedCta || null,
        approved: draftApprovalStatus[draft.segmentId] !== "rejected",
      })),
      tools_used: extractToolsUsed(terminalLogs, messages),
      terminal_logs: terminalLogs,
      messages: messages.map(({ id, role, text, kind, agent, timestamp }) => ({
        id,
        role,
        text,
        kind: kind || "status",
        agent: agent || "Agent",
        timestamp,
      })),
      segments: segmentCards,
      twin_cards: Object.values(twinCards),
      raw_payload: {
        baselineMetrics,
        result,
      },
    };
  }, [
    approvalDrafts,
    aggregateClickRate,
    aggregateOpenRate,
    baselineMetrics,
    brief,
    ctaLink,
    draftApprovalStatus,
    latestCtaLink,
    latestMetrics,
    latestPrompt,
    messages,
    phase,
    result,
    roundHistory,
    segmentCards,
    terminalLogs,
    totalClicked,
    totalOpened,
    totalSent,
    twinCards,
  ]);

  const persistCampaignRun = useCallback(async ({
    forceCreate = false,
    phaseOverride,
    promptOverride,
    ctaOverride,
  }: {
    forceCreate?: boolean;
    phaseOverride?: RunPhase;
    promptOverride?: string;
    ctaOverride?: string;
  } = {}): Promise<string | null> => {
    const payload = buildCampaignRunPayload(phaseOverride, promptOverride, ctaOverride);
    if (!payload) {
      return null;
    }

    try {
      const existingId = forceCreate ? null : campaignRunIdRef.current;
      const endpoint = existingId ? `/api/campaign-runs/${existingId}` : "/api/campaign-runs";
      const method = existingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || "Failed to persist campaign data.");
      }

      const saved = await response.json();
      const savedId = String(saved?.id || existingId || "");
      if (savedId && savedId !== campaignRunIdRef.current) {
        campaignRunIdRef.current = savedId;
        setCampaignRunId(savedId);
      }

      return savedId || null;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to persist campaign data right now.");
      return null;
    }
  }, [buildCampaignRunPayload]);

  const handleEndCampaignAndViewAnalysis = useCallback(async () => {
    if (!hasCampaignData || isSavingCampaign) return;

    activeRunAbortRef.current?.abort();
    activeRunAbortRef.current = null;
    pauseResponderRef.current = null;
    setPendingPause(null);
    setPhase("complete");

    setIsSavingCampaign(true);
    setSaveError(null);
    try {
      const savedId = await persistCampaignRun({
        phaseOverride: "complete",
        promptOverride: latestPrompt || brief,
        ctaOverride: latestCtaLink || ctaLink,
      });

      if (!savedId) {
        throw new Error("Campaign data could not be saved before redirect.");
      }

      router.push(`/campaign/${savedId}/analysis`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to end campaign right now.");
    } finally {
      setIsSavingCampaign(false);
    }
  }, [
    brief,
    ctaLink,
    hasCampaignData,
    isSavingCampaign,
    latestCtaLink,
    latestPrompt,
    persistCampaignRun,
    router,
  ]);

  useEffect(() => {
    if (isSavingCampaign || !campaignRunId || roundHistory.length === 0) {
      return;
    }
    void persistCampaignRun({ phaseOverride: phase });
  }, [campaignRunId, isSavingCampaign, phase, roundHistory.length, persistCampaignRun]);

  useEffect(() => {
    if (isSavingCampaign || !campaignRunId) {
      return;
    }
    if (phase !== "complete" && phase !== "error") {
      return;
    }
    void persistCampaignRun({ phaseOverride: phase });
  }, [campaignRunId, isSavingCampaign, phase, persistCampaignRun]);

  return (
    <div
      className={`${hasConversation ? "h-screen overflow-hidden" : "min-h-screen"} pt-20 px-4 ${hasConversation ? "pb-6" : "pb-10"}`}
      style={{ background: "linear-gradient(180deg, #070f19 0%, #0b1624 100%)" }}
    >
      <Navbar />

      <div className={`${hasConversation ? "max-w-[1400px] h-full flex flex-col" : "max-w-4xl"} mx-auto`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            style={{ fontSize: "0.86rem" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasConversation && phase === "complete" && latestPrompt && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void handlePerformOptimizationRound()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", fontSize: "0.76rem", fontWeight: 700 }}
              >
                <Play className="w-4 h-4" />
                Perform Optimization Round
              </motion.button>
            )}

            {hasConversation && (
              <motion.button
                whileHover={{ scale: hasCampaignData && !isSavingCampaign ? 1.01 : 1 }}
                whileTap={{ scale: hasCampaignData && !isSavingCampaign ? 0.99 : 1 }}
                onClick={() => void handleEndCampaignAndViewAnalysis()}
                disabled={!hasCampaignData || isSavingCampaign}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #0369a1 0%, #1d4ed8 100%)", fontSize: "0.76rem", fontWeight: 700 }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSavingCampaign ? "Ending Campaign..." : "End Campaign and View Analysis"}
              </motion.button>
            )}

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
        </div>

        {hasConversation && saveError && (
          <p className="text-rose-300 mb-3" style={{ fontSize: "0.76rem" }}>
            {saveError}
          </p>
        )}
        {hasConversation && error && (
          <p className="text-rose-300 mb-3" style={{ fontSize: "0.76rem" }}>
            {error}
          </p>
        )}

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
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-8 min-h-0 flex flex-col gap-4">
            <div
              ref={chatRef}
              className="rounded-[28px] p-4 md:p-6 flex-1 min-h-0 overflow-y-auto"
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
                    const kindLabelText = kindLabel(message.kind);
                    const kindIconConfig = kindVisualConfig(message.kind);
                    const KindIcon = kindIconConfig.icon;
                    const agentProfile = getAgentProfile(message.agent);
                    const AgentIcon = agentProfile.icon;
                    const normalizedAgentKey = normalizeAgentKey(message.agent);
                    const isLastAgentMessage = !messages
                      .slice(index + 1)
                      .some(
                        (next) =>
                          next.role === message.role &&
                          normalizeAgentKey(next.agent) === normalizedAgentKey
                      );
                    const canShowTwinDropdown =
                      !isUser &&
                      !isSystem &&
                      shouldAttachTwinInsights(message.agent) &&
                      digitalTwinCards.length > 0 &&
                      isLastAgentMessage;

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
                              background: isSystem ? kindConfig.bubbleBg : agentProfile.bubbleBg,
                              border: isSystem ? kindConfig.bubbleBorder : agentProfile.bubbleBorder,
                            }}
                          >
                            {/* Header - shown only for first message in a group or different agents */}
                            {!isSameAgentContinuation && (
                              <div className="flex items-center gap-2 mb-1.5">
                                <div
                                  className="flex items-center gap-1.5"
                                  title={`${agentProfile.label}: ${agentProfile.description}`}
                                >
                                  <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center"
                                    style={{
                                      background: isSystem ? kindIconConfig.badgeBg : agentProfile.badgeBg,
                                      border: isSystem ? kindIconConfig.badgeBorder : agentProfile.badgeBorder,
                                    }}
                                  >
                                    {isSystem ? (
                                      <KindIcon className="w-3 h-3" style={{ color: kindIconConfig.accentColor }} />
                                    ) : (
                                      <AgentIcon
                                        className="w-3 h-3"
                                        style={{ color: isSystem ? kindIconConfig.badgeColor : agentProfile.badgeColor }}
                                      />
                                    )}
                                  </div>
                                  <span
                                    className="text-slate-200"
                                    style={{ fontSize: "0.7rem", fontWeight: 700 }}
                                  >
                                    {message.agent || "Agent"}
                                  </span>
                                </div>
                                <span
                                  className="px-1.5 py-0.5 rounded-full"
                                  style={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    color: kindIconConfig.badgeColor,
                                    background: kindIconConfig.badgeBg,
                                    border: kindIconConfig.badgeBorder,
                                  }}
                                >
                                  {kindLabelText}
                                </span>
                              </div>
                            )}
                            {/* Compact inline badge for continuation messages */}
                            {isSameAgentContinuation && (
                              <div
                                className="flex items-center gap-1.5 mb-1"
                                title={`${agentProfile.label}: ${agentProfile.description}`}
                              >
                                <AgentIcon className="w-3 h-3" style={{ color: agentProfile.badgeColor, opacity: 0.9 }} />
                                <span className="text-slate-300" style={{ fontSize: "0.62rem", fontWeight: 700 }}>
                                  {message.agent || "Agent"}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: "0.58rem", fontWeight: 600, color: kindIconConfig.badgeColor, background: kindIconConfig.badgeBg, border: kindIconConfig.badgeBorder, opacity: 0.8 }}>
                                  {kindLabelText}
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

                            {canShowTwinDropdown && (
                              <details
                                className="mt-2 rounded-lg p-2"
                                style={{
                                  background: "rgba(2,6,23,0.65)",
                                  border: "1px solid rgba(94,234,212,0.2)",
                                }}
                              >
                                <summary
                                  className="cursor-pointer text-slate-200"
                                  style={{ fontSize: "0.72rem", fontWeight: 700 }}
                                >
                                  Digital Twin Review ({formatCount(digitalTwinCards.length)} categories)
                                </summary>
                                <div className="mt-2 max-h-[260px] overflow-y-auto pr-1 space-y-2">
                                  {visibleDigitalTwinCards.map(({ segment, draft, twin }) => {
                                    const badge = twinStageStyles(twin.stage);
                                    const activeDraft = draft ?? {
                                      subject: twin.subject,
                                      body: twin.body,
                                      ctaLink: twin.ctaLink,
                                    };
                                    const personaApprovals = twin.personas.filter((persona) => persona.decision === "open" || persona.decision === "click").length;
                                    return (
                                      <details
                                        key={`${message.id}-${segment.segmentId}`}
                                        className="rounded-lg p-2"
                                        style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.18)" }}
                                      >
                                        <summary className="cursor-pointer list-none">
                                          <div className="flex items-center justify-between gap-2">
                                            <div>
                                              <div className="text-slate-100" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                                                {segment.name}
                                              </div>
                                              <div className="text-slate-400 mt-0.5" style={{ fontSize: "0.62rem" }}>
                                                Attempt {Math.max(twin.attempt, 1)} / {twin.maxAttempts} • {formatCount(personaApprovals)} positive • {formatCount(twin.ignoreVotes)} declined
                                              </div>
                                            </div>
                                            <div
                                              className="px-1.5 py-0.5 rounded-full"
                                              style={{ fontSize: "0.58rem", fontWeight: 700, background: badge.background, border: badge.border, color: badge.color }}
                                            >
                                              {badge.label}
                                            </div>
                                          </div>
                                        </summary>
                                        <div className="text-slate-400 mt-1" style={{ fontSize: "0.64rem" }}>
                                          Subject: {activeDraft.subject || "Waiting for draft"}
                                        </div>
                                        <div className="text-sky-200 mt-1" style={{ fontSize: "0.62rem" }}>
                                          CTA: {activeDraft.ctaLink || twin.ctaLink || pendingPause?.ctaLink || latestCtaLink || ctaLink}
                                        </div>
                                        <div className="mt-2 grid gap-1.5">
                                          {twin.personas.map((persona) => {
                                            const personaStyle = personaStyles(persona.decision);
                                            return (
                                              <details
                                                key={`${segment.segmentId}-${persona.personaId}`}
                                                className="rounded-md px-2 py-1.5"
                                                style={{ background: "rgba(2,6,23,0.55)", border: "1px solid rgba(100,116,139,0.2)" }}
                                              >
                                                <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                                                  <span className="text-slate-200" style={{ fontSize: "0.62rem", fontWeight: 600 }}>
                                                    {persona.name}
                                                  </span>
                                                  <span
                                                    className="px-1.5 py-0.5 rounded-full"
                                                    style={{ fontSize: "0.56rem", background: personaStyle.background, border: personaStyle.border, color: personaStyle.color }}
                                                    title={personaStyle.verdict}
                                                  >
                                                    {personaStyle.detail}
                                                  </span>
                                                </summary>
                                                <div className="text-slate-400 mt-1" style={{ fontSize: "0.58rem" }}>
                                                  {persona.occupation ? `${persona.occupation}` : "Persona"}{persona.city ? ` • ${persona.city}` : ""}
                                                </div>
                                                {persona.monologue && (
                                                  <div className="text-slate-300 mt-1 whitespace-pre-wrap" style={{ fontSize: "0.6rem", lineHeight: 1.5 }}>
                                                    {persona.monologue}
                                                  </div>
                                                )}
                                              </details>
                                            );
                                          })}
                                        </div>
                                        <div className="text-slate-400 mt-1" style={{ fontSize: "0.62rem" }}>
                                          Attempt {Math.max(twin.attempt, 1)} / {twin.maxAttempts} • {formatCount(personaApprovals)} approved • {formatCount(twin.ignoreVotes)} declined
                                        </div>
                                        <div className="text-sky-200 mt-1" style={{ fontSize: "0.62rem" }}>
                                          CTA: {activeDraft.ctaLink || twin.ctaLink || pendingPause?.ctaLink || latestCtaLink || ctaLink}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                                {(digitalTwinCards.length > visibleTwinCards || visibleTwinCards > INITIAL_VISIBLE_TWIN_CARDS) && (
                                  <div className="flex gap-2 mt-2">
                                    {digitalTwinCards.length > visibleTwinCards && (
                                      <button
                                        onClick={() => setVisibleTwinCards((current) => current + INITIAL_VISIBLE_TWIN_CARDS)}
                                        className="px-2 py-1 rounded-md text-slate-100"
                                        style={{ fontSize: "0.64rem", background: "rgba(30,41,59,0.85)", border: "1px solid rgba(148,163,184,0.26)" }}
                                      >
                                        View more
                                      </button>
                                    )}
                                    {visibleTwinCards > INITIAL_VISIBLE_TWIN_CARDS && (
                                      <button
                                        onClick={() => setVisibleTwinCards(INITIAL_VISIBLE_TWIN_CARDS)}
                                        className="px-2 py-1 rounded-md text-slate-100"
                                        style={{ fontSize: "0.64rem", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(148,163,184,0.22)" }}
                                      >
                                        View less
                                      </button>
                                    )}
                                  </div>
                                )}
                              </details>
                            )}
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
                    className="flex justify-start w-full"
                  >
                    <div className="rounded-2xl px-4 py-3 self-start" style={{ background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.2)" }}>
                      <div className="flex items-center gap-2 text-slate-200" style={{ fontSize: "0.78rem" }}>
                        <Bot className="w-3.5 h-3.5" />
                        {thinkingMessages[thinkingMsgIndex]}
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
            </div>

            <div className="xl:col-span-4 min-h-0 flex flex-col gap-4">
              <div
                className="rounded-[24px] p-4 md:p-5 flex-[1.25] min-h-0 flex flex-col"
                style={{ background: "rgba(8,18,33,0.96)", border: "1px solid rgba(148,163,184,0.2)" }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <span className="text-white text-lg font-bold">Analysis Stats</span>
                </div>
                <p className="text-slate-400 mt-1" style={{ fontSize: "0.76rem" }}>
                  Performance trends for the current campaign run.
                </p>

                <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                  {(latestMetrics || roundHistory.length > 0 || (phase === "complete" && result)) ? (
                    <div className="rounded-[20px] p-4 w-full" style={{ background: "rgba(15,23,42,0.4)", border: "1px solid rgba(148,163,184,0.15)" }}>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="rounded-2xl p-3" style={{ background: "linear-gradient(135deg, rgba(14,116,144,0.15) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(34,211,238,0.18)" }}>
                          <div className="text-cyan-300" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Audience Reached</div>
                          <div className="text-white mt-1" style={{ fontSize: "1.1rem", fontWeight: 800 }}>{formatCount(totalSent || 0)}</div>
                        </div>
                        <div className="rounded-2xl p-3" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(34,197,94,0.18)" }}>
                          <div className="text-emerald-300" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Open Rate</div>
                          <div className="text-white mt-1" style={{ fontSize: "1.1rem", fontWeight: 800 }}>{formatPercent(aggregateOpenRate)}</div>
                          <div className="text-emerald-400/60 mt-0.5" style={{ fontSize: "0.66rem" }}>{formatCount(totalOpened)} opens</div>
                        </div>
                        <div className="rounded-2xl p-3" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(59,130,246,0.18)" }}>
                          <div className="text-blue-300" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Click Rate</div>
                          <div className="text-white mt-1" style={{ fontSize: "1.1rem", fontWeight: 800 }}>{formatPercent(aggregateClickRate)}</div>
                          <div className="text-blue-400/60 mt-0.5" style={{ fontSize: "0.66rem" }}>{formatCount(totalClicked)} clicks</div>
                        </div>
                        <div className="rounded-2xl p-3" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(15,23,42,0.75) 100%)", border: "1px solid rgba(168,85,247,0.18)" }}>
                          <div className="text-purple-300" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Unique Engagement</div>
                          <div className="text-white mt-1" style={{ fontSize: "1.1rem", fontWeight: 800 }}>{formatCount(activeUniqueOpened)}</div>
                          <div className="text-purple-400/60 mt-0.5" style={{ fontSize: "0.66rem" }}>{formatCount(activeUniqueClicked)} clicks</div>
                        </div>
                      </div>

                      {roundHistory.length > 1 && (
                        <div className="mt-3 rounded-2xl p-3" style={{ background: "rgba(15,23,42,0.65)", border: "1px solid rgba(148,163,184,0.14)" }}>
                          <div className="text-slate-400 mb-2" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Round Progression</div>
                          <div className="flex items-end gap-1.5">
                            {roundHistory.map((round) => {
                              const maxRate = Math.max(...roundHistory.map((entry) => entry.summary.openRate), 1);
                              const barHeight = Math.max(14, (round.summary.openRate / maxRate) * 44);
                              return (
                                <div key={`${round.phase || round.summary.phase || "round"}-${round.round}`} className="flex flex-col items-center gap-1 flex-1">
                                  <div className="text-emerald-300" style={{ fontSize: "0.58rem" }}>{formatPercent(round.summary.openRate)}</div>
                                  <div className="w-full rounded-t-md" style={{ height: `${barHeight}px`, background: "linear-gradient(180deg, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.15) 100%)", minWidth: "16px" }} />
                                  <div className="text-slate-500" style={{ fontSize: "0.56rem" }}>{getRoundChipLabel(round)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-[20px] p-4" style={{ background: "rgba(15,23,42,0.4)", border: "1px solid rgba(148,163,184,0.16)" }}>
                      <p className="text-slate-400" style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
                        Analysis stats will populate when campaign metrics are produced.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="rounded-[24px] p-4 md:p-5 flex-[0.9] min-h-0 flex flex-col"
                style={{ background: "rgba(8,18,33,0.96)", border: "1px solid rgba(148,163,184,0.2)" }}
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-400" />
                  <span className="text-white text-lg font-bold">Live Terminal Commands</span>
                </div>
                <p className="text-slate-400 mt-1" style={{ fontSize: "0.76rem" }}>
                  Real-time command and process output from running agents.
                </p>

                <div
                  className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-2xl p-3"
                  style={{
                    background: "rgba(2,6,23,0.75)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    fontFamily: "monospace",
                  }}
                >
                  {terminalLogs.length > 0 ? (
                    <div className="space-y-1">
                      {terminalLogs.map((log, i) => (
                        <div key={`term-${i}`} className="text-slate-300 whitespace-pre-wrap leading-relaxed" style={{ fontSize: "0.68rem" }}>
                          {log}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                  ) : (
                    <p className="text-slate-500" style={{ fontSize: "0.72rem", lineHeight: 1.6 }}>
                      Terminal output will appear here when agents execute commands.
                    </p>
                  )}
                </div>
              </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
