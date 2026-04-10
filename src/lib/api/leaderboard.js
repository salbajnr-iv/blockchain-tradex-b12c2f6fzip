import { supabase } from '@/lib/supabaseClient';

const SETTING_KEY = 'leaderboard_overrides';

// ── Seeded pseudo-random (deterministic) ─────────────────────────────────────
function sr(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Mock display names ────────────────────────────────────────────────────────
const FIRST = [
  'Alex', 'Blake', 'Casey', 'Dana', 'Drew', 'Eli', 'Finn', 'Gray', 'Harper', 'Hunter',
  'Jade', 'Jordan', 'Kai', 'Lane', 'Leo', 'Logan', 'Luca', 'Max', 'Morgan', 'Noel',
  'Nova', 'Oliver', 'Parker', 'Quinn', 'Remi', 'River', 'Robin', 'Rowan', 'Ryan', 'Sage',
  'Sam', 'Skylar', 'Sterling', 'Tatum', 'Taylor', 'Tyler', 'Winter', 'Wren', 'Zara', 'Zion',
];
const LAST = [
  'Crypto', 'Satoshi', 'Nakamoto', 'Vitalik', 'Hodler', 'Mooner', 'Whale', 'Bull',
  'Bear', 'Degen', 'Alpha', 'Beta', 'Sigma', 'Delta', 'Omega', 'Gamma', 'Lambda',
  'Theta', 'Kappa', 'Rho', 'Phi', 'Psi', 'Zeta', 'Eta', 'Nu', 'Xi', 'Tau',
];
const BADGES = ['🦈 Whale', '🔥 Hot Streak', '🎯 Sharp', '💎 Diamond', '🚀 Moon',
  '⚡ Flash', '🏆 Champion', '🐂 Bull Run', '🦅 Eagle Eye', '🌊 Surfer',
  null, null, null, null, null, null];
const AVATARS = ['🐯', '🦊', '🐺', '🦁', '🐻', '🦅', '🐉', '🦄', '🦋', '🐧',
  '🦜', '🐸', '🦩', '🦒', '🐳', '🦈', '🦊', '🐙', '🦑', '🌟',
  '⚡', '🔥', '💎', '🌊', '🎯', '🏹', '🎲', '🎮', '🃏', '🎪'];

// ── Generate deterministic mock 100-user leaderboard ─────────────────────────
export function generateMockUsers() {
  return Array.from({ length: 100 }, (_, i) => {
    const seed = i + 1;
    const first = FIRST[Math.floor(sr(seed * 3) * FIRST.length)];
    const last  = LAST[Math.floor(sr(seed * 7) * LAST.length)];
    const num   = Math.floor(sr(seed * 11) * 9000) + 1000;
    const badge = BADGES[Math.floor(sr(seed * 13) * BADGES.length)];
    const avatar = AVATARS[Math.floor(sr(seed * 17) * AVATARS.length)];

    // top spots get bigger numbers
    const rankFactor = Math.pow((101 - seed) / 100, 1.6);
    const portfolioBase = 200_000 + rankFactor * 1_800_000;
    const portfolio = portfolioBase * (0.85 + sr(seed * 19) * 0.3);

    const profitPct  = 18 + sr(seed * 23) * 380 * rankFactor;
    const totalProfit = portfolio * (profitPct / 100);
    const winRate    = 45 + sr(seed * 29) * 45 * rankFactor;
    const trades     = Math.floor(80 + sr(seed * 31) * 4200 * rankFactor);

    return {
      id: `mock_${seed}`,
      isMock: true,
      name: `${first}${last}${num}`,
      displayName: `${first} ${last[0]}.`,
      avatar,
      badge,
      portfolio: Math.round(portfolio),
      totalProfit: Math.round(totalProfit),
      profitPct: Math.round(profitPct * 10) / 10,
      winRate: Math.round(winRate * 10) / 10,
      trades,
      country: ['🇺🇸', '🇬🇧', '🇩🇪', '🇯🇵', '🇸🇬', '🇦🇺', '🇨🇦', '🇰🇷', '🇫🇷', '🇳🇱'][Math.floor(sr(seed * 37) * 10)],
      joinedDaysAgo: Math.floor(30 + sr(seed * 41) * 700),
    };
  });
}

// ── Fetch overrides from platform_settings ────────────────────────────────────
export async function getLeaderboardOverrides() {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();

    if (!data?.value) return { pins: {}, edits: {}, hidden: [], injected: [] };
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return {
      pins:     parsed.pins     ?? {},
      edits:    parsed.edits    ?? {},
      hidden:   parsed.hidden   ?? [],
      injected: parsed.injected ?? [],
    };
  } catch {
    return { pins: {}, edits: {}, hidden: [], injected: [] };
  }
}

// ── Save overrides ────────────────────────────────────────────────────────────
export async function saveLeaderboardOverrides(overrides) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key: SETTING_KEY,
      value: JSON.stringify(overrides),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

// ── Build final sorted leaderboard applying overrides ─────────────────────────
export function applyOverrides(mockUsers, overrides) {
  const { pins, edits, hidden, injected } = overrides;

  // 1. Start with mock users, apply edits, remove hidden
  let entries = mockUsers
    .filter(u => !hidden.includes(u.id))
    .map(u => {
      const e = edits[u.id];
      return e ? { ...u, ...e } : u;
    });

  // 2. Add injected entries (admin-created)
  injected.forEach(inj => {
    if (!hidden.includes(inj.id)) {
      entries.push({ ...inj, isMock: false, isInjected: true });
    }
  });

  // 3. Default sort by portfolio descending
  entries.sort((a, b) => b.portfolio - a.portfolio);

  // 4. Apply pins: move pinned entries to their target rank
  const pinnedIds = Object.keys(pins);
  if (pinnedIds.length > 0) {
    // Remove pinned entries from their current positions
    const pinned = pinnedIds.map(id => ({
      id,
      entry: entries.find(e => e.id === id),
      targetRank: Number(pins[id]),
    })).filter(p => p.entry);

    const unpinned = entries.filter(e => !pinnedIds.includes(e.id));

    // Re-insert pinned entries at their target positions (1-indexed)
    pinned.sort((a, b) => a.targetRank - b.targetRank);
    pinned.forEach(({ entry, targetRank }) => {
      const idx = Math.max(0, Math.min(targetRank - 1, unpinned.length));
      unpinned.splice(idx, 0, entry);
    });

    entries = unpinned;
  }

  // 5. Assign final ranks
  return entries.slice(0, 100).map((e, i) => ({ ...e, rank: i + 1 }));
}
