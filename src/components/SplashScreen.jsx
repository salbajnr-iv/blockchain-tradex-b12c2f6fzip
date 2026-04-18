import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DURATION = 5000;

// SVG viewBox: 392.88 × 240
// Icon lives in roughly the left 22% (≈86px) centered vertically
// We display the SVG at 390px wide → scale ≈ 0.992
// Icon display area: ~86px wide, ~86px tall, y-offset ≈ 77px from top
const SVG_DISPLAY_W = 390;
const ICON_W = 86;
const ICON_MARGIN_TOP = -77; // pull image up so icon is centred in container

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
          {/* Ambient glow — breathes gently */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: 500,
              height: 500,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, rgba(52,211,153,0.10) 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Centre stack ─────────────────────────────────────── */}
          <div className="relative flex flex-col items-center gap-7">

            {/* Spinning icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              {/* Outer decorative ring */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute rounded-full border border-emerald-500/15"
                  style={{ width: ICON_W + 30, height: ICON_W + 30 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 16, ease: "linear", repeat: Infinity }}
                />

                {/* Spinning icon crop */}
                <motion.div
                  style={{
                    width: ICON_W,
                    height: ICON_W,
                    overflow: "hidden",
                    borderRadius: 16,
                    flexShrink: 0,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, ease: "linear", repeat: Infinity }}
                >
                  <img
                    src="/logo.svg"
                    alt=""
                    style={{
                      width: SVG_DISPLAY_W,
                      height: "auto",
                      marginTop: ICON_MARGIN_TOP,
                      filter: "invert(1)",
                      display: "block",
                    }}
                    draggable={false}
                  />
                </motion.div>
              </div>
            </motion.div>

            {/* Static glowing wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.55 }}
              className="flex flex-col items-center gap-3"
            >
              <h1
                className="text-white text-3xl sm:text-4xl font-bold tracking-[0.22em] uppercase"
                style={{
                  textShadow:
                    "0 0 30px rgba(52,211,153,0.45), 0 0 60px rgba(52,211,153,0.15)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                BLOCK
                <motion.span
                  className="text-emerald-400"
                  animate={{
                    textShadow: [
                      "0 0 12px rgba(52,211,153,0.6)",
                      "0 0 28px rgba(52,211,153,1)",
                      "0 0 12px rgba(52,211,153,0.6)",
                    ],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  TRADE
                </motion.span>
              </h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="text-[11px] text-white/25 tracking-[0.35em] uppercase"
              >
                Your crypto trading platform
              </motion.p>
            </motion.div>
          </div>

          {/* Pulsing loading dots */}
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

          {/* Bottom progress bar */}
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
