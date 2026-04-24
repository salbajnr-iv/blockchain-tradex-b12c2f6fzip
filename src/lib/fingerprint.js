// SERVER TODO (suggestions.md §9): the "My Devices" panel in Settings → Security
// reads/deletes from `device_fingerprints`. It needs the two self-scoped RLS
// policies (`users_read_own_devices`, `users_delete_own_devices`) added in
// suggestions.md §9 — without them the panel shows empty for normal users even
// though the writes from this file (which use the user's own auth) still work.
import { supabase } from '@/lib/supabaseClient';

const STORAGE_KEY = 'bt_visitor_id';

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getCanvasHash() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = '#069';
    ctx.fillText('BlockTrade-fp\u26A1\uD83D\uDD12', 2, 8);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('BlockTrade-fp\u26A1\uD83D\uDD12', 4, 17);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 30, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  } catch {
    return null;
  }
}

function getWebGLHash() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    const params = [
      vendor,
      renderer,
      gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.toString?.(),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      (gl.getSupportedExtensions() || []).join(','),
    ].join('|');

    return params;
  } catch {
    return null;
  }
}

function getAudioHash() {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioCtx) return resolve(null);

      const context = new AudioCtx(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);
      context.startRendering();

      const timeout = setTimeout(() => resolve(null), 1500);

      context.oncomplete = (event) => {
        clearTimeout(timeout);
        try {
          const channel = event.renderedBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 4500; i < 5000; i++) sum += Math.abs(channel[i]);
          resolve(sum.toString());
        } catch {
          resolve(null);
        } finally {
          try {
            oscillator.disconnect();
            compressor.disconnect();
          } catch {
            /* noop */
          }
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function getEnvComponents() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  return {
    userAgent: nav.userAgent || null,
    language: nav.language || null,
    languages: Array.isArray(nav.languages) ? nav.languages.join(',') : null,
    platform: nav.platform || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    deviceMemory: nav.deviceMemory || null,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.()?.timeZone || null,
    timezoneOffset: new Date().getTimezoneOffset(),
    screen: `${scr.width || 0}x${scr.height || 0}x${scr.colorDepth || 0}`,
    pixelRatio: window.devicePixelRatio || 1,
    touch: 'ontouchstart' in window || nav.maxTouchPoints > 0,
    cookiesEnabled: nav.cookieEnabled || false,
  };
}

async function fetchPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ip || null;
  } catch {
    return null;
  }
}

let inFlight = null;

export async function computeFingerprint() {
  const canvas = getCanvasHash();
  const webgl = getWebGLHash();
  const audio = await getAudioHash();
  const env = getEnvComponents();

  const [canvasHash, audioHash, webglHash] = await Promise.all([
    canvas ? sha256Hex(canvas) : Promise.resolve(null),
    audio ? sha256Hex(audio) : Promise.resolve(null),
    webgl ? sha256Hex(webgl) : Promise.resolve(null),
  ]);

  const composite = [
    canvasHash,
    audioHash,
    webglHash,
    env.userAgent,
    env.platform,
    env.timezone,
    env.screen,
    env.hardwareConcurrency,
  ].join('::');

  const visitorId = await sha256Hex(composite);

  return {
    visitorId,
    canvasHash,
    audioHash,
    webglHash,
    components: env,
  };
}

async function persist(userId, fp) {
  if (!userId || !fp?.visitorId) return;
  const ip = await fetchPublicIp();

  const { data: existing, error: selErr } = await supabase
    .from('device_fingerprints')
    .select('id, seen_count')
    .eq('user_id', userId)
    .eq('visitor_id', fp.visitorId)
    .maybeSingle();

  if (selErr) return;

  const now = new Date().toISOString();

  if (existing?.id) {
    await supabase
      .from('device_fingerprints')
      .update({
        last_seen_at: now,
        seen_count: (existing.seen_count || 0) + 1,
        ip_address: ip,
        components: fp.components,
        canvas_hash: fp.canvasHash,
        audio_hash: fp.audioHash,
        webgl_hash: fp.webglHash,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('device_fingerprints').insert({
      user_id: userId,
      visitor_id: fp.visitorId,
      canvas_hash: fp.canvasHash,
      audio_hash: fp.audioHash,
      webgl_hash: fp.webglHash,
      components: fp.components,
      user_agent: fp.components?.userAgent || null,
      language: fp.components?.language || null,
      timezone: fp.components?.timezone || null,
      screen: fp.components?.screen || null,
      platform: fp.components?.platform || null,
      ip_address: ip,
      first_seen_at: now,
      last_seen_at: now,
      seen_count: 1,
    });
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, fp.visitorId);
  } catch {
    /* noop */
  }
}

export function captureFingerprint(userId) {
  if (!userId) return Promise.resolve(null);

  try {
    if (sessionStorage.getItem(STORAGE_KEY + ':uid') === userId) {
      return Promise.resolve(null);
    }
  } catch {
    /* noop */
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const idle =
        window.requestIdleCallback ||
        ((cb) => setTimeout(() => cb({ timeRemaining: () => 0 }), 250));
      await new Promise((resolve) => idle(() => resolve()));

      const fp = await computeFingerprint();
      await persist(userId, fp);

      try {
        sessionStorage.setItem(STORAGE_KEY + ':uid', userId);
      } catch {
        /* noop */
      }
      return fp;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
