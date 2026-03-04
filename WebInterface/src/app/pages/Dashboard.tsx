"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import {
  BarChart3, Users, Mail, TrendingUp, Zap, Plus,
  ArrowUpRight, Clock, CheckCircle, AlertCircle,
  Eye, MousePointer, Activity, ChevronRight, Target,
  Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { Navbar } from "../components/Navbar";
import { MOCK_CAMPAIGNS, DASHBOARD_STATS, MOCK_CUSTOMER_COHORT } from "../../lib/mock-data";

const AREA_DATA = [
  { date: "Feb 24", openRate: 28.4, clickRate: 14.2 },
  { date: "Feb 25", openRate: 31.8, clickRate: 16.8 },
  { date: "Feb 26", openRate: 34.2, clickRate: 18.7 },
  { date: "Feb 27", openRate: 41.8, clickRate: 24.3 },
  { date: "Feb 28", openRate: 38.6, clickRate: 21.4 },
  { date: "Mar 01", openRate: 36.2, clickRate: 19.8 },
  { date: "Mar 02", openRate: 39.1, clickRate: 22.6 },
];

const SEGMENT_DATA = [
  { segment: "18-25", open: 28, click: 15 },
  { segment: "26-35", open: 38, click: 22 },
  { segment: "36-45", open: 36, click: 20 },
  { segment: "46-55", open: 32, click: 16 },
  { segment: "56-65", open: 36, click: 20 },
  { segment: "65+", open: 29, click: 14 },
];

const PIE_DATA = [
  { name: "Active", value: 75.2, color: "#7c3aed" },
  { name: "Inactive", value: 24.8, color: "#374151" },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  completed: { bg: "rgba(16,185,129,0.1)", text: "#10b981", dot: "#10b981", label: "Completed" },
  active: { bg: "rgba(139,92,246,0.1)", text: "#7c3aed", dot: "#7c3aed", label: "Active" },
  draft: { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", dot: "#9ca3af", label: "Draft" },
  pending_approval: { bg: "rgba(234,179,8,0.1)", text: "#eab308", dot: "#eab308", label: "Pending Approval" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="relative p-5 rounded-2xl overflow-hidden group"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${color}20, transparent 70%)`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {sub && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10b981",
                fontSize: "0.7rem",
              }}
            >
              <ArrowUpRight className="w-3 h-3" />
              {sub}
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-gray-400" style={{ fontSize: "0.82rem" }}>{label}</div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <Navbar />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-white mb-1" style={{ fontSize: "1.8rem", fontWeight: 700 }}>
              Campaign Dashboard
            </h1>
            <p className="text-gray-400 flex items-center gap-2" style={{ fontSize: "0.875rem" }}>
              <Activity className="w-4 h-4 text-violet-400" />
              SuperBFSI · XDeposit Campaign Suite · AI Agent Active
            </p>
          </div>
          <Link href="/dashboard/new-campaign">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                fontSize: "0.875rem",
              }}
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </motion.button>
          </Link>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard icon={Mail} label="Total Campaigns" value={DASHBOARD_STATS.totalCampaigns} color="#7c3aed" delay={0.05} />
          <StatCard icon={Users} label="Customers Reached" value={DASHBOARD_STATS.totalCustomersReached.toLocaleString()} sub="+1.2K" color="#0891b2" delay={0.1} />
          <StatCard icon={Eye} label="Avg Open Rate" value={`${DASHBOARD_STATS.avgOpenRate}%`} sub="+4.2%" color="#059669" delay={0.15} />
          <StatCard icon={MousePointer} label="Avg Click Rate" value={`${DASHBOARD_STATS.avgClickRate}%`} sub="+2.8%" color="#d97706" delay={0.2} />
          <StatCard icon={Target} label="Active Optimizations" value={DASHBOARD_STATS.activeOptimizations} color="#ec4899" delay={0.25} />
          <StatCard icon={AlertCircle} label="Pending Approvals" value={DASHBOARD_STATS.pendingApprovals} color="#eab308" delay={0.3} />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Charts - left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    Campaign Performance Trend
                  </h3>
                  <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                    Open & Click rates over last 7 days
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {[
                    { color: "#7c3aed", label: "Open Rate" },
                    { color: "#ec4899", label: "Click Rate" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: l.color }}
                      />
                      <span className="text-gray-400" style={{ fontSize: "0.72rem" }}>
                        {l.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={AREA_DATA}>
                  <defs>
                    <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClick" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a3e",
                      border: "1px solid rgba(139,92,246,0.3)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Area type="monotone" dataKey="openRate" stroke="#7c3aed" fill="url(#colorOpen)" strokeWidth={2} name="Open Rate" />
                  <Area type="monotone" dataKey="clickRate" stroke="#ec4899" fill="url(#colorClick)" strokeWidth={2} name="Click Rate" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Bar chart - age segments */}
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
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    Performance by Age Segment
                  </h3>
                  <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                    Open and click rates across demographics
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={SEGMENT_DATA} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="segment" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a3e",
                      border: "1px solid rgba(139,92,246,0.3)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="open" name="Open Rate" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="click" name="Click Rate" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Cohort overview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="p-5 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  Customer Cohort
                </h3>
                <span className="text-gray-400" style={{ fontSize: "0.72rem" }}>
                  {MOCK_CUSTOMER_COHORT.total_count.toLocaleString()} total
                </span>
              </div>

              {/* Pie chart */}
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={25} outerRadius={38} dataKey="value" strokeWidth={0}>
                      {PIE_DATA.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {PIE_DATA.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-400" style={{ fontSize: "0.72rem" }}>
                          {d.name}
                        </span>
                      </div>
                      <span className="text-white font-semibold" style={{ fontSize: "0.78rem" }}>
                        {d.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Region breakdown */}
              <div className="mt-4 space-y-2">
                {MOCK_CUSTOMER_COHORT.segments.region.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-gray-400" style={{ fontSize: "0.7rem" }}>
                          {r.label}
                        </span>
                        <span className="text-gray-300" style={{ fontSize: "0.7rem" }}>
                          {r.percentage}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${r.percentage}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #7c3aed, #ec4899)" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent campaigns */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
              className="p-5 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  Recent Campaigns
                </h3>
                <Link
                  href="/dashboard"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                  style={{ fontSize: "0.72rem" }}
                >
                  View all
                </Link>
              </div>

              <div className="space-y-3">
                {MOCK_CAMPAIGNS.map((campaign) => {
                  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                  return (
                    <motion.div
                      key={campaign.id}
                      whileHover={{ x: 3 }}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: status.dot }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-white truncate mb-0.5"
                          style={{ fontSize: "0.78rem" }}
                        >
                          {campaign.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded-full"
                            style={{
                              background: status.bg,
                              color: status.text,
                              border: `1px solid ${status.dot}30`,
                              fontSize: "0.62rem",
                            }}
                          >
                            {status.label}
                          </span>
                          {campaign.openRate > 0 && (
                            <span className="text-gray-500" style={{ fontSize: "0.65rem" }}>
                              {campaign.openRate}% open
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/campaign/${campaign.id}/analysis`}>
                        <ChevronRight className="w-4 h-4 text-gray-600 hover:text-violet-400 transition-colors" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-5 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h3 className="text-white mb-4" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                Quick Actions
              </h3>
              <div className="space-y-2">
                {[
                  { label: "New Campaign", icon: Plus, color: "#7c3aed", href: "/dashboard/new-campaign" },
                  { label: "View Analysis", icon: BarChart3, color: "#0891b2", href: "/campaign/camp-001/analysis" },
                  { label: "Optimization", icon: Sparkles, color: "#ec4899", href: "/campaign/camp-001/analysis" },
                  { label: "How to Use", icon: Zap, color: "#059669", href: "/how-to-use" },
                ].map((action) => (
                  <Link key={action.label} href={action.href}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${action.color}20` }}
                      >
                        <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} />
                      </div>
                      <span className="text-gray-300" style={{ fontSize: "0.8rem" }}>
                        {action.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 ml-auto" />
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Campaigns Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 className="text-white" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              All Campaigns
            </h3>
            <div className="flex gap-2">
              {["overview", "performance", "segments"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-3 py-1 rounded-lg capitalize transition-all"
                  style={{
                    background: activeTab === tab ? "rgba(139,92,246,0.2)" : "transparent",
                    color: activeTab === tab ? "#a78bfa" : "#6b7280",
                    border: activeTab === tab ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                    fontSize: "0.75rem",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {["Campaign", "Status", "Segment", "Customers", "Open Rate", "Click Rate", "Round", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-gray-500"
                      style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_CAMPAIGNS.map((campaign, i) => {
                  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                  return (
                    <motion.tr
                      key={campaign.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                      className="hover:bg-white/3 transition-colors"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white" style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                          {campaign.name}
                        </div>
                        <div className="text-gray-500 mt-0.5 flex items-center gap-1" style={{ fontSize: "0.68rem" }}>
                          <Clock className="w-3 h-3" />
                          {new Date(campaign.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full flex items-center gap-1.5 w-fit"
                          style={{
                            background: status.bg,
                            color: status.text,
                            fontSize: "0.7rem",
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300" style={{ fontSize: "0.78rem" }}>
                          {campaign.targetSegment}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300 font-mono" style={{ fontSize: "0.78rem" }}>
                          {campaign.totalCustomers.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {campaign.openRate > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-semibold" style={{ fontSize: "0.82rem" }}>
                              {campaign.openRate}%
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-emerald-400"
                                style={{ width: `${(campaign.openRate / 50) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600" style={{ fontSize: "0.75rem" }}>
                            Pending...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {campaign.clickRate > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-semibold" style={{ fontSize: "0.82rem" }}>
                              {campaign.clickRate}%
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-blue-400"
                                style={{ width: `${(campaign.clickRate / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600" style={{ fontSize: "0.75rem" }}>
                            Pending...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-violet-400"
                          style={{
                            background: "rgba(139,92,246,0.1)",
                            fontSize: "0.7rem",
                          }}
                        >
                          Round {campaign.optimizationRound}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/campaign/${campaign.id}/analysis`}>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              className="px-3 py-1 rounded-lg text-violet-400 hover:text-white hover:bg-violet-600/20 transition-all"
                              style={{ fontSize: "0.72rem" }}
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                            </motion.button>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
