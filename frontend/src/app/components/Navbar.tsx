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
        {
}
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 180 }}
            transition={{ duration: 0.4 }}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              style={{ scale: 1.5 }}
            />
            <div className="absolute inset-[2px] bg-[#0A0A1E] rounded-md z-0" />
            <Zap className="w-4 h-4 text-violet-400 relative z-10" />
          </motion.div>

          <div className="flex items-center tracking-tight font-extrabold" style={{ fontSize: "1.15rem" }}>
            <span className="text-white">Autoreach</span>
            <div className="relative ml-2 flex items-center px-2 py-0.5 rounded-full overflow-hidden" style={{ background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
              <Activity className="w-3 h-3 text-violet-400 mr-1" />
              <span className="text-violet-400 font-bold tracking-wider" style={{ fontSize: "0.65rem" }}>
                AI
              </span>
            </div>
          </div>
        </Link>

        {
}
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

        {
}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400" style={{ fontSize: "0.75rem" }}>
              AI Active
            </span>
          </div>
        </div>

        {
}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.div>

      {
}
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
