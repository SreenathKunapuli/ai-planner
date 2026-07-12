import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

// Initial value comes from the <head> script (data-theme already set), so no flash.
const current = () => document.documentElement.getAttribute("data-theme") || "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("planner-theme", theme);
    } catch {
      /* ignore storage errors */
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle light or dark theme"
      title="Toggle theme"
      className="grid place-items-center h-8 w-8 rounded-lg border-[0.5px] border-line bg-surface text-dim hover:bg-sunken transition"
    >
      {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}
