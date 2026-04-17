// ─────────────────────────────────────────────────────────────────────────────
// Unified toast helper.
// • .error()   → routes through AppErrors (solid, deduplicated, no Sonner)
// • everything else → Sonner as usual
// Import from here instead of 'sonner' throughout the app.
// ─────────────────────────────────────────────────────────────────────────────
import { toast as _sonner } from "sonner";
import { showError } from "@/lib/errorStore";

function errorHandler(messageOrOptions, options = {}) {
  // Sonner allows toast.error(message) or toast.error(message, { description })
  const message =
    typeof messageOrOptions === "string"
      ? messageOrOptions
      : messageOrOptions?.message ?? String(messageOrOptions);

  const title   = options?.title ?? "Error";
  const detail  = options?.description ? `${message} — ${options.description}` : message;

  showError(detail, { title });
}

export const toast = {
  // ── Error always goes to AppErrors ─────────────────────────────────────────
  error: errorHandler,

  // ── Everything else stays on Sonner ────────────────────────────────────────
  success:  (...a) => _sonner.success(...a),
  info:     (...a) => _sonner.info(...a),
  warning:  (...a) => _sonner.warning(...a),
  message:  (...a) => _sonner(...a),
  loading:  (...a) => _sonner.loading(...a),
  promise:  (...a) => _sonner.promise(...a),
  dismiss:  (...a) => _sonner.dismiss(...a),
  custom:   (...a) => _sonner.custom(...a),
};

export default toast;
