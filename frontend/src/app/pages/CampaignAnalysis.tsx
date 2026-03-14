"use client";

import { type ElementType, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileText,
  Hammer,
  Mail,
  MousePointer,
  TrendingUp,
  Users,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Loader } from "../components/Loader";
import type { CampaignRunRow } from "../../lib/types";

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatCount(value: number) {
  return (Number(value || 0) || 0).toLocaleString();
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: ElementType; tone: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(8,18,33,0.92)", border: "1px solid rgba(148,163,184,0.2)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-400" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${tone}22`, border: `1px solid ${tone}55` }}
        >
          <Icon className="w-4 h-4" style={{ color: tone }} />
        </div>
      </div>
      <div className="text-white mt-2" style={{ fontSize: "1.35rem", fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

export default function CampaignAnalysis() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [campaignRun, setCampaignRun] = useState<CampaignRunRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Missing campaign run id.");
      setLoading(false);
      return;
    }

    async function loadRun() {
      try {
        const res = await fetch(`/api/campaign-runs/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Campaign analysis record not found.");
          }
          throw new Error("Failed to load campaign analysis record.");
        }
        const data = (await res.json()) as CampaignRunRow;
        setCampaignRun(data);
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : "Unable to load campaign analysis.");
      } finally {
        setLoading(false);
      }
    }

    void loadRun();
  }, [id]);

  const improvements = useMemo(() => campaignRun?.improvements || [], [campaignRun]);
  const roundHistory = useMemo(() => campaignRun?.round_history || [], [campaignRun]);
  const agentCategories = useMemo(() => campaignRun?.agent_categories || [], [campaignRun]);
  const finalMails = useMemo(() => campaignRun?.final_mails || [], [campaignRun]);
  const toolsUsed = useMemo(() => campaignRun?.tools_used || [], [campaignRun]);
  const logs = useMemo(() => campaignRun?.terminal_logs || [], [campaignRun]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-16 px-4 flex items-center justify-center">
        <Navbar />
        <Loader text="Loading Analysis..." subtext="Fetching campaign run data" />
      </div>
    );
  }

  if (error || !campaignRun) {
    return (
      <div className="min-h-screen pt-20 pb-16 px-4 flex items-center justify-center">
        <Navbar />
        <div className="max-w-lg text-center rounded-2xl p-6" style={{ background: "rgba(8,18,33,0.92)", border: "1px solid rgba(248,113,113,0.3)" }}>
          <div className="text-rose-300" style={{ fontSize: "1rem", fontWeight: 700 }}>Analysis unavailable</div>
          <p className="text-slate-300 mt-2" style={{ fontSize: "0.86rem" }}>{error || "No data found."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #334155 0%, #1e293b 100%)", fontSize: "0.82rem", fontWeight: 700 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4" style={{ background: "linear-gradient(180deg, #070f19 0%, #0b1624 100%)" }}>
      <Navbar />

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
            style={{ fontSize: "0.84rem" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <div className="text-slate-400" style={{ fontSize: "0.75rem" }}>
            Saved {new Date(campaignRun.created_at).toLocaleString()}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-3xl p-6" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <h1 className="text-white" style={{ fontSize: "1.8rem", fontWeight: 800 }}>{campaignRun.campaign_name}</h1>
            <p className="text-slate-300 mt-2" style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>{campaignRun.prompt}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
              <StatCard label="Optimization Rounds" value={formatCount(campaignRun.total_rounds)} icon={BarChart3} tone="#f59e0b" />
              <StatCard label="Audience Reached" value={formatCount(campaignRun.total_sent)} icon={Users} tone="#38bdf8" />
              <StatCard label="Open Rate" value={formatPercent(campaignRun.open_rate)} icon={TrendingUp} tone="#22c55e" />
              <StatCard label="Click Rate" value={formatPercent(campaignRun.click_rate)} icon={MousePointer} tone="#3b82f6" />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
          <section className="xl:col-span-2 rounded-2xl p-5" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 700 }}>Round-wise Improvements</h2>
            </div>
            {improvements.length === 0 ? (
              <p className="text-slate-400" style={{ fontSize: "0.82rem" }}>No round improvements were stored for this campaign.</p>
            ) : (
              <div className="grid gap-2">
                {improvements.map((item) => (
                  <div key={`improvement-${item.round}`} className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.16)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-slate-100" style={{ fontSize: "0.82rem", fontWeight: 700 }}>Round {item.round}</div>
                      <div className="text-slate-300" style={{ fontSize: "0.76rem" }}>
                        Open {formatPercent(item.open_rate)} ({item.open_rate_delta >= 0 ? "+" : ""}{item.open_rate_delta.toFixed(1)}%)
                      </div>
                      <div className="text-slate-300" style={{ fontSize: "0.76rem" }}>
                        Click {formatPercent(item.click_rate)} ({item.click_rate_delta >= 0 ? "+" : ""}{item.click_rate_delta.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <details className="mt-4 rounded-xl p-3" style={{ background: "rgba(2,6,23,0.72)", border: "1px solid rgba(148,163,184,0.14)" }}>
              <summary className="cursor-pointer text-slate-200 inline-flex items-center gap-2" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                <ChevronDown className="w-4 h-4" />
                Round History Payload
              </summary>
              <pre className="mt-3 text-slate-300 overflow-x-auto" style={{ fontSize: "0.72rem", lineHeight: 1.6 }}>
{JSON.stringify(roundHistory, null, 2)}
              </pre>
            </details>
          </section>

          <section className="rounded-2xl p-5" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
              <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 700 }}>Agent Categories</h2>
            </div>
            {agentCategories.length === 0 ? (
              <p className="text-slate-400" style={{ fontSize: "0.82rem" }}>No agent category data is available.</p>
            ) : (
              <div className="grid gap-2">
                {agentCategories.map((agent) => (
                  <div key={agent.agent} className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.16)" }}>
                    <div className="text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 700 }}>{agent.agent}</div>
                    <div className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                      Messages: {formatCount(agent.message_count)} • Thoughts: {formatCount(agent.thought_count)} • Actions: {formatCount(agent.action_count)} • Observations: {formatCount(agent.observation_count)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl p-5 mt-4" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-cyan-400" />
            <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 700 }}>Final Mails By Category</h2>
          </div>
          {finalMails.length === 0 ? (
            <p className="text-slate-400" style={{ fontSize: "0.82rem" }}>No final mails were stored for this run.</p>
          ) : (
            <div className="grid gap-2">
              {finalMails.map((mail, index) => (
                <details key={`${mail.segment_id}-${index}`} className="rounded-xl p-3" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.16)" }}>
                  <summary className="cursor-pointer text-slate-100" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                    {mail.segment_name || `Category ${index + 1}`}
                  </summary>
                  <div className="mt-3 text-slate-300" style={{ fontSize: "0.76rem", lineHeight: 1.55 }}>
                    <div className="text-slate-500" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Subject</div>
                    <div className="text-slate-100 mt-1" style={{ fontWeight: 600 }}>{mail.subject}</div>
                    <div className="text-slate-500 mt-3" style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Body</div>
                    <div className="mt-1 whitespace-pre-wrap">{mail.body}</div>
                    {mail.cta_link && <div className="mt-2 text-sky-300">CTA: {mail.cta_link}</div>}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <section className="rounded-2xl p-5" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Hammer className="w-5 h-5 text-amber-400" />
              <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 700 }}>Tools Used By AI</h2>
            </div>
            {toolsUsed.length === 0 ? (
              <p className="text-slate-400" style={{ fontSize: "0.82rem" }}>No tool usage was inferred from logs/actions.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {toolsUsed.map((tool) => (
                  <span
                    key={tool}
                    className="px-3 py-1.5 rounded-full text-slate-100"
                    style={{ fontSize: "0.72rem", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.3)" }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl p-5" style={{ background: "rgba(8,18,33,0.94)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 700 }}>All Logs (Dropdown)</h2>
            </div>
            <details className="rounded-xl p-3" style={{ background: "rgba(2,6,23,0.72)", border: "1px solid rgba(148,163,184,0.14)" }}>
              <summary className="cursor-pointer text-slate-200" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                View Logs ({formatCount(logs.length)})
              </summary>
              {logs.length === 0 ? (
                <p className="text-slate-400 mt-2" style={{ fontSize: "0.76rem" }}>No terminal logs captured.</p>
              ) : (
                <div className="mt-3 max-h-[360px] overflow-y-auto pr-2 space-y-2">
                  {logs.map((line, index) => (
                    <details key={`log-${index}`} className="rounded-lg p-2" style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.14)" }}>
                      <summary className="cursor-pointer text-slate-300" style={{ fontSize: "0.72rem" }}>
                        Log {index + 1}
                      </summary>
                      <pre className="text-slate-200 mt-2 whitespace-pre-wrap" style={{ fontSize: "0.7rem", lineHeight: 1.55 }}>
{line}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </details>
          </section>
        </div>

        <div className="text-center mt-5">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: "0.74rem", color: "#d1fae5" }}>
            <CheckCircle2 className="w-4 h-4" />
            Analysis is fully data-driven from saved Supabase campaign run.
          </span>
        </div>
      </div>
    </div>
  );
}
