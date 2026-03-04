"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { CheckCircle, Copy, Eye, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { MOCK_EMAIL_VARIANTS } from "../../lib/mock-data";

export interface EmailVariantCard {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  subject: string;
  body: string;
  metrics?: {
    expectedOpenRate: string;
    expectedClickRate: string;
  };
  tags: string[];
}

interface ContentVariantsProps {
  selectedVariant: string | null;
  onSelectVariant: (id: string) => void;
  variants?: EmailVariantCard[];
}

const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "rgba(59,130,246,0.15)", text: "#93c5fd", border: "rgba(59,130,246,0.3)" },
  purple: { bg: "rgba(139,92,246,0.15)", text: "#a78bfa", border: "rgba(139,92,246,0.3)" },
  orange: { bg: "rgba(234,88,12,0.15)", text: "#fdba74", border: "rgba(234,88,12,0.3)" },
};

export function ContentVariants({
  selectedVariant,
  onSelectVariant,
  variants = MOCK_EMAIL_VARIANTS as EmailVariantCard[],
}: ContentVariantsProps) {
  const [expandedVariant, setExpandedVariant] = useState<string | null>("var-b");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>
          Generated Email Variants
        </h3>
        <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
          Select one to proceed
        </span>
      </div>

      {variants.map((variant, idx) => {
        const colors = badgeColors[variant.badgeColor] || badgeColors.purple;
        const isSelected = selectedVariant === variant.id;
        const isExpanded = expandedVariant === variant.id;

        return (
          <motion.div
            key={variant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: isSelected
                ? "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.08))"
                : "rgba(255,255,255,0.03)",
              border: isSelected
                ? "1px solid rgba(139, 92, 246, 0.5)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: isSelected
                ? "0 0 30px rgba(139,92,246,0.2)"
                : "none",
            }}
          >
            {/* Variant header */}
            <div
              className="px-5 py-4 flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedVariant(isExpanded ? null : variant.id)}
            >
              {/* Selection indicator */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVariant(variant.id);
                }}
                className="flex-shrink-0"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: isSelected
                      ? "rgba(139,92,246,0.8)"
                      : "rgba(255,255,255,0.1)",
                    border: isSelected
                      ? "2px solid #a78bfa"
                      : "2px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2.5 h-2.5 rounded-full bg-white"
                    />
                  )}
                </motion.div>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="font-semibold text-white"
                    style={{ fontSize: "0.875rem" }}
                  >
                    {variant.label}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      ...colors,
                      fontSize: "0.7rem",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {variant.badge}
                  </span>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-2 py-0.5 rounded-full text-emerald-400"
                      style={{
                        background: "rgba(16,185,129,0.15)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        fontSize: "0.7rem",
                      }}
                    >
                      ✓ Selected
                    </motion.span>
                  )}
                </div>
                <p className="text-gray-400 truncate" style={{ fontSize: "0.78rem" }}>
                  Subject: <span className="text-gray-300">{variant.subject}</span>
                </p>
              </div>

              {/* Expected metrics */}
              <div className="hidden md:flex items-center gap-4 mr-3">
                <div className="text-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400" style={{ fontSize: "0.7rem" }}>
                      Open
                    </span>
                  </div>
                  <div className="text-white" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    {variant.metrics?.expectedOpenRate ?? "--"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <TrendingUp className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400" style={{ fontSize: "0.7rem" }}>
                      Click
                    </span>
                  </div>
                  <div className="text-white" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    {variant.metrics?.expectedClickRate ?? "--"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(variant.id, `Subject: ${variant.subject}\n\n${variant.body}`);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  {copiedId === variant.id ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded content */}
            <motion.div
              initial={false}
              animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div
                className="px-5 pb-4 pt-0"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Email preview */}
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-400" style={{ fontSize: "0.7rem" }}>
                      Email Preview
                    </span>
                  </div>
                  <div
                    className="mb-2 flex items-center gap-2"
                  >
                    <span className="text-gray-500" style={{ fontSize: "0.7rem" }}>
                      Subject:
                    </span>
                    <span className="text-white" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      {variant.subject}
                    </span>
                  </div>
                  <pre
                    className="text-gray-300 whitespace-pre-wrap"
                    style={{
                      fontSize: "0.75rem",
                      lineHeight: "1.6",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {variant.body}
                  </pre>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {variant.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-gray-400"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: "0.68rem",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
