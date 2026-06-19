import { NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { LibraryPage } from "./pages/LibraryPage";
import { SimulationPage } from "./pages/SimulationPage";

const libs: { kind: string; label: string }[] = [
  { kind: "models", label: "模型库" },
  { kind: "hardware", label: "硬件库" },
  { kind: "frameworks", label: "框架库" },
  { kind: "scenarios", label: "场景库" },
  { kind: "optimizations", label: "优化手段库" },
  { kind: "perf_records", label: "性能数据库" },
];

export function App() {
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
          {libs.map((l) => (
            <NavLink key={l.kind} to={`/library/${l.kind}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulate" element={<SimulationPage />} />
          <Route path="/library/:kind" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
