"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { X, Sliders, Smile, Briefcase, Clock, Globe, Target, Sparkles, RotateCcw } from "lucide-react";

interface Params {
  useEmojis: boolean;
  temperature: number;
  tone: string;
  includeURL: boolean;
  personalizeNames: boolean;
  includeStats: boolean;
  urgency: boolean;
  customAddOn: string;
}

interface CustomizeParamsProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (params: Params) => void;
  initialParams?: Partial<Params>;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", icon: "💼" },
  { value: "friendly", label: "Friendly", icon: "😊" },
  { value: "urgent", label: "Urgent", icon: "⚡" },
  { value: "empathetic", label: "Empathetic", icon: "💙" },
  { value: "assertive", label: "Assertive", icon: "🎯" },
  { value: "inspirational", label: "Inspirational", icon: "✨" },
];

export function CustomizeParams({
  isOpen,
  onClose,
  onRegenerate,
  initialParams = {},
}: CustomizeParamsProps) {
  const [params, setParams] = useState<Params>({
    useEmojis: initialParams.useEmojis ?? true,
    temperature: initialParams.temperature ?? 0.7,
    tone: initialParams.tone ?? "friendly",
    includeURL: initialParams.includeURL ?? true,
    personalizeNames: initialParams.personalizeNames ?? false,
    includeStats: initialParams.includeStats ?? false,
    urgency: initialParams.urgency ?? false,
    customAddOn: initialParams.customAddOn ?? "",
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0d0d2b 0%, #1a0533 100%)",
              border: "1px solid rgba(139, 92, 246, 0.4)",
              boxShadow: "0 25px 80px rgba(139, 92, 246, 0.3)",
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{
                background: "rgba(139, 92, 246, 0.1)",
                borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(139, 92, 246, 0.3)" }}
                >
                  <Sliders className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white" style={{ fontSize: "1rem" }}>
                    Customize Parameters
                  </h2>
                  <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                    Fine-tune AI generation settings
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Toggle options */}
              <div>
                <h3
                  className="text-gray-300 mb-3 flex items-center gap-2"
                  style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Content Options
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "useEmojis", label: "Use Emojis", icon: "😊", desc: "Include relevant emojis" },
                    { key: "includeURL", label: "Include CTA Link", icon: "🔗", desc: "Add product URL" },
                    { key: "personalizeNames", label: "Personalize Names", icon: "👤", desc: "Use [Name] placeholders" },
                    { key: "includeStats", label: "Include Stats", icon: "📊", desc: "Add interest rate data" },
                    { key: "urgency", label: "Urgency Element", icon: "⚡", desc: "Add time pressure" },
                  ].map(({ key, label, icon, desc }) => (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setParams((p) => ({
                          ...p,
                          [key]: !p[key as keyof Params],
                        }))
                      }
                      className="relative p-3 rounded-xl text-left transition-all"
                      style={{
                        background: params[key as keyof Params]
                          ? "rgba(139, 92, 246, 0.2)"
                          : "rgba(255,255,255,0.03)",
                        border: params[key as keyof Params]
                          ? "1px solid rgba(139, 92, 246, 0.5)"
                          : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span style={{ fontSize: "0.9rem" }}>{icon}</span>
                            <span
                              className="text-white"
                              style={{ fontSize: "0.78rem" }}
                            >
                              {label}
                            </span>
                          </div>
                          <p className="text-gray-500" style={{ fontSize: "0.68rem" }}>
                            {desc}
                          </p>
                        </div>
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: params[key as keyof Params]
                              ? "rgba(139,92,246,0.8)"
                              : "rgba(255,255,255,0.1)",
                          }}
                        >
                          {params[key as keyof Params] && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <h3
                  className="text-gray-300 mb-3 flex items-center gap-2"
                  style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
                >
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Creativity Temperature
                </h3>
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                      Conservative
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-lg font-mono"
                      style={{
                        background: "rgba(139,92,246,0.2)",
                        color: "#a78bfa",
                        fontSize: "0.8rem",
                      }}
                    >
                      {params.temperature.toFixed(1)}
                    </span>
                    <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                      Creative
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={params.temperature}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        temperature: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-violet-500"
                    style={{ cursor: "pointer" }}
                  />
                  <div className="flex justify-between mt-1">
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                      <button
                        key={v}
                        onClick={() => setParams((p) => ({ ...p, temperature: v }))}
                        className="text-gray-600 hover:text-violet-400 transition-colors"
                        style={{ fontSize: "0.65rem" }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-500 mt-2" style={{ fontSize: "0.7rem" }}>
                    {params.temperature <= 0.3
                      ? "Precise, formal content with minimal variation"
                      : params.temperature <= 0.6
                      ? "Balanced creative and professional content"
                      : "Highly creative, varied content with unique angles"}
                  </p>
                </div>
              </div>

              {/* Tone selection */}
              <div>
                <h3
                  className="text-gray-300 mb-3 flex items-center gap-2"
                  style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
                >
                  <Briefcase className="w-3.5 h-3.5 text-pink-400" />
                  Communication Tone
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {TONE_OPTIONS.map((tone) => (
                    <motion.button
                      key={tone.value}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setParams((p) => ({ ...p, tone: tone.value }))}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        background:
                          params.tone === tone.value
                            ? "rgba(236, 72, 153, 0.2)"
                            : "rgba(255,255,255,0.03)",
                        border:
                          params.tone === tone.value
                            ? "1px solid rgba(236, 72, 153, 0.5)"
                            : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ fontSize: "1.2rem" }}>{tone.icon}</div>
                      <div
                        className="mt-1"
                        style={{
                          fontSize: "0.72rem",
                          color: params.tone === tone.value ? "#f9a8d4" : "#9ca3af",
                        }}
                      >
                        {tone.label}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Custom add-on */}
              <div>
                <h3
                  className="text-gray-300 mb-3 flex items-center gap-2"
                  style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  Custom Instructions
                </h3>
                <textarea
                  value={params.customAddOn}
                  onChange={(e) =>
                    setParams((p) => ({ ...p, customAddOn: e.target.value }))
                  }
                  placeholder="e.g., Always mention that XDeposit is RBI regulated. Focus on senior citizens benefits..."
                  rows={3}
                  className="w-full rounded-xl p-3 text-white placeholder-gray-600 resize-none outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "0.8rem",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(139, 92, 246, 0.5)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.08)";
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-gray-400 hover:text-white transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onRegenerate(params);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl text-white flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  fontSize: "0.875rem",
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate Content
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
