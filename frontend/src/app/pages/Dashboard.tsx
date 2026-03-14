"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { CampaignRunRow } from "../../lib/types";
import { Plus, Users, Mail, Activity, ArrowRight, Eye, MousePointer } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Loader } from "../components/Loader";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  complete: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981", label: "Complete" },
  running: { bg: "rgba(99,102,241,0.1)", text: "#818cf8", dot: "#818cf8", label: "Running" },
  paused: { bg: "rgba(234,179,8,0.1)", text: "#fbbf24", dot: "#fbbf24", label: "Paused" },
  error: { bg: "rgba(239,68,68,0.1)", text: "#f87171", dot: "#f87171", label: "Error" },
  idle: { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", dot: "#9ca3af", label: "Idle" },
};

function CampaignCard({ campaign, index }: { campaign: CampaignRunRow; index: number }) {
  const phaseKey = (campaign.phase || "complete").toLowerCase();
  const status = STATUS_CONFIG[phaseKey] || STATUS_CONFIG.complete;

  return (
    <Link href={`/campaign/${campaign.id}/analysis`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08 }}
        whileHover={{ y: -8, scale: 1.02 }}
        className="relative p-6 rounded-2xl overflow-hidden group cursor-pointer h-full flex flex-col justify-between"
        style={{
          background: "linear-gradient(145deg, rgba(30,30,35,0.8) 0%, rgba(20,20,25,0.9) 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <span
              className="px-3 py-1 rounded-full flex items-center gap-2"
              style={{ background: status.bg, color: status.text, fontSize: "0.75rem", fontWeight: 600 }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: status.dot }} />
              {status.label}
            </span>
            <span className="text-gray-500 text-xs font-mono">
              {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white mb-2 leading-tight group-hover:text-indigo-400 transition-colors">
            {campaign.campaign_name}
          </h3>
          <p className="text-gray-400 text-sm line-clamp-2 mb-6 flex-1">
            {campaign.prompt || "No prompt provided."}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-auto border-t border-white/5 pt-4">
            <div>
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                <Users size={14} /> Audience
              </div>
              <div className="text-white font-medium text-lg">
                {(campaign.total_sent || 0).toLocaleString()} <span className="text-gray-500 text-xs">users</span>
              </div>
            </div>

            <div className="flex gap-4">
              <div>
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                  <Eye size={14} /> Open
                </div>
                <div className="text-emerald-400 font-medium text-lg">
                  {(campaign.open_rate ?? 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                  <MousePointer size={14} /> Click
                </div>
                <div className="text-indigo-400 font-medium text-lg">
                  {(campaign.click_rate ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaign-runs");
        if (res.ok) {
          const data = (await res.json()) as CampaignRunRow[];
          setCampaigns(data);
        }
      } catch (err) {
        console.warn("Failed to load campaign runs", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchCampaigns();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filteredCampaigns = campaigns.filter((campaign) => {
    const search = searchQuery.toLowerCase();
    return (
      campaign.campaign_name?.toLowerCase().includes(search) ||
      campaign.prompt?.toLowerCase().includes(search)
    );
  });

  const displayedCampaigns = filteredCampaigns.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCampaigns.length;

  useEffect(() => {
    setVisibleCount(6);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Navbar />
        <Loader text="Loading Campaigns..." subtext="Fetching saved campaign analysis runs" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-20 px-4">
      <Navbar />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight mb-2"
            >
              Campaigns
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-gray-400 text-lg"
            >
              All cards below are loaded from the saved campaign analysis runs table.
            </motion.p>
          </div>

          <Link href="/dashboard/new-campaign">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all"
            >
              <Plus className="w-5 h-5" />
              New Campaign
            </motion.button>
          </Link>
        </div>

        <div
          className="mb-8 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search campaigns by name or prompt..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none"
            style={{ fontSize: "0.95rem" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-500 hover:text-white transition-colors text-sm font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-32 rounded-3xl border border-white/5 bg-white/[0.02]">
            <Mail className="w-16 h-16 text-gray-700 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-2">No saved analysis runs yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Create a campaign, then click End Campaign and View Analysis to save it here.
            </p>
            <Link href="/dashboard/new-campaign">
              <button className="text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-2 mx-auto">
                Get Started <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-white/5 bg-white/[0.02] text-gray-400">
            No campaigns match "{searchQuery}"
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedCampaigns.map((campaign, index) => (
                <CampaignCard key={campaign.id} campaign={campaign} index={index} />
              ))}
            </div>

            {filteredCampaigns.length > 6 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                {hasMore && (
                  <button
                    onClick={() => setVisibleCount((count) => count + 6)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-indigo-400 font-medium transition-all hover:bg-indigo-500/10"
                    style={{
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}
                  >
                    <Activity className="w-4 h-4" />
                    View More ({filteredCampaigns.length - visibleCount} remaining)
                  </button>
                )}
                {visibleCount > 6 && (
                  <button
                    onClick={() => setVisibleCount(6)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-gray-400 font-medium transition-all hover:bg-white/5"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    View Less
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #ec4899)",
            boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
          }}
          aria-label="Return to top"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
