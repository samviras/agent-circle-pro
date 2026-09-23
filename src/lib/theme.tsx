import { useEffect, useState } from "react";

const KEY = "agentnet-theme";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, next);
      document.documentElement.classList.toggle("light", next === "light");
      return next;
    });
  };

  return { theme, toggle };
}
