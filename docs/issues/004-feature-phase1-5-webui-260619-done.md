# [004] Phase 1~5 首版能力接入（Library Compare / Analytics / BLIS Native / UI Refresh）

| 字段 | 内容 |
|------|------|
| 编号 | 004 |
| 类型 | feature |
| 状态 | done |
| 创建时间 | 2026-06-19 |
| 优先级 | P0 |
| 关联阶段 | Phase 1~5 |
| 来源文档 | `docs/requirements.md`、`docs/architecture.md`、[Issue #001](001-proposal-inference-perf-platform-260619-wip.md)、[Issue #002](002-feature-platform-scaffolding-260619-wip.md) |

---

## 背景

Phase 0 已具备平台骨架，但 Web 仍主要围绕 vllm-ascend 的启发式组合仿真，未覆盖后续阶段要求的
参考库对比、解析模型视图，以及 inference-sim 原生 DES 仿真入口。

## 目标

- **Phase 1**：让四大库至少具备首版字段级对比与更丰富的过滤能力。
- **Phase 2**：增加显式解析模型接口和 Web 视图，输出 ridge point、曲线与瓶颈分解。
- **Phase 3**：保留并强化性能数据库查询/对照分析在 Web 里的入口。
- **Phase 4**：将组合仿真从单一路径页面升级为 Simulation Studio 的正式模式之一。
- **Phase 5**：除 vllm-ascend 之外，把 `third_party/inference-sim` 的原生 cluster DES 能力接入 Web。

## 实现内容

- 后端新增：
  - `POST /api/library/{kind}/compare`：对模型 / 硬件 / 框架 / 场景 / 优化手段做字段差异对比；
  - `POST /api/analytic/estimate`：返回 TTFT / TPOT / ridge point / 曲线 / breakdown；
  - `POST /api/combosim/simulate`：明确平台组合仿真接口；
  - `POST /api/blis/simulate`：直接通过 `third_party/inference-sim` 的包级 API 跑原生 cluster DES。
- 新增 `apiserver/estimate.go`、`analytic.go`、`library_query.go`、`blis.go`，将解析模型、库对比和 BLIS
  原生仿真从单一 `simulate.go` 中解耦出来。
- 扩展 `library.Hardware` schema，加入 `calibration` 字段，并为 Ascend / NVIDIA GPU 补充校准元数据，
  使 Web 可在不修改基座的前提下驱动 roofline / DES 路径。
- 新增 `data/hardware/gpu.yaml`、`data/frameworks/general.yaml`，让参考库与 Web 不再只展示 Ascend /
  vllm-ascend 组合。
- 前端把 `SimulationPage` 升级为 **Simulation Studio**：
  - Platform Combosim；
  - Roofline Analytics；
  - BLIS Native DES。
- 更新 `LibraryPage`，增加库内勾选多项后的字段差异对比面板；更新 Dashboard 与导航文案；整体继续强化
  卡片、tab、工作台式布局和信息层次。

## 验证

- `go test ./apiserver/... ./library/...`
- `cd web && npm run build`

## 下一步（可选）

- 扩充 perfdb 的非 Ascend 公开数据；
- 将 BLIS 原生模式继续扩展到更完整的 workload / flow-control / routing 参数面；
- 用真实 observe/calibrate 数据替换当前 `calibration.status=assumed` 的硬件项。
