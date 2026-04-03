import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle({ size = "sm" }) {
  const { isDark, toggleTheme } = useTheme();
  const isSmall = size === "sm";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative flex items-center justify-center rounded-lg border border-border/50 bg-secondary/50 transition-all hover:bg-secondary hover:border-primary/30 ${isSmall ? "w-8 h-8" : "w-10 h-10"}`}
    >
      {isDark ? (
        <Sun className={`${isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} text-yellow-400`} />
      ) : (
        <Moon className={`${isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} text-primary`} />
      )}
    </button>
  );
}
