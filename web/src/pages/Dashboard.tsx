import { useEffect, useState } from "react";
import { api, PlatformConfig } from "../api/client";

export function Dashboard() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p>Failed to reach API: {error}</p>;
  if (!config) return <p>Loading…</p>;

  const entries = Object.entries(config.counts);
  return (
    <div>
      <h2>Platform Overview</h2>
      <p>
        Curated reference libraries (schema v{config.schema_version}, data:{" "}
        <code>{config.data_dir}</code>)
      </p>
      <div className="card-grid">
        {entries.map(([k, v]) => (
          <div className="card" key={k}>
            <div className="num">{v}</div>
            <div>{k.replace("_", " ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
