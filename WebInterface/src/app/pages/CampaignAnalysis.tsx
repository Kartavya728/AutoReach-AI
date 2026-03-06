"use client";

import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, Users, Mail, Eye, MousePointer,
  CheckCircle, XCircle, ChevronLeft, Sparkles, Brain,
  Clock, Target, Globe, Smile, User, Activity, ArrowUpRight,
  RefreshCw, Send, AlertTriangle, ChevronRight, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import { Navbar } from "../components/Navbar";
import { AIProcessing } from "../components/AIProcessing";
import type { CampaignRow, OptimizationSuggestionRow, ComputedAnalysisReport, ImprovementReport } from "../../lib/types";

const ANALYSIS_STEPS = [
  { step: "Fetching campaign report from CampaignX API...", agent: "Performance-Monitor" },
  { step: "Parsing customer interaction records (EO/EC flags)...", agent: "Performance-Monitor" },
  { step: "Calculating open rate across audience...", agent: "Performance-Monitor" },
  { step: "Calculating click rate across audience...", agent: "Performance-Monitor" },
  { step: "THOUGHT: Identifying performance patterns by segment", agent: "ReAct-Planner" },
  { step: "ACTION: Segment analysis by age, gender, region, device", agent: "ReAct-Planner" },
  { step: "OBSERVATION: Correlating demographic engagement", agent: "ReAct-Planner" },
  { step: "Querying RAG knowledge base for optimization strategies...", agent: "RAG-Retriever" },
  { step: "Retrieved relevant optimization documents", agent: "RAG-Retriever" },
  { step: "Generating optimization recommendations with reasoning...", agent: "ReAct-Planner" },
  { step: "Ranking optimizations by expected impact × confidence...", agent: "Strategy-Agent" },
  { step: "Analysis complete. Optimization report ready for review.", agent: "Orchestrator" },
];

const OPT_ICONS: Record<string, React.ElementType> = {
  clock: Clock,
  smile: Smile,
  user: User,
  globe: Globe,
  users: Users,
};

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: "rgba(239,68,68,0.1)", text: "#f87171", border: "rgba(239,68,68,0.3)" },
  medium: { bg: "rgba(234,179,8,0.1)", text: "#fbbf24", border: "rgba(234,179,8,0.3)" },
  low: { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", border: "rgba(107,114,128,0.3)" },
};

const DEVICE_COLORS = ["#7c3aed", "#0891b2", "#059669"];

export default function CampaignAnalysis() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [analysisStep, setAnalysisStep] = useState<"loading" | "ready">("loading");
  const [agentSteps, setAgentSteps] = useState<{ step: string; agent: string }[]>([]);
  const [optStatuses, setOptStatuses] = useState<Record<string, "pending" | "approved" | "rejected">>({});
  const [expandedOpt, setExpandedOpt] = useState<string | null>(null);
  const [showRelaunching, setShowRelaunching] = useState(false);
  const [improvementReport, setImprovementReport] = useState<ImprovementReport | null>(null);

  // Real data state
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [report, setReport] = useState<ComputedAnalysisReport | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestionRow[]>([]);
  const [optimizationHistory, setOptimizationHistory] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const campaignId = id || "";

  // Fetch real data from API
  useEffect(() => {
    if (!campaignId) {
      setNotFound(true);
      setDataLoading(false);
      return;
    }

    async function loadCampaignData() {
      // 1. Session Cache for instant load
      const cacheKey = `campaign_data_${campaignId}`;
      // Always fetch fresh — never serve cached metrics (old data may have 0% rates)
      // const cached = sessionStorage.getItem(cacheKey);
      // disabled: cache caused stale 0% metrics to persist

      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        const data = await res.json();
        
        // Cache for next session load
        sessionStorage.setItem(cacheKey, JSON.stringify(data));

        setCampaign(data.campaign);
        setReport(data.analysisReport);
        setSuggestions(data.optimizations || []);
        setOptimizationHistory(data.optimizationHistory || []);

        // Initialize opt statuses from fetched suggestions
        const statuses: Record<string, "pending" | "approved" | "rejected"> = {};
        for (const opt of (data.optimizations || [])) {
          statuses[opt.id] = opt.status || "pending";
        }
        setOptStatuses(statuses);
      } catch (err) {
        console.warn("Failed to load campaign data:", err);
      } finally {
        setDataLoading(false);
        setAnalysisStep("ready");
      }
    }

    loadCampaignData();
  }, [campaignId]);

  const handleApproveOpt = (optId: string) => {
    setOptStatuses((prev) => ({ ...prev, [optId]: "approved" }));
  };

  const handleRejectOpt = (optId: string) => {
    setOptStatuses((prev) => ({ ...prev, [optId]: "rejected" }));
  };

  const approvedCount = Object.values(optStatuses).filter((s) => s === "approved").length;

  const handleRelaunch = async () => {
    if (approvedCount === 0) {
      alert("Please approve at least one optimization suggestion first.");
      return;
    }

    setShowRelaunching(true);

    // Only include explicitly approved suggestions
    const approvedSuggestions = suggestions.map((s) => ({
      ...s,
      status: optStatuses[s.id]
    })).filter(s => s.status === "approved");

    try {
      const res = await fetch("/api/agent/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          approvedSuggestions,
        }),
      });

      if (!res.ok) {
        throw new Error(`Optimization failed: ${res.status}`);
      }

      const result = await res.json() as ImprovementReport;
      setImprovementReport(result);
      setShowRelaunching(false);
    } catch (err) {
      console.error("Optimization failed:", err);
      setShowRelaunching(false);
      alert(err instanceof Error ? err.message : "Optimization failed");
    }
  };

  // Loading and not found states
  if (dataLoading || analysisStep === "loading") {
    return (
      <div className="min-h-screen pt-20 pb-16 px-4 flex flex-col items-center justify-center">
        <Navbar />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-lg w-full">
          <div className="mb-6">
            <h2 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              AI Agent Generating Analysis
            </h2>
            <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
              Retrieving performance data and routing through ReAct optimization planner...
            </p>
          </div>
          <AIProcessing
            steps={[
              { step: "Fetching campaign report from CampaignX API...", agent: "Performance-Monitor" },
              { step: "Parsing interaction records and identifying performance patterns", agent: "ReAct-Planner" },
              { step: "Generating optimization recommendations with reasoning...", agent: "ReAct-Planner" },
            ]}
            isComplete={false}
            title="Analysis Pipeline"
          />
        </motion.div>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen pt-20 pb-16 px-4 flex items-center justify-center">
        <Navbar />
        
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <div className="text-white mb-2" style={{ fontSize: "1.2rem", fontWeight: 600 }}>Campaign Not Found</div>
          <div className="text-gray-400 mb-4" style={{ fontSize: "0.875rem" }}>The requested campaign could not be found.</div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-xl text-violet-400 hover:bg-violet-600/20 transition-all"
            style={{ border: "1px solid rgba(139,92,246,0.3)" }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Safe report fallback when campaign hasn't been sent yet
  const safeReport: ComputedAnalysisReport = report ?? {
    campaignId: campaignId,
    totalSent: campaign.total_customers || 0,
    totalOpened: campaign.total_opened ?? 0,
    totalClicked: campaign.total_clicked ?? 0,
    openRate: campaign.open_rate ?? 0,
    clickRate: campaign.click_rate ?? 0,
    timeSeriesData: [],
    segmentPerformance: [],
    regionPerformance: [],
    genderPerformance: [],
    deviceBreakdown: [
      { device: "Mobile", percentage: 64 },
      { device: "Desktop", percentage: 28 },
      { device: "Tablet", percentage: 8 },
    ],
    hourlyBestPerformance: "N/A",
    topPerformingSegment: "All Customers",
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <Navbar />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
              style={{ fontSize: "0.875rem" }}
            >
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-white" style={{ fontSize: "0.875rem" }}>
              {campaign.name}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400" style={{ fontSize: "0.75rem" }}>
              Live Analysis
            </span>
          </div>
        </motion.div>

        {/* AI Processing section was originally here */}

        {analysisStep === "ready" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Total Sent", value: safeReport.totalSent.toLocaleString(), icon: Mail, color: "#7c3aed" },
                { label: "Total Opened", value: safeReport.totalOpened.toLocaleString(), icon: Eye, color: "#0891b2" },
                { label: "Open Rate", value: `${safeReport.openRate}%`, icon: TrendingUp, color: "#059669", sub: "Industry avg: 22%" },
                { label: "Click Rate", value: `${safeReport.clickRate}%`, icon: MousePointer, color: "#ec4899", sub: "Industry avg: 10%" },
                { label: "Opt Rounds", value: campaign.optimization_round ?? 1, icon: RefreshCw, color: "#f59e0b", sub: "Active Iterations" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="p-5 rounded-2xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}30` }}
                    >
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                    {stat.sub && (
                      <span className="text-gray-600" style={{ fontSize: "0.65rem" }}>
                        {stat.sub}
                      </span>
                    )}
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.3 + i * 0.1 }}
                    className="text-3xl font-bold text-white mb-1"
                    style={{
                      background: `linear-gradient(135deg, ${stat.color}, #ffffff)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-gray-400" style={{ fontSize: "0.78rem" }}>
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Charts grid */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Time series - spans 2 cols */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2 p-6 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                      Hourly Engagement
                    </h3>
                    <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                      Opens and clicks throughout the day
                    </p>
                  </div>
                  <div
                    className="px-2 py-1 rounded-lg text-emerald-400"
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      fontSize: "0.7rem",
                    }}
                  >
                    Peak: {safeReport.hourlyBestPerformance}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={safeReport.timeSeriesData}>
                    <defs>
                      <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#1a1a3e", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "12px", color: "#fff" }} />
                    <Area type="monotone" dataKey="opens" stroke="#7c3aed" fill="url(#openGrad)" strokeWidth={2.5} name="Opens" />
                    <Area type="monotone" dataKey="clicks" stroke="#ec4899" fill="url(#clickGrad)" strokeWidth={2.5} name="Clicks" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Device breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="p-6 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="text-white mb-5" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  Device Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={safeReport.deviceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      dataKey="percentage"
                      strokeWidth={0}
                    >
                      {safeReport.deviceBreakdown.map((_, index) => (
                        <Cell key={index} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a1a3e", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "12px", color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {safeReport.deviceBreakdown.map((item, i) => (
                    <div key={item.device} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: DEVICE_COLORS[i] }} />
                        <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                          {item.device}
                        </span>
                      </div>
                      <span className="text-white font-semibold" style={{ fontSize: "0.78rem" }}>
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Segment performance charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Age segment */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="text-white mb-1" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  Performance by Age Segment
                </h3>
                <p className="text-gray-500 mb-4" style={{ fontSize: "0.75rem" }}>
                  Open & click rates per age group
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={safeReport.segmentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="segment" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: "#1a1a3e", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "12px", color: "#fff" }} />
                    <Bar dataKey="openRate" name="Open Rate" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clickRate" name="Click Rate" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Region performance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="p-6 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="text-white mb-1" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  Regional Performance
                </h3>
                <p className="text-gray-500 mb-4" style={{ fontSize: "0.75rem" }}>
                  Engagement rates across Indian regions
                </p>
                <div className="space-y-3">
                  {safeReport.regionPerformance.map((r, i) => (
                    <motion.div
                      key={r.region}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-24 text-gray-400 flex-shrink-0" style={{ fontSize: "0.72rem" }}>
                        {r.region}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(r.openRate / 50) * 100}%` }}
                              transition={{ duration: 1, delay: 0.5 + i * 0.05 }}
                              className="h-full rounded-full bg-violet-500"
                            />
                          </div>
                          <span className="text-violet-400 w-10 text-right" style={{ fontSize: "0.7rem" }}>
                            {r.openRate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(r.clickRate / 30) * 100}%` }}
                              transition={{ duration: 1, delay: 0.5 + i * 0.05 }}
                              className="h-full rounded-full bg-pink-500"
                            />
                          </div>
                          <span className="text-pink-400 w-10 text-right" style={{ fontSize: "0.7rem" }}>
                            {r.clickRate}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  {[{ color: "#7c3aed", label: "Open Rate" }, { color: "#ec4899", label: "Click Rate" }].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                      <span className="text-gray-500" style={{ fontSize: "0.65rem" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Gender performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl mb-8"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h3 className="text-white mb-4" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                Performance by Gender
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {safeReport.genderPerformance.map((g) => (
                  <div key={g.gender} className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: g.gender.toLowerCase().includes("female")
                          ? "rgba(236,72,153,0.15)"
                          : "rgba(139,92,246,0.15)",
                        border: g.gender.toLowerCase().includes("female")
                          ? "1px solid rgba(236,72,153,0.3)"
                          : "1px solid rgba(139,92,246,0.3)",
                      }}
                    >
                      <Users
                        className="w-6 h-6"
                        style={{
                          color: g.gender.toLowerCase().includes("female") ? "#ec4899" : "#7c3aed",
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-white mb-1" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        {g.gender}
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-emerald-400 font-semibold" style={{ fontSize: "1rem" }}>
                            {g.openRate}%
                          </span>
                          <span className="text-gray-500 ml-1" style={{ fontSize: "0.72rem" }}>
                            open rate
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-400 font-semibold" style={{ fontSize: "1rem" }}>
                            {g.clickRate}%
                          </span>
                          <span className="text-gray-500 ml-1" style={{ fontSize: "0.72rem" }}>
                            click rate
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* KEY INSIGHT */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="p-5 rounded-2xl mb-8 flex items-start gap-4"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.07))",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.3)" }}
              >
                <Brain className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <div className="text-violet-300 mb-1" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  AI Key Insight
                </div>
                <div className="text-gray-300" style={{ fontSize: "0.82rem", lineHeight: "1.6" }}>
                  Top performing segment: <span className="text-violet-400 font-semibold">{safeReport.topPerformingSegment}</span>.{" "}
                  Campaign performs best during <span className="text-pink-400 font-semibold">{safeReport.hourlyBestPerformance}</span>.
                  South India + female + 26-45 age group shows strongest engagement. Recommend morning-slot targeted
                  re-campaign with personalized subject lines.
                </div>
              </div>
            </motion.div>

            {/* ── OPTIMIZATION HISTORY ── */}
            {optimizationHistory && optimizationHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.58 }}
                className="mb-10"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #ec4899)" }}
                  >
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-white" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    Previous Optimization Rounds
                  </h2>
                </div>
                
                <div className="space-y-4">
                  {optimizationHistory.map((hist: any, idx: number) => (
                    <motion.div
                      key={idx}
                      className="p-5 rounded-2xl"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-white font-semibold flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs">Round {hist.round || idx + 1}</span>
                          <span className="text-sm text-gray-400">{hist.date ? new Date(hist.date).toLocaleDateString() : 'Previous'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-gray-500 text-xs mr-2">Open Rate</span> 
                            <span className="text-emerald-400 font-bold">{hist.previous_open_rate ?? 'N/A'}%</span>
                          </div>
                          <div className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <span className="text-gray-500 text-xs mr-2">Click Rate</span> 
                            <span className="text-blue-400 font-bold">{hist.previous_click_rate ?? 'N/A'}%</span>
                          </div>
                        </div>
                      </div>
                      
                      {hist.applied_optimizations && hist.applied_optimizations.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-violet-400 mb-2 font-semibold uppercase tracking-wider">Applied Optimizations</div>
                          <div className="space-y-1.5">
                            {hist.applied_optimizations.map((opt: string, i: number) => (
                              <div key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-violet-500 mt-0.5">•</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── OPTIMIZATION SECTION ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-white" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                      AI Optimization Suggestions
                    </h2>
                  </div>
                  <p className="text-gray-400" style={{ fontSize: "0.82rem" }}>
                    ReAct agent recommendations with full reasoning. Approve to apply changes.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="px-3 py-1.5 rounded-xl"
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      fontSize: "0.75rem",
                      color: "#10b981",
                    }}
                  >
                    {approvedCount} approved
                  </div>
                  {suggestions.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRelaunch}
                      disabled={showRelaunching}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                        fontSize: "0.8rem",
                        opacity: showRelaunching ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${showRelaunching ? 'animate-spin' : ''}`} />
                      {showRelaunching ? "Implementing..." : "Implement Strategies"}
                    </motion.button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {suggestions.map((opt: OptimizationSuggestionRow, i: number) => {
                  const status = optStatuses[opt.id] || "pending";
                  const categoryIcon = opt.category || "clock";
                  const Icon = OPT_ICONS[categoryIcon] || Target;
                  const priority = PRIORITY_CONFIG[opt.priority];
                  const isExpanded = expandedOpt === opt.id;

                  return (
                    <motion.div
                      key={opt.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65 + i * 0.08 }}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background:
                          status === "approved"
                            ? "rgba(16,185,129,0.05)"
                            : status === "rejected"
                            ? "rgba(107,114,128,0.05)"
                            : "rgba(255,255,255,0.02)",
                        border:
                          status === "approved"
                            ? "1px solid rgba(16,185,129,0.3)"
                            : status === "rejected"
                            ? "1px solid rgba(107,114,128,0.2)"
                            : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div
                        className="p-5 cursor-pointer"
                        onClick={() => setExpandedOpt(isExpanded ? null : opt.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background:
                                status === "approved"
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(139,92,246,0.15)",
                              border:
                                status === "approved"
                                  ? "1px solid rgba(16,185,129,0.3)"
                                  : "1px solid rgba(139,92,246,0.3)",
                            }}
                          >
                            {status === "approved" ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                            ) : status === "rejected" ? (
                              <XCircle className="w-5 h-5 text-gray-500" />
                            ) : (
                              <Icon className="w-5 h-5 text-violet-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1 flex-wrap">
                              <span
                                className="text-white"
                                style={{ fontSize: "0.9rem", fontWeight: 600 }}
                              >
                                {opt.title}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full"
                                style={{
                                  ...priority,
                                  border: `1px solid ${priority.border}`,
                                  fontSize: "0.65rem",
                                }}
                              >
                                {opt.priority} priority
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full text-emerald-400"
                                style={{
                                  background: "rgba(16,185,129,0.1)",
                                  border: "1px solid rgba(16,185,129,0.2)",
                                  fontSize: "0.65rem",
                                }}
                              >
                                {opt.expected_impact}
                              </span>
                            </div>
                            <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>
                              <span className="text-gray-500">Current:</span> {opt.current_value || "N/A"} →{" "}
                              <span className="text-violet-400">{opt.suggested_value || "N/A"}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {status === "pending" && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={(e) => { e.stopPropagation(); handleApproveOpt(opt.id); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-400"
                                  style={{
                                    background: "rgba(16,185,129,0.1)",
                                    border: "1px solid rgba(16,185,129,0.2)",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Approve
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={(e) => { e.stopPropagation(); handleRejectOpt(opt.id); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400"
                                  style={{
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </motion.button>
                              </>
                            )}
                            {status === "approved" && (
                              <span className="text-emerald-400 flex items-center gap-1" style={{ fontSize: "0.75rem" }}>
                                <CheckCircle className="w-3.5 h-3.5" /> Approved
                              </span>
                            )}
                            {status === "rejected" && (
                              <span className="text-gray-500 flex items-center gap-1" style={{ fontSize: "0.75rem" }}>
                                <XCircle className="w-3.5 h-3.5" /> Rejected
                              </span>
                            )}
                            <ChevronRight
                              className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expanded reasoning */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="px-5 pb-5"
                              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                            >
                              <div className="grid md:grid-cols-2 gap-4 mt-4">
                                {/* Agent reasoning */}
                                <div
                                  className="p-4 rounded-xl"
                                  style={{
                                    background: "rgba(139,92,246,0.05)",
                                    border: "1px solid rgba(139,92,246,0.15)",
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-violet-400" style={{ fontSize: "0.72rem" }}>
                                      Agent Reasoning
                                    </span>
                                  </div>
                                  <p className="text-gray-300" style={{ fontSize: "0.78rem", lineHeight: "1.7" }}>
                                    {opt.reasoning}
                                  </p>
                                </div>

                                {/* Agent thought process */}
                                <div
                                  className="p-4 rounded-xl"
                                  style={{
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                                    <span className="text-cyan-400" style={{ fontSize: "0.72rem" }}>
                                      Agent Thoughts
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 font-mono">
                                    {(opt.agent_thoughts || []).map((thought: string, ti: number) => (
                                      <motion.div
                                        key={ti}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ti * 0.05 }}
                                        className="flex items-start gap-2"
                                      >
                                        <span className="text-gray-600 flex-shrink-0" style={{ fontSize: "0.65rem" }}>
                                          {ti + 1}.
                                        </span>
                                        <span className="text-gray-400" style={{ fontSize: "0.72rem", lineHeight: "1.5" }}>
                                          {thought}
                                        </span>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Relaunch CTA */}
              {approvedCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-5 rounded-2xl flex items-center justify-between gap-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.08))",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(139,92,246,0.3)" }}
                    >
                      <Zap className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                        {approvedCount} optimization{approvedCount > 1 ? "s" : ""} approved
                      </div>
                      <div className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                        Apply changes and relaunch optimized campaign
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRelaunch}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Relaunch Optimized Campaign
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Relaunch overlay */}
      <AnimatePresence>
        {showRelaunching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
              >
                <RefreshCw className="w-10 h-10 text-white" />
              </motion.div>
              <div className="text-white mb-2" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                Applying Optimizations...
              </div>
              <div className="text-gray-400">
                Modifying campaign approach based on approved suggestions
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
