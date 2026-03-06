"use client";

import { motion } from "motion/react";
import { Zap } from "lucide-react";

export function Loader({
    text = "Processing...",
    subtext = "Please wait a moment",
}: {
    text?: string;
    subtext?: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            {/* Outer Glow Ring container */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                {/* Ring 1 - Fast */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-l-2 border-transparent"
                    style={{
                        borderTopColor: "rgba(139, 92, 246, 0.8)",
                        borderLeftColor: "rgba(236, 72, 153, 0.5)",
                        filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))",
                    }}
                />

                {/* Ring 2 - Slow / Opposite */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-2 rounded-full border-r-2 border-b-2 border-transparent"
                    style={{
                        borderRightColor: "rgba(99, 102, 241, 0.8)",
                        borderBottomColor: "rgba(56, 189, 248, 0.5)",
                        filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.4))",
                    }}
                />

                {/* Central Core */}
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden z-10"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
                    <div className="absolute inset-[2px] bg-[#0A0A1E] rounded-xl z-0" />
                    <Zap className="w-6 h-6 text-violet-400 relative z-10" />
                </motion.div>

                {/* Ambient background glow */}
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute inset-0 bg-violet-600 rounded-full blur-2xl z-0"
                />
            </div>

            <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="flex flex-col items-center"
            >
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400 mb-2 tracking-wide">
                    {text}
                </h3>
                {subtext && (
                    <p className="text-gray-500 text-sm font-medium tracking-wider uppercase">
                        {subtext}
                    </p>
                )}
            </motion.div>
        </div>
    );
}
