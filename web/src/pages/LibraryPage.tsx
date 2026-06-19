import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type Row = Record<string, unknown>;

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

function preferredFilterKey(rows: Row[]): string | null {
  const candidates = ["category", "vendor", "developer", "device_type"];
  for (const key of candidates) {
    if (rows.some((row) => typeof row[key] === "string" && String(row[key]).length > 0)) {
      return key;
    }
  }
  return null;
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
      .then((data) => {
        setRows(data);
        setSelectedRow(data[0] ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [kind]);

  if (error) return <p>加载库数据失败：{error}</p>;

  const cols = scalarColumns(rows);
  const filterKey = preferredFilterKey(rows);
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
            : "优化手段库";

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
      </section>
    </div>
  );
}
