"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function BackgroundGlow() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <motion.div
                animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.15, 0.25, 0.15],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full blur-[120px]"
                style={{
                    background: "radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)",
                    top: "-15%",
                    left: "-10%",
                }}
            />
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full blur-[120px]"
                style={{
                    background: "radial-gradient(circle, rgba(236,72,153,0.4), transparent 70%)",
                    bottom: "-10%",
                    right: "-5%",
                }}
            />
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.15, 0.1],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full blur-[120px]"
                style={{
                    background: "radial-gradient(circle, rgba(8,145,178,0.3), transparent 70%)",
                    top: "40%",
                    left: "30%",
                }}
            />
        </div>
    );
}
