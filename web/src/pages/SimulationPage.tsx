import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticResponse,
  api,
  BLISNativeResponse,
  FrameworkEntry,
  HardwareEntry,
  ModelEntry,
  OptimizationEntry,
  ScenarioEntry,
  SimulationResponse,
} from "../api/client";

const PROCESS_STEPS = [
  "校验输入组合",
  "加载模型与硬件画像",
  "筛选适用优化手段",
  "估算 TTFT / TPOT",
  "生成分阶段耗时拆解",
  "汇总结果并渲染页面",
];

type StudioTab = "platform" | "analytic" | "blis";

function normalizeSimulationResponse(resp: SimulationResponse): SimulationResponse {
  return {
    ...resp,
    applied_optimizations: resp.applied_optimizations ?? [],
    breakdown: resp.breakdown ?? [],
    notes: resp.notes ?? [],
    profiles:
      resp.profiles && resp.profiles.length > 0
        ? resp.profiles
        : [
            {
              label: "当前结果",
              description: "后端未返回更多 profile，已回退为单结果模式。",
              metrics: resp.metrics,
              applied_optimizations: resp.applied_optimizations ?? [],
              bottleneck: resp.bottleneck,
              breakdown: resp.breakdown ?? [],
            },
          ],
  };
}

export function SimulationPage() {
  const [studioTab, setStudioTab] = useState<StudioTab>("platform");
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [hardware, setHardware] = useState<HardwareEntry[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkEntry[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [optimizations, setOptimizations] = useState<OptimizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState("");
  const [device, setDevice] = useState("");
  const [framework, setFramework] = useState("");
  const [scenario, setScenario] = useState("");
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);

  const [runtimeVersion, setRuntimeVersion] = useState("v0.21.0rc1");
  const [cannVersion, setCANNVersion] = useState("9.0.0");
  const [graphMode, setGraphMode] = useState("hybrid");
  const [quantMode, setQuantMode] = useState("kv_int8");
  const [commMode, setCommMode] = useState("flashcomm_v1");
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [selectedOptimizations, setSelectedOptimizations] = useState<string[]>([]);
  const [platformResult, setPlatformResult] = useState<SimulationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [processIndex, setProcessIndex] = useState(0);
  const [platformError, setPlatformError] = useState<string | null>(null);

  const [analyticResult, setAnalyticResult] = useState<AnalyticResponse | null>(null);
  const [analyticLoading, setAnalyticLoading] = useState(false);
  const [analyticError, setAnalyticError] = useState<string | null>(null);

  const [nativeBackend, setNativeBackend] = useState("roofline");
  const [nativeTP, setNativeTP] = useState(1);
  const [nativeInstances, setNativeInstances] = useState(1);
  const [nativeRate, setNativeRate] = useState(2);
  const [nativeNumRequests, setNativeNumRequests] = useState(32);
  const [nativeHorizonUs, setNativeHorizonUs] = useState(15000000);
  const [nativeArrivalProcess, setNativeArrivalProcess] = useState("poisson");
  const [nativeRoutingPolicy, setNativeRoutingPolicy] = useState("round-robin");
  const [nativeScheduler, setNativeScheduler] = useState("fcfs");
  const [nativePreemption, setNativePreemption] = useState("fcfs");
  const [nativeKVBlocks, setNativeKVBlocks] = useState(200000);
  const [nativeMaxRunning, setNativeMaxRunning] = useState(128);
  const [nativeMaxScheduled, setNativeMaxScheduled] = useState(2048);
  const [nativeSeed, setNativeSeed] = useState(7);
  const [nativeResult, setNativeResult] = useState<BLISNativeResponse | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.library<ModelEntry>("models"),
      api.library<HardwareEntry>("hardware"),
      api.library<FrameworkEntry>("frameworks"),
      api.library<ScenarioEntry>("scenarios"),
      api.library<OptimizationEntry>("optimizations"),
    ])
      .then(([m, h, f, s, o]) => {
        setModels(m);
        setHardware(h);
        setFrameworks(f);
        setScenarios(s);
        setOptimizations(o);
        setModel(m[0]?.name ?? "");
        setDevice(h[0]?.name ?? "");
        setFramework(f[0]?.name ?? "");
        setScenario(s[0]?.name ?? "");
        setInputTokens(s[0]?.input_tokens.typical ?? 0);
        setOutputTokens(s[0]?.output_tokens.typical ?? 0);
        setRuntimeVersion(f[0]?.latest_version ?? "v0.21.0rc1");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const selectedScenario = scenarios.find((item) => item.name === scenario);
    if (selectedScenario) {
      setInputTokens(selectedScenario.input_tokens.typical);
      setOutputTokens(selectedScenario.output_tokens.typical);
    }
  }, [scenario, scenarios]);

  const frameworkOptimizations = useMemo(
    () => optimizations.filter((opt) => opt.frameworks.includes(framework)),
    [framework, optimizations]
  );
  const nativeHardware = useMemo(
    () => hardware.filter((item) => item.calibration?.status),
    [hardware]
  );

  function toggleOptimization(id: string) {
    setSelectedOptimizations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function onPlatformSubmit(event: FormEvent) {
    event.preventDefault();
    setPlatformError(null);
    setPlatformResult(null);
    setIsSimulating(true);
    setProcessIndex(0);
    const tick = window.setInterval(() => {
      setProcessIndex((current) => Math.min(current + 1, PROCESS_STEPS.length - 1));
    }, 420);

    try {
      const response = await api.simulate({
        model,
        hardware: device,
        framework,
        scenario,
        runtime_version: runtimeVersion,
        cann_version: cannVersion,
        graph_mode: graphMode,
        quant_mode: quantMode,
        comm_mode: commMode,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        auto_optimize: autoOptimize,
        selected_optimizations: autoOptimize ? [] : selectedOptimizations,
      });
      setProcessIndex(PROCESS_STEPS.length - 1);
      setPlatformResult(normalizeSimulationResponse(response));
    } catch (err) {
      setPlatformError(String(err));
    } finally {
      window.clearInterval(tick);
      setTimeout(() => setIsSimulating(false), 250);
    }
  }

  async function onAnalyticSubmit(event: FormEvent) {
    event.preventDefault();
    setAnalyticLoading(true);
    setAnalyticError(null);
    try {
      const response = await api.analytic({
        model,
        hardware: device,
        scenario,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
      setAnalyticResult(response);
    } catch (err) {
      setAnalyticError(String(err));
    } finally {
      setAnalyticLoading(false);
    }
  }

  async function onBLISSubmit(event: FormEvent) {
    event.preventDefault();
    setNativeLoading(true);
    setNativeError(null);
    setNativeResult(null);
    try {
      const response = await api.blisSimulate({
        model,
        hardware: device,
        scenario,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_backend: nativeBackend,
        tp: nativeTP,
        num_instances: nativeInstances,
        rate: nativeRate,
        num_requests: nativeNumRequests,
        horizon_us: nativeHorizonUs,
        arrival_process: nativeArrivalProcess,
        routing_policy: nativeRoutingPolicy,
        scheduler: nativeScheduler,
        preemption_policy: nativePreemption,
        total_kv_blocks: nativeKVBlocks,
        max_running_reqs: nativeMaxRunning,
        max_scheduled_tokens: nativeMaxScheduled,
        seed: nativeSeed,
      });
      setNativeResult(response);
    } catch (err) {
      setNativeError(String(err));
    } finally {
      setNativeLoading(false);
    }
  }

  if (loading) return <p>正在加载 Simulation Studio 所需配置…</p>;
  if (error) return <p>无法加载 Simulation Studio：{error}</p>;

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel-strong">
        <div>
          <div className="eyebrow">Simulation Studio</div>
          <h2>平台仿真 + 解析模型 + BLIS 原生仿真</h2>
          <p>
            将平台组合仿真、roofline 解析视图和 third_party/inference-sim 的原生离散事件仿真收敛到同一工作台，
            让 Web UI 不再只覆盖 vllm-ascend 这一条路径。
          </p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{frameworkOptimizations.length}</strong>
            <span>当前框架可用优化</span>
          </div>
          <div className="mini-stat">
            <strong>{nativeHardware.length}</strong>
            <span>可跑原生 BLIS 的硬件</span>
          </div>
          <div className="mini-stat">
            <strong>3</strong>
            <span>统一工作台模式</span>
          </div>
        </div>
      </section>

      <section className="studio-tabs">
        {([
          ["platform", "Platform Combosim"],
          ["analytic", "Roofline Analytics"],
          ["blis", "BLIS Native DES"],
        ] as Array<[StudioTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={`studio-tab ${studioTab === tab ? "active" : ""}`}
            onClick={() => setStudioTab(tab)}
          >
            {label}
          </button>
        ))}
      </section>

      {studioTab === "platform" && (
        <>
          <form className="sim-form elevated-panel" onSubmit={onPlatformSubmit}>
            <div className="form-grid">
              <SharedSelectionFields
                models={models}
                hardware={hardware}
                frameworks={frameworks}
                scenarios={scenarios}
                model={model}
                setModel={setModel}
                device={device}
                setDevice={setDevice}
                framework={framework}
                setFramework={setFramework}
                scenario={scenario}
                setScenario={setScenario}
                inputTokens={inputTokens}
                setInputTokens={setInputTokens}
                outputTokens={outputTokens}
                setOutputTokens={setOutputTokens}
                includeFramework
              />
              <SelectField label="运行时版本" value={runtimeVersion} onChange={setRuntimeVersion} options={["v0.21.0rc1", "v1", "v0.20.2rc1"]} />
              <SelectField label="CANN 版本" value={cannVersion} onChange={setCANNVersion} options={["9.0.0", "8.5.1", "8.5.0"]} />
              <SelectField label="Graph 模式" value={graphMode} onChange={setGraphMode} options={["hybrid", "full", "eager"]} />
              <SelectField label="量化模式" value={quantMode} onChange={setQuantMode} options={["kv_int8", "w8a8", "fp16"]} />
              <SelectField label="通信模式" value={commMode} onChange={setCommMode} options={["flashcomm_v1", "hccs_native"]} />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={autoOptimize} onChange={(e) => setAutoOptimize(e.target.checked)} />
              <span>自动启用当前框架可用的优化手段</span>
            </label>
            {!autoOptimize && (
              <div className="opt-box">
                <strong>手工选择优化手段</strong>
                <div className="checkbox-list">
                  {frameworkOptimizations.map((opt) => (
                    <label key={opt.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedOptimizations.includes(opt.id)}
                        onChange={() => toggleOptimization(opt.id)}
                      />
                      <span>{opt.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button className="primary-btn" type="submit">
              运行组合仿真
            </button>
          </form>

          {(isSimulating || platformResult) && (
            <section className="process-panel">
              <div className="process-header">
                <div>
                  <div className="eyebrow">组合仿真执行过程</div>
                  <h3>{isSimulating ? "正在执行仿真" : "仿真流程完成"}</h3>
                </div>
                <div className="process-badge">{Math.round(((processIndex + 1) / PROCESS_STEPS.length) * 100)}%</div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${((processIndex + 1) / PROCESS_STEPS.length) * 100}%` }} />
              </div>
              <div className="process-grid">
                {PROCESS_STEPS.map((step, index) => {
                  const status =
                    index < processIndex ? "done" : index === processIndex ? (isSimulating ? "running" : "done") : "pending";
                  return (
                    <div className={`process-step ${status}`} key={step}>
                      <div className="process-step-index">{index + 1}</div>
                      <div>
                        <strong>{step}</strong>
                        <p>{status === "pending" ? "等待执行" : status === "running" ? "正在处理" : "已完成"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {platformError && <div className="error-panel">组合仿真失败：{platformError}</div>}
          {platformResult && <PlatformResult result={platformResult} />}
        </>
      )}

      {studioTab === "analytic" && (
        <>
          <form className="sim-form elevated-panel" onSubmit={onAnalyticSubmit}>
            <div className="form-grid">
              <SharedSelectionFields
                models={models}
                hardware={hardware}
                frameworks={frameworks}
                scenarios={scenarios}
                model={model}
                setModel={setModel}
                device={device}
                setDevice={setDevice}
                framework={framework}
                setFramework={setFramework}
                scenario={scenario}
                setScenario={setScenario}
                inputTokens={inputTokens}
                setInputTokens={setInputTokens}
                outputTokens={outputTokens}
                setOutputTokens={setOutputTokens}
              />
            </div>
            <button className="primary-btn" type="submit">
              {analyticLoading ? "正在计算…" : "生成解析模型视图"}
            </button>
          </form>
          {analyticError && <div className="error-panel">解析模型计算失败：{analyticError}</div>}
          {analyticResult && <AnalyticPanel result={analyticResult} />}
        </>
      )}

      {studioTab === "blis" && (
        <>
          <form className="sim-form elevated-panel" onSubmit={onBLISSubmit}>
            <div className="form-grid">
              <SharedSelectionFields
                models={models}
                hardware={nativeHardware}
                frameworks={frameworks}
                scenarios={scenarios}
                model={model}
                setModel={setModel}
                device={device}
                setDevice={setDevice}
                framework={framework}
                setFramework={setFramework}
                scenario={scenario}
                setScenario={setScenario}
                inputTokens={inputTokens}
                setInputTokens={setInputTokens}
                outputTokens={outputTokens}
                setOutputTokens={setOutputTokens}
              />
              <SelectField label="延迟后端" value={nativeBackend} onChange={setNativeBackend} options={["roofline"]} />
              <NumberField label="TP" value={nativeTP} onChange={setNativeTP} min={1} />
              <NumberField label="实例数" value={nativeInstances} onChange={setNativeInstances} min={1} />
              <NumberField label="到达率 req/s" value={nativeRate} onChange={setNativeRate} min={0.1} step={0.1} />
              <NumberField label="请求数" value={nativeNumRequests} onChange={setNativeNumRequests} min={1} />
              <NumberField label="仿真时长 (μs)" value={nativeHorizonUs} onChange={setNativeHorizonUs} min={1000} />
              <SelectField label="到达过程" value={nativeArrivalProcess} onChange={setNativeArrivalProcess} options={["poisson", "gamma", "weibull", "constant"]} />
              <SelectField label="路由策略" value={nativeRoutingPolicy} onChange={setNativeRoutingPolicy} options={["round-robin", "least-loaded", "weighted", "always-busiest"]} />
              <SelectField label="调度策略" value={nativeScheduler} onChange={setNativeScheduler} options={["fcfs", "priority-fcfs", "sjf", "reverse-priority"]} />
              <SelectField label="抢占策略" value={nativePreemption} onChange={setNativePreemption} options={["fcfs", "priority"]} />
              <NumberField label="KV blocks" value={nativeKVBlocks} onChange={setNativeKVBlocks} min={1024} />
              <NumberField label="最大运行请求" value={nativeMaxRunning} onChange={setNativeMaxRunning} min={1} />
              <NumberField label="最大 scheduled tokens" value={nativeMaxScheduled} onChange={setNativeMaxScheduled} min={1} />
              <NumberField label="随机种子" value={nativeSeed} onChange={setNativeSeed} min={1} />
            </div>
            <button className="primary-btn" type="submit">
              {nativeLoading ? "正在执行 BLIS…" : "运行 BLIS 原生仿真"}
            </button>
          </form>
          {nativeError && <div className="error-panel">BLIS 原生仿真失败：{nativeError}</div>}
          {nativeResult && <BLISResultPanel result={nativeResult} />}
        </>
      )}
    </div>
  );
}

function SharedSelectionFields({
  models,
  hardware,
  frameworks,
  scenarios,
  model,
  setModel,
  device,
  setDevice,
  framework,
  setFramework,
  scenario,
  setScenario,
  inputTokens,
  setInputTokens,
  outputTokens,
  setOutputTokens,
  includeFramework = false,
}: {
  models: ModelEntry[];
  hardware: HardwareEntry[];
  frameworks: FrameworkEntry[];
  scenarios: ScenarioEntry[];
  model: string;
  setModel: (value: string) => void;
  device: string;
  setDevice: (value: string) => void;
  framework: string;
  setFramework: (value: string) => void;
  scenario: string;
  setScenario: (value: string) => void;
  inputTokens: number;
  setInputTokens: (value: number) => void;
  outputTokens: number;
  setOutputTokens: (value: number) => void;
  includeFramework?: boolean;
}) {
  return (
    <>
      <label>
        <span>模型</span>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          {models.map((item) => (
            <option key={item.name} value={item.name}>
              {item.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>硬件</span>
        <select value={device} onChange={(e) => setDevice(e.target.value)}>
          {hardware.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {includeFramework && (
        <label>
          <span>框架</span>
          <select value={framework} onChange={(e) => setFramework(e.target.value)}>
            {frameworks.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>场景</span>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {scenarios.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <NumberField label="输入 Token 数" value={inputTokens} onChange={setInputTokens} min={1} />
      <NumberField label="输出 Token 数" value={outputTokens} onChange={setOutputTokens} min={1} />
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  step?: number;
}) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlatformResult({ result }: { result: SimulationResponse }) {
  const profiles = result.profiles ?? [];
  const chartData = profiles.map((profile) => ({
    name: profile.label,
    TTFT: profile.metrics.ttft_ms,
    TPOT: profile.metrics.tpot_ms,
    吞吐: profile.metrics.throughput_tok_s,
  }));
  return (
    <div className="results-block">
      <div className="card-grid">
        <MetricCard label="TTFT (ms)" value={result.metrics.ttft_ms} accent="blue" />
        <MetricCard label="TPOT (ms)" value={result.metrics.tpot_ms} accent="purple" />
        <MetricCard label="吞吐 (tok/s)" value={result.metrics.throughput_tok_s} accent="green" />
        <MetricCard label="E2E (ms)" value={result.metrics.e2e_ms} accent="orange" />
      </div>

      <section className="chart-panel">
        <div className="chart-header">
          <h3>最差 / 典型 / 最佳结果对比</h3>
          <span>组合仿真用于解释优化手段集合对吞吐和时延的影响。</span>
        </div>
        <div className="profile-card-grid">
          {profiles.map((profile) => (
            <div className="profile-card" key={profile.label}>
              <div className="eyebrow">{profile.label}</div>
              <strong>{profile.description}</strong>
              <div className="profile-metrics">
                <span>TTFT：{profile.metrics.ttft_ms} ms</span>
                <span>TPOT：{profile.metrics.tpot_ms} ms</span>
                <span>吞吐：{profile.metrics.throughput_tok_s} tok/s</span>
              </div>
              <p>瓶颈：{profile.bottleneck}</p>
              <div className="tag-row">
                {profile.applied_optimizations.length > 0 ? (
                  profile.applied_optimizations.map((item) => (
                    <span className="tag" key={item}>
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="tag">无额外优化</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
              <XAxis dataKey="name" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip />
              <Legend />
              <Bar dataKey="TTFT" fill="#4c6bff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="TPOT" fill="#7f56d9" radius={[6, 6, 0, 0]} />
              <Bar dataKey="吞吐" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="detail-panel">
        <h3>当前结果解读</h3>
        <div className="detail-list">
          <div className="detail-item">
            <span>当前组合</span>
            <strong>
              {result.selection.model} / {result.selection.hardware} / {result.selection.framework} / {result.selection.scenario}
            </strong>
          </div>
          <div className="detail-item">
            <span>主要瓶颈</span>
            <strong>{result.bottleneck}</strong>
          </div>
          <div className="detail-item">
            <span>生效优化</span>
            <strong className="tag-row">
              {(result.applied_optimizations ?? []).map((item) => (
                <span key={item} className="tag">
                  {item}
                </span>
              ))}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function AnalyticPanel({ result }: { result: AnalyticResponse }) {
  const inputCurve = result.curves.input_tokens.map((item) => ({ tokens: item.x, TTFT: item.value }));
  const outputCurve = result.curves.output_tokens.map((item) => ({ tokens: item.x, E2E: item.value }));
  return (
    <div className="results-block">
      <div className="card-grid">
        <MetricCard label="TTFT (ms)" value={result.estimates.ttft_ms} accent="blue" />
        <MetricCard label="TPOT (ms)" value={result.estimates.tpot_ms} accent="purple" />
        <MetricCard label="吞吐 (tok/s)" value={result.estimates.throughput_tok_s} accent="green" />
        <MetricCard label="Ridge point" value={result.roofline.ridge_point} accent="orange" />
      </div>

      <section className="library-layout">
        <div className="chart-panel">
          <div className="chart-header">
            <h3>输入长度对 TTFT 的影响</h3>
            <span>展示 prefill 路径在不同输入规模下的曲线趋势。</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={inputCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
                <XAxis dataKey="tokens" stroke="currentColor" />
                <YAxis stroke="currentColor" />
                <Tooltip />
                <Line type="monotone" dataKey="TTFT" stroke="#4c6bff" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <aside className="detail-panel">
          <h3>Roofline 诊断</h3>
          <div className="detail-list">
            <div className="detail-item">
              <span>Prefill bound</span>
              <strong>{result.roofline.prefill_bound}</strong>
            </div>
            <div className="detail-item">
              <span>Decode bound</span>
              <strong>{result.roofline.decode_bound}</strong>
            </div>
            <div className="detail-item">
              <span>AI (prefill / decode)</span>
              <strong>
                {result.roofline.arithmetic_intensity_pf} / {result.roofline.arithmetic_intensity_dc}
              </strong>
            </div>
            <div className="detail-item">
              <span>Prefill compute / memory</span>
              <strong>
                {result.roofline.prefill_compute_ms} / {result.roofline.prefill_memory_ms} ms
              </strong>
            </div>
            <div className="detail-item">
              <span>Decode compute / memory</span>
              <strong>
                {result.roofline.decode_compute_ms} / {result.roofline.decode_memory_ms} ms
              </strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="chart-panel">
        <div className="chart-header">
          <h3>输出长度对 E2E 的影响</h3>
          <span>更适合观察 decode-heavy / reasoning 型场景的尾部增长。</span>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={outputCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
              <XAxis dataKey="tokens" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip />
              <Line type="monotone" dataKey="E2E" stroke="#f97316" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function BLISResultPanel({ result }: { result: BLISNativeResponse }) {
  return (
    <div className="results-block">
      <div className="card-grid">
        <MetricCard label="TTFT mean (ms)" value={result.metrics.ttft_mean_ms} accent="blue" />
        <MetricCard label="TTFT p95 (ms)" value={result.metrics.ttft_p95_ms} accent="purple" />
        <MetricCard label="Responses/s" value={result.metrics.responses_per_sec} accent="green" />
        <MetricCard label="Tokens/s" value={result.metrics.tokens_per_sec} accent="orange" />
      </div>

      <section className="library-layout">
        <div className="chart-panel">
          <div className="chart-header">
            <h3>BLIS 原生结果摘要</h3>
            <span>该结果来自真实 cluster DES + roofline latency backend，而非平台 heuristic 近似。</span>
          </div>
          <div className="blis-summary-grid">
            <div className="metric-card">
              <div className="num">{result.metrics.completed_requests}</div>
              <div>完成请求</div>
            </div>
            <div className="metric-card">
              <div className="num">{result.metrics.injected_requests}</div>
              <div>注入请求</div>
            </div>
            <div className="metric-card">
              <div className="num">{result.metrics.e2e_p95_ms}</div>
              <div>E2E p95 (ms)</div>
            </div>
            <div className="metric-card">
              <div className="num">{result.metrics.preemption_count}</div>
              <div>抢占次数</div>
            </div>
          </div>
        </div>
        <aside className="detail-panel">
          <h3>校准与说明</h3>
          <div className="detail-list">
            <div className="detail-item">
              <span>校准状态</span>
              <strong>{result.calibration.status}</strong>
            </div>
            <div className="detail-item">
              <span>校准说明</span>
              <strong>{result.calibration.notes}</strong>
            </div>
            <div className="detail-item">
              <span>仿真配置</span>
              <strong>
                {result.selection.model} / {result.selection.hardware} / {result.selection.latency_backend} / TP
                {result.selection.tp} / {result.selection.num_instances} instances
              </strong>
            </div>
            <div className="detail-item">
              <span>补充说明</span>
              <strong className="notes-stack">
                {result.notes.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </strong>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "blue" | "purple" | "green" | "orange";
}) {
  const accentClass =
    accent === "blue" ? "accent-blue" : accent === "purple" ? "accent-purple" : accent === "green" ? "accent-green" : "accent-orange";
  return (
    <div className={`metric-card ${accentClass}`}>
      <div className="num">{value}</div>
      <div>{label}</div>
    </div>
  );
}
