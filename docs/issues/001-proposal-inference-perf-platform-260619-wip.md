# [001] 推理性能平台整体方案与路线图

| 字段 | 内容 |
|------|------|
| 编号 | 001 |
| 类型 | proposal |
| 状态 | wip |
| 创建时间 | 2026-06-19 |
| 优先级 | P0 |
| 关联阶段 | Phase 0~5 |
| 来源文档 | `~/Downloads/ascend_qwen_inference_sim_research.pdf`、`docs/requirements.md`、`docs/architecture/overview.md` |

---

## 背景

基于开源 BLIS（inference-sim）离散事件仿真器，构建一个面向“模型 + 硬件 + 输入输出长度 +
推理框架”的推理性能平台，提供可视化界面、四大参考库、解析性能模型、公开性能数据库，以及
优化手段可选的组合仿真系统。首期对齐设计报告，聚焦 **华为 Ascend + Qwen** 垂直切片，schema
与引擎保持通用以便后续横向扩展。

## 目标

- 沉淀一份可持续更新的需求描述文档与架构设计文档（见 `docs/requirements.md`、
  `docs/architecture/overview.md`）。
- 以阶段化路线图推进：Phase 0 基础设施 → Phase 1 四大库 → Phase 2 解析模型 →
  Phase 3 性能数据库 → Phase 4 组合仿真 → Phase 5 Ascend 保真与泛化。
- 全程满足“基座可独立同步上游”的硬约束（见 [Issue #003](003-refactor-base-vendor-split-260619-done.md)）。

## 实现内容（done 时填写）

- 路线图与阶段拆分见 `docs/requirements.md` 第“路线图”章节；架构见 `docs/architecture/overview.md`。
- 各阶段以独立 issue 跟踪（Phase 0 见 [Issue #002](002-feature-platform-scaffolding-260619-wip.md)）。

## 验证（done 时填写）

- 每阶段以其 issue 的验证章节为准；本提案在全部阶段 issue 关闭后转 `done`。

## 下一步

- 推进 [Issue #002](002-feature-platform-scaffolding-260619-wip.md)（Phase 0），随后规划 Phase 1 各库 issue。
