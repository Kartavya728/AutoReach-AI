"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useEffect, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Zap,
  Brain,
  Target,
  BarChart3,
  Mail,
  Users,
  ChevronRight,
  ArrowRight,
  Cpu,
  Database,
  Network,
  Shield,
  BookOpen,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "ReAct AI Agents",
    description: "LangGraph-powered agents with Reasoning + Action architecture for intelligent autonomous campaign planning",
    color: "#7c3aed",
    glow: "rgba(124,58,237,0.3)",
  },
  {
    icon: Database,
    title: "RAG Knowledge Base",
    description: "Corrective RAG retrieval from BFSI marketing best practices with pgvector semantic search",
    color: "#0891b2",
    glow: "rgba(8,145,178,0.3)",
  },
  {
    icon: Target,
    title: "Smart Segmentation",
    description: "Automatic demographic & behavioral customer profiling with micro-segment identification",
    color: "#059669",
    glow: "rgba(5,150,105,0.3)",
  },
  {
    icon: Network,
    title: "Multi-Agent Pipeline",
    description: "Orchestrated workflow: Strategy → Content → Approval → Execute → Analyze → Optimize",
    color: "#d97706",
    glow: "rgba(217,119,6,0.3)",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    description: "Real-time open/click rate tracking with segment-level drill-downs and visual dashboards",
    color: "#ec4899",
    glow: "rgba(236,72,153,0.3)",
  },
  {
    icon: Shield,
    title: "Human-in-Loop",
    description: "Critical approvals at every AI decision point — you stay in control of every campaign",
    color: "#84cc16",
    glow: "rgba(132,204,22,0.3)",
  },
];

const STATS = [
  { value: "38%", label: "Avg Open Rate", sub: "+12% vs baseline" },
  { value: "21%", label: "Click Rate", sub: "+8% vs baseline" },
  { value: "5K+", label: "Customers Reached", sub: "Active cohort" },
  { value: "3x", label: "ROI Uplift", sub: "via AI optimization" },
];

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
    }[] = [];

    const colors = ["#7c3aed", "#ec4899", "#0891b2", "#059669"];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.opacity * 255).toString(16).padStart(2, "0");
        ctx.fill();

        // Draw connections
        particles.slice(i + 1, i + 5).forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(139,92,246,${(1 - dist / 120) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count}{suffix}</span>;
}

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const [statsVisible, setStatsVisible] = useState(false);

  return (
    <div ref={containerRef} className="min-h-screen overflow-x-hidden">
      <ParticleCanvas />

      {/* Gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(circle, #7c3aed, transparent)",
            top: "10%",
            left: "10%",
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{
            background: "radial-gradient(circle, #ec4899, transparent)",
            top: "20%",
            right: "15%",
          }}
        />
        <div
          className="absolute w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{
            background: "radial-gradient(circle, #0891b2, transparent)",
            bottom: "20%",
            left: "30%",
          }}
        />
      </div>

      {/* Hero */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.4)",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
            </motion.div>
            <span className="text-violet-300" style={{ fontSize: "0.8rem" }}>
              CampaignX · FrostHack XPECTO 2026 · IIT Mandi
            </span>
            <span
              className="px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300"
              style={{ fontSize: "0.65rem" }}
            >
              v1.0
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1
              className="mb-4"
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                lineHeight: 1.1,
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #a78bfa 40%, #ec4899 70%, #ffffff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundSize: "200% auto",
                  animation: "gradientShift 4s ease infinite",
                }}
              >
                Campaign
              </span>
              <span
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                X
              </span>
            </h1>
            <h2
              className="text-gray-300 mb-6"
              style={{ fontSize: "clamp(1.2rem, 3vw, 1.8rem)", fontWeight: 400 }}
            >
              AI Multi-Agent Marketing{" "}
              <span className="text-violet-400">Automation</span> Platform
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 max-w-2xl mx-auto mb-10"
            style={{ fontSize: "1rem", lineHeight: "1.7" }}
          >
            Powered by{" "}
            <span className="text-violet-400 font-semibold">LangGraph ReAct agents</span>{" "}
            and{" "}
            <span className="text-pink-400 font-semibold">Corrective RAG</span> — plan, execute,
            analyze, and autonomously optimize email campaigns for SuperBFSI with
            human-in-loop approval at every critical step.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(139,92,246,0.5)" }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  fontSize: "1rem",
                }}
              >
                <LayoutDashboard className="w-5 h-5" />
                Open Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>

            <Link href="/dashboard/new-campaign">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: "1rem",
                }}
              >
                <Zap className="w-5 h-5 text-yellow-400" />
                New Campaign
              </motion.button>
            </Link>

            <Link href="/how-to-use">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl text-gray-300 font-semibold"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "1rem",
                }}
              >
                <BookOpen className="w-4 h-4" />
                How to Use
              </motion.button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-16 flex flex-col items-center gap-2"
          >
            <span className="text-gray-600" style={{ fontSize: "0.7rem" }}>
              Scroll to explore
            </span>
            <div
              className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
              style={{ borderColor: "rgba(255,255,255,0.15)" }}
            >
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1 h-2 rounded-full bg-violet-400"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <motion.section
        onViewportEnter={() => setStatsVisible(true)}
        className="relative z-10 py-24 px-4"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-white mb-3" style={{ fontSize: "2rem" }}>
              Proven Performance
            </h2>
            <p className="text-gray-400">
              Real results from demo campaigns on SuperBFSI cohort
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8, scale: 1.03 }}
                className="relative p-6 rounded-2xl text-center"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="text-4xl font-bold mb-1"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa, #f9a8d4)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {statsVisible ? (
                    stat.value.includes("%") ? (
                      <><AnimatedCounter target={parseInt(stat.value)} suffix="%" /></>
                    ) : stat.value.includes("K") ? (
                      <><AnimatedCounter target={parseInt(stat.value)} suffix="K+" /></>
                    ) : (
                      stat.value
                    )
                  ) : "—"}
                </div>
                <div className="text-white mb-1" style={{ fontSize: "0.875rem" }}>
                  {stat.label}
                </div>
                <div
                  className="text-emerald-400"
                  style={{ fontSize: "0.7rem" }}
                >
                  {stat.sub}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Grid */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-400" style={{ fontSize: "0.75rem" }}>
                Platform Capabilities
              </span>
            </div>
            <h2 className="text-white mb-4" style={{ fontSize: "2.5rem" }}>
              Everything you need to{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                run smarter campaigns
              </span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              From brief to optimization loop — every step powered by AI agents
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative p-6 rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Hover glow */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${feature.glow}, transparent 70%)`,
                  }}
                />

                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                    style={{
                      background: `${feature.color}25`,
                      border: `1px solid ${feature.color}40`,
                    }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                  </div>
                  <h3 className="text-white mb-2" style={{ fontSize: "1rem" }}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-400" style={{ fontSize: "0.82rem", lineHeight: "1.6" }}>
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            <div className="text-center mb-8">
              <h2 className="text-white mb-2" style={{ fontSize: "1.5rem" }}>
                Multi-Agent Architecture
              </h2>
              <p className="text-gray-400" style={{ fontSize: "0.85rem" }}>
                ReAct + Corrective RAG pipeline with human-in-loop checkpoints
              </p>
            </div>

            {/* Architecture flow */}
            <div className="flex flex-wrap justify-center items-center gap-3">
              {[
                { label: "Campaign Brief", icon: Mail, color: "#7c3aed" },
                { label: "→", isArrow: true },
                { label: "RAG Retriever", icon: Database, color: "#0891b2" },
                { label: "→", isArrow: true },
                { label: "ReAct Planner", icon: Brain, color: "#059669" },
                { label: "→", isArrow: true },
                { label: "Content Gen", icon: Zap, color: "#d97706" },
                { label: "→", isArrow: true },
                { label: "Human Approval", icon: Users, color: "#ec4899" },
                { label: "→", isArrow: true },
                { label: "Launch + Monitor", icon: TrendingUp, color: "#84cc16" },
                { label: "→", isArrow: true },
                { label: "Optimize Loop", icon: Target, color: "#7c3aed" },
              ].map((item, i) =>
                item.isArrow ? (
                  <ChevronRight key={i} className="w-4 h-4 text-gray-600" />
                ) : (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.05, y: -3 }}
                    className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl"
                    style={{
                      background: `${item.color}15`,
                      border: `1px solid ${item.color}30`,
                    }}
                  >
                    {item.icon && (
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    )}
                    <span className="text-gray-300 text-center" style={{ fontSize: "0.68rem" }}>
                      {item.label}
                    </span>
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.15))",
              border: "1px solid rgba(139,92,246,0.4)",
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.3), transparent 70%)",
              }}
            />
            <div className="relative z-10">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-block mb-6"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
                >
                  <Zap className="w-8 h-8 text-white" />
                </div>
              </motion.div>

              <h2 className="text-white mb-4" style={{ fontSize: "2rem" }}>
                Ready to launch your campaign?
              </h2>
              <p className="text-gray-400 mb-8">
                Let the AI agents plan, generate, and optimize — you just approve.
              </p>

              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/dashboard/new-campaign">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(139,92,246,0.6)" }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                      fontSize: "1rem",
                    }}
                  >
                    <Zap className="w-5 h-5" />
                    Start New Campaign
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
                <Link href="/how-to-use">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: "1rem",
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                    Read the Guide
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 text-center border-t border-white/5">
        <p className="text-gray-600" style={{ fontSize: "0.8rem" }}>
          CampaignX · Built for FrostHack XPECTO 2026 · IIT Mandi ·{" "}
          <span className="text-violet-500">InXiteOut</span> Hackathon
        </p>
      </footer>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

function LayoutDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
