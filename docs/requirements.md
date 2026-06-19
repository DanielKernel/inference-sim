# 需求描述文档（Requirements）

> 状态：草拟中（v0.1）。本文件为持续更新文档，随阶段推进修订；变更见文末“变更记录”。
> 关联：`docs/architecture.md`（架构）、`docs/issues/`（执行追踪）、
> `docs/UPSTREAM-DELTAS.md`（基座同步约束）。

## 1. 背景与定位

基于开源 **BLIS（inference-sim）** 离散事件仿真器，构建一个面向大模型推理的**性能平台**：
围绕“**模型 + 硬件 + 输入/输出长度 + 推理框架**”四要素，提供可视化界面、四大参考库、解析
性能模型、公开性能数据库，以及“优化手段可选”的组合仿真系统。

参考设计：`ascend_qwen_inference_sim_research.pdf`。首期采用**垂直切片**策略，聚焦
**华为 Ascend + Qwen**，schema 与引擎保持通用，便于后续横向扩展到其他厂商/模型/框架。

## 2. 角色与目标用户

- 容量规划/性能工程师：评估不同组合下的 TTFT/TPOT/吞吐与瓶颈。
- 推理框架/硬件选型决策者：横向对比模型、硬件、框架、场景。
- 研究/优化人员：分析优化手段组合的收益与全流程性能消耗分段。

## 3. 总体目标

1. **可视化界面**：支持配置修改与结果查看/对比。
2. **四大参考库**：模型库、硬件库、推理框架（优化手段）库、应用场景库；均支持按过滤条件
   查询与多项对比。
3. **解析性能模型**：建立“模型+硬件+输入输出长度”的推理性能模型，给出公式、原理示意、变化
   曲线、流程分段消耗、计算示意，推导 TTFT/TPOT 极限，并提供可交互动态示意与性能拐点对应的
   硬件限制。
4. **性能数据库**：沉淀“模型+硬件+输入输出长度+软件”业界公开性能数据，含完整测试条件与环境，
   支持过滤查询。
5. **组合仿真系统**：选择四要素后，综合所有可用优化手段，仿真最差/最佳/典型性能并展示所用
   加速手段；支持手动勾选/取消优化手段、清单化管理、同组合不同手段对比、不同组合对比，以及
   针对某结果的全流程性能消耗图形化分解以定位瓶颈。
6. **BLIS 原生能力复用**：`third_party/inference-sim` 已支持的原生命令与仿真能力（`run / replay / observe / calibrate`、
   workload synthesis、trace pipeline、routing / scheduling / flow-control / PD / EPD / autoscaling /
   saturation / goodput 等）必须作为平台正式能力纳入需求范围，并逐步通过 Web UI 呈现，而不是只保留
   在 CLI 内部。

## 4. 功能需求

### 4.1 可视化界面（UI）
- 配置编辑：选择/修改模型、硬件、IO 长度、框架与优化手段、工作负载参数。
- 结果查看：指标卡片、曲线、瓶颈分段（瀑布/堆叠）、对比视图。
- 技术栈：React + TypeScript 前端 + Go HTTP API（见架构文档）。
- 运行方式：支持**一键构建、部署和运行**，自动打开 Web 页面完成配置、仿真和结果查看，并覆盖
  **Ubuntu、Windows、macOS** 三个操作系统。
- **Web UI 复用目标**：除当前平台组合仿真外，Web 还应逐步提供 BLIS 原生的 `Run / Replay / Observe /
  Calibrate / Saturation / Trace` 能力入口，形成统一的 Simulation Studio，而不是把这些功能散落在 CLI 中。

### 4.2 模型库
- 覆盖分类：LLM、VLM、Omni、语音、Embedding。
- 字段：结构参数（层数/隐藏维/头数/GQA·MLA/MoE/上下文长度等）、关键创新算法、量化支持、
  技术报告与三方测试报告链接/数据。
- 能力：按分类/厂商/规模/能力等过滤查询；多模型对比。

### 4.3 硬件库
- 覆盖：2026 主力发货 GPU/NPU/TPU 芯片、整机、集群。
- 字段：算力（FP16/FP8/INT8）、功耗、显存容量与带宽、互联（HCCS/NVLink 等）拓扑与带宽。
- 能力：为每个硬件建立 **roofline 模型**，可查看计算 bound/存储 bound 临界点（ridge point）；
  按过滤条件查询；多硬件对比。

### 4.4 推理框架（优化手段）库
- 覆盖：vLLM、vllm-ascend、SGLang、xLLM、TensorRT-LLM 等。
- 内容：各框架的优化手段（KV Cache/分页、chunked prefill、投机推理、prefix cache、量化、
  graph/ACL 模式、通信优化、PD 分离等）的实现与可用性、起始版本。
- 能力：按条件查询；多框架对比。

### 4.5 应用场景库
- 覆盖：对话、RAG、摘要、代码、推理（thinking）、语音 ASR/TTS 等。
- 内容：典型输入/输出 token 组合（典型/最小/最大）。
- 能力：**双向查询**（场景→大小、大小→场景）；多场景对比。

### 4.6 解析性能模型（对应需求 5.1）
- 公式：由 roofline FLOPs/带宽推导 prefill(TTFT) 与 decode(TPOT)，并返回各项（计算/访存/通信）。
- 拐点：计算 ridge point 与计算 bound/存储 bound 边界；标注引发拐点的硬件限制。
- 曲线：TTFT/TPOT 随 ISL/OSL/batch/TP/量化变化；算术强度—可达 FLOPS。
- 分段：QKV 投影、注意力、FFN、AllReduce/通信、KV 读取、采样等分段消耗。
- 交互：滑杆改变输入实时查看输出性能与当前瓶颈，配合公式渲染与示意图。

### 4.7 性能数据库（对应需求 5.2）
- 记录字段：模型、硬件、框架及版本、驱动/CANN、ISL/OSL、batch/并发、量化、TP/PP、实测
  TTFT/ITL/吞吐/E2E、测试条件、来源（URL+日期）。
- 强约束：所有数据须标注真实来源与完整测试条件；占位数据须显式标注为占位。
- 能力：按过滤条件查询并展示出处。

### 4.8 组合仿真系统（对应需求 5.3）
- 输入：模型 + 硬件 + IO 长度 + 软件（框架）。
- 扩展输入：支持运行时版本、CANN 版本、Graph 模式、量化模式、通信模式等软件栈维度。
- 自动模式：综合可用优化手段，输出**最差/最佳/典型**性能，并标注每个结果所用加速手段。
- 手动模式：优化手段清单化，支持勾选/取消，依赖与互斥校验后重算。
- 对比：同组合不同手段集合对比；不同组合对比。
- 诊断：针对某结果，图形化展示推理全流程各段性能消耗，定位瓶颈并给出优化方向。

### 4.9 BLIS 原生仿真能力复用（新增）

> 代码依据：`third_party/inference-sim/cmd/root.go`、`cmd/replay.go`、`cmd/observe_cmd.go`、
> `cmd/calibrate.go`、`sim/cluster/deployment.go`、`sim/workload/spec.go`、`sim/metrics.go`。

- **4.9.1 Run / Cluster DES**
  - 平台不仅要支持“平台组合仿真”，还要支持 BLIS 原生 cluster DES 路径；
  - Web 应可配置模型、硬件、TP、实例数、arrival process、路由策略、调度策略、抢占策略、KV blocks、
    max running reqs、max scheduled tokens 等核心 run 参数；
  - 结果应展示完成请求数、TTFT/ITL/E2E 分位数、吞吐、preemption、queue/drop 统计等聚合指标。
- **4.9.2 Replay / Trace 回放**
  - 支持导入 TraceV2 header/data 文件，在 Web 中回放真实或生成请求序列；
  - 支持 fixed / closed-loop 会话模式、think time 配置、trace re-export，以及与 run 路径的策略参数复用。
- **4.9.3 Observe / Real Server 采集**
  - 支持将 workload 发送到真实 OpenAI-compatible 服务，记录 TraceV2；
  - 支持 workload-spec、preset、rate-mode、concurrency-mode、RTT、ITL 录制、prewarm、warmup、goodput SLO。
- **4.9.4 Calibrate / 仿真校准**
  - 支持导入 observe 产出的 TraceV2 与 replay 产出的 SimResult，生成 calibration report；
  - 支持 TTFT / E2E / ITL 误差、warm-up 排除、network RTT/bandwidth 调整、goodput 比较。
- **4.9.5 Workload 建模**
  - 支持 open-loop 与 closed-loop 两类 workload；
  - 到达过程覆盖 `poisson / gamma / weibull / constant`；
  - 长度分布覆盖 `gaussian / exponential / pareto_lognormal / lognormal / empirical / constant`；
  - 支持 cohort、diurnal、spike、drain、prefix sharing、multi-turn reasoning、multimodal。
- **4.9.6 高级 serving 机制**
  - 支持 weighted routing scorer、prefix cache scorer、gateway flow control、TTL / queue shedding /
    in-flight eviction、PD disaggregation、EPD encode pool、autoscaler、post-hoc saturation、goodput。

### 4.10 当前实现与目标覆盖矩阵（新增）

| 能力 | 当前代码状态 | Web/UI 状态 | 目标 |
|------|-------------|------------|------|
| 四大参考库查询与对比 | 已实现首版（`apiserver/server.go`、`web/src/pages/LibraryPage.tsx`） | 已接入 | 继续扩库到主流开源/闭源模型、硬件、框架、场景 |
| 解析模型（TTFT/TPOT/roofline/breakdown） | 已实现首版（`apiserver/analytic.go`） | 已接入 | 补公式渲染、动态示意、更多曲线维度 |
| 性能数据库查询与 benchmark 对照 | 已实现首版（`web/src/pages/PerfDatabasePage.tsx`） | 已接入 | 扩充更多公开组合与过滤维度 |
| 平台组合仿真 | 已实现首版（`apiserver/simulate.go`、`web/src/pages/SimulationPage.tsx`） | 已接入 | 补更完整的组合-组合对比与图形化瓶颈诊断 |
| BLIS Native Run | 已实现首版（`apiserver/blis.go`） | 已接入 | 继续扩充更多原生命令参数 |
| BLIS Replay / Observe / Calibrate | 基座已实现（`cmd/replay.go`、`cmd/observe_cmd.go`、`cmd/calibrate.go`） | **尚未接入 Web** | 必须补齐为 Web 工作台入口 |
| Flow control / PD / EPD / autoscaler / saturation | 基座已实现（`sim/cluster/*.go`） | **尚未形成完整 Web 控制面** | 必须逐步补齐参数面板、结果视图与 trace 诊断 |

## 5. 非功能需求与约束

- **基座可独立同步**（硬约束）：BLIS 基座位于 `third_party/inference-sim/`，独立 Go 模块，平台
  **零修改基座**；升级走 `scripts/update-base.sh`，详见 `docs/UPSTREAM-DELTAS.md`。
- **可加性**：扩展仅新增根目录模块/目录，不改 `cmd/` 与 `sim/`。
- **确定性**：解析接口为纯函数/确定性；遵循基座 INV-6（同种子 stdout 一致）原则。
- **数据严格性**：curated 数据严格解析（未知字段拒绝）、provenance 必填。
- **工程标准**：沿用基座 BDD/TDD、表驱动测试与不变量/规则（见基座 `docs/contributing/`）。

## 6. 范围与优先级

- 首期（Ascend + Qwen）：Qwen2.5/3/3.5 dense 文本模型、Ascend 910B/950/310P、vllm-ascend；
  其余厂商/模型/框架以少量种子保证 schema 通用性。
- 后续：横向扩展模型/硬件/框架覆盖，VL/Omni/MoE/thinking、HCCS 通信与量化保真、自动校准，并把
  BLIS 的 replay / observe / calibrate / advanced cluster controls 全部纳入 Web 工作台。

## 7. 路线图（阶段）

| 阶段 | 目标 | 主要交付 |
|------|------|----------|
| Phase 0 | 基础设施 | API 骨架、库加载器、Web 骨架、CI、双模块拆分 |
| Phase 1 | 四大库 | 数据 + 过滤/对比 API + 浏览/对比 UI |
| Phase 2 | 解析模型 | TTFT/TPOT、ridge point、曲线、分段、交互示意 |
| Phase 3 | 性能数据库 | 带完整测试条件的公开数据 + 查询 UI |
| Phase 4 | 组合仿真 | 优化手段目录 + 最差/最佳/典型 + 对比 + 瀑布分解 |
| Phase 5 | Ascend 保真 + 泛化 | Ascend 延迟/通信/量化建模、profile 校准、扩库 |
| Phase 6 | BLIS 全量复用 | Replay / Observe / Calibrate / Trace / Flow-control / PD / EPD / Autoscaler / Saturation Web 化 |

执行以 `docs/issues/` 跟踪。

## 8. 验收要点（首期，参考设计报告误差容忍度）

- TTFT P50 误差目标 < 15%，ITL mean < 20%，吞吐 < 15%（针对常见组合）；实验性组合放宽。

## 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-06-19 | 初稿：依据用户需求与设计报告整理，确立五大功能 + UI + 阶段路线图与基座同步约束。 |
| v0.2 | 2026-06-19 | 将 `third_party/inference-sim` 的原生命令与高级 cluster 能力纳入正式需求范围，新增 Web 覆盖矩阵与 Phase 6（BLIS 全量复用）。 |
