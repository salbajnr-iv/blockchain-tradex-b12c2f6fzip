// ─────────────────────────────────────────────────────────────────────────────
// Global Error Store — call showError(message) from anywhere (React or not).
// Deduplicates by message text: the same error will never stack twice.
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE     = 4;

const listeners = new Set();
// messageKey → { id, timerId }
const active = new Map();
let errors = [];

function notify() {
  listeners.forEach((fn) => fn([...errors]));
}

export function showError(message, { title = "Error" } = {}) {
  const key = `${title}::${message}`;

  // ── Dedup: if already visible, just bump its timer ──────────────────────────
  if (active.has(key)) {
    const { id, timerId } = active.get(key);
    clearTimeout(timerId);
    const newTimer = setTimeout(() => dismissError(id), AUTO_DISMISS_MS);
    active.set(key, { id, timerId: newTimer });
    // reset the startedAt so the progress bar restarts
    errors = errors.map((e) =>
      e.id === id ? { ...e, startedAt: Date.now() } : e
    );
    notify();
    return id;
  }

  // ── Add new error ───────────────────────────────────────────────────────────
  if (errors.length >= MAX_VISIBLE) {
    // drop the oldest
    const oldest = errors[0];
    const oldKey = `${oldest.title}::${oldest.message}`;
    clearTimeout(active.get(oldKey)?.timerId);
    active.delete(oldKey);
    errors = errors.slice(1);
  }

  const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timerId = setTimeout(() => dismissError(id), AUTO_DISMISS_MS);
  active.set(key, { id, timerId });

  errors = [
    ...errors,
    { id, title, message, startedAt: Date.now() },
  ];
  notify();
  return id;
}

export function dismissError(id) {
  const target = errors.find((e) => e.id === id);
  if (!target) return;
  const key = `${target.title}::${target.message}`;
  clearTimeout(active.get(key)?.timerId);
  active.delete(key);
  errors = errors.filter((e) => e.id !== id);
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener([...errors]);
  return () => listeners.delete(listener);
}

export const AUTO_DISMISS_DURATION = AUTO_DISMISS_MS;
