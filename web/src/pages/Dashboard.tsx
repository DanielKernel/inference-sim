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
    <div>
      <h2>平台总览</h2>
      <p>
        当前使用 curated 参考数据（schema v{config.schema_version}，数据目录：
        <code>{config.data_dir}</code>）
      </p>
      <p>
        支持一键启动平台、自动打开网页，并在页面中完成模型 / 硬件 / 框架 / 场景配置、性能仿真、
        结果查看与瓶颈分段分析。
      </p>
      <div className="card-grid">
        {entries.map(([k, v]) => (
          <div className="card" key={k}>
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
