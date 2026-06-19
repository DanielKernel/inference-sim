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
  developer: string;
  category: string;
  params_b: number;
  architecture: {
    num_layers: number;
    hidden_size: number;
    max_seq_len: number;
  };
  quant_support: string[];
}

export interface HardwareEntry {
  name: string;
  vendor: string;
  device_type: string;
  chip_type: string;
  fp16_tflops: number;
  fp8_tflops: number;
  memory_gib: number;
  memory_bandwidth_tbs: number;
  calibration: {
    mfu_prefill: number;
    mfu_decode: number;
    status: string;
    notes: string;
  };
}

export interface FrameworkEntry {
  name: string;
  vendor: string;
  latest_version: string;
  supported_hardware: string[];
}

export interface ScenarioEntry {
  name: string;
  category: string;
  description: string;
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
  lane: string;
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
  applied_optimizations?: string[];
  breakdown?: SimulationStage[];
  notes?: string[];
  profiles?: Array<{
    label: string;
    description: string;
    metrics: {
      ttft_ms: number;
      tpot_ms: number;
      e2e_ms: number;
      throughput_tok_s: number;
    };
    applied_optimizations: string[];
    bottleneck: string;
    breakdown: SimulationStage[];
  }>;
}

export interface AnalyticRequest {
  model: string;
  hardware: string;
  scenario: string;
  input_tokens: number;
  output_tokens: number;
}

export interface AnalyticResponse {
  selection: {
    model: string;
    hardware: string;
    scenario: string;
    input_tokens: number;
    output_tokens: number;
  };
  estimates: {
    ttft_ms: number;
    tpot_ms: number;
    e2e_ms: number;
    throughput_tok_s: number;
  };
  roofline: {
    ridge_point: number;
    arithmetic_intensity_pf: number;
    arithmetic_intensity_dc: number;
    prefill_bound: string;
    decode_bound: string;
    prefill_compute_ms: number;
    prefill_memory_ms: number;
    decode_compute_ms: number;
    decode_memory_ms: number;
  };
  breakdown: SimulationStage[];
  curves: {
    input_tokens: Array<{ x: number; value: number }>;
    output_tokens: Array<{ x: number; value: number }>;
  };
}

export interface BLISNativeRequest {
  model: string;
  hardware: string;
  scenario: string;
  input_tokens: number;
  output_tokens: number;
  latency_backend: string;
  tp: number;
  num_instances: number;
  rate: number;
  num_requests: number;
  horizon_us: number;
  arrival_process: string;
  routing_policy: string;
  scheduler: string;
  preemption_policy: string;
  total_kv_blocks: number;
  max_running_reqs: number;
  max_scheduled_tokens: number;
  seed: number;
}

export interface BLISNativeResponse {
  selection: {
    model: string;
    hardware: string;
    scenario: string;
    latency_backend: string;
    tp: number;
    num_instances: number;
    arrival_process: string;
    input_tokens: number;
    output_tokens: number;
  };
  calibration: {
    status: string;
    notes: string;
  };
  metrics: {
    completed_requests: number;
    injected_requests: number;
    ttft_mean_ms: number;
    ttft_p95_ms: number;
    e2e_p95_ms: number;
    itl_mean_ms: number;
    responses_per_sec: number;
    tokens_per_sec: number;
    dropped_unservable: number;
    timed_out_requests: number;
    preemption_count: number;
  };
  notes: string[];
}

export interface LibraryCompareResponse<T> {
  items: T[];
  diff_fields: string[];
}

export interface LibraryQueryOptions {
  q?: string;
  field?: string;
  value?: string;
  limit?: number;
}

function buildPath(path: string, params?: object) {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
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
  library: <T = unknown>(kind: string, options?: LibraryQueryOptions) =>
    getJSON<T[]>(buildPath(`/api/library/${kind}`, options)),
  libraryCompare: <T = unknown>(kind: string, keys: string[]) =>
    postJSON<{ keys: string[] }, LibraryCompareResponse<T>>(`/api/library/${kind}/compare`, { keys }),
  simulate: (req: SimulateRequest) => postJSON<SimulateRequest, SimulationResponse>("/api/combosim/simulate", req),
  analytic: (req: AnalyticRequest) => postJSON<AnalyticRequest, AnalyticResponse>("/api/analytic/estimate", req),
  blisSimulate: (req: BLISNativeRequest) => postJSON<BLISNativeRequest, BLISNativeResponse>("/api/blis/simulate", req),
};
