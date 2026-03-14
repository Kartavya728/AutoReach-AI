"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  RefreshCw,
  Search,
  ArrowUp,
  Users,
  TrendingUp,
  Mail,
  DollarSign,
  UserCheck,
  Activity,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Navbar } from "@/src/app/components/Navbar";
import type { CustomerCRMRecord } from "@/src/lib/types";



const PAGE_SIZE = 5;

export default function CustomersCRMPage() {
  const [customers, setCustomers] = useState<CustomerCRMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [metricsFilter, setMetricsFilter] = useState("all");

  
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (e) {
      console.error("Failed to load customers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncCustomersFromApi = useCallback(async (showAlertOnError: boolean) => {
    const res = await fetch("/api/customers/sync", { method: "POST", cache: "no-store" });
    if (!res.ok && showAlertOnError) {
      throw new Error("Failed to sync customers from API.");
    }
    return res.ok;
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncCustomersFromApi(true);
      await fetchCustomers();
    } catch (e) {
      console.error(e);
      alert("Error syncing customers.");
    } finally {
      setSyncing(false);
    }
  }, [fetchCustomers, syncCustomersFromApi]);

  useEffect(() => {
    let cancelled = false;

    const loadCustomers = async () => {
      setSyncing(true);
      try {
        await syncCustomersFromApi(false);
      } catch (e) {
        console.warn("Initial customer sync fell back to cached CRM data.", e);
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }

      if (!cancelled) {
        await fetchCustomers();
      }
    };

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [fetchCustomers, syncCustomersFromApi]);

  
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  
  const filteredCustomers = useMemo(() => {
    let result = customers;

    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.full_name ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.customer_id ?? "").toLowerCase().includes(q) ||
          (c.city ?? "").toLowerCase().includes(q)
      );
    }

    
    if (metricsFilter !== "all") {
      result = result.filter((c) => {
        if (metricsFilter === "sent") return (c.emails_sent ?? 0) > 0;
        if (metricsFilter === "opened") return (c.emails_opened ?? 0) > 0;
        if (metricsFilter === "clicked") return (c.emails_clicked ?? 0) > 0;
        return true;
      });
    }

    return result;
  }, [customers, searchQuery, metricsFilter]);

  const displayedCustomers = filteredCustomers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredCustomers.length;

  
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, metricsFilter]);

  
  const stats = useMemo(() => {
    if (customers.length === 0) return null;
    const total = customers.length;
    const maleCount = customers.filter((c) => (c.gender ?? "").toLowerCase().startsWith("m")).length;
    const femaleCount = customers.filter((c) => (c.gender ?? "").toLowerCase().startsWith("f")).length;
    const avgAge = Math.round(customers.reduce((s, c) => s + (c.age ?? 0), 0) / total);
    const avgIncome = Math.round(customers.reduce((s, c) => s + (c.monthly_income ?? 0), 0) / total);
    const totalSent = customers.reduce((s, c) => s + (c.emails_sent ?? 0), 0);
    const totalOpened = customers.reduce((s, c) => s + (c.emails_opened ?? 0), 0);
    const totalClicked = customers.reduce((s, c) => s + (c.emails_clicked ?? 0), 0);
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";
    return {
      total,
      maleCount,
      femaleCount,
      avgAge,
      avgIncome,
      totalSent,
      openRate,
      clickRate,
    };
  }, [customers]);

  return (
    <div className="min-h-screen pt-20 pb-20 px-4">
      <Navbar />

      <div className="max-w-7xl mx-auto mt-6">
        {
}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight mb-1">
              Customer CRM
            </h1>
            <p className="text-gray-400 text-sm">
              Manage and view audience metrics &amp; AI targeting weights.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl px-5 py-3 font-semibold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing API..." : "Sync from CampaignX API"}
          </button>
        </div>

        {
}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Total Customers",
                value: stats.total.toLocaleString(),
                icon: Users,
                color: "#7c3aed",
              },
              {
                label: "Avg Age",
                value: `${stats.avgAge} yrs`,
                sub: `${stats.maleCount}M · ${stats.femaleCount}F`,
                icon: UserCheck,
                color: "#06b6d4",
              },
              {
                label: "Avg Monthly Income",
                value: `₹${stats.avgIncome.toLocaleString()}`,
                icon: DollarSign,
                color: "#f59e0b",
              },
              {
                label: "Total Emails Sent",
                value: stats.totalSent.toLocaleString(),
                sub: `${stats.openRate}% open · ${stats.clickRate}% click`,
                icon: Mail,
                color: "#ec4899",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-5 rounded-2xl transition-transform hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${stat.color}20`,
                      border: `1px solid ${stat.color}30`,
                    }}
                  >
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <span className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                    {stat.label}
                  </span>
                </div>
                <div
                  className="text-2xl font-bold mb-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${stat.color}, #fff)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {stat.value}
                </div>
                {stat.sub && (
                  <div className="text-gray-500" style={{ fontSize: "0.72rem" }}>
                    {stat.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {
}
        <div
          className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email, ID, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none"
            style={{ fontSize: "0.875rem" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-500 hover:text-white transition-colors text-xs"
            >
              Clear
            </button>
          )}

          {
}
          <div className="h-6 w-px bg-gray-700/50 mx-2" />
          <div className="relative flex items-center group">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 group-hover:text-indigo-400 transition-colors pointer-events-none" />
            <select
              title="Metrics Filter"
              value={metricsFilter}
              onChange={(e) => setMetricsFilter(e.target.value)}
              className="pl-9 pr-8 py-1.5 rounded-lg text-sm transition-all appearance-none cursor-pointer outline-none focus:border-indigo-500 hover:border-indigo-400/50"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
            >
              <option value="all" className="bg-[#1f1f23]">All Metrics</option>
              <option value="sent" className="bg-[#1f1f23]">Sent ({">"} 0)</option>
              <option value="opened" className="bg-[#1f1f23]">Opened ({">"} 0)</option>
              <option value="clicked" className="bg-[#1f1f23]">Clicked ({">"} 0)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none group-hover:text-white transition-colors" />
          </div>

          <span className="text-gray-600 flex-shrink-0 ml-auto" style={{ fontSize: "0.72rem" }}>
            {filteredCustomers.length} result{filteredCustomers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {
}
        <div
          className="overflow-hidden rounded-2xl shadow-xl"
          style={{
            background: "rgba(31,31,35,0.8)",
            border: "1px solid rgba(42,42,48,1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid rgba(42,42,48,1)" }}
          >
            <span className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full hidden sm:block" />
            <h2 className="text-lg font-bold text-white">
              Audience Database ({filteredCustomers.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                Loading customers...
              </div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No customers found. Click <strong>Sync from Autoreach AI</strong> to pull the cohort.
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No customers match &quot;{searchQuery}&quot;
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-[#25252A] border-b border-[#2A2A30]">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Customer</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Demographics</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Metrics (Sent/Open/Click)</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">AI Weights (W1/W2/W3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A30]">
                  {displayedCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#2A2A30]/50 transition-colors">
                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="font-medium text-white">{c.full_name || "Unknown"}</div>
                        <div className="text-gray-400 text-xs mt-1">{c.email}</div>
                        <div className="text-indigo-400 text-[10px] uppercase tracking-wider mt-1">
                          {c.customer_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 min-w-[250px] text-gray-300">
                        <div>
                          <span className="text-gray-500 mr-2">Age:</span>
                          {c.age ?? "-"} |{" "}
                          <span className="text-gray-500 mx-2">Gender:</span>
                          {c.gender ?? "-"}
                        </div>
                        <div className="mt-1">
                          <span className="text-gray-500 mr-2">Location:</span>
                          {c.city ?? "-"}
                        </div>
                        <div className="mt-1">
                          <span className="text-gray-500 mr-2">Income:</span>₹
                          {c.monthly_income?.toLocaleString() ?? "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <span className="bg-gray-800 text-gray-300 py-1 px-3 rounded-md border border-gray-700">
                            S: {c.emails_sent}
                          </span>
                          <span className="bg-indigo-900/40 text-indigo-300 py-1 px-3 rounded-md border border-indigo-500/30">
                            O: {c.emails_opened}
                          </span>
                          <span className="bg-purple-900/40 text-purple-300 py-1 px-3 rounded-md border border-purple-500/30">
                            C: {c.emails_clicked}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center">
                            <span className="w-6 text-gray-500 text-xs">W1:</span>
                            <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">
                              {c.w1.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-6 text-gray-500 text-xs">W2:</span>
                            <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">
                              {c.w2.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-6 text-gray-500 text-xs">W3:</span>
                            <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">
                              {c.w3.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {
}
          {filteredCustomers.length > PAGE_SIZE && (
            <div
              className="flex items-center justify-center gap-4 px-6 py-4"
              style={{ borderTop: "1px solid rgba(42,42,48,1)" }}
            >
              {hasMore && (
                <button
                  onClick={() => setVisibleCount(filteredCustomers.length)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-indigo-400 font-medium transition-all hover:bg-indigo-500/10"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    fontSize: "0.85rem",
                  }}
                >
                  <Activity className="w-4 h-4" />
                  View More ({filteredCustomers.length - visibleCount} remaining)
                </button>
              )}
              {visibleCount > PAGE_SIZE && (
                <button
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-gray-400 font-medium transition-all hover:bg-white/5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "0.85rem",
                  }}
                >
                  <TrendingUp className="w-4 h-4" />
                  View Less
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {
}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #ec4899)",
            boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
          }}
          aria-label="Return to top"
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}
