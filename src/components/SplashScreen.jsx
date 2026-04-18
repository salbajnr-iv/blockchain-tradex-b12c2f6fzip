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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] select-none"
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(34,197,94,0.08) 0%, transparent 70%)",
            }}
          />

          {/* Center content */}
          <div className="relative flex flex-col items-center gap-6">

            {/* Logo ring */}
            <div className="relative flex items-center justify-center">
              {/* Spinning ring */}
              <motion.div
                className="absolute w-32 h-32 rounded-full border border-emerald-500/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                className="absolute w-40 h-40 rounded-full border border-emerald-500/10"
                animate={{ rotate: -360 }}
                transition={{ duration: 14, ease: "linear", repeat: Infinity }}
              />

              {/* Logo container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center shadow-2xl"
              >
                <img
                  src="/logo.svg"
                  alt="BlockTrade"
                  width="52"
                  height="52"
                  className="invert"
                />
              </motion.div>
            </div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
              className="flex flex-col items-center gap-1.5"
            >
              <h1
                className="text-white text-3xl font-bold tracking-[0.2em] uppercase"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                Block<span className="text-emerald-400">Trade</span>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="text-xs text-white/35 tracking-widest uppercase"
              >
                Your crypto trading platform
              </motion.p>
            </motion.div>
          </div>

          {/* Progress bar */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div
              className="h-full bg-emerald-500"
              style={{
                boxShadow: "0 0 8px rgba(52,211,153,0.8)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: DURATION / 1000 - 0.1, ease: "linear", delay: 0.1 }}
            />
          </motion.div>

          {/* Corner dots */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute bottom-8 w-1 h-1 rounded-full bg-emerald-500/60"
              style={{ left: `calc(50% + ${(i - 1) * 10}px)` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
