# inference-sim-platform

> 基于开源 **BLIS（inference-sim）** 离散事件仿真器构建的**大模型推理性能平台**：围绕
> “**模型 + 硬件 + 输入/输出长度 + 推理框架**”四要素，提供可视化界面、四大参考库、解析
> 性能模型、公开性能数据库，以及优化手段可选的组合仿真系统。首期聚焦 **华为 Ascend + Qwen**。

- 需求描述：[`docs/requirements.md`](docs/requirements.md)
- 架构设计：[`docs/architecture.md`](docs/architecture.md)
- 变更追踪：[`docs/issues/`](docs/issues/README.md)
- 基座同步约束：[`docs/UPSTREAM-DELTAS.md`](docs/UPSTREAM-DELTAS.md)

## 项目介绍

本仓库由两个 **独立的 Go 模块** 组成，扩展代码与 BLIS 基座**分开存放、互不混合**：

```
<repo root>          扩展模块  github.com/DanielKernel/inference-sim-platform
├── apiserver/       独立 Go HTTP API（包装 BLIS，零修改基座）
├── library/         curated 参考数据的 schema + 严格 YAML 加载器
├── data/            curated 种子数据（模型/硬件/框架/场景/性能库/优化手段）
├── web/             React + TypeScript 前端（Vite）
├── scripts/         平台脚本（基座同步等）
├── docs/            需求 / 架构 / issues / 基座同步说明
└── third_party/
    └── inference-sim/   基座模块  github.com/inference-sim/inference-sim（受管、可独立升级）
```

基座通过根 `go.mod` 的本地 `replace` 依赖，**永不被平台修改**，可独立从上游同步特性。详见
[`docs/UPSTREAM-DELTAS.md`](docs/UPSTREAM-DELTAS.md)。

### 当前进度
- ✅ Phase 0：平台基础设施（API 骨架、库加载器、Web 骨架、CI、双模块拆分）。
- ⏳ Phase 1~5：四大库 / 解析模型 / 性能数据库 / 组合仿真 / Ascend 保真（见 `docs/issues/`）。

## 环境要求

- **Go** ≥ 1.24（两个模块均使用）
- **Node.js** ≥ 20 与 npm（前端）
- 基座同步脚本需要 `git`、`rsync`

## 构建方法

### 一键构建、部署和运行（推荐，支持 Ubuntu / macOS / Windows）

```bash
# Ubuntu / macOS
./scripts/run-platform.sh
```

```powershell
# Windows PowerShell / Windows Terminal
.\scripts\run-platform.ps1
```

```bat
REM Windows CMD / 双击入口
scripts\run-platform.cmd
```

该命令会自动：

1. 构建 Go API 服务；
2. 构建前端静态页面；
3. 启动统一服务（API + Web）；
4. 自动打开浏览器到 Web 页面；
5. 在页面里完成**配置、仿真和结果查看**。

> 默认地址为 `http://localhost:8080`。停止时按 `Ctrl+C`。
> Go 依赖会在**构建前**通过独立步骤下载到本机模块缓存；如果依赖已经在缓存中，脚本不会重复下载。
> 运行阶段只启动本地已构建的可执行文件，不会在运行时联网下载 Go 依赖源码。

如果只想构建、不启动：

```bash
# Ubuntu / macOS
./scripts/build-platform.sh
```

```powershell
# Windows PowerShell / Windows Terminal
.\scripts\build-platform.ps1
```

```bat
REM Windows CMD / 双击入口
scripts\build-platform.cmd
```

如果只想**预下载 Go 依赖**、不立即构建：

```bash
# Ubuntu / macOS
./scripts/download-go-deps.sh
```

```powershell
# Windows PowerShell / Windows Terminal
.\scripts\download-go-deps.ps1
```

```bat
REM Windows CMD
scripts\download-go-deps.cmd
```

### 1) 扩展模块（API + 库）

```bash
# 在仓库根目录
go build ./...                      # 构建扩展模块（apiserver、library）
go test ./apiserver/... ./library/...   # 运行扩展模块测试
go build -o apiserver-bin ./apiserver   # 产出 API 服务二进制
```

### 2) 前端（Web）

```bash
cd web
npm install
npm run build      # 类型检查 + 生产构建（产物在 web/dist）
```

### 3) BLIS 基座（独立模块）

```bash
cd third_party/inference-sim
go build ./...                 # 构建基座
go build -o blis .             # 产出 blis CLI（run/replay/observe/calibrate 等）
go test ./sim/...              # 基座核心测试
```

## 使用方法

### 打开 Web 页面完成配置、仿真和查看结果

执行（按操作系统选择其一）：

```bash
# Ubuntu / macOS
./scripts/run-platform.sh
```

```powershell
# Windows PowerShell / Windows Terminal
.\scripts\run-platform.ps1
```

```bat
REM Windows CMD / 双击入口
scripts\run-platform.cmd
```

脚本会自动：

1. 构建 Go API 服务；
2. 构建前端静态页面；
3. 启动统一服务；
4. 自动打开浏览器；
5. 保持前台运行，按 `Ctrl+C` 可停止。

> Windows PowerShell 入口会优先使用 `.bin\apiserver.exe`；如果构建产物因环境差异未落盘，
> 会自动回退到 `go run ./apiserver` 启动，避免 `Start-Process` 因找不到 exe 直接失败。

浏览器打开后：

1. 进入 **Simulate** 页面；
2. 选择 **Model / Hardware / Framework / Scenario**；
3. 可修改 **Input tokens / Output tokens**；
4. 选择 **自动优化** 或手工勾选优化手段；
5. 点击 **Run simulation**；
6. 在页面中查看**仿真执行过程**（输入校验、画像加载、优化手段筛选、指标估算、分段生成、结果汇总）；
7. 查看 **TTFT / TPOT / Throughput / E2E**、瓶颈判定、应用的优化手段，以及全流程分段结果。

### 所有“xxx库”页面均支持查询

以下页面都提供统一的**关键字查询**能力，部分库还带**分类筛选**：

- 模型库
- 硬件库
- 框架库
- 场景库
- 优化手段库
- 性能数据库

支持按名称、厂商、类别、版本、说明等字段快速检索，并可点击表格行查看明细。

### 启动 API 服务

```bash
# 默认监听 :8080，读取根目录 data/ 作为 curated 数据源，并托管构建后的前端页面
./apiserver-bin --addr :8080 --data data --web-dir web/dist
# 或直接运行：go run ./apiserver --addr :8080 --data data --web-dir web/dist

# 如果只想启动 API、不托管前端，也可以省略 --web-dir
./apiserver-bin --addr :8080 --data data
```

当前可用接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 平台配置与各库条目计数 |
| GET | `/api/library/{kind}` | 列出某类库条目（`models`/`hardware`/`frameworks`/`scenarios`/`optimizations`/`perf_records`） |
| POST | `/api/simulate` | 根据模型/硬件/框架/场景/优化手段执行轻量仿真 |

示例：

```bash
curl localhost:8080/api/config
curl localhost:8080/api/library/hardware
```

### 启动前端（开发模式）

```bash
cd web
npm run dev     # http://localhost:5173 ，/api 自动代理到 :8080
```

> 开发时通常需要两个终端：一个运行 `apiserver-bin --web-dir web/dist` 或 `go run ./apiserver ...`，
> 一个运行 `npm run dev`（:5173）。正式“一键运行”优先使用 `./scripts/run-platform.sh`。

### 运行 BLIS 基座 CLI（可选）

```bash
cd third_party/inference-sim
./blis run --model qwen/qwen3-14b
```

## 参考数据（data/）

curated 数据以版本化 YAML 种子文件维护，是参考库的**事实来源**，并作为 overlay 不修改基座
配置。文件格式与新增方法见 [`data/README.md`](data/README.md)。

## 基座升级（从上游同步特性）

基座位于子目录，**不使用**根目录 `git merge`，而是按前缀同步：

```bash
scripts/update-base.sh                                   # 同步到上游 main
scripts/update-base.sh https://github.com/inference-sim/inference-sim.git v0.21.0rc1   # 指定 ref
```

脚本会克隆上游指定版本、覆盖 `third_party/inference-sim/` 前缀（扩展代码不受影响）、重建两个
模块并打印验证/提交步骤。备选方案（git subtree / submodule）见
[`docs/UPSTREAM-DELTAS.md`](docs/UPSTREAM-DELTAS.md)。

## 开发约定

- 每次实质性修改先在 [`docs/issues/`](docs/issues/README.md) 建 issue 跟踪。
- 不修改基座源码；不得已的改动登记到 `docs/UPSTREAM-DELTAS.md` 的 delta ledger。
- 沿用基座的 BDD/TDD、表驱动测试与不变量/规则标准。

## 许可

本仓库扩展代码的许可见根目录后续补充；BLIS 基座许可见
[`third_party/inference-sim/LICENSE`](third_party/inference-sim/LICENSE)。
