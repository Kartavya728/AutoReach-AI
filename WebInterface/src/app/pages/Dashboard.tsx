"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import type { CampaignRow } from "../../lib/types";
import { Plus, Users, Mail, Activity, ArrowRight, Eye, MousePointer } from "lucide-react";
import { Navbar } from "../components/Navbar";

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  completed: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981", label: "Completed" },
  active: { bg: "rgba(139,92,246,0.1)", text: "#7c3aed", dot: "#7c3aed", label: "Active" },
  draft: { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", dot: "#9ca3af", label: "Draft" },
  pending_approval: { bg: "rgba(234,179,8,0.1)", text: "#eab308", dot: "#eab308", label: "Pending Approval" },
};

function CampaignCard({ campaign, index }: { campaign: CampaignRow; index: number }) {
  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  
  return (
    <Link href={`/campaign/${campaign.id}/analysis`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ y: -8, scale: 1.02 }}
        className="relative p-6 rounded-2xl overflow-hidden group cursor-pointer h-full flex flex-col justify-between"
        style={{
          background: "linear-gradient(145deg, rgba(30,30,35,0.8) 0%, rgba(20,20,25,0.9) 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
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
            {campaign.name}
          </h3>
          <p className="text-gray-400 text-sm line-clamp-2 mb-6 flex-1">
            {campaign.brief || "No brief provided."}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-auto border-t border-white/5 pt-4">
            <div>
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                <Users size={14} /> Audience
              </div>
              <div className="text-white font-medium text-lg">
                {(campaign.total_customers || 0).toLocaleString()} <span className="text-gray-500 text-xs">users</span>
              </div>
            </div>
            
            {campaign.status !== 'draft' ? (
              <div className="flex gap-4">
                <div>
                  <div className="flex items-center gap-1 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                    <Eye size={14} /> Open
                  </div>
                  <div className="text-emerald-400 font-medium text-lg">
                    {campaign.open_rate ?? 0}%
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                    <MousePointer size={14} /> Click
                  </div>
                  <div className="text-indigo-400 font-medium text-lg">
                    {campaign.click_rate ?? 0}%
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1 uppercase tracking-wider">
                  <Activity size={14} /> Optimization
                </div>
                <div className="text-gray-400 text-sm font-medium">Pending Launch</div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data);
        }
      } catch (err) {
        console.warn("Failed to load campaigns", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E11] pt-20 flex items-center justify-center">
        <Navbar />
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E11] pt-20 pb-20 px-4">
      <Navbar />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 mt-8">
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
              Manage, analyze, and optimize your BFSI marketing deployments.
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

        {campaigns.length === 0 ? (
          <div className="text-center py-32 rounded-3xl border border-white/5 bg-white/[0.02]">
            <Mail className="w-16 h-16 text-gray-700 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-2">No campaigns yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">Create your first AI-driven financial campaign to start reaching your audience.</p>
            <Link href="/dashboard/new-campaign">
              <button className="text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-2 mx-auto">
                Get Started <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
