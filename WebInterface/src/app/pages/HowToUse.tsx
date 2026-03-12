"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Key, Database, Brain, Zap, CheckCircle, Code,
  Terminal, BookOpen, ArrowRight, ChevronRight,
  ExternalLink, Mail, BarChart3, Target, Shield,
  FileText, Globe, Cpu, Network, GitBranch,
} from "lucide-react";
import { Navbar } from "../components/Navbar";

const SETUP_STEPS = [
  {
    step: 1,
    title: "Get API Keys",
    icon: Key,
    color: "#7c3aed",
    description: "Set up all required credentials",
    items: [
      {
        name: "Gemini API Key",
        desc: "Get from Google AI Studio",
        link: "https://aistudio.google.com/app/apikey",
        envVar: "GEMINI_API_KEY",
        free: true,
      },
      {
        name: "Autoreach API Key",
        desc: "Register your team at Autoreach AI",
        link: "https://campaignx.inxiteout.ai",
        envVar: "CAMPAIGNX_API_KEY",
        free: true,
      },
      {
        name: "Supabase Keys",
        desc: "Create project for database + RAG",
        link: "https://supabase.com/dashboard",
        envVar: "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
        free: true,
      },

    ],
  },
  {
    step: 2,
    title: "Configure Environment",
    icon: Terminal,
    color: "#0891b2",
    description: "Set up your .env.local file",
    code: `# Create .env.local in project root
GEMINI_API_KEY=your_gemini_key_here
CAMPAIGNX_API_KEY=your_campaignx_key
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`,
  },
  {
    step: 3,
    title: "Set Up Supabase",
    icon: Database,
    color: "#059669",
    description: "Run SQL schema and enable pgvector",
    items: [
      { name: "Open Supabase SQL Editor", desc: "Dashboard → SQL Editor → New Query" },
      { name: "Run schema file", desc: "Copy contents of /src/lib/supabase-schema.sql and execute" },
      { name: "Enable pgvector", desc: "Run: CREATE EXTENSION IF NOT EXISTS vector;" },
      { name: "Verify tables", desc: "Check campaigns, customer_cohort, campaign_embeddings tables exist" },
    ],
  },
  {
    step: 4,
    title: "Register with Autoreach AI",
    icon: Mail,
    color: "#d97706",
    description: "Get your API key for email campaign execution",
    code: `# Register your team (one-time)
curl -X POST https://campaignx.inxiteout.ai/api/v1/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "team_name": "YourTeamName",
    "team_email": "team@example.com"
  }'
  
# Response: API key will be emailed to you
# Add to .env.local: CAMPAIGNX_API_KEY=<your_key>`,
  },
  {
    step: 5,
    title: "Enable API Calls",
    icon: Code,
    color: "#ec4899",
    description: "Verify Next.js API routes are active",
    items: [
      { name: "/app/api/campaignx/*", desc: "Server routes proxy all Autoreach API calls using CAMPAIGNX_API_KEY" },
      { name: "/app/api/gemini/*", desc: "Gemini generation/analyze routes use GEMINI_API_KEY" },
      { name: "/app/api/agent/run", desc: "LangGraph + LangChain.js orchestration endpoint" },

      { name: "/src/lib/supabase.ts", desc: "Supabase client reads NEXT_PUBLIC_* keys" },
    ],
  },
  {
    step: 6,
    title: "Install Dependencies",
    icon: Zap,
    color: "#84cc16",
    description: "Install required packages",
    code: `npm install @google/generative-ai
npm install @langchain/langgraph
npm install @langchain/google-genai
npm install @langchain/core
npm install @supabase/supabase-js
npm install @langchain/community`,
  },
];

const ARCHITECTURE = [
  {
    layer: "Frontend (Next.js)",
    items: ["Landing Page", "Dashboard", "New Campaign Wizard", "Analysis + Charts", "Optimization Panel"],
    color: "#7c3aed",
  },
  {
    layer: "AI Agent Layer (LangGraph)",
    items: ["Orchestrator Agent", "ReAct Planner", "RAG Retriever", "Content Generator", "Strategy Agent"],
    color: "#0891b2",
  },
  {
    layer: "LLM Layer (Gemini 2.0)",
    items: ["Campaign Brief Parsing", "Strategy Generation", "Email Content (3 variants)", "Performance Analysis", "Optimization Reasoning"],
    color: "#059669",
  },
  {
    layer: "Backend APIs",
    items: ["Autoreach API (send/report)", "Supabase DB + Auth", "pgvector (RAG search)"],
    color: "#d97706",
  },
];

const SQL_SNIPPET = `-- Key tables in Supabase schema:

-- Stores all campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  brief TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  subject VARCHAR(200),
  body TEXT,
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  ...
);

-- For RAG semantic search
CREATE TABLE campaign_embeddings (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(768),  -- pgvector
  metadata JSONB,
  ...
);

-- Match documents function for RAG
CREATE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 5
) RETURNS TABLE (...) ...`;

export default function HowToUse() {
  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <Navbar />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            <BookOpen className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400" style={{ fontSize: "0.8rem" }}>
              Complete Setup Guide
            </span>
          </div>
          <h1 className="text-white mb-4" style={{ fontSize: "3rem", fontWeight: 800 }}>
            How to Use{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Autoreach AI
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto" style={{ fontSize: "1rem", lineHeight: "1.7" }}>
            Complete guide to set up the AI multi-agent marketing platform with
            Gemini, LangGraph, and Supabase.
          </p>
        </motion.div>



        {/* Setup Steps */}
        <div className="space-y-8 mb-16">
          {SETUP_STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="px-6 py-4 flex items-center gap-4"
                style={{
                  background: `${step.color}08`,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}20`, border: `1px solid ${step.color}30` }}
                >
                  <step.icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full font-mono"
                      style={{
                        background: `${step.color}15`,
                        color: step.color,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                      }}
                    >
                      STEP {step.step}
                    </span>
                    <h3 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-gray-400" style={{ fontSize: "0.78rem" }}>
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="p-6">
                {step.code && (
                  <pre
                    className="rounded-xl p-4 overflow-x-auto text-gray-300"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      fontSize: "0.78rem",
                      lineHeight: "1.6",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {step.code}
                  </pre>
                )}

                {step.items && (
                  <div className="space-y-2">
                    {step.items.map((item, j) => (
                      <motion.div
                        key={j}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: j * 0.04 }}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <CheckCircle
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: step.color }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                              {item.name}
                            </span>
                            {"free" in item && item.free && (
                              <span
                                className="px-1.5 py-0.5 rounded text-emerald-400"
                                style={{
                                  background: "rgba(16,185,129,0.1)",
                                  fontSize: "0.6rem",
                                }}
                              >
                                FREE TIER
                              </span>
                            )}
                            {"envVar" in item && item.envVar && (
                              <code
                                className="px-2 py-0.5 rounded text-cyan-400"
                                style={{
                                  background: "rgba(8,145,178,0.1)",
                                  fontSize: "0.68rem",
                                  fontFamily: "monospace",
                                }}
                              >
                                {item.envVar}
                              </code>
                            )}
                          </div>
                          <div className="text-gray-400 mt-0.5" style={{ fontSize: "0.75rem" }}>
                            {item.desc}
                          </div>
                          {"link" in item && item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 mt-1 hover:text-violet-300 transition-colors"
                              style={{ color: step.color, fontSize: "0.72rem" }}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {item.link}
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Architecture Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.2)" }}
            >
              <Network className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-white" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              Architecture Overview
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {ARCHITECTURE.map((layer, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-5 rounded-2xl"
                style={{
                  background: `${layer.color}05`,
                  border: `1px solid ${layer.color}20`,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: layer.color }}
                  />
                  <span style={{ color: layer.color, fontSize: "0.78rem", fontWeight: 600 }}>
                    {layer.layer}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-gray-400" style={{ fontSize: "0.78rem" }}>
                      <ChevronRight className="w-3 h-3" style={{ color: layer.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* SQL Schema Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(5,150,105,0.2)" }}
            >
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                Supabase SQL Schema
              </h2>
              <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                Full schema at: /src/lib/supabase-schema.sql
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex gap-1.5">
                {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
                  <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <span className="text-gray-500 ml-2" style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>
                supabase-schema.sql
              </span>
            </div>
            <pre
              className="p-5 text-gray-300 overflow-x-auto"
              style={{ fontSize: "0.75rem", lineHeight: "1.7", fontFamily: "'Courier New', monospace" }}
            >
              {SQL_SNIPPET}
            </pre>
          </div>
        </motion.div>

        {/* Flow description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.2)" }}
            >
              <GitBranch className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-white" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              How to Run a Campaign
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { num: "01", title: "Write Campaign Brief", desc: "Go to New Campaign. Write a natural language brief describing your product, goals, and audience. The AI parses this automatically.", icon: FileText },
              { num: "02", title: "AI Plans the Campaign", desc: "LangGraph ReAct agent retrieves BFSI best practices via RAG, generates segmentation strategy, calculates optimal send time, and creates 3 A/B content variants.", icon: Brain },
              { num: "03", title: "Review & Customize", desc: "Review the 3 generated email variants. Use Customize Parameters to adjust emojis, temperature, tone, and other settings. Regenerate if needed.", icon: Cpu },
              { num: "04", title: "Human Approval", desc: "Review the campaign brief, selected content, customer count, and send time. Approve to execute — this triggers the Autoreach API call.", icon: Shield },
              { num: "05", title: "Monitor & Analyze", desc: "After launch, the Performance Monitor agent fetches open/click data from Autoreach API. Charts and segment breakdowns are generated automatically.", icon: BarChart3 },
              { num: "06", title: "Optimize & Relaunch", desc: "The Optimization Agent analyzes results, suggests data-backed improvements with full reasoning. Approve suggestions and relaunch — the loop continues.", icon: Target },
            ].map((flow, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-4 p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(139,92,246,0.15)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <flow.icon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-mono text-violet-400"
                      style={{ fontSize: "0.65rem" }}
                    >
                      {flow.num}
                    </span>
                    <span className="text-white" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      {flow.title}
                    </span>
                  </div>
                  <p className="text-gray-400" style={{ fontSize: "0.78rem", lineHeight: "1.6" }}>
                    {flow.desc}
                  </p>
                </div>
                {i < 5 && <ArrowRight className="w-4 h-4 text-gray-700 flex-shrink-0 mt-3" />}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-center p-10 rounded-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1))",
            border: "1px solid rgba(139,92,246,0.3)",
          }}
        >
          <h2 className="text-white mb-3" style={{ fontSize: "1.8rem", fontWeight: 700 }}>
            Ready to Get Started?
          </h2>
          <p className="text-gray-400 mb-8">
            Start using the platform with live APIs and unlock the agentic pipeline.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/dashboard/new-campaign">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  fontSize: "0.9rem",
                }}
              >
                <Zap className="w-4 h-4" />
                Try New Campaign
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: "0.9rem",
                }}
              >
                <BarChart3 className="w-4 h-4" />
                View Dashboard
              </motion.button>
            </Link>
            <Link href="/campaign/camp-001/analysis">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-gray-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "0.9rem",
                }}
              >
                <Globe className="w-4 h-4" />
                View Sample Analysis
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
