"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  Zap,
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  Activity,
  Cpu,
  Users,
} from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/customers", label: "Customers CRM", icon: Users },
  { href: "/dashboard/new-campaign", label: "New Campaign", icon: PlusCircle },
  { href: "/how-to-use", label: "How to Use", icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3 rounded-2xl"
        style={{
          background: "rgba(10, 10, 30, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          boxShadow: "0 4px 40px rgba(139, 92, 246, 0.15)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center"
          >
            <Zap className="w-4 h-4 text-white" />
          </motion.div>
          <span
            className="font-bold text-white"
            style={{ fontSize: "1.1rem" }}
          >
            Campaign
            <span className="text-violet-400">X</span>
          </span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
            <Activity className="w-3 h-3 text-violet-400" />
            <span className="text-violet-400" style={{ fontSize: "0.65rem" }}>
              AI
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200"
                  style={{
                    background: isActive
                      ? "rgba(139, 92, 246, 0.25)"
                      : "transparent",
                    color: isActive ? "#a78bfa" : "#9ca3af",
                    border: isActive
                      ? "1px solid rgba(139, 92, 246, 0.4)"
                      : "1px solid transparent",
                  }}
                >
                  <link.icon className="w-4 h-4" />
                  <span style={{ fontSize: "0.875rem" }}>{link.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1))",
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400" style={{ fontSize: "0.75rem" }}>
              AI Active
            </span>
          </div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 cursor-pointer"
          >
            <Cpu className="w-3 h-3 text-violet-400" />
            <span className="text-violet-400" style={{ fontSize: "0.75rem" }}>
              Gemini 2.0
            </span>
          </motion.div>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden mt-2 mx-auto max-w-7xl rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10, 10, 30, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between px-5 py-4 text-gray-300 hover:text-white hover:bg-violet-500/10 border-b border-white/5 last:border-0 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <link.icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
