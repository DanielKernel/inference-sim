import { useEffect, useState } from "react";
import { api, PlatformConfig } from "../api/client";

export function Dashboard() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p>无法连接后端服务：{error}</p>;
  if (!config) return <p>正在加载平台信息…</p>;

  const entries = Object.entries(config.counts);
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">推理性能控制台</div>
          <h2>平台总览</h2>
          <p>
            当前使用 curated 参考数据（schema v{config.schema_version}，数据目录：
            <code>{config.data_dir}</code>）
          </p>
          <p>
            支持一键启动平台、自动打开网页，并在页面中完成模型 / 硬件 / 框架 / 场景配置、性能仿真、
            结果查看与瓶颈分段分析。
          </p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{config.schema_version}</strong>
            <span>数据 schema 版本</span>
          </div>
          <div className="mini-stat">
            <strong>{entries.reduce((sum, [, value]) => sum + value, 0)}</strong>
            <span>总数据条目</span>
          </div>
        </div>
      </section>

      <section className="toolbar-panel info-band">
        <div className="info-item">
        <strong>仿真工作台</strong>
        <span>在一个工作台里切换平台组合仿真、解析模型和 BLIS 原生 DES</span>
        </div>
        <div className="info-item">
        <strong>原生 BLIS 接入</strong>
        <span>不再只展示 vllm-ascend，Web 现已可直接驱动 inference-sim 的 cluster 仿真路径</span>
        </div>
        <div className="info-item">
        <strong>解析 + 数据 + 仿真联动</strong>
        <span>可把 roofline 指标、公开 benchmark 与组合仿真结果放到同一条分析链路里</span>
        </div>
      </section>

      <div className="card-grid">
        {entries.map(([k, v]) => (
          <div className="metric-card" key={k}>
            <div className="num">{v}</div>
            <div>
              {k === "models"
                ? "模型条目"
                : k === "hardware"
                  ? "硬件条目"
                  : k === "frameworks"
                    ? "框架条目"
                    : k === "scenarios"
                      ? "场景条目"
                      : k === "optimizations"
                        ? "优化手段条目"
                        : "性能记录条目"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
