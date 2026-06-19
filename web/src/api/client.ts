// Typed API client for the BLIS platform backend. Types mirror the Go library
// schema (snake_case JSON contract).

export interface LibraryCounts {
  models: number;
  hardware: number;
  frameworks: number;
  scenarios: number;
  perf_records: number;
  optimizations: number;
}

export interface PlatformConfig {
  schema_version: number;
  data_dir: string;
  counts: LibraryCounts;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJSON<{ status: string }>("/api/health"),
  config: () => getJSON<PlatformConfig>("/api/config"),
  library: <T = unknown>(kind: string) => getJSON<T[]>(`/api/library/${kind}`),
};
