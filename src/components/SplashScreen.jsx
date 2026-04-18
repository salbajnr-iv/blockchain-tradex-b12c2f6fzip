import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DURATION = 5000;

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const exit = setTimeout(() => setVisible(false), DURATION - 600);
    const done = setTimeout(onDone, DURATION);
    return () => { clearTimeout(exit); clearTimeout(done); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] select-none overflow-hidden"
        >
          {/* Ambient glow behind logo */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: 600,
              height: 300,
              background:
                "radial-gradient(ellipse at center, rgba(52,211,153,0.12) 0%, transparent 70%)",
              borderRadius: "50%",
            }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Center content */}
          <div className="relative flex flex-col items-center gap-8">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              <img
                src="/logo.svg"
                alt="BlockTrade"
                width="320"
                height="auto"
                className="w-64 sm:w-80 invert drop-shadow-[0_0_24px_rgba(52,211,153,0.25)]"
                draggable={false}
              />
            </motion.div>

            {/* Divider line */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.7 }}
              className="w-16 h-px bg-emerald-500/50 origin-center"
            />

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.9 }}
              className="text-xs text-white/30 tracking-[0.3em] uppercase"
            >
              Your crypto trading platform
            </motion.p>
          </div>

          {/* Loading dots */}
          <div className="absolute bottom-12 flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
            <motion.div
              className="h-full bg-emerald-500"
              style={{ boxShadow: "0 0 10px rgba(52,211,153,0.9)" }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: DURATION / 1000 - 0.1,
                ease: "linear",
                delay: 0.1,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
