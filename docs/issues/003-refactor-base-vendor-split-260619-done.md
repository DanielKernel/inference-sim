# [003] 基座 vendor 化拆分为双模块 + 同步工具

| 字段 | 内容 |
|------|------|
| 编号 | 003 |
| 类型 | refactor |
| 状态 | done |
| 创建时间 | 2026-06-19 |
| 优先级 | P0 |
| 关联阶段 | Phase 0 |
| 来源文档 | `docs/UPSTREAM-DELTAS.md`、[Issue #001](001-proposal-inference-perf-platform-260619-wip.md) |

---

## 背景

要求 BLIS 基座与平台扩展**独立存放、互不混合**，且基座能**独立更新版本**、可持续从上游
`inference-sim` 同步特性。Go 的 `vendor/` 为保留目录名（直接使用会导致 `go build` 因
“inconsistent vendoring”失败），故需选择非保留目录名并采用双模块结构。

## 目标

- 将整个 BLIS 基座移入 `third_party/inference-sim/`，作为独立 Go 模块
  `github.com/inference-sim/inference-sim`。
- 根目录建立扩展模块 `github.com/DanielKernel/inference-sim-platform`，经本地 `replace` 依赖基座。
- 提供与子目录布局匹配的基座同步机制（非根目录 `git merge`）。
- 基座源码零修改；CI 与 sync 工具相应调整。

## 实现内容

- **目录**：基座（`sim/ cmd/ main.go defaults.yaml hardware_config.json model_configs/ examples/
  testdata/ scripts/ k8s/ specs/ docs/ mkdocs.yml Dockerfile 等`）整体迁入
  `third_party/inference-sim/`，连同其 `go.mod`/`go.sum` 与 `.github/`（保留但失效）。
- **模块**：新增根 `go.mod`（`replace github.com/inference-sim/inference-sim => ./third_party/inference-sim`）；
  `apiserver` 导入路径改为新根模块；`go mod tidy` 通过；已用临时 probe 验证根模块可经 replace
  导入基座 `sim` 包。
- **CI**：基座 `ci.yml/docs.yml/release.yml/claude.yml` 随基座迁入 `third_party`（失效保存）；
  根 `.github/workflows/` 新增 `base-ci.yml`（构建/测试基座模块）、保留 `platform.yml`；
  以 `base-drift-check.yml`（前缀级 diff 漂移检测）替换原 `upstream-sync.yml`（根 merge）。
- **同步工具**：新增 `scripts/update-base.sh`，以 `rsync --delete` 将上游指定 ref 覆盖到
  `third_party/inference-sim` 前缀，扩展代码不受影响；文档另列 git subtree / submodule 备选方案。
- **gitignore**：基座 `.gitignore`（含 `data/` 忽略）随基座迁走；根目录新增 `.gitignore`，不忽略 `data/`。
- **文档**：`docs/UPSTREAM-DELTAS.md` 重写为双模块布局 + 前缀级同步 runbook + 空的 delta ledger。

## 验证

- 根模块：`go build ./...`、`go test ./apiserver/... ./library/...` 通过。
- 基座模块：`cd third_party/inference-sim && go build ./...` 通过；`sim` 包测试通过。
- `git check-ignore data` 显示 `data/` 在根目录可被跟踪。
- replace 可用性：临时 probe 测试 `TestBaseModuleReachable` 通过后已移除。

## 下一步

- 后续基座升级请新建 issue，记录 `update-base.sh` 升级前后 SHA 与 `go test` 回归结果。
