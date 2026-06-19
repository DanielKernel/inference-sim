import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { LibraryPage } from "./pages/LibraryPage";
import { PerfDatabasePage } from "./pages/PerfDatabasePage";
import { SimulationPage } from "./pages/SimulationPage";

const libs: { kind: string; label: string }[] = [
  { kind: "models", label: "模型库" },
  { kind: "hardware", label: "硬件库" },
  { kind: "frameworks", label: "框架库" },
  { kind: "scenarios", label: "场景库" },
  { kind: "optimizations", label: "优化手段库" },
];

type ThemeMode = "system" | "light" | "dark";

export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem("theme-mode");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const activeTheme = useMemo(
    () => (themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode),
    [themeMode, systemDark]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    window.localStorage.setItem("theme-mode", themeMode);
  }, [activeTheme, themeMode]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <h1>推理性能平台</h1>
            <p>模型 · 硬件 · 框架 · 场景</p>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            总览
          </NavLink>
          <NavLink to="/simulate">配置与仿真</NavLink>
          <NavLink to="/perfdb">性能数据库</NavLink>
          {libs.map((l) => (
            <NavLink key={l.kind} to={`/library/${l.kind}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow">设计升级</div>
            <strong>跟随系统主题 + 可手动切换</strong>
          </div>
          <div className="theme-switcher" role="group" aria-label="主题切换">
            {([
              ["system", "跟随系统"],
              ["light", "浅色"],
              ["dark", "深色"],
            ] as Array<[ThemeMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`theme-pill ${themeMode === mode ? "active" : ""}`}
                onClick={() => setThemeMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulate" element={<SimulationPage />} />
          <Route path="/perfdb" element={<PerfDatabasePage />} />
          <Route path="/library/perf_records" element={<PerfDatabasePage />} />
          <Route path="/library/:kind" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
