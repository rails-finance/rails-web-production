"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-rb-100 dark:bg-rb-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rb-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-rb-400 dark:focus-visible:ring-offset-rb-900"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="group cursor-pointer p-2 rounded-lg bg-rb-100 dark:bg-rb-800 hover:bg-rb-200 dark:hover:bg-rb-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rb-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-rb-400 dark:focus-visible:ring-offset-rb-900"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 text-rb-500 group-hover:text-teal-500 transition-colors" aria-hidden="true" />
      ) : (
        <Sun className="w-5 h-5 text-rb-300 group-hover:text-teal-500 transition-colors" aria-hidden="true" />
      )}
    </button>
  );
}
