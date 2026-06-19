import { useEffect, useState } from "react";
import { api, PlatformConfig } from "../api/client";
import { OVERVIEW_TOPICS } from "../content/overviewTopics";

const FACTORS = [
  {
    title: "模型",
    detail: "层数、隐藏维度、注意力结构、MoE/多模态结构、上下文长度与量化能力，决定 prefill / decode 的 FLOPs、KV 大小与通信模式。",
  },
  {
    title: "硬件",
    detail: "算力、显存容量、HBM 带宽、互联拓扑和功耗，决定 roofline 上界、KV 容量和多卡并行的通信代价。",
  },
  {
    title: "软件/推理框架",
    detail: "vLLM、vllm-ascend、SGLang、TensorRT-LLM 等框架通过 continuous batching、chunked prefill、prefix cache、graph、KV 量化等语义改变实际执行路径。",
  },
  {
    title: "输入 / 输出 Token",
    detail: "输入长度主要影响 TTFT 与 prefill 压力，输出长度主要影响 decode 次数、ITL、E2E 与吞吐，二者还会共同影响 KV 占用与调度拥塞。",
  },
];

const PRINCIPLES = [
  "BLIS / inference-sim 不是单一经验公式器，而是一个可校准的离散事件仿真内核：请求先到达，再经历 admission、routing、queue、prefill、decode、complete。",
  "平台先用模型结构、硬件参数和软件语义建立解析 / roofline 级估算，再在原生 DES 路径里把批处理、KV、调度、通信、抢占和队列等待叠加起来。",
  "因此同一个“模型 + 硬件 + 软件 + token 长度”组合，最终输出的不只是 TTFT/TPOT，还包括吞吐、E2E、preemption、drop、saturation 等系统级结果。",
];

const DIFFERENCES = [
  {
    title: "仿真数据更可解释",
    detail: "仿真能直接给出为什么慢：是 prefill 计算、decode KV 读取、通信、排队还是容量限制导致的，这通常比纯 benchmark 更容易定位瓶颈。",
  },
  {
    title: "真实实测更接近生产噪声",
    detail: "实测会包含网络抖动、服务端实现细节、编译预热、异步调度、真实 prefix 命中率、内核版本差异等复杂因素。",
  },
  {
    title: "两者应形成 observe → replay → calibrate 闭环",
    detail: "正确做法不是拿仿真替代实测，而是用实测 trace 驱动 replay，再用 calibrate 衡量误差并修正参数与建模假设。",
  },
];

const CAUTIONS = [
  "把仿真结果视为“趋势、排序和瓶颈解释工具”，不要直接当成生产 SLA 承诺值。",
  "模型、硬件和运行时没有校准时，TTFT / ITL / 吞吐的绝对误差可能明显放大，尤其是新硬件和新框架版本。",
  "当使用 flow-control、PD/EPD、autoscaler、prefix cache 等高级机制时，应优先用 trace-driven replay 或 observe 数据校准，而不是只依赖静态默认值。",
  "对外展示时应同时给出测试条件、trace 来源、模型版本、硬件拓扑和量化模式，避免脱离上下文比较数字。",
];

const RECOMMENDATIONS = [
  {
    title: "坚持“离散事件内核 + 可校准代价模型”路线",
    detail: "附文建议不要做单一 benchmark 壳子，而要围绕可校准 DES 内核演进。这与 inference-sim 当前的 cluster / workload / trace / calibrate 架构完全一致，应该继续强化。",
  },
  {
    title: "把框架差异建模为“服务语义插件”",
    detail: "对本项目最正确的优化不是复制框架源码，而是继续把 continuous batching、chunked prefill、KV、prefix cache、graph、PD/EPD 等外显行为抽象成可配置语义层。",
  },
  {
    title: "优先补 Observe / Replay / Calibrate 的闭环能力",
    detail: "附文强调没有校准的数据容易沦为玩具。本项目最值得优先补强的是把实测采集、trace 回放、误差校准完整做成 Web 工作流。",
  },
  {
    title: "强化可解释性输出，而非只追求单个数字",
    detail: "应继续强化请求生命周期、阶段耗时、通信/带宽/队列瓶颈、trace 与 saturation 结果的图形化输出，这比再堆一个静态总分更重要。",
  },
  {
    title: "扩展数据面，但保持分层建模",
    detail: "模型库、硬件库、框架库、性能数据库可以继续扩容到更多开源/闭源模型与 2026 主流硬件，但解析模型、原生 DES、校准闭环这三层职责要继续分清。",
  },
];

export function Dashboard() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p>无法连接后端服务：{error}</p>;
  if (!config) return <p>正在加载平台信息…</p>;

  const entries = Object.entries(config.counts);
  const totalEntries = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel-strong">
        <div>
          <div className="eyebrow">推理性能控制台</div>
          <h2>平台总览</h2>
          <p>
            当前使用 curated 参考数据（schema v{config.schema_version}，数据目录：
            <code>{config.data_dir}</code>），并以 <strong>BLIS / inference-sim</strong> 为仿真基座，将
            模型、硬件、软件语义和输入/输出 token 长度统一映射到可解释的性能结果。
          </p>
          <p>
            平台既支持解析模型与组合仿真，也支持 BLIS 原生 run / replay / observe / calibrate 路径，
            用于回答“为什么这个组合快/慢”“瓶颈在哪”“仿真与实测差多少”这三类核心问题。
          </p>
        </div>
        <div className="hero-stats">
          <div className="mini-stat">
            <strong>{config.schema_version}</strong>
            <span>数据 schema 版本</span>
          </div>
          <div className="mini-stat">
            <strong>{totalEntries}</strong>
            <span>总数据条目</span>
          </div>
          <div className="mini-stat">
            <strong>4</strong>
            <span>核心影响因子</span>
          </div>
        </div>
      </section>

      <section className="toolbar-panel info-band">
        <div className="info-item">
          <strong>仿真工作台</strong>
          <span>统一承载平台组合仿真、Roofline 解析、BLIS 原生运行、Trace 回放、实测采集与校准报告。</span>
        </div>
        <div className="info-item">
          <strong>原生 BLIS 复用</strong>
          <span>不仅复用 latency model，还复用 workload、trace、cluster DES、saturation 与 calibrate 能力。</span>
        </div>
        <div className="info-item">
          <strong>解释优先</strong>
          <span>目标不是只给一个吞吐数字，而是解释模型、硬件、软件与 token 长度如何共同塑造结果。</span>
        </div>
      </section>

      <section className="detail-panel">
        <h3>技术洞察</h3>
        <p className="section-description">
          以下内容把原先分散在总览子菜单中的专题合并到一个板块中，统一覆盖技术原理、GitHub 项目、软件实践、架构设计、数学建模、arXiv 研究与趋势建议；每条结论均附真实链接。
        </p>
        <div className="topic-section-stack">
          {OVERVIEW_TOPICS.map((topic) => (
            <section className="insight-topic-group" key={topic.slug}>
              <div className="eyebrow">{topic.label}</div>
              <h4>{topic.title}</h4>
              <p>{topic.summary}</p>
              {topic.sections.map((section) => (
                <div className="insight-subsection" key={`${topic.slug}-${section.title}`}>
                  <strong>{section.title}</strong>
                  {section.description && <p className="section-description">{section.description}</p>}
                  <div className="insight-grid">
                    {section.items.map((item) => (
                      <article className="insight-card" key={`${topic.slug}-${item.title}`}>
                        <h4>{item.title}</h4>
                        <p>{item.summary}</p>
                        {item.takeaways && item.takeaways.length > 0 && (
                          <div className="insight-takeaways">
                            <strong>落地要点</strong>
                            <ul>
                              {item.takeaways.map((takeaway) => (
                                <li key={takeaway}>{takeaway}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="source-stack">
                          <strong>参考链接</strong>
                          {item.sources.map((source) => (
                            <div className="source-item" key={`${item.title}-${source.url}`}>
                              <a href={source.url} target="_blank" rel="noreferrer">
                                {source.label}
                              </a>
                              {(source.date || source.note) && (
                                <span>
                                  {source.date ? `${source.date}` : ""}
                                  {source.date && source.note ? " · " : ""}
                                  {source.note ? source.note : ""}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
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

      <section className="dashboard-grid">
        <section className="detail-panel">
          <h3>inference-sim / BLIS 仿真原理</h3>
          <div className="detail-list">
            {PRINCIPLES.map((item) => (
              <div className="detail-item" key={item}>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <h3>四个因子如何影响性能</h3>
          <div className="detail-list">
            {FACTORS.map((item) => (
              <div className="detail-item" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.detail}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="detail-panel">
        <h3>仿真如何从输入参数推导输出性能</h3>
        <div className="detail-list">
          <div className="detail-item">
            <span>第 1 步：建立结构与上界</span>
            <strong>
              先由模型结构和硬件参数推导 FLOPs、KV 大小、显存容量、带宽和互联上界，形成 roofline /
              latency backend 的基础代价。
            </strong>
          </div>
          <div className="detail-item">
            <span>第 2 步：注入软件语义</span>
            <strong>
              再引入推理框架语义：batch 形成、chunked prefill、prefix cache、graph、KV 量化、调度策略、
              route、PD/EPD、flow-control 等，把“软件配置”映射为真实 serving 行为差异。
            </strong>
          </div>
          <div className="detail-item">
            <span>第 3 步：按请求生命周期推进</span>
            <strong>
              请求依次经历 arrival → admit → route → queue → prefill → decode → complete，系统在每个阶段累计
              计算、访存、通信、KV 和排队成本，输出 TTFT、TPOT/ITL、E2E、throughput、preemption 等结果。
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="detail-panel">
          <h3>仿真数据 vs 真实实测数据</h3>
          <div className="detail-list">
            {DIFFERENCES.map((item) => (
              <div className="detail-item" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.detail}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <h3>使用仿真数据的注意事项</h3>
          <div className="detail-list">
            {CAUTIONS.map((item) => (
              <div className="detail-item" key={item}>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="detail-panel">
        <h3>基于附文筛选出的正确优化建议</h3>
        <div className="detail-list">
          {RECOMMENDATIONS.map((item) => (
            <div className="detail-item" key={item.title}>
              <span>{item.title}</span>
              <strong>{item.detail}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
