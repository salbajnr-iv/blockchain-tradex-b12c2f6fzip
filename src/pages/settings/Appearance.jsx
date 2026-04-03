import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";

const THEMES = [
  { id: "light", label: "Light", icon: Sun,     desc: "Clean white background" },
  { id: "dark",  label: "Dark",  icon: Moon,    desc: "Easy on the eyes" },
];

const ACCENT_COLORS = [
  { id: "green",  label: "Emerald",  value: "142 71% 45%", text: "text-emerald-500",  ring: "ring-emerald-500",  bg: "bg-emerald-500" },
  { id: "blue",   label: "Blue",     value: "217 91% 60%", text: "text-blue-500",     ring: "ring-blue-500",     bg: "bg-blue-500" },
  { id: "violet", label: "Violet",   value: "262 83% 68%", text: "text-violet-500",   ring: "ring-violet-500",   bg: "bg-violet-500" },
  { id: "orange", label: "Orange",   value: "25 95% 53%",  text: "text-orange-500",   ring: "ring-orange-500",   bg: "bg-orange-500" },
];

export default function AppearanceSettings() {
  const { theme, toggleTheme, isDark } = useTheme();

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
                  isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30 hover:bg-secondary/30"
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

      {/* Layout density */}
      <div className="bg-card border border-border/50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Display</h2>
        <div className="space-y-4">
          {[
            { label: "Compact numbers", desc: "Show $1.2M instead of $1,200,000", enabled: true },
            { label: "Animated charts", desc: "Enable motion animations on charts", enabled: true },
            { label: "Show percentage badges", desc: "Display 24h change badges on all prices", enabled: true },
          ].map(({ label, desc, enabled }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${enabled ? "bg-primary" : "bg-secondary"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform m-0.5 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
