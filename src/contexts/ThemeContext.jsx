import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const ACCENT_PRESETS = {
  green:  "142 71% 45%",
  blue:   "217 91% 60%",
  violet: "262 83% 68%",
  orange: "25 95% 53%",
};

function applyAccent(value) {
  document.documentElement.style.setProperty("--primary", value);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("bt-theme") || "dark"; } catch { return "dark"; }
  });

  const [accentColor, setAccentColorState] = useState(() => {
    try { return localStorage.getItem("bt-accent") || "green"; } catch { return "green"; }
  });

  const [displayPrefs, setDisplayPrefsState] = useState(() => {
    try {
      const stored = localStorage.getItem("bt-display-prefs");
      return stored ? JSON.parse(stored) : { compactNumbers: true, animatedCharts: true, percentageBadges: true };
    } catch {
      return { compactNumbers: true, animatedCharts: true, percentageBadges: true };
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") { root.classList.add("dark"); } else { root.classList.remove("dark"); }
    try { localStorage.setItem("bt-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const value = ACCENT_PRESETS[accentColor] || ACCENT_PRESETS.green;
    applyAccent(value);
    try { localStorage.setItem("bt-accent", accentColor); } catch {}
  }, [accentColor]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const setAccentColor = (id) => {
    if (ACCENT_PRESETS[id]) setAccentColorState(id);
  };

  const setDisplayPref = (key, value) => {
    setDisplayPrefsState((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("bt-display-prefs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, isDark: theme === "dark",
      accentColor, setAccentColor, accentPresets: ACCENT_PRESETS,
      displayPrefs, setDisplayPref,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
