"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  // The server always renders the light state. Reading the user's stored or
  // system theme on the first client render would mismatch that HTML and trip
  // React's hydration error, so the icon/label stay server-identical until the
  // component has mounted.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`group inline-flex items-center justify-center w-9 h-9 rounded-xl border border-line bg-surface-2 text-ink-2 hover:text-ink hover:border-ink-3 hover:scale-105 transition-all ${className}`}
    >
      <span
        key={theme}
        className="block animate-fade-up transition-transform group-hover:rotate-12 duration-300"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </span>
    </button>
  );
}
