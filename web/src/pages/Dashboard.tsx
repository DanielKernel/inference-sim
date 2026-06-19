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
          <strong>一键运行</strong>
          <span>构建 API + Web，打开浏览器后直接配置与仿真</span>
        </div>
        <div className="info-item">
          <strong>全库查询</strong>
          <span>模型、硬件、框架、场景、优化手段、性能数据库均支持关键字查询</span>
        </div>
        <div className="info-item">
          <strong>过程可视化</strong>
          <span>开始仿真后实时展示执行阶段，不再只给最终结果</span>
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
