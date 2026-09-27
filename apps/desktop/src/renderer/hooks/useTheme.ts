import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("dt-theme") as Theme) || "light");

  useEffect(() => {
    localStorage.setItem("dt-theme", theme);
    apply(theme);
  }, [theme]);

  return { theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
