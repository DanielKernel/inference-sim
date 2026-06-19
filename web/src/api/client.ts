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

export interface ModelEntry {
  name: string;
  display_name: string;
  category: string;
  params_b: number;
}

export interface HardwareEntry {
  name: string;
  vendor: string;
  fp16_tflops: number;
  memory_bandwidth_tbs: number;
}

export interface FrameworkEntry {
  name: string;
  latest_version: string;
}

export interface ScenarioEntry {
  name: string;
  category: string;
  input_tokens: { typical: number; min: number; max: number };
  output_tokens: { typical: number; min: number; max: number };
}

export interface OptimizationEntry {
  id: string;
  name: string;
  category: string;
  frameworks: string[];
}

export interface SimulateRequest {
  model: string;
  hardware: string;
  framework: string;
  scenario: string;
  runtime_version: string;
  cann_version: string;
  graph_mode: string;
  quant_mode: string;
  comm_mode: string;
  input_tokens: number;
  output_tokens: number;
  auto_optimize: boolean;
  selected_optimizations: string[];
}

export interface SimulationStage {
  stage: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  percent: number;
  description: string;
}

export interface SimulationResponse {
  selection: {
    model: string;
    hardware: string;
    framework: string;
    scenario: string;
    runtime_version: string;
    cann_version: string;
    graph_mode: string;
    quant_mode: string;
    comm_mode: string;
    input_tokens: number;
    output_tokens: number;
  };
  metrics: {
    ttft_ms: number;
    tpot_ms: number;
    e2e_ms: number;
    throughput_tok_s: number;
  };
  bottleneck: string;
  applied_optimizations: string[];
  breakdown: SimulationStage[];
  notes: string[];
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function postJSON<TReq, TResp>(path: string, body: TReq): Promise<TResp> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as TResp;
}

export const api = {
  health: () => getJSON<{ status: string }>("/api/health"),
  config: () => getJSON<PlatformConfig>("/api/config"),
  library: <T = unknown>(kind: string) => getJSON<T[]>(`/api/library/${kind}`),
  simulate: (req: SimulateRequest) => postJSON<SimulateRequest, SimulationResponse>("/api/simulate", req),
};
