import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Check } from "lucide-react";

const THEMES = [
  { id: "light", label: "Light", icon: Sun,  desc: "Clean white background" },
  { id: "dark",  label: "Dark",  icon: Moon, desc: "Easy on the eyes" },
];

const ACCENT_COLORS = [
  { id: "green",  label: "Emerald", bg: "bg-emerald-500" },
  { id: "blue",   label: "Blue",    bg: "bg-blue-500" },
  { id: "violet", label: "Violet",  bg: "bg-violet-500" },
  { id: "orange", label: "Orange",  bg: "bg-orange-500" },
];

const DISPLAY_OPTIONS = [
  { key: "compactNumbers",    label: "Compact numbers",       desc: "Show $1.2M instead of $1,200,000" },
  { key: "animatedCharts",    label: "Animated charts",       desc: "Enable motion animations on charts" },
  { key: "percentageBadges",  label: "Show percentage badges", desc: "Display 24h change badges on all prices" },
];

export default function AppearanceSettings() {
  const { theme, toggleTheme, accentColor, setAccentColor, displayPrefs, setDisplayPref } = useTheme();

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map(({ id, label, icon: Icon, desc }) => {
            const isSelected = theme === id;
            return (
              <button
                key={id}
                onClick={() => { if (theme !== id) toggleTheme(); }}
                className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-primary/30 hover:bg-secondary/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-secondary"}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent colour */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Accent Colour</h2>
        <p className="text-xs text-muted-foreground mb-4">Changes the primary colour used across buttons, highlights, and charts</p>
        <div className="flex items-center gap-3 flex-wrap">
          {ACCENT_COLORS.map(({ id, label, bg }) => {
            const isSelected = accentColor === id;
            return (
              <button
                key={id}
                onClick={() => setAccentColor(id)}
                title={label}
                className={`relative w-10 h-10 rounded-full ${bg} transition-all focus:outline-none ${
                  isSelected ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "hover:scale-105 opacity-70 hover:opacity-100"
                }`}
                style={isSelected ? { ringColor: `var(--primary)` } : {}}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white drop-shadow" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Current: <span className="text-foreground font-medium capitalize">{accentColor}</span>
        </p>
      </div>

      {/* Display preferences */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Display</h2>
        <p className="text-xs text-muted-foreground mb-4">Preferences are saved locally and apply to this browser</p>
        <div className="space-y-4">
          {DISPLAY_OPTIONS.map(({ key, label, desc }) => {
            const enabled = displayPrefs[key] ?? true;
            return (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <button
                  onClick={() => setDisplayPref(key, !enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
                    enabled ? "bg-primary" : "bg-secondary border border-border/50"
                  }`}
                  aria-label={`Toggle ${label}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
