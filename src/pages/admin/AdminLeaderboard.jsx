import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Trophy, Pin, Pencil, Trash2, Plus, Save, X, RotateCcw,
  EyeOff, Eye, Users, Crown, Search, AlertTriangle, ChevronUp, ChevronDown,
} from "lucide-react";
import { generateMockUsers, getLeaderboardOverrides, saveLeaderboardOverrides, applyOverrides } from "@/lib/api/leaderboard";
import { fmtUsd } from "@/lib/formatters";

const AVATARS = ['🐯','🦊','🐺','🦁','🐻','🦅','🐉','🦄','🦋','🐧','🦜','🐸','🦩','🦒','🐳','🦈','🐙','🌟','⚡','🔥','💎','🌊','🎯'];

// ── Inline stat editor ─────────────────────────────────────────────────────────
function EditModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState({
    displayName: entry.displayName ?? "",
    name:        entry.name        ?? "",
    avatar:      entry.avatar      ?? "🐯",
    portfolio:   entry.portfolio   ?? 0,
    totalProfit: entry.totalProfit ?? 0,
    winRate:     entry.winRate     ?? 50,
    trades:      entry.trades      ?? 100,
    badge:       entry.badge       ?? "",
    country:     entry.country     ?? "🇺🇸",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground">Edit Entry</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Avatar picker */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(av => (
                <button
                  key={av}
                  onClick={() => set("avatar", av)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${form.avatar === av ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/80"}`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {[
            { k: "displayName", label: "Display Name", type: "text" },
            { k: "name",        label: "Username",     type: "text" },
            { k: "badge",       label: "Badge (emoji + label, optional)", type: "text" },
            { k: "country",     label: "Country Flag (emoji)", type: "text" },
          ].map(({ k, label, type }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
              <input
                type={type}
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
          ))}

          {[
            { k: "portfolio",   label: "Portfolio Value ($)", step: 1000 },
            { k: "totalProfit", label: "Total Profit ($)",    step: 500 },
            { k: "winRate",     label: "Win Rate (%)",        step: 0.1, min: 0, max: 100 },
            { k: "trades",      label: "Total Trades",        step: 1 },
          ].map(({ k, label, step, min, max }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
              <input
                type="number"
                value={form[k]}
                step={step}
                min={min}
                max={max}
                onChange={e => set(k, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50 font-mono"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border/50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Inject new user form ───────────────────────────────────────────────────────
function InjectModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    displayName: "",
    name:        "",
    avatar:      "🌟",
    portfolio:   500_000,
    totalProfit: 80_000,
    winRate:     65,
    trades:      1200,
    badge:       "⭐ VIP",
    country:     "🇺🇸",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground">Inject New Entry</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(av => (
                <button
                  key={av}
                  onClick={() => set("avatar", av)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${form.avatar === av ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/80"}`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {[
            { k: "displayName", label: "Display Name", type: "text", placeholder: "CryptoKing" },
            { k: "name",        label: "Username",     type: "text", placeholder: "CryptoKing2024" },
            { k: "badge",       label: "Badge",        type: "text", placeholder: "⭐ VIP" },
            { k: "country",     label: "Country Flag", type: "text", placeholder: "🇺🇸" },
          ].map(({ k, label, type, placeholder }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
              <input
                type={type}
                value={form[k]}
                placeholder={placeholder}
                onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
          ))}

          {[
            { k: "portfolio",   label: "Portfolio Value ($)", step: 1000 },
            { k: "totalProfit", label: "Total Profit ($)",    step: 500 },
            { k: "winRate",     label: "Win Rate (%)",        step: 0.1, min: 0, max: 100 },
            { k: "trades",      label: "Total Trades",        step: 1 },
          ].map(({ k, label, step, min, max }) => (
            <div key={k}>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
              <input
                type="number"
                value={form[k]}
                step={step}
                min={min}
                max={max}
                onChange={e => set(k, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50 font-mono"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border/50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (!form.displayName.trim()) return toast.error("Display name required"); onSave(form); }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add to Board
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Pin position input ─────────────────────────────────────────────────────────
function PinInput({ entry, currentPin, onPin, onUnpin }) {
  const [val, setVal] = useState(currentPin ?? entry.rank);
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={100}
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        className="w-14 px-1.5 py-1 text-xs bg-secondary/60 border border-border rounded-lg text-center font-mono focus:outline-none focus:border-primary/50"
      />
      <button
        onClick={() => onPin(entry.id, val)}
        className="p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        title="Pin to position"
      >
        <Pin className="w-3 h-3" />
      </button>
      {currentPin != null && (
        <button
          onClick={() => onUnpin(entry.id)}
          className="p-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          title="Unpin"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main admin page ────────────────────────────────────────────────────────────
export default function AdminLeaderboard() {
  const qc = useQueryClient();
  const [editEntry, setEditEntry]   = useState(null);
  const [showInject, setShowInject] = useState(false);
  const [search, setSearch]         = useState("");

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["leaderboard_overrides"],
    queryFn: getLeaderboardOverrides,
  });

  const saveMutation = useMutation({
    mutationFn: saveLeaderboardOverrides,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaderboard_overrides"] });
      toast.success("Leaderboard updated");
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const board = useMemo(() => {
    if (!overrides) return [];
    return applyOverrides(generateMockUsers(), overrides);
  }, [overrides]);

  const filtered = useMemo(() =>
    search.trim()
      ? board.filter(e =>
          e.name?.toLowerCase().includes(search.toLowerCase()) ||
          e.displayName?.toLowerCase().includes(search.toLowerCase())
        )
      : board,
    [board, search]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const ov = overrides ?? { pins: {}, edits: {}, hidden: [], injected: [] };

  const update = (patch) => {
    const next = { ...ov, ...patch };
    saveMutation.mutate(next);
  };

  const handlePin = (id, rank) => {
    update({ pins: { ...ov.pins, [id]: rank } });
  };

  const handleUnpin = (id) => {
    const { [id]: _, ...rest } = ov.pins;
    update({ pins: rest });
  };

  const handleToggleHide = (id) => {
    const hidden = ov.hidden.includes(id)
      ? ov.hidden.filter(h => h !== id)
      : [...ov.hidden, id];
    update({ hidden });
  };

  const handleEdit = (entry) => setEditEntry(entry);

  const handleSaveEdit = (form) => {
    const edits = { ...ov.edits, [editEntry.id]: form };
    update({ edits });
    setEditEntry(null);
  };

  const handleInject = (form) => {
    const id = `injected_${Date.now()}`;
    const newEntry = { id, ...form };
    update({ injected: [...ov.injected, newEntry] });
    setShowInject(false);
  };

  const handleRemoveInjected = (id) => {
    update({ injected: ov.injected.filter(e => e.id !== id) });
    const { [id]: _, ...edits } = ov.edits;
    const pins = { ...ov.pins };
    delete pins[id];
    // also clean up edits/pins for removed entry
    saveMutation.mutate({ ...ov, injected: ov.injected.filter(e => e.id !== id), edits, pins });
  };

  const handleReset = () => {
    if (!confirm("Reset all overrides? This cannot be undone.")) return;
    saveMutation.mutate({ pins: {}, edits: {}, hidden: [], injected: [] });
  };

  const pinnedCount  = Object.keys(ov.pins).length;
  const hiddenCount  = ov.hidden.length;
  const editedCount  = Object.keys(ov.edits).length;
  const injectedCount = ov.injected.length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Leaderboard Control</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pin positions, edit stats, inject entries, or hide users from the public board.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowInject(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Inject Entry
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 text-sm font-semibold hover:bg-red-500/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset All
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pinned",   value: pinnedCount,   icon: Pin,   color: "text-blue-500",   bg: "bg-blue-500/10" },
          { label: "Hidden",   value: hiddenCount,   icon: EyeOff, color: "text-red-500",   bg: "bg-red-500/10" },
          { label: "Edited",   value: editedCount,   icon: Pencil, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Injected", value: injectedCount, icon: Plus,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label} entries</p>
          </div>
        ))}
      </div>

      {/* Active overrides notice */}
      {(pinnedCount + hiddenCount + editedCount + injectedCount) > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Active overrides are live. The public leaderboard reflects your changes in real time.</span>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or username…"
              className="bg-transparent text-sm outline-none flex-1 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{filtered.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider w-12">Rank</th>
                <th className="text-left px-3 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Trader</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider hidden md:table-cell">Portfolio</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider hidden sm:table-cell">Profit</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider hidden lg:table-cell">Win %</th>
                <th className="text-center px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Pin Position</th>
                <th className="text-center px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((entry) => {
                const isPinned  = ov.pins[entry.id] != null;
                const isHidden  = ov.hidden.includes(entry.id);
                const isEdited  = ov.edits[entry.id] != null;

                return (
                  <tr
                    key={entry.id}
                    className={`transition-colors ${
                      isHidden  ? "opacity-40 bg-red-50 dark:bg-red-950/20" :
                      isPinned  ? "bg-blue-50 dark:bg-blue-950/20" :
                      entry.isInjected ? "bg-emerald-50 dark:bg-emerald-950/20" :
                      "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums">#{entry.rank}</span>
                        {isPinned  && <Pin className="w-3 h-3 text-blue-500" title="Pinned" />}
                        {isEdited  && <Pencil className="w-3 h-3 text-amber-500" title="Edited" />}
                        {entry.isInjected && <Plus className="w-3 h-3 text-emerald-500" title="Injected" />}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{entry.avatar}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{entry.displayName}</p>
                          <p className="text-xs text-gray-500 truncate">{entry.country} {entry.name}</p>
                          {entry.badge && <span className="text-[10px] text-gray-400">{entry.badge}</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-semibold text-sm tabular-nums text-gray-900 dark:text-white">{fmtUsd(entry.portfolio, true)}</span>
                    </td>

                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-sm font-semibold text-emerald-500 tabular-nums">+{fmtUsd(entry.totalProfit, true)}</span>
                    </td>

                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{entry.winRate}%</span>
                    </td>

                    {/* Pin control */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <PinInput
                          entry={entry}
                          currentPin={ov.pins[entry.id]}
                          onPin={handlePin}
                          onUnpin={handleUnpin}
                        />
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
                          title="Edit stats"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleHide(entry.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHidden
                              ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          }`}
                          title={isHidden ? "Show" : "Hide from board"}
                        >
                          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        {entry.isInjected && (
                          <button
                            onClick={() => handleRemoveInjected(entry.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            title="Remove injected entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {editEntry  && <EditModal   entry={editEntry}  onSave={handleSaveEdit} onClose={() => setEditEntry(null)} />}
      {showInject && <InjectModal onSave={handleInject} onClose={() => setShowInject(false)} />}
    </div>
  );
}
