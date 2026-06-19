# Issues 目录

本目录记录 **inference-sim-platform（基于 BLIS 的推理性能平台）** 所有功能开发、优化提案和
Bug 修复的完整历史，**所有实质性修改均以 issue 文档方式追踪**。

> 本规范参考 `harness-engineering/docs/issues/README.md` 制定，并结合本项目“双模块
> （扩展模块 + 受管 BLIS 基座）”的结构特点做了适配。

---

## Issue 文档创建规范

### 命名格式

```
{编号}-{类型}-{名称}-{创建时间YYMMDD}-{状态}.md
```

| 字段 | 说明 | 示例 |
|------|------|------|
| 编号 | 3 位数字，顺序递增，不复用 | `001`、`023` |
| 类型 | `feature`、`bugfix`、`proposal`、`refactor` 之一 | `feature` |
| 名称 | kebab-case，简短描述主题，不超过 5 个词 | `platform-scaffolding` |
| 创建时间 | YYMMDD 格式 | `260619` |
| 状态 | `tbd`、`wip`、`done` 之一 | `done` |

**示例**：

```
001-proposal-inference-perf-platform-260619-wip.md
003-refactor-base-vendor-split-260619-done.md
```

> 状态变更时**重命名文件**（将文件名末段从 `tbd` 改为 `wip` 或 `done`），不新建文件。

---

### 状态说明

| 状态 | 含义 |
|------|------|
| `tbd` | To Be Done — 已规划，尚未开始 |
| `wip` | Work In Progress — 正在进行中 |
| `done` | 已完成，经验证可关闭 |

---

### Issue 文档模板

```markdown
# [{编号}] {标题}

| 字段 | 内容 |
|------|------|
| 编号 | {编号} |
| 类型 | feature / bugfix / proposal / refactor |
| 状态 | tbd / wip / done |
| 创建时间 | YYYY-MM-DD |
| 优先级 | P0 / P1 / P2 |
| 关联阶段 | Phase 0~5（见 docs/requirements.md） |
| 来源文档 | 对应的需求/设计/对话记录 |

---

## 背景

{为什么需要这个 issue}

## 目标

{具体要实现什么}

## 实现内容（done 时填写）

{新增/修改了哪些文件，改动要点}

## 验证（done 时填写）

{如何验证，测试/构建结果}

## 下一步（可选）

{后续 issue 引用}
```

---

### 工作流约定

1. **新工作开始前**先创建 issue 文档（状态 `tbd`），开始实现时改为 `wip`（同时重命名文件）。
2. **完成后**更新实现内容与验证章节，状态改为 `done`（重命名文件）。
3. **每次修改都有 issue**：不允许无 issue 的实质性代码变更进入主线。
4. **引用方式**：issue 之间可互相引用，格式为 `[Issue #003](003-refactor-base-vendor-split-260619-done.md)`。
5. **编号不回收**：取消的 issue 标注 `cancelled` 并在文档内说明原因，编号不复用。

---

### 基座（BLIS）相关约定

1. **不修改基座源码**：BLIS 基座位于 `third_party/inference-sim/`，作为独立 Go 模块受管，
   仅通过根模块 `replace` 依赖。任何对基座的不得已改动都必须登记到
   `docs/UPSTREAM-DELTAS.md` 的“core-file delta ledger”，并在对应 issue 中说明。
2. **基座升级独立追踪**：基座版本同步通过 `scripts/update-base.sh` 完成，不走根目录
   `git merge`；每次升级应单独建一个 `refactor`/`feature` 类 issue 记录升级前后 SHA 与回归结果。

---

## Issues 清单

| 编号 | 标题 | 类型 | 状态 | 文件 |
|------|------|------|------|------|
| 001 | 推理性能平台整体方案与路线图 | proposal | wip | [001-proposal-inference-perf-platform-260619-wip.md](./001-proposal-inference-perf-platform-260619-wip.md) |
| 002 | Phase 0 平台基础设施（API + 库加载 + Web + CI） | feature | wip | [002-feature-platform-scaffolding-260619-wip.md](./002-feature-platform-scaffolding-260619-wip.md) |
| 003 | 基座 vendor 化拆分为双模块 + 同步工具 | refactor | done | [003-refactor-base-vendor-split-260619-done.md](./003-refactor-base-vendor-split-260619-done.md) |
| 004 | Phase 1~5 首版能力接入（Library Compare / Analytics / BLIS Native / UI Refresh） | feature | done | [004-feature-phase1-5-webui-260619-done.md](./004-feature-phase1-5-webui-260619-done.md) |
