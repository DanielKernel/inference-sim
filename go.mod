module github.com/DanielKernel/inference-sim-platform

go 1.24.0

require gopkg.in/yaml.v3 v3.0.1

// The BLIS base lives as an isolated, independently-updatable module under
// third_party/inference-sim (see docs/UPSTREAM-DELTAS.md). It is never modified
// by the platform; we depend on it via this local replace.
replace github.com/inference-sim/inference-sim => ./third_party/inference-sim
