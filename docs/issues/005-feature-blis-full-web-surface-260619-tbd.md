# [005] BLIS 全量能力 Web 化（Replay / Observe / Calibrate / Flow Control / PD / Saturation）

| 字段 | 内容 |
|------|------|
| 编号 | 005 |
| 类型 | feature |
| 状态 | tbd |
| 创建时间 | 2026-06-19 |
| 优先级 | P0 |
| 关联阶段 | Phase 6 |
| 来源文档 | `docs/requirements.md`、`docs/architecture.md`、[Issue #001](001-proposal-inference-perf-platform-260619-wip.md)、[Issue #004](004-feature-phase1-5-webui-260619-done.md) |

---

## 背景

当前平台已经把 BLIS 原生 **run / cluster DES** 以首版形式接入 Web，但 `third_party/inference-sim`
仍有大量能力只存在于 CLI 与基座层：`replay`、`observe`、`calibrate`、TraceV2 导入导出、flow
control、PD/EPD、autoscaler、post-hoc saturation、goodput 等。

如果这些能力不进入 Web，则产品层会长期存在“两套能力边界”：

- CLI：完整仿真/采集/校准/诊断链路；
- Web：组合仿真 + 首版 native run。

这与“平台把 inference-sim 全能力复用并呈现到 Web UI”的目标不一致。

## 目标

- 补齐 Web 侧的 BLIS `Replay / Observe / Calibrate` 工作流；
- 暴露 TraceV2 的导入、回放、导出与结果查看；
- 为 flow control、PD/EPD、autoscaler、saturation、goodput 提供参数面板与结果视图；
- 让 Web 成为 inference-sim 的统一控制面，而不是只覆盖 overlay 能力。

## 实现内容（done 时填写）

- 待补充。

## 验证（done 时填写）

- 待补充。

## 下一步（可选）

- 先补 Replay / Observe / Calibrate 的 API 适配层；
- 再补 flow control / PD / EPD / autoscaler / saturation 的配置面板与结果页；
- 最后收敛 trace、goodput、校准报告和稳定性分析的统一 UX。
