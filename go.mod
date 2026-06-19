module github.com/DanielKernel/inference-sim-platform

go 1.24.0

require (
	github.com/inference-sim/inference-sim v0.0.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/sirupsen/logrus v1.9.3 // indirect
	golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8 // indirect
	gonum.org/v1/gonum v0.17.0 // indirect
)

// The BLIS base lives as an isolated, independently-updatable module under
// third_party/inference-sim (see docs/UPSTREAM-DELTAS.md). It is never modified
// by the platform; we depend on it via this local replace.
replace github.com/inference-sim/inference-sim => ./third_party/inference-sim
