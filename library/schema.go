// Package library defines the curated reference-data model for the inference
// performance platform (models, hardware, frameworks, scenarios, published
// performance records, and optimization techniques) and the strict loaders
// that read it from in-repo YAML seed files under data/.
//
// This package is additive: it does not modify or depend on the BLIS DES core
// in any way that would impede syncing features from the upstream inference-sim
// repository. See docs/UPSTREAM-DELTAS.md.
package library

// Kind enumerates the six curated data kinds. Each kind is stored in its own
// directory under data/<kind>/ as one or more YAML files.
type Kind string

const (
	KindModel        Kind = "model"
	KindHardware     Kind = "hardware"
	KindFramework    Kind = "framework"
	KindScenario     Kind = "scenario"
	KindPerfRecord   Kind = "perf_record"
	KindOptimization Kind = "optimization"
)

// SchemaVersion is the current curated-data schema version. Loaders reject
// files whose schema_version is newer than this value.
const SchemaVersion = 1

// Provenance records where a curated datum came from so downstream consumers can
// display citations and reason about freshness. Every seed file carries one.
type Provenance struct {
	Source    string `json:"source" yaml:"source"`
	URL       string `json:"url" yaml:"url"`
	Retrieved string `json:"retrieved" yaml:"retrieved"` // ISO date YYYY-MM-DD
	Notes     string `json:"notes" yaml:"notes"`
}

// Reference is an external link (tech report, third-party benchmark, docs).
type Reference struct {
	Title string `json:"title" yaml:"title"`
	URL   string `json:"url" yaml:"url"`
	Kind  string `json:"kind" yaml:"kind"` // tech_report | benchmark | docs | paper | blog
}

// Benchmark is a published third-party or first-party measured result attached
// to a model entry (e.g. an accuracy or capability score).
type Benchmark struct {
	Name   string  `json:"name" yaml:"name"`
	Metric string  `json:"metric" yaml:"metric"`
	Value  float64 `json:"value" yaml:"value"`
	Source string  `json:"source" yaml:"source"`
}

// MoEConfig captures mixture-of-experts structure when present.
type MoEConfig struct {
	NumExperts       int `json:"num_experts" yaml:"num_experts"`
	NumActiveExperts int `json:"num_active_experts" yaml:"num_active_experts"`
	ExpertHidden     int `json:"expert_hidden" yaml:"expert_hidden"`
}

// ModelArchitecture captures the structural parameters needed for analytical
// performance modeling and for display/comparison.
type ModelArchitecture struct {
	Type          string     `json:"type" yaml:"type"` // decoder_only | multimodal | embedding
	NumLayers     int        `json:"num_layers" yaml:"num_layers"`
	HiddenSize    int        `json:"hidden_size" yaml:"hidden_size"`
	NumHeads      int        `json:"num_heads" yaml:"num_heads"`
	NumKVHeads    int        `json:"num_kv_heads" yaml:"num_kv_heads"`
	HeadDim       int        `json:"head_dim" yaml:"head_dim"`
	AttentionType string     `json:"attention_type" yaml:"attention_type"` // mha | gqa | mla
	FFNSize       int        `json:"ffn_size" yaml:"ffn_size"`
	VocabSize     int        `json:"vocab_size" yaml:"vocab_size"`
	MaxSeqLen     int        `json:"max_seq_len" yaml:"max_seq_len"`
	RopeTheta     float64    `json:"rope_theta" yaml:"rope_theta"`
	MoE           *MoEConfig `json:"moe,omitempty" yaml:"moe,omitempty"`
}

// Model is a single entry in the model library.
type Model struct {
	Name          string            `json:"name" yaml:"name"`
	DisplayName   string            `json:"display_name" yaml:"display_name"`
	Developer     string            `json:"developer" yaml:"developer"`
	Category      string            `json:"category" yaml:"category"` // llm | vlm | omni | voice | embedding
	ParamsB       float64           `json:"params_b" yaml:"params_b"`
	Architecture  ModelArchitecture `json:"architecture" yaml:"architecture"`
	KeyAlgorithms []string          `json:"key_algorithms" yaml:"key_algorithms"`
	QuantSupport  []string          `json:"quant_support" yaml:"quant_support"`
	References    []Reference       `json:"references" yaml:"references"`
	Benchmarks    []Benchmark       `json:"benchmarks" yaml:"benchmarks"`
	Tags          []string          `json:"tags" yaml:"tags"`
}

// Interconnect describes device-to-device links (HCCS, NVLink, etc.).
type Interconnect struct {
	Type                string  `json:"type" yaml:"type"`
	LinksPerDevice      int     `json:"links_per_device" yaml:"links_per_device"`
	BandwidthPerLinkGBs float64 `json:"bandwidth_per_link_gbs" yaml:"bandwidth_per_link_gbs"`
	Topology            string  `json:"topology" yaml:"topology"`
}

// Hardware is a single entry in the hardware library. Roofline-derived values
// (ridge point, bound classification) are computed on demand, not stored.
type Hardware struct {
	Name               string       `json:"name" yaml:"name"`
	Vendor             string       `json:"vendor" yaml:"vendor"`
	DeviceType         string       `json:"device_type" yaml:"device_type"` // gpu | npu | tpu
	ChipType           string       `json:"chip_type" yaml:"chip_type"`
	Year               int          `json:"year" yaml:"year"`
	FP16TFlops         float64      `json:"fp16_tflops" yaml:"fp16_tflops"`
	FP8TFlops          float64      `json:"fp8_tflops" yaml:"fp8_tflops"`
	INT8TOps           float64      `json:"int8_tops" yaml:"int8_tops"`
	MemoryGiB          float64      `json:"memory_gib" yaml:"memory_gib"`
	MemoryBandwidthTBs float64      `json:"memory_bandwidth_tbs" yaml:"memory_bandwidth_tbs"`
	PowerW             float64      `json:"power_w" yaml:"power_w"`
	Interconnect       Interconnect `json:"interconnect" yaml:"interconnect"`
	SupportedDtypes    []string     `json:"supported_dtypes" yaml:"supported_dtypes"`
	References         []Reference  `json:"references" yaml:"references"`
	Tags               []string     `json:"tags" yaml:"tags"`
}

// Optimization technique offered by a framework or modeled by combosim.
type Optimization struct {
	ID               string      `json:"id" yaml:"id"`
	Name             string      `json:"name" yaml:"name"`
	Category         string      `json:"category" yaml:"category"` // kv_cache | scheduling | quantization | speculative | comm | graph
	Description      string      `json:"description" yaml:"description"`
	Frameworks       []string    `json:"frameworks" yaml:"frameworks"`
	Applicability    string      `json:"applicability" yaml:"applicability"`
	LatencyFactor    float64     `json:"latency_factor" yaml:"latency_factor"`       // multiplier on latency (<1 = faster); 0 means unset
	ThroughputFactor float64     `json:"throughput_factor" yaml:"throughput_factor"` // multiplier on throughput (>1 = better); 0 means unset
	MemoryFactor     float64     `json:"memory_factor" yaml:"memory_factor"`         // multiplier on memory (<1 = less); 0 means unset
	DependsOn        []string    `json:"depends_on" yaml:"depends_on"`
	ConflictsWith    []string    `json:"conflicts_with" yaml:"conflicts_with"`
	References       []Reference `json:"references" yaml:"references"`
}

// FrameworkOptimization is a framework's support status for a technique.
type FrameworkOptimization struct {
	Name         string `json:"name" yaml:"name"`
	Category     string `json:"category" yaml:"category"`
	Description  string `json:"description" yaml:"description"`
	Available    bool   `json:"available" yaml:"available"`
	SinceVersion string `json:"since_version" yaml:"since_version"`
	Notes        string `json:"notes" yaml:"notes"`
}

// Framework is a single entry in the inference-framework library.
type Framework struct {
	Name              string                  `json:"name" yaml:"name"`
	Vendor            string                  `json:"vendor" yaml:"vendor"`
	LatestVersion     string                  `json:"latest_version" yaml:"latest_version"`
	Languages         []string                `json:"languages" yaml:"languages"`
	SupportedHardware []string                `json:"supported_hardware" yaml:"supported_hardware"`
	Optimizations     []FrameworkOptimization `json:"optimizations" yaml:"optimizations"`
	References        []Reference             `json:"references" yaml:"references"`
	Tags              []string                `json:"tags" yaml:"tags"`
}

// TokenRange is a typical / min / max token count for a scenario dimension.
type TokenRange struct {
	Typical int `json:"typical" yaml:"typical"`
	Min     int `json:"min" yaml:"min"`
	Max     int `json:"max" yaml:"max"`
}

// Scenario is a single entry in the application-scenario library.
type Scenario struct {
	Name         string      `json:"name" yaml:"name"`
	Category     string      `json:"category" yaml:"category"`
	Description  string      `json:"description" yaml:"description"`
	InputTokens  TokenRange  `json:"input_tokens" yaml:"input_tokens"`
	OutputTokens TokenRange  `json:"output_tokens" yaml:"output_tokens"`
	Examples     []string    `json:"examples" yaml:"examples"`
	References   []Reference `json:"references" yaml:"references"`
	Tags         []string    `json:"tags" yaml:"tags"`
}

// PerfMetrics are the measured serving metrics for a published perf record.
type PerfMetrics struct {
	TTFTms         float64 `json:"ttft_ms" yaml:"ttft_ms"`
	ITLms          float64 `json:"itl_ms" yaml:"itl_ms"`
	E2Ems          float64 `json:"e2e_ms" yaml:"e2e_ms"`
	ThroughputTokS float64 `json:"throughput_tok_s" yaml:"throughput_tok_s"`
}

// PerfRecord is a single published performance measurement with the full test
// conditions and environment required to interpret it.
type PerfRecord struct {
	Model            string      `json:"model" yaml:"model"`
	Hardware         string      `json:"hardware" yaml:"hardware"`
	Framework        string      `json:"framework" yaml:"framework"`
	FrameworkVersion string      `json:"framework_version" yaml:"framework_version"`
	Driver           string      `json:"driver" yaml:"driver"` // e.g. CANN 9.0.0 / CUDA 12.4
	InputTokens      int         `json:"input_tokens" yaml:"input_tokens"`
	OutputTokens     int         `json:"output_tokens" yaml:"output_tokens"`
	BatchSize        int         `json:"batch_size" yaml:"batch_size"`
	Concurrency      int         `json:"concurrency" yaml:"concurrency"`
	Quantization     string      `json:"quantization" yaml:"quantization"`
	KVQuantization   string      `json:"kv_quantization" yaml:"kv_quantization"`
	TPSize           int         `json:"tp_size" yaml:"tp_size"`
	PPSize           int         `json:"pp_size" yaml:"pp_size"`
	Metrics          PerfMetrics `json:"metrics" yaml:"metrics"`
	TestConditions   string      `json:"test_conditions" yaml:"test_conditions"`
	Source           Reference   `json:"source" yaml:"source"`
	Date             string      `json:"date" yaml:"date"`
}
