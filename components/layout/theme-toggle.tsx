"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "otl-theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
}

/**
 * Light/Dark/Auto switcher. "Auto" (the default) follows the OS via the
 * `prefers-color-scheme` media query in globals.css; picking Light or Dark
 * sets `data-theme` on <html> to override it, persisted to localStorage.
 * See the inline script in app/layout.tsx that applies the stored choice
 * before hydration, so there's no flash of the wrong theme on load.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      setPreference(stored);
    }
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — theme still applies for this load
    }
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-sidebar-active p-0.5" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          onClick={() => choose(option.value)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            preference === option.value ? "bg-accent text-accent-foreground" : "text-sidebar-muted hover:text-sidebar-fg"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
