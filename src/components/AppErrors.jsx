import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, X, AlertTriangle } from "lucide-react";
import { subscribe, dismissError, AUTO_DISMISS_DURATION } from "@/lib/errorStore";

// ─── Progress bar that counts down the auto-dismiss ──────────────────────────
function DismissBar({ startedAt }) {
  const [width, setWidth] = useState(100);
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_DURATION) * 100);
      setWidth(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startedAt]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-red-500/20">
      <div
        className="h-full bg-red-500/60 transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ─── Single error card ────────────────────────────────────────────────────────
function ErrorCard({ id, title, message, startedAt }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.94 }}
      animate={{ opacity: 1, x: 0,  scale: 1    }}
      exit={{    opacity: 0, x: 80, scale: 0.94, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="relative w-80 rounded-xl overflow-hidden shadow-2xl border
        bg-white border-gray-200
        dark:bg-gray-900 dark:border-gray-700/80"
    >
      {/* Red top accent stripe */}
      <div className="h-0.5 w-full bg-gradient-to-r from-red-500 to-red-400" />

      <div className="flex items-start gap-3 px-4 pt-4 pb-4">
        {/* Icon */}
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10
          flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
            {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed break-words">
            {message}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => dismissError(id)}
          className="shrink-0 -mt-0.5 -mr-1 w-6 h-6 rounded-md flex items-center justify-center
            text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown bar */}
      <DismissBar startedAt={startedAt} />
    </motion.div>
  );
}

// ─── Root renderer — mount once in App.jsx ───────────────────────────────────
export default function AppErrors() {
  const [errors, setErrors] = useState([]);

  useEffect(() => subscribe(setErrors), []);

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none"
      aria-live="assertive"
      aria-label="Application errors"
    >
      <AnimatePresence mode="popLayout">
        {errors.map((err) => (
          <div key={err.id} className="pointer-events-auto">
            <ErrorCard {...err} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
