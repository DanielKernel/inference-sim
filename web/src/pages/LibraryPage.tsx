import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type Row = Record<string, unknown>;
type PerfRow = {
  model: string;
  hardware: string;
  framework: string;
  framework_version: string;
  source_authority: string;
  metric_coverage: string;
  derived_metrics: string[];
  input_tokens: number;
  output_tokens: number;
  batch_size: number;
  concurrency: number;
  metrics: {
    ttft_ms: number;
    itl_ms: number;
    e2e_ms: number;
    throughput_tok_s: number;
  };
  test_conditions: string;
  source: {
    title: string;
    url: string;
    kind: string;
  };
  date: string;
};

// scalarColumns picks displayable (string/number/boolean) top-level fields so the
// generic table stays readable. Nested objects/arrays are summarized in Phase 1.
function scalarColumns(rows: Row[]): string[] {
  const cols: string[] = [];
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      const t = typeof v;
      if ((t === "string" || t === "number" || t === "boolean") && !cols.includes(k)) {
        cols.push(k);
      }
    }
  }
  return cols.slice(0, 8);
}

function columnLabel(col: string): string {
  switch (col) {
    case "name":
      return "名称";
    case "display_name":
      return "显示名称";
    case "developer":
      return "开发者";
    case "vendor":
      return "厂商";
    case "category":
      return "类别";
    case "params_b":
      return "参数量(B)";
    case "latest_version":
      return "最新版本";
    case "device_type":
      return "设备类型";
    case "chip_type":
      return "芯片类型";
    case "year":
      return "年份";
    case "fp16_tflops":
      return "FP16 算力";
    case "memory_bandwidth_tbs":
      return "带宽(TB/s)";
    case "source_authority":
      return "数据权威性";
    case "metric_coverage":
      return "指标覆盖说明";
    case "framework_version":
      return "框架版本";
    default:
      return col;
  }
}

function searchBlob(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  if (Array.isArray(value)) {
    return value.map(searchBlob).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(searchBlob).join(" ");
  }
  return "";
}

function displayValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(displayValue).join(" / ");
  }
  return JSON.stringify(value);
}

function renderDetailValue(key: string, value: unknown) {
  if (key === "metrics" && value && typeof value === "object") {
    const metrics = value as Record<string, unknown>;
    return (
      <strong className="metric-inline-list">
        <span>TTFT: {displayValue(metrics.ttft_ms)} ms</span>
        <span>ITL: {displayValue(metrics.itl_ms)} ms</span>
        <span>E2E: {displayValue(metrics.e2e_ms)} ms</span>
        <span>吞吐: {displayValue(metrics.throughput_tok_s)} tok/s</span>
      </strong>
    );
  }
  if (key === "source" && value && typeof value === "object") {
    const source = value as { title?: string; url?: string };
    return (
      <strong>
        {source.title ?? "来源"}
        {source.url ? (
          <>
            <br />
            <a href={source.url} target="_blank" rel="noreferrer">
              打开来源链接
            </a>
          </>
        ) : null}
      </strong>
    );
  }
  if (key === "derived_metrics" && Array.isArray(value)) {
    return (
      <strong className="tag-row">
        {value.map((item) => (
          <span className="tag" key={String(item)}>
            {String(item)}
          </span>
        ))}
      </strong>
    );
  }
  return <strong>{displayValue(value)}</strong>;
}

function filterLabel(kind: string, key: string): string {
  if (key === "category") {
    return kind === "models"
      ? "模型类别"
      : kind === "scenarios"
        ? "场景类别"
        : kind === "optimizations"
          ? "优化类别"
          : "类别";
  }
  if (key === "vendor") return "厂商";
  if (key === "developer") return "开发者";
  if (key === "device_type") return "设备类型";
  return "筛选项";
}

function preferredFilterKey(kind: string, rows: Row[]): string | null {
  const candidates = ["category", "vendor", "developer", "device_type"];
  for (const key of candidates) {
    if (rows.some((row) => typeof row[key] === "string" && String(row[key]).length > 0)) {
      return key;
    }
  }
  return kind === "perf_records" ? "framework" : null;
}

export function LibraryPage() {
  const { kind = "" } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("全部");
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  useEffect(() => {
    setError(null);
    setRows([]);
    setQuery("");
    setFilterValue("全部");
    setSelectedRow(null);
    api
      .library<Row>(kind)
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, [kind]);

  if (error) return <p>加载库数据失败：{error}</p>;

  const cols = scalarColumns(rows);
  const filterKey = preferredFilterKey(kind, rows);
  const filterOptions = filterKey
    ? ["全部", ...new Set(rows.map((row) => String(row[filterKey] ?? "")).filter(Boolean))]
    : ["全部"];
  const filteredRows = rows.filter((row) => {
    const matchesQuery = query.trim()
      ? searchBlob(row).includes(query.trim().toLowerCase())
      : true;
    const matchesFilter = filterKey && filterValue !== "全部"
      ? String(row[filterKey] ?? "") === filterValue
      : true;
    return matchesQuery && matchesFilter;
  });
  const heroTitle =
    kind === "models"
      ? "模型库"
      : kind === "hardware"
      ? "硬件库"
      : kind === "frameworks"
        ? "框架库"
        : kind === "scenarios"
          ? "场景库"
          : kind === "optimizations"
            ? "优化手段库"
            : "性能数据库";

  return (
    <div className="page-stack">
      <section className="hero-panel">
      <div>
        <div className="eyebrow">参考库查询</div>
        <h2>{heroTitle}</h2>
        <p>支持关键字检索、分类筛选、结果浏览与明细查看。</p>
      </div>
      <div className="hero-stats">
        <div className="mini-stat">
          <strong>{rows.length}</strong>
          <span>总记录数</span>
        </div>
        <div className="mini-stat">
          <strong>{filteredRows.length}</strong>
          <span>当前命中</span>
        </div>
      </div>
      </section>

      <section className="toolbar-panel">
      <label className="toolbar-field">
        <span>关键字查询</span>
        <input
          placeholder="输入名称、厂商、类别、版本、说明等关键字"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {filterKey && (
        <label className="toolbar-field">
          <span>{filterLabel(kind, filterKey)}</span>
          <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}
      </section>

      <section className="library-layout">
      {kind === "perf_records" ? (
        <PerfDatabaseView
          rows={filteredRows as PerfRow[]}
          selectedRow={selectedRow as PerfRow | null}
          setSelectedRow={(row) => setSelectedRow(row as Row)}
        />
      ) : (
        <>
      <div className="table-panel">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{columnLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr
                key={i}
                className={selectedRow === row ? "table-row-active" : ""}
                onClick={() => setSelectedRow(row)}
              >
                {cols.map((c) => (
                  <td key={c}>{displayValue(row[c])}</td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={Math.max(cols.length, 1)}>
                  <div className="empty-state">没有匹配当前查询条件的结果。</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <aside className="detail-panel">
        <h3>记录详情</h3>
        {kind === "perf_records" && selectedRow && (
          <div className="perfdb-summary">
            <span className="badge official">{String(selectedRow.source_authority ?? "数据记录")}</span>
            <p>{String(selectedRow.metric_coverage ?? "")}</p>
          </div>
        )}
        {selectedRow ? (
          <div className="detail-list">
            {Object.entries(selectedRow).map(([key, value]) => (
              <div className="detail-item" key={key}>
                <span>{columnLabel(key)}</span>
                {renderDetailValue(key, value)}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">点击左侧任意一行，查看该条记录的详细信息。</div>
        )}
      </aside>
        </>
      )}
      </section>
    </div>
  );
}

function PerfDatabaseView({
  rows,
  selectedRow,
  setSelectedRow,
}: {
  rows: PerfRow[];
  selectedRow: PerfRow | null;
  setSelectedRow: (row: PerfRow) => void;
}) {
  const bestThroughput = rows.reduce((best, row) => Math.max(best, row.metrics.throughput_tok_s), 0);
  const bestTTFT = rows.reduce((best, row) => (best === 0 ? row.metrics.ttft_ms : Math.min(best, row.metrics.ttft_ms)), 0);
  const officialCount = rows.filter((row) => row.source_authority.includes("官方")).length;
  const [sortBy, setSortBy] = useState<"ttft" | "throughput" | "input">("throughput");
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const sortedRows = [...rows].sort((a, b) => {
    if (sortBy === "ttft") return a.metrics.ttft_ms - b.metrics.ttft_ms;
    if (sortBy === "input") return a.input_tokens - b.input_tokens;
    return b.metrics.throughput_tok_s - a.metrics.throughput_tok_s;
  });
  const selectedCompareRows = sortedRows.filter((row, index) =>
    compareKeys.includes(`${row.model}-${row.framework_version}-${index}`)
  );
  const compareChartData = selectedCompareRows.map((row) => ({
    name: `${row.model}-${row.framework_version}`,
    TTFT: row.metrics.ttft_ms,
    吞吐: row.metrics.throughput_tok_s,
  }));

  function toggleCompare(rowKey: string) {
    setCompareKeys((prev) => {
      if (prev.includes(rowKey)) {
        return prev.filter((item) => item !== rowKey);
      }
      if (prev.length >= 2) {
        return [prev[1], rowKey];
      }
      return [...prev, rowKey];
    });
  }

  return (
    <>
      <div className="perfdb-main">
        <div className="perfdb-cards">
          <div className="metric-card accent-green">
            <div className="num">{officialCount}</div>
            <div>官方数据条目</div>
          </div>
          <div className="metric-card accent-blue">
            <div className="num">{bestThroughput.toFixed(2)}</div>
            <div>最高吞吐（tok/s）</div>
          </div>
          <div className="metric-card accent-purple">
            <div className="num">{bestTTFT.toFixed(0)}</div>
            <div>最低 TTFT（ms）</div>
          </div>
        </div>

        <div className="toolbar-panel">
          <label className="toolbar-field">
            <span>结果排序</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "ttft" | "throughput" | "input")}>
              <option value="throughput">按吞吐从高到低</option>
              <option value="ttft">按 TTFT 从低到高</option>
              <option value="input">按输入 Token 从低到高</option>
            </select>
          </label>
          <div className="compare-hint">
            选择最多两条 benchmark，查看官方性能结果图形化对比。
          </div>
        </div>

        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>对比</th>
                <th>模型</th>
                <th>硬件</th>
                <th>框架版本</th>
                <th>输入</th>
                <th>并发</th>
                <th>TTFT(ms)</th>
                <th>吞吐(tok/s)</th>
                <th>数据属性</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => {
                const rowKey = `${row.model}-${row.framework_version}-${index}`;
                return (
                <tr
                  key={rowKey}
                  className={selectedRow === row ? "table-row-active" : ""}
                  onClick={() => setSelectedRow(row)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={compareKeys.includes(rowKey)}
                      onChange={() => toggleCompare(rowKey)}
                    />
                  </td>
                  <td>{row.model}</td>
                  <td>{row.hardware}</td>
                  <td>{row.framework_version}</td>
                  <td>{row.input_tokens}</td>
                  <td>{row.concurrency}</td>
                  <td>{row.metrics.ttft_ms}</td>
                  <td>{row.metrics.throughput_tok_s}</td>
                  <td>
                    <span className="badge official">{row.source_authority}</span>
                  </td>
                </tr>
              )})}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">没有匹配当前查询条件的性能结果。</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedCompareRows.length > 0 && (
          <div className="chart-panel">
            <div className="chart-header">
              <h3>性能结果对比图</h3>
              <span>对比官方 benchmark 的 TTFT 与吞吐差异</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={compareChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
                  <XAxis dataKey="name" stroke="currentColor" />
                  <YAxis stroke="currentColor" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="TTFT" fill="#4c6bff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="吞吐" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <aside className="detail-panel">
        <h3>性能结果详情</h3>
        {selectedRow ? (
          <>
            <div className="perfdb-summary">
              <span className="badge official">{selectedRow.source_authority}</span>
              <p>{selectedRow.metric_coverage}</p>
            </div>
            <div className="detail-list">
              <div className="detail-item">
                <span>组合</span>
                <strong>
                  {selectedRow.model} / {selectedRow.hardware} / {selectedRow.framework_version}
                </strong>
              </div>
              <div className="detail-item">
                <span>性能结果</span>
                {renderDetailValue("metrics", selectedRow.metrics)}
              </div>
              <div className="detail-item">
                <span>测试条件</span>
                <strong>{selectedRow.test_conditions}</strong>
              </div>
              <div className="detail-item">
                <span>推导指标</span>
                {renderDetailValue("derived_metrics", selectedRow.derived_metrics)}
              </div>
              <div className="detail-item">
                <span>官方来源</span>
                {renderDetailValue("source", selectedRow.source)}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">点击左侧性能结果，查看其指标、条件与来源说明。</div>
        )}
      </aside>
    </>
  );
}
