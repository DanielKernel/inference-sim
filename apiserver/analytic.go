package main

import (
	"encoding/json"
	"net/http"

	"github.com/DanielKernel/inference-sim-platform/library"
)

type analyticRequest struct {
	Model        string `json:"model"`
	Hardware     string `json:"hardware"`
	Scenario     string `json:"scenario"`
	InputTokens  int    `json:"input_tokens"`
	OutputTokens int    `json:"output_tokens"`
}

type analyticPoint struct {
	X     int     `json:"x"`
	Value float64 `json:"value"`
}

type analyticResponse struct {
	Selection struct {
		Model        string `json:"model"`
		Hardware     string `json:"hardware"`
		Scenario     string `json:"scenario"`
		InputTokens  int    `json:"input_tokens"`
		OutputTokens int    `json:"output_tokens"`
	} `json:"selection"`
	Estimates struct {
		TTFTms         float64 `json:"ttft_ms"`
		TPOTms         float64 `json:"tpot_ms"`
		E2Ems          float64 `json:"e2e_ms"`
		ThroughputTokS float64 `json:"throughput_tok_s"`
	} `json:"estimates"`
	Roofline struct {
		RidgePoint            float64 `json:"ridge_point"`
		ArithmeticIntensityPF float64 `json:"arithmetic_intensity_pf"`
		ArithmeticIntensityDC float64 `json:"arithmetic_intensity_dc"`
		PrefillBound          string  `json:"prefill_bound"`
		DecodeBound           string  `json:"decode_bound"`
		PrefillComputeMs      float64 `json:"prefill_compute_ms"`
		PrefillMemoryMs       float64 `json:"prefill_memory_ms"`
		DecodeComputeMs       float64 `json:"decode_compute_ms"`
		DecodeMemoryMs        float64 `json:"decode_memory_ms"`
	} `json:"roofline"`
	Breakdown []stageBreakdown `json:"breakdown"`
	Curves    struct {
		InputTokens  []analyticPoint `json:"input_tokens"`
		OutputTokens []analyticPoint `json:"output_tokens"`
	} `json:"curves"`
}

func (s *Server) handleAnalyticEstimate(w http.ResponseWriter, r *http.Request) {
	var req analyticRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid analytic request: "+err.Error())
		return
	}
	model, ok := findByName(s.store.Models, req.Model, func(m library.Model) string { return m.Name })
	if !ok {
		writeError(w, http.StatusBadRequest, errBadInput("unknown model", req.Model).Error())
		return
	}
	hw, ok := findByName(s.store.Hardware, req.Hardware, func(item library.Hardware) string { return item.Name })
	if !ok {
		writeError(w, http.StatusBadRequest, errBadInput("unknown hardware", req.Hardware).Error())
		return
	}
	inputTokens, outputTokens, err := resolveScenarioTokens(s.store.Scenarios, req.Scenario, req.InputTokens, req.OutputTokens)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	estimate := estimateMetrics(model, hw, inputTokens, outputTokens, 1.0, 1.0)

	var resp analyticResponse
	resp.Selection.Model = model.DisplayName
	resp.Selection.Hardware = hw.Name
	resp.Selection.Scenario = req.Scenario
	resp.Selection.InputTokens = inputTokens
	resp.Selection.OutputTokens = outputTokens
	resp.Estimates.TTFTms = estimate.TTFTms
	resp.Estimates.TPOTms = estimate.TPOTms
	resp.Estimates.E2Ems = estimate.E2Ems
	resp.Estimates.ThroughputTokS = estimate.ThroughputTokS
	resp.Roofline.RidgePoint = estimate.RidgePoint
	resp.Roofline.ArithmeticIntensityPF = estimate.ArithmeticIntensityPF
	resp.Roofline.ArithmeticIntensityDC = estimate.ArithmeticIntensityDC
	resp.Roofline.PrefillBound = pickBound(estimate.PrefillComputeMs, estimate.PrefillMemoryMs)
	resp.Roofline.DecodeBound = pickBound(estimate.DecodeComputeMs, estimate.DecodeMemoryMs)
	resp.Roofline.PrefillComputeMs = estimate.PrefillComputeMs
	resp.Roofline.PrefillMemoryMs = estimate.PrefillMemoryMs
	resp.Roofline.DecodeComputeMs = estimate.DecodeComputeMs
	resp.Roofline.DecodeMemoryMs = estimate.DecodeMemoryMs
	resp.Breakdown = estimate.Breakdown
	resp.Curves.InputTokens = buildInputCurve(model, hw, outputTokens)
	resp.Curves.OutputTokens = buildOutputCurve(model, hw, inputTokens)
	writeJSON(w, http.StatusOK, resp)
}

func buildInputCurve(model library.Model, hw library.Hardware, outputTokens int) []analyticPoint {
	points := []int{128, 512, 2048, 8192, 16384}
	out := make([]analyticPoint, 0, len(points))
	for _, tokens := range points {
		estimate := estimateMetrics(model, hw, tokens, outputTokens, 1.0, 1.0)
		out = append(out, analyticPoint{X: tokens, Value: estimate.TTFTms})
	}
	return out
}

func buildOutputCurve(model library.Model, hw library.Hardware, inputTokens int) []analyticPoint {
	points := []int{64, 256, 512, 1024, 2048}
	out := make([]analyticPoint, 0, len(points))
	for _, tokens := range points {
		estimate := estimateMetrics(model, hw, inputTokens, tokens, 1.0, 1.0)
		out = append(out, analyticPoint{X: tokens, Value: estimate.E2Ems})
	}
	return out
}

func pickBound(computeMs, memoryMs float64) string {
	if computeMs >= memoryMs {
		return "compute_bound"
	}
	return "memory_bound"
}
