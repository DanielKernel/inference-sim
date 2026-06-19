import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, SimulateRequest, SimulationResponse } from "../api/client";

type PerfRow = {
  model: string;
  hardware: string;
  framework: string;
  framework_version: string;
  driver: string;
  source_authority: string;
  metric_coverage: string;
  derived_metrics: string[];
  input_tokens: number;
  output_tokens: number;
  batch_size: number;
  concurrency: number;
  quantization: string;
  kv_quantization: string;
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

function comparePayloadFromPerfRow(row: PerfRow): SimulateRequest {
  const runtimeVersion = row.framework_version.split("（")[0] || row.framework_version;
  const quantMode = row.quantization === "w8a8" ? "w8a8" : row.kv_quantization === "int8" ? "kv_int8" : "fp16";
  const commMode = row.driver.includes("flashcomm") ? "flashcomm_v1" : "hccs_native";
  return {
    model: row.model,
    hardware: row.hardware,
    framework: row.framework,
    scenario: "",
    runtime_version: runtimeVersion,
    cann_version: row.driver.includes("9.0.0") ? "9.0.0" : "8.5.0",
    graph_mode: row.driver.includes("dbo") ? "hybrid" : "eager",
    quant_mode: quantMode,
    comm_mode: commMode,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    auto_optimize: true,
    selected_optimizations: [],
  };
}

export function PerfDatabasePage() {
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"ttft" | "throughput" | "input">("throughput");
  const [selectedRow, setSelectedRow] = useState<PerfRow | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [benchmarkComparison, setBenchmarkComparison] = useState<SimulationResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .library<PerfRow>("perf_records")
      .then((data) => {
        setRows(data);
        setSelectedRow(data[0] ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const filteredRows = rows.filter((row) =>
    query.trim() ? searchBlob(row).includes(query.trim().toLowerCase()) : true
  );
  const sortedRows = [...filteredRows].sort((a, b) => {
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
      if (prev.includes(rowKey)) return prev.filter((item) => item !== rowKey);
      if (prev.length >= 2) return [prev[1], rowKey];
      return [...prev, rowKey];
    });
  }

  async function compareWithSimulation(row: PerfRow) {
    setCompareLoading(true);
    setCompareError(null);
    setBenchmarkComparison(null);
    try {
      const resp = await api.simulate(comparePayloadFromPerfRow(row));
      setBenchmarkComparison(resp);
    } catch (e) {
      setCompareError(String(e));
    } finally {
      setCompareLoading(false);
    }
  }

  const bestThroughput = filteredRows.reduce((best, row) => Math.max(best, row.metrics.throughput_tok_s), 0);
  const bestTTFT = filteredRows.reduce((best, row) => (best === 0 ? row.metrics.ttft_ms : Math.min(best, row.metrics.ttft_ms)), 0);
  const officialCount = filteredRows.filter((row) => row.source_authority.includes("官方")).length;

  if (error) return <p>加载性能数据库失败：{error}</p>;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">官方性能结果数据库</div>
          <h2>性能数据库</h2>
          <p>聚焦官方公开 benchmark，支持排序、筛选、图表对比，以及与当前仿真结果做偏差分析。</p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{officialCount}</strong>
            <span>官方数据条目</span>
          </div>
          <div className="mini-stat">
            <strong>{bestThroughput.toFixed(2)}</strong>
            <span>最高吞吐（tok/s）</span>
          </div>
          <div className="mini-stat">
            <strong>{bestTTFT.toFixed(0)}</strong>
            <span>最低 TTFT（ms）</span>
          </div>
        </div>
      </section>

      <section className="toolbar-panel">
        <label className="toolbar-field">
          <span>关键字查询</span>
          <input
            placeholder="输入模型、硬件、框架版本、来源说明等关键字"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="toolbar-field">
          <span>结果排序</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "ttft" | "throughput" | "input")}>
            <option value="throughput">按吞吐从高到低</option>
            <option value="ttft">按 TTFT 从低到高</option>
            <option value="input">按输入 Token 从低到高</option>
          </select>
        </label>
        <div className="compare-hint">支持勾选最多两条 benchmark 做图形化对比，也可将单条 benchmark 与当前仿真结果做对照。</div>
      </section>

      <section className="library-layout">
        <div className="perfdb-main">
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
                        <input type="checkbox" checked={compareKeys.includes(rowKey)} onChange={() => toggleCompare(rowKey)} />
                      </td>
                      <td>{row.model}</td>
                      <td>{row.hardware}</td>
                      <td>{row.framework_version}</td>
                      <td>{row.input_tokens}</td>
                      <td>{row.concurrency}</td>
                      <td>{row.metrics.ttft_ms}</td>
                      <td>{row.metrics.throughput_tok_s}</td>
                      <td><span className="badge official">{row.source_authority}</span></td>
                    </tr>
                  );
                })}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={9}><div className="empty-state">没有匹配当前查询条件的性能结果。</div></td>
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
                  <strong>{selectedRow.model} / {selectedRow.hardware} / {selectedRow.framework_version}</strong>
                </div>
                <div className="detail-item">
                  <span>性能结果</span>
                  <strong className="metric-inline-list">
                    <span>TTFT: {selectedRow.metrics.ttft_ms} ms</span>
                    <span>ITL: {selectedRow.metrics.itl_ms} ms</span>
                    <span>E2E: {selectedRow.metrics.e2e_ms} ms</span>
                    <span>吞吐: {selectedRow.metrics.throughput_tok_s} tok/s</span>
                  </strong>
                </div>
                <div className="detail-item">
                  <span>测试条件</span>
                  <strong>{selectedRow.test_conditions}</strong>
                </div>
                <div className="detail-item">
                  <span>推导指标</span>
                  <strong className="tag-row">
                    {selectedRow.derived_metrics.map((item) => (
                      <span className="tag" key={item}>{item}</span>
                    ))}
                  </strong>
                </div>
                <div className="detail-item">
                  <span>官方来源</span>
                  <strong>
                    {selectedRow.source.title}
                    <br />
                    <a href={selectedRow.source.url} target="_blank" rel="noreferrer">打开来源链接</a>
                  </strong>
                </div>
              </div>
              <div className="compare-actions">
                <button className="primary-btn" type="button" onClick={() => compareWithSimulation(selectedRow)} disabled={compareLoading}>
                  {compareLoading ? "正在执行对照仿真…" : "与当前仿真模型对照"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">点击左侧性能结果，查看其指标、条件与来源说明。</div>
          )}
        </aside>

        {selectedRow && benchmarkComparison && (
          <section className="chart-panel library-full-span">
            <div className="chart-header">
              <h3>官方 Benchmark vs 当前仿真结果</h3>
              <span>将选中的官方公开数据与最差 / 典型 / 最佳仿真结果放在同一视图对比</span>
            </div>
            <BenchmarkSimulationCompare benchmark={selectedRow} simulation={benchmarkComparison} />
          </section>
        )}
        {selectedRow && compareError && (
          <section className="error-panel library-full-span">对照仿真失败：{compareError}</section>
        )}
      </section>
    </div>
  );
}

function BenchmarkSimulationCompare({
  benchmark,
  simulation,
}: {
  benchmark: PerfRow;
  simulation: SimulationResponse;
}) {
  const profiles = simulation.profiles ?? [];
  const chartData = [
    {
      name: "官方结果",
      TTFT: benchmark.metrics.ttft_ms,
      吞吐: benchmark.metrics.throughput_tok_s,
    },
    ...profiles.map((profile) => ({
      name: profile.label,
      TTFT: profile.metrics.ttft_ms,
      吞吐: profile.metrics.throughput_tok_s,
    })),
  ];

  const typical = profiles.find((profile) => profile.label === "典型") ?? profiles[0];
  const ttftDelta = typical ? (((typical.metrics.ttft_ms - benchmark.metrics.ttft_ms) / benchmark.metrics.ttft_ms) * 100).toFixed(1) : "-";
  const throughputDelta = typical ? (((typical.metrics.throughput_tok_s - benchmark.metrics.throughput_tok_s) / benchmark.metrics.throughput_tok_s) * 100).toFixed(1) : "-";

  return (
    <div className="compare-grid">
      <div className="compare-summary">
        <div className="detail-item">
          <span>官方 TTFT</span>
          <strong>{benchmark.metrics.ttft_ms} ms</strong>
        </div>
        <div className="detail-item">
          <span>典型仿真 TTFT 偏差</span>
          <strong>{ttftDelta}%</strong>
        </div>
        <div className="detail-item">
          <span>官方吞吐</span>
          <strong>{benchmark.metrics.throughput_tok_s} tok/s</strong>
        </div>
        <div className="detail-item">
          <span>典型仿真吞吐偏差</span>
          <strong>{throughputDelta}%</strong>
        </div>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
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
  );
}
