# Curated reference data

This directory holds the **source of truth** for the platform's reference libraries
as version-stamped YAML seed files. It is loaded by the Go `library` package and
served by `apiserver`. It is an *overlay* — it never edits the upstream BLIS files
(`defaults.yaml`, `hardware_config.json`, `model_configs/`).

## Layout

| Directory        | Kind            | Contents                                          |
| ---------------- | --------------- | ------------------------------------------------- |
| `models/`        | `model`         | LLM / VLM / Omni / voice / embedding models       |
| `hardware/`      | `hardware`      | GPU / NPU / TPU chips, with roofline parameters   |
| `frameworks/`    | `framework`     | vLLM, vllm-ascend, SGLang, xLLM, TensorRT-LLM …   |
| `scenarios/`     | `scenario`      | Application scenarios with typical ISL/OSL        |
| `optimizations/` | `optimization`  | Acceleration-technique catalog (combosim inputs)  |
| `perfdb/`        | `perf_record`   | Published performance measurements + provenance   |

## File format

Every file is a YAML document with this envelope:

```yaml
schema_version: 1          # required; loaders reject versions newer than they support
kind: model                # must match the directory's kind
provenance:                # where this data came from
  source: "..."
  url: "..."
  retrieved: "2026-06-19"  # ISO date
  notes: "..."
items:                     # list of typed entries (see library/schema.go)
  - name: ...
    ...
```

Rules:

- **Strict parsing**: unknown fields are rejected (catches typos). Field names are in
  `library/schema.go`.
- **Deterministic load order**: files are read in sorted filename order.
- Files prefixed with `_` or `.` are ignored.
- Multiple files per kind are allowed and concatenated.

## Adding data

1. Add or edit a YAML file under the appropriate kind directory.
2. Run `go test ./library/...` to validate parsing.
3. For `perf_record` entries, always include a real `source` (URL + date) and the full
   `test_conditions` — published numbers are meaningless without their environment.
