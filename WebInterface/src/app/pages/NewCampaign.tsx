"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import {
  Send, Sliders, RefreshCw, CheckCircle, Clock, Users,
  ArrowRight, ChevronLeft, Sparkles, Zap, Target,
  Calendar, Mail, MessageSquare, Info,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { AIProcessing } from "../components/AIProcessing";
import { ContentVariants, type EmailVariantCard } from "../components/ContentVariants";
import { CustomizeParams } from "../components/CustomizeParams";

import { getCustomerCohort, sendCampaign } from "../../lib/campaignx-api";
import { generateCampaignContent } from "../../lib/gemini";
import { runCampaignAgent } from "../../lib/langgraph";

const EXAMPLE_BRIEFS = [
  "Run email campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 percentage point higher returns than its competitors. Announce an additional 0.25 percentage point higher returns for female senior citizens. Optimise for open rate and click rate. Don't skip emails to customers marked 'inactive'. Include the call to action: https://superbfsi.com/xdeposit/explore/",
  "Launch a targeted re-engagement campaign for inactive customers promoting XDeposit. Emphasize urgency and exclusive offer. Target 18-45 age group. Focus on digital-first messaging.",
  "Create a professional email campaign for senior citizens (55+) promoting XDeposit's safety and higher returns. Use formal tone, no emojis. Highlight RBI regulation and guaranteed returns.",
];

const STEPS = [
  { id: 1, label: "Campaign Brief" },
  { id: 2, label: "AI Planning" },
  { id: 3, label: "Review Content" },
  { id: 4, label: "Configure & Approve" },
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toCampaignXDateTime(sendDate: string, sendTime: string) {
  // CampaignX API format: DD:MM:YY HH:MM:SS
  const [year, month, day] = sendDate.split("-");
  const now = new Date();

  // Build the intended datetime
  const intended = new Date(`${sendDate}T${sendTime}:00`);

  // If intended time is in the past, use now + 5 minutes
  if (intended <= now) {
    const future = new Date(now.getTime() + 5 * 60 * 1000);
    const dd = String(future.getDate()).padStart(2, "0");
    const mm = String(future.getMonth() + 1).padStart(2, "0");
    const yy = String(future.getFullYear()).slice(-2);
    const hh = String(future.getHours()).padStart(2, "0");
    const mi = String(future.getMinutes()).padStart(2, "0");
    const ss = String(future.getSeconds()).padStart(2, "0");
    return `${dd}:${mm}:${yy} ${hh}:${mi}:${ss}`;
  }

  return `${day}:${month}:${year.slice(-2)} ${sendTime}:00`;
}

function mapGeneratedVariantToCard(
  subject: string,
  body: string,
  tone: string,
  variant: string,
  index: number
): EmailVariantCard {
  const variantId = `var-${String.fromCharCode(97 + index)}`;
  const toneLower = tone.toLowerCase();
  const badgeColor =
    toneLower.includes("urgent") ? "orange" : toneLower.includes("friendly") ? "purple" : "blue";

  return {
    id: variantId,
    label: `Variant ${variant || String.fromCharCode(65 + index)}`,
    badge: tone || "AI Generated",
    badgeColor,
    subject,
    body,
    tags: ["ai-generated", tone.toLowerCase()],
  };
}

export default function NewCampaign() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [brief, setBrief] = useState("");
  const [agentSteps, setAgentSteps] = useState<{ step: string; agent: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [emailVariants, setEmailVariants] = useState<EmailVariantCard[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [customParams, setCustomParams] = useState({
    useEmojis: true,
    temperature: 0.7,
    tone: "friendly",
    includeURL: true,
    personalizeNames: false,
    includeStats: false,
    urgency: false,
    customAddOn: "",
  });
  const [sendTime, setSendTime] = useState("10:00");
  const [sendDate, setSendDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLaunching, setIsLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [customerCohortSize, setCustomerCohortSize] = useState(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);
  const [targetCustomerIds, setTargetCustomerIds] = useState<string[]>([]);
  const [cohortData, setCohortData] = useState<{ active: number; inactive: number; total: number } | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);

  // Fetch available models
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models) {
          setAvailableModels(data.models);
          const defaultModel = data.models.find((m: { isDefault: boolean }) => m.isDefault);
          if (defaultModel) setSelectedModel(defaultModel.id);
        }
      })
      .catch(() => {});
  }, []);

  const handleGeneratePlan = async () => {
    if (!brief.trim()) return;
    setIsProcessing(true);
    setAgentSteps([]);
    setStep(2);

    try {
      const agentResult = await runCampaignAgent(brief, (step, agent) => {
        setAgentSteps((prev) => [...prev, { step, agent }]);
      });

      // Save the campaign ID returned by the agent
      if (agentResult.savedCampaignId) {
        setSavedCampaignId(agentResult.savedCampaignId);
      }

      if (Array.isArray(agentResult.contentVariants) && agentResult.contentVariants.length > 0) {
        const mappedVariants = agentResult.contentVariants.map((item, index) => {
          const safe = item as {
            subject?: string;
            body?: string;
            tone?: string;
            variant?: string;
          };
          return mapGeneratedVariantToCard(
            safe.subject ?? `Variant ${index + 1}`,
            safe.body ?? "",
            safe.tone ?? "Professional",
            safe.variant ?? String.fromCharCode(65 + index),
            index
          );
        });
        setEmailVariants(mappedVariants);
        setSelectedVariant(mappedVariants[0]?.id ?? null);
      }

      // Update customer count from agent result
      if (agentResult.targetCustomerIds) {
        setTargetCustomerIds(agentResult.targetCustomerIds);
        setCustomerCohortSize(agentResult.targetCustomerIds.length);
      } else if (agentResult.customerCount) {
        setCustomerCohortSize(agentResult.customerCount);
      }

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingDone(true);
        setTimeout(() => setStep(3), 800);
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run campaign planning.";
      setAgentSteps((prev) => [
        ...prev,
        { step: `Error: ${message}`, agent: "Orchestrator" },
      ]);
      setIsProcessing(false);
      setProcessingDone(false);
    }
  };

  const handleRegenerate = async (params: typeof customParams) => {
    setCustomParams(params);
    setIsProcessing(true);
    setProcessingDone(false);
    setAgentSteps([]);
    setStep(2);

    const regenSteps = [
      { step: `Applying new parameters: tone=${params.tone}, temp=${params.temperature}`, agent: "Orchestrator" },
      { step: `Emoji usage: ${params.useEmojis ? "enabled" : "disabled"}`, agent: "Content-Generator" },
      { step: "Regenerating Variant A with updated settings...", agent: "Content-Generator" },
      { step: "Regenerating Variant B with updated settings...", agent: "Content-Generator" },
      { step: "Regenerating Variant C with updated settings...", agent: "Content-Generator" },
      { step: "Quality check and ranking variants...", agent: "Strategy-Agent" },
      { step: "New content variants ready!", agent: "Orchestrator" },
    ];

    for (const stepData of regenSteps) {
      await wait(450);
      setAgentSteps((prev) => [...prev, stepData]);
    }

    try {
      const generated = await generateCampaignContent({
        brief,
        tone: params.tone,
        temperature: params.temperature,
        useEmojis: params.useEmojis,
        additionalParams: params.customAddOn,
      });
      if (generated.length > 0) {
        const mappedVariants = generated.map((variant, index) =>
          mapGeneratedVariantToCard(
            variant.subject,
            variant.body,
            variant.tone,
            variant.variant,
            index
          )
        );
        setEmailVariants(mappedVariants);
        setSelectedVariant(mappedVariants[0]?.id ?? null);
      }
    } catch {
      setAgentSteps((prev) => [
        ...prev,
        { step: "Regeneration failed. Using last successful variants.", agent: "Orchestrator" },
      ]);
    }

    setIsProcessing(false);
    setProcessingDone(true);
    setTimeout(() => setStep(3), 800);
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    setStep(4);
    setLaunchError(null);

    try {
      const cohort = await getCustomerCohort();
      
      // Use the AI targeted subset if available, otherwise fallback to the active cohort
      let finalCustomerIds = targetCustomerIds;
      if (!finalCustomerIds || finalCustomerIds.length === 0) {
        finalCustomerIds = cohort.data.map((customer) => customer.customer_id);
      }
      
      setCustomerCohortSize(finalCustomerIds.length);
      setCohortData({
        total: cohort.total_count,
        active: cohort.data.filter((c) => c.status !== "inactive").length,
        inactive: cohort.data.filter((c) => c.status === "inactive").length,
      });

      const selected = emailVariants.find((variant) => variant.id === selectedVariant);
      if (!selected) {
        throw new Error("No email variant selected.");
      }

      const sendResult = await sendCampaign({
        subject: selected.subject,
        body: selected.body,
        list_customer_ids: finalCustomerIds,
        send_time: toCampaignXDateTime(sendDate, sendTime),
      });

      // Update campaign in Supabase with external campaign ID
      if (savedCampaignId) {
        try {
          await fetch(`/api/campaigns/${savedCampaignId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              external_campaign_id: sendResult.campaign_id,
              status: "active",
              send_time: new Date(`${sendDate}T${sendTime}`).toISOString(),
              total_customers: finalCustomerIds.length,
              target_customer_ids: finalCustomerIds,
              subject: selected.subject,
              body: selected.body,
            }),
          });
        } catch (err) {
          console.warn("Failed to update campaign in Supabase:", err);
        }
      }

      setIsLaunching(false);
      setLaunched(true);

      // Navigate to analysis using saved campaign ID or external ID
      const analysisId = savedCampaignId || sendResult.campaign_id;
      setTimeout(() => {
        router.push(`/campaign/${analysisId}/analysis`);
      }, 1500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Campaign launch failed unexpectedly.";
      setLaunchError(message);
      setIsLaunching(false);
    }
  };

  const selectedVariantData = emailVariants.find((v) => v.id === selectedVariant);

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <Navbar />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
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
            New Campaign
          </span>
        </motion.div>

        {/* Step indicators */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-0 mb-10 overflow-x-auto pb-2"
        >
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background:
                    step === s.id
                      ? "rgba(139,92,246,0.2)"
                      : step > s.id
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    step === s.id
                      ? "1px solid rgba(139,92,246,0.4)"
                      : step > s.id
                      ? "1px solid rgba(16,185,129,0.3)"
                      : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      step === s.id
                        ? "rgba(139,92,246,0.6)"
                        : step > s.id
                        ? "rgba(16,185,129,0.6)"
                        : "rgba(255,255,255,0.1)",
                    fontSize: "0.65rem",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {step > s.id ? <CheckCircle className="w-3 h-3" /> : s.id}
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: step === s.id ? "#a78bfa" : step > s.id ? "#6ee7b7" : "#6b7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 h-px mx-1"
                  style={{
                    background:
                      step > s.id
                        ? "rgba(16,185,129,0.5)"
                        : "rgba(255,255,255,0.1)",
                  }}
                />
              )}
            </div>
          ))}
        </motion.div>

        {/* Step 1: Campaign Brief */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <h2 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  Describe Your Campaign
                </h2>
                <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                  Write a natural language brief — the AI agents will plan everything automatically
                </p>
              </div>

              {/* Brief input */}
              <div
                className="relative rounded-2xl overflow-hidden mb-6"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="px-4 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                    Campaign Brief (natural language)
                  </span>
                  <div
                    className="ml-auto flex items-center gap-3"
                  >
                    {/* Model selector */}
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="px-2 py-1 rounded-lg text-gray-300 outline-none cursor-pointer"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        fontSize: "0.7rem",
                        appearance: "auto",
                      }}
                    >
                      {availableModels.length > 0
                        ? availableModels.map((m) => (
                            <option key={m.id} value={m.id} style={{ background: "#1a1a2e", color: "#e5e7eb" }}>
                              {m.name}
                            </option>
                          ))
                        : (
                            <option value="gemini-2.5-flash" style={{ background: "#1a1a2e", color: "#e5e7eb" }}>
                              Gemini 2.5 Flash
                            </option>
                          )}
                    </select>
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      <span className="text-violet-400" style={{ fontSize: "0.65rem" }}>
                        AI will analyze
                      </span>
                    </div>
                  </div>
                </div>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Describe your campaign goal, product details, target audience, tone, and any specific requirements..."
                  rows={7}
                  className="w-full p-5 bg-transparent text-white placeholder-gray-600 resize-none outline-none"
                  style={{ fontSize: "0.9rem", lineHeight: "1.7" }}
                />
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-gray-600" style={{ fontSize: "0.72rem" }}>
                    {brief.length} characters
                  </span>
                  <span className="text-gray-600" style={{ fontSize: "0.72rem" }}>
                    Max 2000 chars recommended
                  </span>
                </div>
              </div>

              {/* Example briefs */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                    Try an example brief:
                  </span>
                </div>
                <div className="space-y-2">
                  {EXAMPLE_BRIEFS.map((example, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01, x: 3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setBrief(example)}
                      className="w-full text-left p-3 rounded-xl text-gray-400 hover:text-gray-300 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: "0.78rem",
                        lineHeight: "1.5",
                      }}
                    >
                      <span className="text-violet-400 mr-2">Example {i + 1}:</span>
                      {example.substring(0, 120)}...
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGeneratePlan}
                  disabled={!brief.trim()}
                  className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-semibold transition-all"
                  style={{
                    background: brief.trim()
                      ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                      : "rgba(255,255,255,0.05)",
                    fontSize: "1rem",
                    cursor: brief.trim() ? "pointer" : "not-allowed",
                    opacity: brief.trim() ? 1 : 0.5,
                  }}
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Campaign Plan with AI
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: AI Processing */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <h2 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  AI Agents at Work
                </h2>
                <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                  LangGraph ReAct + RAG pipeline analyzing your brief and generating strategy
                </p>
              </div>

              <AIProcessing
                steps={agentSteps}
                isComplete={processingDone}
                title="CampaignX Multi-Agent Pipeline"
              />

              {/* Brief preview */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                    Processing Brief
                  </span>
                </div>
                <p className="text-gray-400" style={{ fontSize: "0.8rem", lineHeight: "1.6" }}>
                  {brief.substring(0, 200)}
                  {brief.length > 200 && "..."}
                </p>
              </motion.div>

              {processingDone && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl flex items-center gap-3"
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-emerald-400" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      Campaign plan generated successfully!
                    </div>
                    <div className="text-emerald-600" style={{ fontSize: "0.75rem" }}>
                      3 content variants ready · Loading review screen...
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Review Content */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    Review Generated Content
                  </h2>
                  <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                    AI generated 3 variants. Select one and customize if needed.
                  </p>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCustomize(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-violet-400"
                    style={{
                      background: "rgba(139,92,246,0.1)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      fontSize: "0.8rem",
                    }}
                  >
                    <Sliders className="w-4 h-4" />
                    Customize Params
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRegenerate(customParams)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-300"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "0.8rem",
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </motion.button>
                </div>
              </div>

              {/* Active params display */}
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { label: `Tone: ${customParams.tone}`, active: true },
                  { label: `Temp: ${customParams.temperature}`, active: true },
                  { label: "Emojis", active: customParams.useEmojis },
                  { label: "CTA URL", active: customParams.includeURL },
                  { label: "Personalized", active: customParams.personalizeNames },
                  { label: "Urgency", active: customParams.urgency },
                ].map(
                  (tag) =>
                    tag.active && (
                      <span
                        key={tag.label}
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(139,92,246,0.1)",
                          border: "1px solid rgba(139,92,246,0.2)",
                          color: "#a78bfa",
                          fontSize: "0.7rem",
                        }}
                      >
                        {tag.label}
                      </span>
                    )
                )}
              </div>

              <ContentVariants
                selectedVariant={selectedVariant}
                onSelectVariant={setSelectedVariant}
                variants={emailVariants}
              />

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex gap-4"
              >
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl text-gray-400 hover:text-white transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "0.875rem",
                  }}
                >
                  ← Back to Brief
                </button>
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep(4)}
                  disabled={!selectedVariant}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold"
                  style={{
                    background: selectedVariant
                      ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                      : "rgba(255,255,255,0.05)",
                    fontSize: "0.9rem",
                    cursor: selectedVariant ? "pointer" : "not-allowed",
                    opacity: selectedVariant ? 1 : 0.5,
                  }}
                >
                  Proceed to Configuration
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {/* Step 4: Configure & Launch */}
          {step === 4 && !launched && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <h2 className="text-white mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  Review & Launch Campaign
                </h2>
                <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                  Human-in-Loop Approval — review everything before launch
                </p>
              </div>

              {isLaunching ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                    }}
                  >
                    <Send className="w-10 h-10 text-white" />
                  </motion.div>
                  <div className="text-white mb-2" style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                    Launching Campaign...
                  </div>
                  <div className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                    Calling CampaignX API · Scheduling emails · Setting up monitoring...
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    {["Validating customer IDs", "Submitting to API", "Setting up tracking"].map(
                      (s, i) => (
                        <motion.div
                          key={s}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.8 }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                          style={{
                            background: "rgba(139,92,246,0.1)",
                            border: "1px solid rgba(139,92,246,0.2)",
                            fontSize: "0.7rem",
                            color: "#a78bfa",
                          }}
                        >
                          <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }}
                            className="w-1.5 h-1.5 rounded-full bg-violet-400"
                          />
                          {s}
                        </motion.div>
                      )
                    )}
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Selected variant summary */}
                    <div
                      className="p-5 rounded-2xl"
                      style={{
                        background: "rgba(139,92,246,0.05)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-4 h-4 text-violet-400" />
                        <span className="text-white" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                          Selected Email Variant
                        </span>
                        <span
                          className="ml-auto px-2 py-0.5 rounded-full text-violet-400"
                          style={{
                            background: "rgba(139,92,246,0.15)",
                            fontSize: "0.7rem",
                          }}
                        >
                          {selectedVariantData?.label}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <span className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                            Subject
                          </span>
                          <p className="text-white mt-0.5" style={{ fontSize: "0.82rem" }}>
                            {selectedVariantData?.subject}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                            Preview
                          </span>
                          <p
                            className="text-gray-400 mt-0.5 line-clamp-3"
                            style={{ fontSize: "0.78rem", lineHeight: "1.5" }}
                          >
                            {selectedVariantData?.body.substring(0, 150)}...
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Campaign settings */}
                    <div
                      className="p-5 rounded-2xl"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-cyan-400" />
                        <span className="text-white" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                          Campaign Settings
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                            Send Date
                          </label>
                          <input
                            type="date"
                            value={sendDate}
                            onChange={(e) => setSendDate(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg text-white outline-none"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              fontSize: "0.8rem",
                              colorScheme: "dark",
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                            Send Time (IST)
                          </label>
                          <input
                            type="time"
                            value={sendTime}
                            onChange={(e) => setSendTime(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg text-white outline-none"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              fontSize: "0.8rem",
                              colorScheme: "dark",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Target audience */}
                  <div
                    className="p-5 rounded-2xl mb-6"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-white" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        Target Audience
                      </span>
                      <span
                        className="ml-auto text-emerald-400 font-semibold"
                        style={{ fontSize: "0.875rem" }}
                      >
                        {customerCohortSize.toLocaleString()} customers
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Active", value: cohortData ? cohortData.active.toLocaleString() : "—", color: "#7c3aed" },
                        { label: "Inactive", value: cohortData ? cohortData.inactive.toLocaleString() : "—", color: "#6b7280" },
                        { label: "Total", value: customerCohortSize.toLocaleString(), color: "#ec4899" },
                        { label: "Segments", value: "All", color: "#0891b2" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="p-3 rounded-xl text-center"
                          style={{
                            background: `${item.color}10`,
                            border: `1px solid ${item.color}20`,
                          }}
                        >
                          <div
                            className="font-bold mb-0.5"
                            style={{ color: item.color, fontSize: "1.1rem" }}
                          >
                            {item.value}
                          </div>
                          <div className="text-gray-400" style={{ fontSize: "0.7rem" }}>
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approval warning */}
                  <div
                    className="p-4 rounded-xl mb-6 flex items-start gap-3"
                    style={{
                      background: "rgba(234,179,8,0.08)",
                      border: "1px solid rgba(234,179,8,0.25)",
                    }}
                  >
                    <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-yellow-400" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        Human-in-Loop Approval Required
                      </div>
                      <div className="text-yellow-600 mt-1" style={{ fontSize: "0.78rem" }}>
                        By approving, you confirm that the campaign content, target segment, and send time
                        have been reviewed. The AI agent will then execute the campaign via CampaignX API and
                        begin performance monitoring automatically.
                      </div>
                    </div>
                  </div>

                  {launchError && (
                    <div
                      className="mb-4 p-3 rounded-xl"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.28)",
                      }}
                    >
                      <p className="text-red-300" style={{ fontSize: "0.8rem" }}>
                        {launchError}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-3 rounded-xl text-gray-400 hover:text-white"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: "0.875rem",
                      }}
                    >
                      ← Back
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(139,92,246,0.5)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleLaunch}
                      className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-semibold"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                        fontSize: "1rem",
                      }}
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve & Launch Campaign
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Launched success */}
          {launched && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.1))",
                  border: "2px solid rgba(16,185,129,0.5)",
                }}
              >
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </motion.div>
              <h2 className="text-white mb-3" style={{ fontSize: "1.8rem", fontWeight: 700 }}>
                Campaign Launched! 🚀
              </h2>
              <p className="text-gray-400 mb-2">
                Campaign submitted to CampaignX API successfully
              </p>
              <p className="text-gray-500" style={{ fontSize: "0.8rem" }}>
                Redirecting to analysis dashboard...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CustomizeParams
        isOpen={showCustomize}
        onClose={() => setShowCustomize(false)}
        onRegenerate={handleRegenerate}
        initialParams={customParams}
      />
    </div>
  );
}
