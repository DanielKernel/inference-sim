# [002] Phase 0 平台基础设施（API + 库加载 + Web + CI）

| 字段 | 内容 |
|------|------|
| 编号 | 002 |
| 类型 | feature |
| 状态 | wip |
| 创建时间 | 2026-06-19 |
| 优先级 | P0 |
| 关联阶段 | Phase 0 |
| 来源文档 | `docs/requirements.md`、`docs/architecture.md`、[Issue #001](001-proposal-inference-perf-platform-260619-wip.md) |

---

## 背景

平台需要一套“可加性”的基础设施：Go HTTP API、curated 参考数据的严格加载器、React+TS 前端
骨架，以及对应 CI。该层不得改动 BLIS 基座，确保后续阶段在其上叠加。

## 目标

- `library/`：六类 curated 数据（model/hardware/framework/scenario/perf_record/optimization）的
  Go schema + 严格 YAML 加载器（未知字段拒绝、schema 版本校验、确定性加载顺序）。
- `apiserver/`：独立 Go 二进制，提供 `/api/health`、`/api/config`、`/api/library/{kind}`，含 CORS。
- `data/`：Ascend + Qwen 为主的种子数据，建立 provenance 格式。
- `web/`：Vite + React + TS 骨架（Dashboard + 通用库浏览页），与 API 的类型化客户端。
- CI：扩展模块与前端构建、测试（见 `docs/architecture.md` 的 CI 章节）。

## 实现内容（进行中）

- 已完成 `library/`（`schema.go`、`loader.go` + 测试）、`apiserver/`（`server.go`、`main.go` + 测试）、
  六类种子数据、`web/` 骨架与 `npm run build` 通过、`.github/workflows/platform.yml`。
- JSON 契约统一为 snake_case（schema 同时带 `json`/`yaml` tag）。
- 已补充一键运行链路：`POST /api/simulate`、`web` 中的 **Simulate** 页面、`scripts/build-platform.sh`、
  `scripts/run-platform.sh`，以及 Windows 的 `build-platform.ps1` / `run-platform.ps1` /
  `*.cmd` 包装入口，可覆盖 Ubuntu / macOS / Windows，一键构建、启动并打开浏览器完成配置 /
  仿真 / 查看结果。
- 待办：Phase 1 的过滤/对比 API 与富前端页面（拆分到后续 issue）。

## 验证（部分）

- `go test ./apiserver/... ./library/...` 通过；`apiserver` 本地 `curl /api/config` 返回各库计数正确。
- `cd web && npm run build` 通过（tsc + vite）。
- `./scripts/run-platform.sh` 可成功启动统一服务，`curl /api/health`、`curl /api/simulate` 可返回结果。

## 下一步

- Phase 1：模型/硬件/框架/场景四库的过滤、对比 API 与前端页面（新建 issue）。
