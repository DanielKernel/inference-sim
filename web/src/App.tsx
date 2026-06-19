import { NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { LibraryPage } from "./pages/LibraryPage";

const libs: { kind: string; label: string }[] = [
  { kind: "models", label: "Models" },
  { kind: "hardware", label: "Hardware" },
  { kind: "frameworks", label: "Frameworks" },
  { kind: "scenarios", label: "Scenarios" },
  { kind: "optimizations", label: "Optimizations" },
  { kind: "perf_records", label: "Perf DB" },
];

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>BLIS Platform</h1>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
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
          <Route path="/library/:kind" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
