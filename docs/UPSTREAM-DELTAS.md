# Upstream Sync Ledger & Runbook

This repository extends **BLIS / inference-sim** with an inference performance
platform (web UI + curated reference libraries + analytical/database/combinatorial
simulation), initially focused on **Huawei Ascend + Qwen**.

A hard design requirement is that **BLIS can keep syncing features from the original
upstream `inference-sim` repository independently**, without the Ascend+Qwen platform
work causing merge pain. This document records how that is guaranteed.

## Two-module layout

The repository is split into two Go modules so the base and the extensions are
**stored separately and updated independently**:

```
<repo root>  ── module github.com/DanielKernel/inference-sim-platform  (extensions)
├── apiserver/                 # standalone Go HTTP API binary
├── library/                   # curated reference-data schema + strict loaders
├── analytic/   (Phase 2)      # analytical TTFT/TPOT model
├── combosim/   (Phase 4)      # optimization-aware simulation
├── ascend/     (Phase 5)      # Ascend-specific modeling
├── data/                      # curated YAML seed files (overlay)
├── web/                       # React + TypeScript frontend
├── docs/                      # platform docs (this file, issues/, requirements, arch)
├── scripts/update-base.sh     # base sync tool
├── go.mod                     # requires base via local `replace`
└── third_party/
    └── inference-sim/  ── module github.com/inference-sim/inference-sim  (BLIS base)
        ├── sim/ cmd/ main.go defaults.yaml hardware_config.json model_configs/ ...
        └── .github/           # base's own workflows (inert - see below)
```

The extension module depends on the base purely through a local replace in the root
`go.mod`:

```
require github.com/inference-sim/inference-sim v0.0.0   // added when first imported
replace github.com/inference-sim/inference-sim => ./third_party/inference-sim
```

This means: **the base is never modified by the platform**, the extension code never
lives inside the base tree, and the base can be replaced wholesale with a newer
upstream version without touching any extension file.

## CI ownership

GitHub only executes workflows in the **root** `.github/workflows`. After the split:

| Workflow (root, active)  | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `platform.yml`           | Build + test extension module + web frontend     |
| `base-ci.yml`            | Build + smoke-test the vendored base module      |
| `base-drift-check.yml`   | Weekly: detect when the base is behind upstream  |

The base's own workflows (`ci.yml`, `docs.yml`, `release.yml`, `claude.yml`) and issue
templates were relocated under `third_party/inference-sim/.github/` together with the
base. They are **preserved but inert** (not at the repo root, so GitHub does not run
them) and travel with the base on every sync.

## Core-file delta ledger

Every change to a **base-owned file** under `third_party/inference-sim/` must be listed
here. Keep it as close to empty as possible; entries must be re-applied after each base
sync (the overlay sync overwrites the prefix). The platform is designed so this stays
empty - extend via the root extension module, never by editing the base.

| File | Change | Reason | Re-apply notes |
| ---- | ------ | ------ | -------------- |
| _(none)_ | - | - | - |

## Sync runbook

Because the base lives in a **subdirectory**, you do **not** sync it with a root-level
`git merge upstream/main` (that would mismatch paths and conflict). Sync into the
prefix instead.

### Recommended: overlay sync script

```bash
# refreshes third_party/inference-sim to upstream main; extension code untouched
scripts/update-base.sh
# or pin a ref:
scripts/update-base.sh https://github.com/inference-sim/inference-sim.git v0.21.0rc1
```

The script clones the upstream ref, overlays it onto `third_party/inference-sim`
(`rsync --delete`), re-builds both modules, and prints the verify/commit steps. Since
the base is never modified locally, the overlay is loss-free.

### Alternatives

- **git subtree** - preserves upstream history under the prefix:
  ```bash
  git subtree pull --prefix third_party/inference-sim \
    https://github.com/inference-sim/inference-sim.git main --squash
  ```
- **git submodule** - make `third_party/inference-sim` a pointer to upstream and run
  `git submodule update --remote`. Truest "independent version", but adds checkout
  friction for contributors and CI.

After any sync: `(cd third_party/inference-sim && go test ./...) && go test ./...`, then
rebuild the web app if base changes affect the API.

The `base-drift-check.yml` workflow runs the comparison weekly and on demand so you
know when a sync is due.
