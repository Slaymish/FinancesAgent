"use client";

import { useEffect, useState } from "react";
import { useTheme } from "../theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <span className="icon-button__glyph" aria-hidden>
        {mounted ? (isDark ? "☾" : "☀") : "☀"}
      </span>
      <span className="icon-button__label">{mounted ? (isDark ? "Dark" : "Light") : "Theme"}</span>
    </button>
  );
}
