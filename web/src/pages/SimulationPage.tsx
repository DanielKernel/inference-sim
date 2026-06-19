import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  api,
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

function normalizeSimulationResponse(resp: SimulationResponse): SimulationResponse {
  const appliedOptimizations = resp.applied_optimizations ?? [];
  const breakdown = resp.breakdown ?? [];
  const notes = resp.notes ?? [];
  const profiles =
    resp.profiles && resp.profiles.length > 0
      ? resp.profiles
      : [
          {
            label: "当前结果",
            description: "后端未返回最差 / 典型 / 最佳三档结果，已回退为单结果模式。",
            metrics: resp.metrics,
            applied_optimizations: appliedOptimizations,
            bottleneck: resp.bottleneck,
            breakdown,
          },
        ];

  return {
    ...resp,
    applied_optimizations: appliedOptimizations,
    breakdown,
    notes,
    profiles,
  };
}

export function SimulationPage() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [hardware, setHardware] = useState<HardwareEntry[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkEntry[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [optimizations, setOptimizations] = useState<OptimizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [processIndex, setProcessIndex] = useState(0);
  const [processStartedAt, setProcessStartedAt] = useState<number | null>(null);

  const [model, setModel] = useState("");
  const [device, setDevice] = useState("");
  const [framework, setFramework] = useState("");
  const [scenario, setScenario] = useState("");
  const [runtimeVersion, setRuntimeVersion] = useState("v0.21.0rc1");
  const [cannVersion, setCANNVersion] = useState("9.0.0");
  const [graphMode, setGraphMode] = useState("hybrid");
  const [quantMode, setQuantMode] = useState("kv_int8");
  const [commMode, setCommMode] = useState("flashcomm_v1");
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [selectedOptimizations, setSelectedOptimizations] = useState<string[]>([]);

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
  const safeBreakdown = result?.breakdown ?? [];
  const safeProfiles = result?.profiles ?? [];
  const safeAppliedOptimizations = result?.applied_optimizations ?? [];
  const safeNotes = result?.notes ?? [];
  const totalTimelineMs =
    safeBreakdown.length > 0
      ? safeBreakdown[safeBreakdown.length - 1].end_ms
      : 0;
  const timelineLanes = result
    ? ["预填充", "解码", "通信", "后处理"].map((lane) => ({
        lane,
        items: safeBreakdown.filter((step) => step.lane === lane),
      })).filter((group) => group.items.length > 0)
    : [];
  const profileChartData = safeProfiles.map((profile) => ({
    name: profile.label,
    TTFT: profile.metrics.ttft_ms,
    TPOT: profile.metrics.tpot_ms,
    吞吐: profile.metrics.throughput_tok_s,
  }));

  function toggleOptimization(id: string) {
    setSelectedOptimizations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsSimulating(true);
    setProcessIndex(0);
    setProcessStartedAt(Date.now());

    const tick = window.setInterval(() => {
      setProcessIndex((current) => Math.min(current + 1, PROCESS_STEPS.length - 1));
    }, 450);

    try {
      const respPromise = api.simulate({
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

      const minProcessDelay = new Promise((resolve) => window.setTimeout(resolve, 1800));
      const [resp] = await Promise.all([respPromise, minProcessDelay]);
      setProcessIndex(PROCESS_STEPS.length - 1);
      setResult(normalizeSimulationResponse(resp));
    } catch (err) {
      setError(String(err));
    } finally {
      window.clearInterval(tick);
      setTimeout(() => {
        setIsSimulating(false);
      }, 300);
    }
  }

  if (loading) return <p>正在加载仿真配置项…</p>;
  if (error && !result) return <p>加载仿真页面失败：{error}</p>;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">交互式推理仿真</div>
          <h2>配置与仿真</h2>
          <p>
            参考 Datadog 一类控制台的呈现方式，将仿真分为“配置、执行过程、指标结果、瓶颈拆解”
            四个区域，避免页面只显示最终结果。
          </p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{frameworkOptimizations.length}</strong>
            <span>当前框架可用优化</span>
          </div>
          <div className="mini-stat">
            <strong>{scenarios.length}</strong>
            <span>可选业务场景</span>
          </div>
        </div>
      </section>

      <form className="sim-form elevated-panel" onSubmit={onSubmit}>
        <div className="form-grid">
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

          <label>
            <span>运行时版本</span>
            <select value={runtimeVersion} onChange={(e) => setRuntimeVersion(e.target.value)}>
              <option value="v0.21.0rc1">v0.21.0rc1</option>
              <option value="v0.20.2rc1">v0.20.2rc1</option>
              <option value="v0.19.1rc1">v0.19.1rc1</option>
              <option value="v0.18.0">v0.18.0</option>
            </select>
          </label>

          <label>
            <span>CANN 版本</span>
            <select value={cannVersion} onChange={(e) => setCANNVersion(e.target.value)}>
              <option value="9.0.0">9.0.0</option>
              <option value="8.5.1">8.5.1</option>
              <option value="8.5.0">8.5.0</option>
            </select>
          </label>

          <label>
            <span>Graph 模式</span>
            <select value={graphMode} onChange={(e) => setGraphMode(e.target.value)}>
              <option value="hybrid">hybrid</option>
              <option value="full">full</option>
              <option value="eager">eager</option>
            </select>
          </label>

          <label>
            <span>量化模式</span>
            <select value={quantMode} onChange={(e) => setQuantMode(e.target.value)}>
              <option value="kv_int8">kv_int8</option>
              <option value="w8a8">w8a8</option>
              <option value="fp16">fp16</option>
            </select>
          </label>

          <label>
            <span>通信模式</span>
            <select value={commMode} onChange={(e) => setCommMode(e.target.value)}>
              <option value="flashcomm_v1">flashcomm_v1</option>
              <option value="hccs_native">hccs_native</option>
            </select>
          </label>

          <label>
            <span>输入 Token 数</span>
            <input
              type="number"
              min={1}
              value={inputTokens}
              onChange={(e) => setInputTokens(Number(e.target.value))}
            />
          </label>

          <label>
            <span>输出 Token 数</span>
            <input
              type="number"
              min={1}
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number(e.target.value))}
            />
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autoOptimize}
            onChange={(e) => setAutoOptimize(e.target.checked)}
          />
          <span>自动选择当前框架适用的全部优化手段</span>
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
                  <span>
                    {opt.name} <small>({opt.category})</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="primary-btn" type="submit">
          开始仿真
        </button>
      </form>

      {(isSimulating || processStartedAt) && (
        <section className="process-panel">
          <div className="process-header">
            <div>
              <div className="eyebrow">仿真执行过程</div>
              <h3>{isSimulating ? "正在执行仿真" : "仿真流程完成"}</h3>
            </div>
            <div className="process-badge">
              {Math.round(((processIndex + 1) / PROCESS_STEPS.length) * 100)}%
            </div>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${((processIndex + 1) / PROCESS_STEPS.length) * 100}%` }}
            />
          </div>
          <div className="process-grid">
            {PROCESS_STEPS.map((step, idx) => {
              const status =
                idx < processIndex ? "done" : idx === processIndex ? (isSimulating ? "running" : "done") : "pending";
              return (
                <div className={`process-step ${status}`} key={step}>
                  <div className="process-step-index">{idx + 1}</div>
                  <div>
                    <strong>{step}</strong>
                    <p>
                      {status === "done"
                        ? "已完成"
                        : status === "running"
                          ? "正在处理"
                          : "等待执行"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && <div className="error-panel">仿真失败：{error}</div>}

      {result && (
        <div className="results-block">
          <h3>仿真结果</h3>
          <div className="card-grid">
            <div className="metric-card accent-blue">
              <div className="num">{result.metrics.ttft_ms}</div>
              <div>TTFT（毫秒）</div>
            </div>
            <div className="metric-card accent-purple">
              <div className="num">{result.metrics.tpot_ms}</div>
              <div>TPOT（毫秒）</div>
            </div>
            <div className="metric-card accent-green">
              <div className="num">{result.metrics.throughput_tok_s}</div>
              <div>吞吐（tok/s）</div>
            </div>
            <div className="metric-card accent-orange">
              <div className="num">{result.metrics.e2e_ms}</div>
              <div>E2E（毫秒）</div>
            </div>
          </div>

          <div className="card elevated-panel" style={{ marginTop: 18 }}>
            <p>
              <strong>主要瓶颈：</strong> {result.bottleneck}
            </p>
            <p>
              <strong>当前组合：</strong> {result.selection.model} / {result.selection.hardware} /{" "}
              {result.selection.framework} / {result.selection.scenario}（输入
              {result.selection.input_tokens}，输出 {result.selection.output_tokens}）
            </p>
            <p>
              <strong>运行时配置：</strong> {result.selection.runtime_version} / CANN {result.selection.cann_version} /{" "}
              {result.selection.graph_mode} / {result.selection.quant_mode} / {result.selection.comm_mode}
            </p>
            <div className="tag-row">
              {safeAppliedOptimizations.map((item) => (
                <span className="tag" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <h3>最差 / 典型 / 最佳 对比</h3>
          <div className="profile-card-grid">
            {safeProfiles.map((profile) => (
              <div className="profile-card" key={profile.label}>
                <div className="eyebrow">{profile.label}</div>
                <strong>{profile.description}</strong>
                <div className="profile-metrics">
                  <span>TTFT：{profile.metrics.ttft_ms} ms</span>
                  <span>TPOT：{profile.metrics.tpot_ms} ms</span>
                  <span>E2E：{profile.metrics.e2e_ms} ms</span>
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

          <div className="chart-panel">
            <div className="chart-header">
              <h3>三档结果图形化对比</h3>
              <span>用于快速观察不同优化组合对 TTFT、TPOT 与吞吐的影响</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={profileChartData}>
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
          </div>

          <h3>阶段耗时时序图</h3>
          <div className="timeline-panel">
            <div className="timeline-axis">
              <span>0 ms</span>
              <span>{Math.round(totalTimelineMs / 2)} ms</span>
              <span>{Math.round(totalTimelineMs)} ms</span>
            </div>
            <div className="timeline-lanes">
              {timelineLanes.map((group) => (
                <div className="timeline-swimlane" key={group.lane}>
                  <div className="timeline-swimlane-title">{group.lane}</div>
                  <div className="timeline-swimlane-rows">
                    {group.items.map((row) => (
                      <div className="timeline-lane" key={row.stage}>
                        <div className="timeline-lane-label">
                          <strong>{row.stage}</strong>
                          <span>{row.start_ms} - {row.end_ms} ms</span>
                        </div>
                        <div className="timeline-track">
                          <div
                            className="timeline-bar"
                            style={{
                              left: `${(row.start_ms / Math.max(totalTimelineMs, 0.1)) * 100}%`,
                              width: `${(row.duration_ms / Math.max(totalTimelineMs, 0.1)) * 100}%`,
                            }}
                          >
                            {row.duration_ms} ms
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h3>阶段耗时拆解</h3>
          <div className="breakdown-list">
            {safeBreakdown.map((row) => (
              <div className="breakdown-item" key={row.stage}>
                <div className="breakdown-topline">
                  <strong>{row.stage}</strong>
                  <span>{row.duration_ms} ms / {row.percent}%</span>
                </div>
                <div className="progress-track slim">
                  <div className="progress-fill" style={{ width: `${row.percent}%` }} />
                </div>
                <p>{row.description}</p>
              </div>
            ))}
          </div>

          {safeNotes.length > 0 && (
            <>
              <h3>结果说明</h3>
              <ul>
                {safeNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
