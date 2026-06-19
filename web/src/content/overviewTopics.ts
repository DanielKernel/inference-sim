export interface TopicSource {
  label: string;
  url: string;
  date?: string;
  note?: string;
}

export interface TopicItem {
  title: string;
  summary: string;
  takeaways?: string[];
  sources: TopicSource[];
}

export interface TopicSection {
  title: string;
  description?: string;
  items: TopicItem[];
}

export interface OverviewTopic {
  slug: string;
  label: string;
  title: string;
  summary: string;
  sections: TopicSection[];
}

export const OVERVIEW_TOPICS: OverviewTopic[] = [
  {
    slug: "insights",
    label: "技术洞察",
    title: "推理性能技术洞察与基本原理",
    summary: "聚焦影响 LLM serving 性能的关键机制：排队/批处理、Prefill/Decode 分离、KV Cache 复用，以及延迟优化的第一性原则。",
    sections: [
      {
        title: "关键机制",
        items: [
          {
            title: "Prefill 与 Decode 需要分开建模",
            summary:
              "BLIS 的集群架构文档、llm-d inference simulator 的延迟建模文档，以及 vLLM README 都把“首 token 之前”和“逐 token 解码”明确拆开。对仿真系统而言，这决定了 TTFT、ITL/TPOT、E2E 不能被一个单一 service-time 替代。",
            takeaways: [
              "把 TTFT 与逐 token 延迟拆成两个可校准的阶段输出。",
              "涉及 PD / disaggregation 时，把 KV 传输成本当成独立阶段而不是隐藏常数。 ",
            ],
            sources: [
              {
                label: "BLIS Cluster Architecture",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
                note: "明确描述 request lifecycle 和 observe → replay → calibrate 闭环。",
              },
              {
                label: "llm-d-inference-sim Latency Simulation",
                url: "https://github.com/llm-d/llm-d-inference-sim/blob/main/docs/latency-simulation.md",
                note: "给出 total_time≈prefill_time+decode_time，并解释 P/D 时 KV transfer 替代 TTFT。",
              },
              {
                label: "vLLM README",
                url: "https://github.com/vllm-project/vllm",
                note: "当前 README 把 continuous batching、chunked prefill、disaggregated prefill/decode/encode 作为核心能力列出。",
              },
            ],
          },
          {
            title: "队列策略与批处理等待时间直接塑造延迟/吞吐权衡",
            summary:
              "Ray Serve 的动态批处理文档把 max_batch_size、batch_wait_timeout_s 和 max_concurrent_batches 公开为一等参数。它提醒我们：即使不进入 token-step continuous batching，光是 queue wait 和 batch forming 就会改变服务表现。",
            takeaways: [
              "仿真面板要暴露 queue depth / batch wait 之类的控制面变量。",
              "结果页需要同时呈现 throughput 和 tail latency，而不是只看 TPS。",
            ],
            sources: [
              {
                label: "Ray Serve Dynamic Request Batching",
                url: "https://docs.ray.io/en/latest/serve/advanced-guides/dyn-req-batch.html",
                note: "文档直接说明请求先进入 queue，再按 max_batch_size 与 timeout 形成批。",
              },
            ],
          },
          {
            title: "KV Cache 不是细节，而是系统级性能杠杆",
            summary:
              "vLLM 的 PagedAttention 文章把内存碎片与过度预留定义为主要瓶颈，并给出 block-based KV 管理、共享前缀、Copy-on-Write 的具体机制。若仿真不建模 KV block、prefix reuse、cache locality，就很难解释吞吐和 admission 行为。",
            takeaways: [
              "需要在 trace 或 workload 中保留 prompt reuse / prefix overlap 信息。",
              "把 KV blocks、cache hits、reuse/eviction 设计成结果页可见指标。",
            ],
            sources: [
              {
                label: "vLLM launch blog",
                url: "https://blog.vllm.ai/2023/06/20/vllm.html",
                date: "2023-06-20",
                note: "说明 PagedAttention、KV block table、under 4% memory waste、copy-on-write prefix sharing。",
              },
              {
                label: "vLLM README",
                url: "https://github.com/vllm-project/vllm",
                note: "README 继续把 PagedAttention、prefix caching、continuous batching 作为主特性保留。",
              },
            ],
          },
          {
            title: "延迟优化首先取决于 token 处理速度与 token 数量",
            summary:
              "OpenAI 的 latency optimization 指南把“生成更少 token、并行化、减少请求次数、KV-friendly prompt layout”归纳为通用原则。它更像生产实践 sanity check，可用于校验仿真输出是否抓住真正的敏感变量。",
            takeaways: [
              "结果解读要强调 output tokens 对延迟的线性影响通常大于 prompt 缩短。",
              "最大化共享 prompt prefix 既是生产优化，也是 replay 数据需要采集的结构化信息。",
            ],
            sources: [
              {
                label: "OpenAI Latency Optimization Guide",
                url: "https://platform.openai.com/docs/guides/latency-optimization",
                note: "列出 seven principles，并明确输出 token 往往是主导延迟项。",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "github-projects",
    label: "GitHub 项目",
    title: "业界相关仿真 GitHub 项目综述",
    summary: "优先展示与 LLM serving simulation、可重放 benchmarking、调度/缓存实验最直接相关的仓库。",
    sections: [
      {
        title: "高信号仓库",
        items: [
          {
            title: "BLIS / inference-sim",
            summary:
              "一个 CPU-only、deterministic 的 LLM 推理离散事件仿真器，覆盖 routing、KV cache、observe/replay/calibrate、saturation、autoscaling，是本平台最直接的对标对象。",
            takeaways: [
              "强项在于从 workload spec 到 trace/replay/calibration 的完整链路。",
              "适合放在总览页中作为“预测 + 实测闭环”的主线案例。",
            ],
            sources: [
              {
                label: "inference-sim README",
                url: "https://github.com/inference-sim/inference-sim",
              },
              {
                label: "Cluster Architecture",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
                note: "展示 shared-clock event loop、admission、routing、gateway queue、metrics aggregation。",
              },
              {
                label: "Latency Models",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/guide/latency-models.md",
                note: "解释 roofline 与 trained-physics 两套后端如何并存。",
              },
            ],
          },
          {
            title: "llm-d-inference-sim",
            summary:
              "一个“像 vLLM，但不需要 GPU”的实时模拟服务，重点是 OpenAI-compatible server、可配置 TTFT/ITL、并发负载、LoRA/KV cache 事件与 PD 传输延迟。",
            takeaways: [
              "非常适合对比“控制平面测试替身”与“真正 DES 预测器”的边界。",
              "如果总览页要解释 mock simulator 与 predictive simulator 的区别，它是理想例子。",
            ],
            sources: [
              {
                label: "llm-d-inference-sim README",
                url: "https://github.com/llm-d/llm-d-inference-sim",
              },
              {
                label: "Latency Simulation",
                url: "https://github.com/llm-d/llm-d-inference-sim/blob/main/docs/latency-simulation.md",
                note: "把 TTFT、ITL、load factor 和 P/D KV transfer 写成显式公式。",
              },
            ],
          },
          {
            title: "vLLM",
            summary:
              "不是仿真器，而是最重要的 serving system 参考实现之一。它把 PagedAttention、continuous batching、chunked prefill、prefix caching、disaggregated prefill/decode/encode 变成了工程事实。",
            takeaways: [
              "适合在总览页作为“生产 serving 语义来源”，帮助解释仿真为何要建模这些机制。",
            ],
            sources: [
              {
                label: "vLLM README",
                url: "https://github.com/vllm-project/vllm",
              },
              {
                label: "vLLM Blog: PagedAttention",
                url: "https://blog.vllm.ai/2023/06/20/vllm.html",
                date: "2023-06-20",
              },
            ],
          },
          {
            title: "SGLang",
            summary:
              "同样不是完整预测仿真器，但仓库内自带 schedule simulator/debug utility，并在 benchmark/hicache 中沉淀了 cache-aware serving 的实验方法。",
            takeaways: [
              "适合在项目综述里作为“服务系统内嵌 scheduler simulator”的例子。",
            ],
            sources: [
              {
                label: "SGLang repo",
                url: "https://github.com/sgl-project/sglang",
              },
            ],
          },
          {
            title: "ASTRA-sim / SimGrid",
            summary:
              "这两者更偏通用系统仿真：ASTRA-sim 强调 workload/system/network 分层；SimGrid 强调成熟的 kernel/plugin 框架。它们对 inference 仿真页最有价值的部分是架构抽象方法，而不是 TTFT/ITL 指标本身。",
            takeaways: [
              "适合作为“为什么仿真系统需要清晰分层与插件边界”的对照材料。",
            ],
            sources: [
              {
                label: "ASTRA-sim repo",
                url: "https://github.com/astra-sim/astra-sim",
              },
              {
                label: "SimGrid repo",
                url: "https://github.com/simgrid/simgrid",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "software",
    label: "软件与实践",
    title: "商用及开源仿真软件分析与优秀实践",
    summary: "从成熟仿真软件提炼值得迁移到推理性能平台的经验：多方法建模、模块化内核、资源/队列抽象与可交互实验工作流。",
    sections: [
      {
        title: "软件侧观察",
        items: [
          {
            title: "AnyLogic：把离散事件、Agent、System Dynamics 混合到一套多方法建模中",
            summary:
              "AnyLogic 官方离散事件页面强调 multimethod simulation：实体既能处于流程图中的资源角色，也能拥有独立状态机。对推理仿真平台来说，这提示我们不要把 router、instance、queue、autoscaler 强行塞进同一种抽象。",
            takeaways: [
              "对 control-plane、queueing 与 per-instance state 采用不同抽象是合理的。",
              "如果后续要扩展成本、能耗、容量规划，multimethod 比单一公式更稳健。",
            ],
            sources: [
              {
                label: "AnyLogic discrete-event modeling",
                url: "https://www.anylogic.com/use-of-simulation/discrete-event-simulation/",
              },
            ],
          },
          {
            title: "OMNeT++：组件化、模块化、可嵌入内核",
            summary:
              "OMNeT++ README 直接把自己定义为 public-source、component-based、modular、open-architecture，并强调 embeddable simulation kernel。它说明长期可维护的仿真系统通常会把内核、模型组件、GUI/analysis 松耦合。",
            takeaways: [
              "对推理仿真平台而言，内核、建模层、Web 可视化层最好保持独立演化。",
            ],
            sources: [
              {
                label: "OMNeT++ README",
                url: "https://github.com/omnetpp/omnetpp",
              },
              {
                label: "OMNeT++ official site",
                url: "https://omnetpp.org/",
              },
            ],
          },
          {
            title: "SimPy：轻量但清晰的 process-based DES",
            summary:
              "SimPy 文档把 generator-based process 与 shared resources 讲得非常清楚：客户、车辆、服务台、隧道都能建成 process + resource。它适合提醒我们：很多 serving 行为最终都能回落到 process/resource/timeout 三元组。",
            takeaways: [
              "复杂系统的第一版模型可以先用 process/resource 解释，再逐渐引入 GPU/KV 专有细节。",
            ],
            sources: [
              {
                label: "SimPy docs overview",
                url: "https://simpy.readthedocs.io/en/latest/index.html",
              },
            ],
          },
          {
            title: "优秀实践：把实验、trace、结果导出做成产品能力，而不是只给一个指标",
            summary:
              "成熟工具共同的最佳实践不是“更复杂的公式”，而是让用户能回放实验、观察中间状态、输出可分享产物。BLIS 的 TraceV2 与 Vidur 的 simulator_output/chrome traces 都证明了这一点。",
            takeaways: [
              "结果导出、trace 复现、指标解释层与数值本身同样重要。",
            ],
            sources: [
              {
                label: "BLIS architecture docs",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
              },
              {
                label: "Vidur README",
                url: "https://github.com/microsoft/vidur",
                note: "README 说明 simulator_output 与 Chrome trace 导出能力。",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "architecture",
    label: "架构设计",
    title: "仿真系统架构设计与关键技术",
    summary: "从 BLIS、Vidur、ASTRA-sim 等项目中抽取可迁移的架构模式：事件内核、校准后端、分层工作负载与插件边界。",
    sections: [
      {
        title: "推荐架构模式",
        items: [
          {
            title: "共享时钟 + 确定性事件排序",
            summary:
              "BLIS 的 cluster architecture 文档明确采用 shared-clock event loop，并在集群层与实例层都强调 event ordering。这类设计非常适合做可回放、可对比、可回归的 serving simulator。",
            takeaways: [
              "把 determinism 当成产品特性：同一 trace、同一 seed、同一配置应得到可复现结果。",
            ],
            sources: [
              {
                label: "BLIS Cluster Architecture",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
              },
            ],
          },
          {
            title: "工作负载、系统、网络分层建模",
            summary:
              "ASTRA-sim 把 workload、system、network_frontend 拆开；Vidur 也把 profiling 数据分为 compute 和 network。对推理仿真平台来说，这种分层能让 workload trace、GPU 代价模型、互联模型分别演进。",
            takeaways: [
              "避免把 workload sampling、hardware calibration、routing policy 混到同一个大对象里。",
            ],
            sources: [
              {
                label: "ASTRA-sim repo",
                url: "https://github.com/astra-sim/astra-sim",
              },
              {
                label: "Vidur profiling docs",
                url: "https://github.com/microsoft/vidur/blob/main/docs/profiling.md",
                note: "区分 compute profiling 与 network profiling，并说明 once profiled, simulations can be run on CPUs only。",
              },
            ],
          },
          {
            title: "可插拔延迟后端比“一次性拟合”更可持续",
            summary:
              "BLIS 当前把 roofline 与 trained-physics 并列成 latency backends。前者用于纯分析，后者用于物理启发 + 学习系数校正。这个模式比单次 benchmark 拟合更适合长期扩展到新模型、新硬件。",
            takeaways: [
              "页面里应明确区分“解析估算”“原生 DES”“实测回放校准”三种证据等级。",
            ],
            sources: [
              {
                label: "BLIS Latency Models",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/guide/latency-models.md",
              },
            ],
          },
          {
            title: "闭环优先：Observe → Replay → Calibrate",
            summary:
              "BLIS 的架构文档把 observe/replay/calibrate 画成独立 pipeline；这比只做“离线 benchmark”更适合产品化，因为它能解释误差来自 workload、sim config 还是 latency model。",
            takeaways: [
              "Replay 与 calibrate 应被视为一等入口，而非附属工具。",
            ],
            sources: [
              {
                label: "BLIS Observe / Replay / Calibrate pipeline",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "modeling",
    label: "数学建模",
    title: "数学建模参考与指标设计",
    summary: "给出更适合推理仿真系统的建模入口：roofline、物理启发校正、阶段分解、goodput/SLO 视角，以及 trace-driven 校准。",
    sections: [
      {
        title: "建模建议",
        items: [
          {
            title: "用 roofline 做“上界 + 可解释”底座",
            summary:
              "BLIS 的 roofline 模式明确把 step time 建立在 FLOPs、HBM 带宽、模型结构和 TP 上；这很适合做冷启动估算、硬件迁移、what-if 分析的第一层模型。",
            takeaways: [
              "把 FLOPs、带宽、KV 可容纳量和并行度做成可解释输入，不要只给黑盒回归数。",
            ],
            sources: [
              {
                label: "BLIS Latency Models",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/guide/latency-models.md",
              },
            ],
          },
          {
            title: "用 physics-informed 校正连接“解析模型”和“真实系统”",
            summary:
              "BLIS 的 trained-physics 用 roofline basis + learned correction coefficients；Vidur 也要求先做 quick initial profiling，再 CPU-only 运行大规模仿真。两者共同指向一个结论：生产级仿真需要“可解释基座 + 校正项”。",
            takeaways: [
              "系数或 profile 应与模型/硬件版本绑定，避免脱离上下文复用。",
            ],
            sources: [
              {
                label: "BLIS trained-physics backend",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/guide/latency-models.md",
              },
              {
                label: "Vidur README",
                url: "https://github.com/microsoft/vidur",
                note: "README 提到 quick initial profiling phase 之后即可无 GPU 运行仿真。",
              },
            ],
          },
          {
            title: "指标不要只盯 tokens/s，至少同时看 TTFT、ITL/TPOT、E2E、goodput",
            summary:
              "OpenAI 的延迟指南提醒“输出 token 往往主导时延”；DistServe 等论文又把 SLO-constrained goodput 变成比较指标。对总览页而言，吞吐只是结果之一，是否满足 TTFT/ITL 目标同样重要。",
            takeaways: [
              "页面设计上要把 goodput 与 tail latency 作为一等结果，而不是备注。",
            ],
            sources: [
              {
                label: "OpenAI Latency Optimization Guide",
                url: "https://platform.openai.com/docs/guides/latency-optimization",
              },
              {
                label: "DistServe title search",
                url: "https://arxiv.org/search/?query=DistServe%3A+Disaggregating+Prefill+and+Decoding+for+Goodput-optimized+LLM+Serving&searchtype=title",
                date: "2024",
              },
            ],
          },
          {
            title: "Replay 数据需要保留长度分布与前缀重用，而不只是平均 QPS",
            summary:
              "InferLine 强调 trace-driven evaluation；vLLM 与 prefix caching 资料则说明 prompt overlap 直接影响系统开销。仿真 trace 至少应保留 input/output lengths、arrival pattern、prefix overlap、streaming/ITL 信息。",
            takeaways: [
              "“平均请求长度”不够；需要长度分布和 burstiness。",
            ],
            sources: [
              {
                label: "InferLine title search",
                url: "https://arxiv.org/search/?query=InferLine%3A+ML+Prediction+Pipeline+Provisioning+and+Management+for+Tight+Latency+Objectives&searchtype=title",
                date: "2020",
              },
              {
                label: "vLLM PagedAttention blog",
                url: "https://blog.vllm.ai/2023/06/20/vllm.html",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "papers",
    label: "arXiv 研究",
    title: "arXiv 学术论文结论与最新进展",
    summary: "筛选对 inference simulation、serving 调度、相位分离和校准最有用的论文，输出偏工程决策的结论。",
    sections: [
      {
        title: "高信号论文卡片",
        items: [
          {
            title: "Vidur: A Large-Scale Simulation Framework for LLM Inference",
            summary:
              "最直接面向“LLM serving simulation”的论文之一，核心价值是把 workload、phase-level execution、调度与 memory/KV 行为纳入同一高保真模拟器，并用真实系统验证关键指标。",
            takeaways: [
              "对产品最重要的启示是：校准与验证的广度，和模拟器本身同样重要。",
            ],
            sources: [
              {
                label: "arXiv",
                url: "https://arxiv.org/abs/2405.05465",
                date: "2024-05",
              },
              {
                label: "Vidur repo",
                url: "https://github.com/microsoft/vidur",
              },
            ],
          },
          {
            title: "Efficient Memory Management for Large Language Model Serving with PagedAttention",
            summary:
              "vLLM 论文把 KV cache 管理从实现细节提升为吞吐/容量核心变量，并与 PagedAttention、memory sharing、continuous batching 形成一套完整工程叙事。",
            takeaways: [
              "任何不建模 KV allocation / prefix sharing 的推理仿真，都会高估可用并发或低估内存压力。",
            ],
            sources: [
              {
                label: "arXiv",
                url: "https://arxiv.org/abs/2309.06180",
                date: "2023-09",
              },
            ],
          },
          {
            title: "Sarathi-Serve / Splitwise / DistServe",
            summary:
              "这三类工作共同指向一个趋势：prefill 与 decode 的调度、分离和 piggyback 机制，会显著改变 TTFT/TPOT/goodput 前沿；也说明 serving simulator 不应把两者当成同构阶段。",
            takeaways: [
              "若路线图要扩展到 disaggregated serving，这是最值得优先跟踪的一组论文。",
            ],
            sources: [
              {
                label: "Sarathi-Serve title search",
                url: "https://arxiv.org/search/?query=Sarathi-Serve%3A+Efficient+LLM+Inference+by+Piggybacking+Decodes+with+Chunked+Prefills&searchtype=title",
                date: "2024",
              },
              {
                label: "Splitwise title search",
                url: "https://arxiv.org/search/?query=Splitwise%3A+Efficient+Generative+LLM+Inference+Using+Phase+Splitting&searchtype=title",
                date: "2023",
              },
              {
                label: "DistServe title search",
                url: "https://arxiv.org/search/?query=DistServe%3A+Disaggregating+Prefill+and+Decoding+for+Goodput-optimized+LLM+Serving&searchtype=title",
                date: "2024",
              },
            ],
          },
          {
            title: "Clockwork / InferLine",
            summary:
              "虽然不是 LLM-only 论文，但它们把 predictable serving、trace-driven provisioning、SLO-aware planning 说得非常透。它们对“如何做 replay / calibrate / capacity planning”依然有长期价值。",
            takeaways: [
              "对平台建设而言，这两篇更像方法论文：告诉你如何把预测与运维控制结合起来。",
            ],
            sources: [
              {
                label: "Clockwork",
                url: "https://arxiv.org/abs/2006.02464",
                date: "2020-06",
              },
              {
                label: "InferLine title search",
                url: "https://arxiv.org/search/?query=InferLine%3A+ML+Prediction+Pipeline+Provisioning+and+Management+for+Tight+Latency+Objectives&searchtype=title",
                date: "2020",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "trends",
    label: "趋势与建议",
    title: "仿真技术未来趋势与后续落地建议",
    summary: "根据当前仓库、官方文档和论文信号，提炼未来 1–3 个迭代周期最值得落地的方向。",
    sections: [
      {
        title: "未来趋势",
        items: [
          {
            title: "从“单机推理延迟”转向“多阶段 serving system 仿真”",
            summary:
              "vLLM README 已经把 disaggregated prefill/decode/encode 列为主特性；DistServe/Splitwise/Sarathi-Serve 也都在强调阶段分离。未来平台的竞争力更可能来自跨阶段调度仿真，而不是更复杂的单式 latency predictor。",
            sources: [
              {
                label: "vLLM README",
                url: "https://github.com/vllm-project/vllm",
              },
              {
                label: "DistServe title search",
                url: "https://arxiv.org/search/?query=DistServe%3A+Disaggregating+Prefill+and+Decoding+for+Goodput-optimized+LLM+Serving&searchtype=title",
              },
            ],
          },
          {
            title: "从吞吐分数转向 SLO / goodput / replay calibration",
            summary:
              "OpenAI latency guide 与 DistServe/Clockwork 类工作都指向一个事实：用户最终关心的是满足约束条件的“可用吞吐”，而不是脱离上下文的峰值 TPS。",
            sources: [
              {
                label: "OpenAI Latency Optimization Guide",
                url: "https://platform.openai.com/docs/guides/latency-optimization",
              },
              {
                label: "Clockwork",
                url: "https://arxiv.org/abs/2006.02464",
              },
            ],
          },
          {
            title: "从静态默认参数转向“观测产物自动回填”",
            summary:
              "BLIS 与 llm-d-inference-sim 都证明 trace/replay/configuration artifacts 是产品资产。Web 工具层应该尽量复用最近一次 Observe/Replay 产物，减少把 pipeline 中间件当成手工参数搬运。",
            sources: [
              {
                label: "BLIS architecture",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
              },
              {
                label: "llm-d-inference-sim README",
                url: "https://github.com/llm-d/llm-d-inference-sim",
              },
            ],
          },
        ],
      },
      {
        title: "后续落地建议",
        items: [
          {
            title: "建议 1：把“最近一次 Observe / Replay 工件”提升为正式状态",
            summary:
              "当前最实用的用户体验提升，是让 Replay/Calibrate 默认复用最近一次 trace 与 sim results，并在 UI 明示默认来源。",
            sources: [
              {
                label: "BLIS pipeline reference",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/concepts/architecture.md",
              },
            ],
          },
          {
            title: "建议 2：在总览中区分三类证据等级",
            summary:
              "建议把“解析模型估算”“DES 原生仿真”“实测回放校准”标成不同证据层级，降低用户误把 heuristic estimate 当成 empirical truth 的风险。",
            sources: [
              {
                label: "BLIS Latency Models",
                url: "https://github.com/inference-sim/inference-sim/blob/main/docs/guide/latency-models.md",
              },
            ],
          },
          {
            title: "建议 3：优先补强 prefix overlap / ITL / goodput 的可视化",
            summary:
              "从 vLLM、OpenAI latency guide 与 DistServe 的信号看，prefix friendliness、ITL 和 goodput 都是比平均延迟更接近真实使用体验的指标，适合优先做成总览专题图表。",
            sources: [
              {
                label: "vLLM blog",
                url: "https://blog.vllm.ai/2023/06/20/vllm.html",
              },
              {
                label: "OpenAI Latency Optimization Guide",
                url: "https://platform.openai.com/docs/guides/latency-optimization",
              },
              {
                label: "DistServe title search",
                url: "https://arxiv.org/search/?query=DistServe%3A+Disaggregating+Prefill+and+Decoding+for+Goodput-optimized+LLM+Serving&searchtype=title",
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getOverviewTopic(slug?: string): OverviewTopic | undefined {
  return OVERVIEW_TOPICS.find((topic) => topic.slug === slug);
}
