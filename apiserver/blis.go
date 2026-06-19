package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/DanielKernel/inference-sim-platform/library"
	blissim "github.com/inference-sim/inference-sim/sim"
	bliscluster "github.com/inference-sim/inference-sim/sim/cluster"
	blislatency "github.com/inference-sim/inference-sim/sim/latency"
	blisworkload "github.com/inference-sim/inference-sim/sim/workload"
)

type blisSimulateRequest struct {
	Model              string  `json:"model"`
	Hardware           string  `json:"hardware"`
	Scenario           string  `json:"scenario"`
	InputTokens        int     `json:"input_tokens"`
	OutputTokens       int     `json:"output_tokens"`
	LatencyBackend     string  `json:"latency_backend"`
	TP                 int     `json:"tp"`
	NumInstances       int     `json:"num_instances"`
	Rate               float64 `json:"rate"`
	NumRequests        int     `json:"num_requests"`
	HorizonUs          int64   `json:"horizon_us"`
	ArrivalProcess     string  `json:"arrival_process"`
	RoutingPolicy      string  `json:"routing_policy"`
	Scheduler          string  `json:"scheduler"`
	PreemptionPolicy   string  `json:"preemption_policy"`
	TotalKVBlocks      int64   `json:"total_kv_blocks"`
	MaxRunningReqs     int64   `json:"max_running_reqs"`
	MaxScheduledTokens int64   `json:"max_scheduled_tokens"`
	Seed               int64   `json:"seed"`
}

type blisSimulateResponse struct {
	Selection struct {
		Model          string `json:"model"`
		Hardware       string `json:"hardware"`
		Scenario       string `json:"scenario"`
		LatencyBackend string `json:"latency_backend"`
		TP             int    `json:"tp"`
		NumInstances   int    `json:"num_instances"`
		ArrivalProcess string `json:"arrival_process"`
		InputTokens    int    `json:"input_tokens"`
		OutputTokens   int    `json:"output_tokens"`
	} `json:"selection"`
	Calibration struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	} `json:"calibration"`
	Metrics struct {
		CompletedRequests int     `json:"completed_requests"`
		InjectedRequests  int     `json:"injected_requests"`
		TTFTMeanMs        float64 `json:"ttft_mean_ms"`
		TTFTP95Ms         float64 `json:"ttft_p95_ms"`
		E2EP95Ms          float64 `json:"e2e_p95_ms"`
		ITLMeanMs         float64 `json:"itl_mean_ms"`
		ResponsesPerSec   float64 `json:"responses_per_sec"`
		TokensPerSec      float64 `json:"tokens_per_sec"`
		DroppedUnservable int     `json:"dropped_unservable"`
		TimedOutRequests  int     `json:"timed_out_requests"`
		PreemptionCount   int64   `json:"preemption_count"`
	} `json:"metrics"`
	Notes []string `json:"notes"`
}

func (s *Server) handleBLISSimulate(w http.ResponseWriter, r *http.Request) {
	var req blisSimulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid BLIS simulate request: "+err.Error())
		return
	}
	resp, err := s.runBLISSimulation(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) runBLISSimulation(req blisSimulateRequest) (*blisSimulateResponse, error) {
	model, ok := findByName(s.store.Models, req.Model, func(item library.Model) string { return item.Name })
	if !ok {
		return nil, errBadInput("unknown model", req.Model)
	}
	hw, ok := findByName(s.store.Hardware, req.Hardware, func(item library.Hardware) string { return item.Name })
	if !ok {
		return nil, errBadInput("unknown hardware", req.Hardware)
	}
	inputTokens, outputTokens, err := resolveScenarioTokens(s.store.Scenarios, req.Scenario, req.InputTokens, req.OutputTokens)
	if err != nil {
		return nil, err
	}

	backend := req.LatencyBackend
	if backend == "" {
		backend = "roofline"
	}
	if req.TP <= 0 {
		req.TP = 1
	}
	if req.NumInstances <= 0 {
		req.NumInstances = 1
	}
	if req.Rate <= 0 {
		req.Rate = 2
	}
	if req.NumRequests <= 0 {
		req.NumRequests = 32
	}
	if req.HorizonUs <= 0 {
		req.HorizonUs = 15_000_000
	}
	if req.ArrivalProcess == "" {
		req.ArrivalProcess = "poisson"
	}
	if req.RoutingPolicy == "" {
		req.RoutingPolicy = "round-robin"
	}
	if req.Scheduler == "" {
		req.Scheduler = "fcfs"
	}
	if req.PreemptionPolicy == "" {
		req.PreemptionPolicy = "fcfs"
	}
	if req.TotalKVBlocks <= 0 {
		req.TotalKVBlocks = 200000
	}
	if req.MaxRunningReqs <= 0 {
		req.MaxRunningReqs = 128
	}
	if req.MaxScheduledTokens <= 0 {
		req.MaxScheduledTokens = 2048
	}

	modelConfig := toBLISModelConfig(model)
	hwConfig := toBLISHardwareConfig(hw)
	latencyModel, err := blislatency.NewLatencyModel(
		blissim.NewLatencyCoeffs([]float64{0, 0, 0}, []float64{0, 0, 0}),
		blissim.NewModelHardwareConfig(modelConfig, hwConfig, model.Name, hw.Name, req.TP, 1, false, "", backend, int64(model.Architecture.MaxSeqLen)),
	)
	if err != nil {
		return nil, fmt.Errorf("building BLIS latency model: %w", err)
	}
	_ = latencyModel

	spec := &blisworkload.WorkloadSpec{
		Version:       "2",
		Seed:          req.Seed,
		Category:      blisCategoryForScenario(req.Scenario),
		AggregateRate: req.Rate,
		Horizon:       req.HorizonUs,
		NumRequests:   int64(req.NumRequests),
		Clients: []blisworkload.ClientSpec{
			{
				ID:           "webui-client",
				TenantID:     "default",
				SLOClass:     "standard",
				Model:        model.Name,
				RateFraction: 1,
				Arrival:      blisworkload.ArrivalSpec{Process: req.ArrivalProcess},
				InputDist:    blisworkload.DistSpec{Type: "constant", Params: map[string]float64{"value": float64(inputTokens)}},
				OutputDist:   blisworkload.DistSpec{Type: "constant", Params: map[string]float64{"value": float64(outputTokens)}},
				Streaming:    true,
			},
		},
	}
	requests, err := blisworkload.GenerateRequests(spec, req.HorizonUs, int64(req.NumRequests))
	if err != nil {
		return nil, fmt.Errorf("generating BLIS workload: %w", err)
	}

	config := bliscluster.DeploymentConfig{
		SimConfig: blissim.SimConfig{
			Horizon:             req.HorizonUs,
			Seed:                req.Seed,
			KVCacheConfig:       blissim.NewKVCacheConfig(req.TotalKVBlocks, 16, 0, 0.9, 100.0, 0),
			BatchConfig:         blissim.NewBatchConfig(req.MaxRunningReqs, req.MaxScheduledTokens, 0),
			LatencyCoeffs:       blissim.NewLatencyCoeffs([]float64{0, 0, 0}, []float64{0, 0, 0}),
			ModelHardwareConfig: blissim.NewModelHardwareConfig(modelConfig, hwConfig, model.Name, hw.Name, req.TP, 1, false, "", backend, int64(model.Architecture.MaxSeqLen)),
			PolicyConfig:        blissim.NewPolicyConfig(req.Scheduler, req.PreemptionPolicy),
			WorkloadConfig:      blissim.NewWorkloadConfig(),
		},
		NumInstances:            req.NumInstances,
		AdmissionPolicy:         "always-admit",
		RoutingPolicy:           req.RoutingPolicy,
		SnapshotRefreshInterval: 0,
		CacheSignalDelay:        bliscluster.DefaultCacheSignalDelay,
	}

	cs := bliscluster.NewClusterSimulator(config, requests, nil)
	if err := cs.Run(); err != nil {
		return nil, fmt.Errorf("running BLIS simulation: %w", err)
	}
	output := cs.AggregatedMetrics().BuildOutput("cluster", nil)

	var resp blisSimulateResponse
	resp.Selection.Model = model.DisplayName
	resp.Selection.Hardware = hw.Name
	resp.Selection.Scenario = req.Scenario
	resp.Selection.LatencyBackend = backend
	resp.Selection.TP = req.TP
	resp.Selection.NumInstances = req.NumInstances
	resp.Selection.ArrivalProcess = req.ArrivalProcess
	resp.Selection.InputTokens = inputTokens
	resp.Selection.OutputTokens = outputTokens
	resp.Calibration.Status = hw.Calibration.Status
	resp.Calibration.Notes = hw.Calibration.Notes
	resp.Metrics.CompletedRequests = output.CompletedRequests
	resp.Metrics.InjectedRequests = output.InjectedRequests
	resp.Metrics.TTFTMeanMs = round2(output.TTFTMeanMs)
	resp.Metrics.TTFTP95Ms = round2(output.TTFTP95Ms)
	resp.Metrics.E2EP95Ms = round2(output.E2EP95Ms)
	resp.Metrics.ITLMeanMs = round2(output.ITLMeanMs)
	resp.Metrics.ResponsesPerSec = round2(output.ResponsesPerSec)
	resp.Metrics.TokensPerSec = round2(output.TokensPerSec)
	resp.Metrics.DroppedUnservable = output.DroppedUnservable
	resp.Metrics.TimedOutRequests = output.TimedOutRequests
	resp.Metrics.PreemptionCount = output.PreemptionCount
	resp.Notes = []string{
		"该结果由 third_party/inference-sim 的真实 cluster DES 路径生成，而不是平台启发式估算。",
		"当前硬件校准状态来自 curated 数据中的 calibration 字段；assumed 表示用于 Web 集成的保守近似值。",
	}
	return &resp, nil
}

func toBLISModelConfig(model library.Model) blissim.ModelConfig {
	weightBytes := 2.0
	for _, mode := range model.QuantSupport {
		if mode == "fp8" || mode == "w8a8" {
			weightBytes = 1.0
			break
		}
	}
	return blissim.ModelConfig{
		NumLayers:           model.Architecture.NumLayers,
		HiddenDim:           model.Architecture.HiddenSize,
		NumHeads:            model.Architecture.NumHeads,
		NumKVHeads:          model.Architecture.NumKVHeads,
		VocabSize:           model.Architecture.VocabSize,
		BytesPerParam:       2.0,
		IntermediateDim:     model.Architecture.FFNSize,
		HiddenAct:           "silu",
		WeightBytesPerParam: weightBytes,
	}
}

func toBLISHardwareConfig(hw library.Hardware) blissim.HardwareCalib {
	return blissim.HardwareCalib{
		TFlopsPeak: hw.FP16TFlops,
		TFlopsFP8:  hw.FP8TFlops,
		BwPeakTBs:  hw.MemoryBandwidthTBs,
		MfuPrefill: hw.Calibration.MfuPrefill,
		MfuDecode:  hw.Calibration.MfuDecode,
		MemoryGiB:  hw.MemoryGiB,
	}
}

func resolveScenarioTokens(scenarios []library.Scenario, scenario string, inputTokens, outputTokens int) (int, int, error) {
	if scenario == "" {
		if inputTokens <= 0 || outputTokens < 0 {
			return 0, 0, errBadInput("invalid token lengths", "input_tokens must be > 0 and output_tokens must be >= 0")
		}
		return inputTokens, outputTokens, nil
	}
	sc, ok := findByName(scenarios, scenario, func(item library.Scenario) string { return item.Name })
	if !ok {
		return 0, 0, errBadInput("unknown scenario", scenario)
	}
	if inputTokens <= 0 {
		inputTokens = sc.InputTokens.Typical
	}
	if outputTokens < 0 {
		outputTokens = sc.OutputTokens.Typical
	}
	if outputTokens == 0 {
		outputTokens = sc.OutputTokens.Typical
	}
	if inputTokens <= 0 || outputTokens < 0 {
		return 0, 0, errBadInput("invalid token lengths", "resolved tokens must be positive")
	}
	return inputTokens, outputTokens, nil
}

func blisCategoryForScenario(scenario string) string {
	switch scenario {
	case "reasoning":
		return "reasoning"
	default:
		return "language"
	}
}
