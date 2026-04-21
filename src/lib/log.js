/**
 * Tiny logger that only emits in development.
 *
 * Use this in place of `console.log` / `console.warn` for diagnostic noise
 * that should never reach a production console (e.g. "connected", "subscribed",
 * portfolio engine warnings). Real user-facing errors should still go through
 * the toast system.
 *
 *   import { devLog, devWarn } from '@/lib/log';
 *   devLog('Realtime notifications active for portfolio', portfolioId);
 */
const enabled = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export const devLog  = (...args) => { if (enabled) console.log(...args);  };
export const devWarn = (...args) => { if (enabled) console.warn(...args); };
export const devInfo = (...args) => { if (enabled) console.info(...args); };
