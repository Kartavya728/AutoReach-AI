"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { CustomerCRMRecord } from "@/src/lib/types";

export default function CustomersCRMPage() {
  const [customers, setCustomers] = useState<CustomerCRMRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (e) {
      console.error("Failed to load customers", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/customers/sync", { method: "POST" });
      if (res.ok) {
        await fetchCustomers();
      } else {
        alert("Failed to sync customers from API.");
      }
    } catch (e) {
      console.error(e);
      alert("Error syncing customers.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Customer CRM</h1>
          <p className="text-gray-400 mt-1">Manage and view audience metrics & AI targeting weights.</p>
        </div>
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 h-11 transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? "Syncing API..." : "Sync from CampaignX"}
        </button>
      </div>

      <div className="bg-[#1F1F23]/80 border border-[#2A2A30] backdrop-blur-md overflow-hidden rounded-2xl shadow-xl">
        <div className="border-b border-[#2A2A30] p-6 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full mr-3 hidden sm:block"></span>
            Audience Database ({customers.length})
          </h2>
        </div>
        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No customers found. Click <strong>Sync from CampaignX</strong> to pull the cohort.
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
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#2A2A30]/50 transition-colors">
                    <td className="px-6 py-4 min-w-[200px]">
                      <div className="font-medium text-white">{c.full_name || "Unknown"}</div>
                      <div className="text-gray-400 text-xs mt-1">{c.email}</div>
                      <div className="text-indigo-400 text-[10px] uppercase tracking-wider mt-1">{c.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 min-w-[250px] text-gray-300">
                      <div><span className="text-gray-500 mr-2">Age:</span>{c.age ?? '-'} | <span className="text-gray-500 mx-2">Gender:</span>{c.gender ?? '-'}</div>
                      <div className="mt-1"><span className="text-gray-500 mr-2">Location:</span>{c.city ?? '-'}</div>
                      <div className="mt-1"><span className="text-gray-500 mr-2">Income:</span>₹{c.monthly_income?.toLocaleString() ?? '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <span className="bg-gray-800 text-gray-300 py-1 px-3 rounded-md border border-gray-700">S: {c.emails_sent}</span>
                        <span className="bg-indigo-900/40 text-indigo-300 py-1 px-3 rounded-md border border-indigo-500/30">O: {c.emails_opened}</span>
                        <span className="bg-purple-900/40 text-purple-300 py-1 px-3 rounded-md border border-purple-500/30">C: {c.emails_clicked}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center"><span className="w-6 text-gray-500 text-xs">W1:</span><span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">{c.w1.toFixed(2)}</span></div>
                        <div className="flex items-center"><span className="w-6 text-gray-500 text-xs">W2:</span><span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">{c.w2.toFixed(2)}</span></div>
                        <div className="flex items-center"><span className="w-6 text-gray-500 text-xs">W3:</span><span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs">{c.w3.toFixed(2)}</span></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
