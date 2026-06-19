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

  if (error) return <p>Failed to load {kind}: {error}</p>;

  const cols = scalarColumns(rows);
  return (
    <div>
      <h2 style={{ textTransform: "capitalize" }}>{kind.replace("_", " ")}</h2>
      <p>{rows.length} entries</p>
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
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
