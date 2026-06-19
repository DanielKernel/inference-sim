import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type Row = Record<string, unknown>;

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
    default:
      return col;
  }
}

export function LibraryPage() {
  const { kind = "" } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setRows([]);
    api
      .library<Row>(kind)
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, [kind]);

  if (error) return <p>加载库数据失败：{error}</p>;

  const cols = scalarColumns(rows);
  return (
    <div>
      <h2>
        {kind === "models"
          ? "模型库"
          : kind === "hardware"
            ? "硬件库"
            : kind === "frameworks"
              ? "框架库"
              : kind === "scenarios"
                ? "场景库"
                : kind === "optimizations"
                  ? "优化手段库"
                  : "性能数据库"}
      </h2>
      <p>共 {rows.length} 条记录</p>
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{columnLabel(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{String(row[c] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
