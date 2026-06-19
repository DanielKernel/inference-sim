package main

import (
	"encoding/json"
	"math"
	"net/http"
	"slices"

	"github.com/DanielKernel/inference-sim-platform/library"
)

type simulateRequest struct {
	Model                 string   `json:"model"`
	Hardware              string   `json:"hardware"`
	Framework             string   `json:"framework"`
	Scenario              string   `json:"scenario"`
	InputTokens           int      `json:"input_tokens"`
	OutputTokens          int      `json:"output_tokens"`
	AutoOptimize          bool     `json:"auto_optimize"`
	SelectedOptimizations []string `json:"selected_optimizations"`
}

type stageBreakdown struct {
	Stage       string  `json:"stage"`
	StartMs     float64 `json:"start_ms"`
	EndMs       float64 `json:"end_ms"`
	DurationMs  float64 `json:"duration_ms"`
	Percent     float64 `json:"percent"`
	Description string  `json:"description"`
}

type simulateResponse struct {
	Selection struct {
		Model        string `json:"model"`
		Hardware     string `json:"hardware"`
		Framework    string `json:"framework"`
		Scenario     string `json:"scenario"`
		InputTokens  int    `json:"input_tokens"`
		OutputTokens int    `json:"output_tokens"`
	} `json:"selection"`
	Metrics struct {
		TTFTms         float64 `json:"ttft_ms"`
		TPOTms         float64 `json:"tpot_ms"`
		E2Ems          float64 `json:"e2e_ms"`
		ThroughputTokS float64 `json:"throughput_tok_s"`
	} `json:"metrics"`
	Bottleneck           string           `json:"bottleneck"`
	AppliedOptimizations []string         `json:"applied_optimizations"`
	Breakdown            []stageBreakdown `json:"breakdown"`
	Notes                []string         `json:"notes"`
}

func (s *Server) handleSimulate(w http.ResponseWriter, r *http.Request) {
	var req simulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid simulate request: "+err.Error())
		return
	}
	resp, err := s.simulate(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) simulate(req simulateRequest) (*simulateResponse, error) {
	model, ok := findByName(s.store.Models, req.Model, func(m library.Model) string { return m.Name })
	if !ok {
		return nil, errBadInput("unknown model", req.Model)
	}
	hw, ok := findByName(s.store.Hardware, req.Hardware, func(h library.Hardware) string { return h.Name })
	if !ok {
		return nil, errBadInput("unknown hardware", req.Hardware)
	}
	fw, ok := findByName(s.store.Frameworks, req.Framework, func(f library.Framework) string { return f.Name })
	if !ok {
		return nil, errBadInput("unknown framework", req.Framework)
	}
	sc, ok := findByName(s.store.Scenarios, req.Scenario, func(s library.Scenario) string { return s.Name })
	if !ok {
		return nil, errBadInput("unknown scenario", req.Scenario)
	}

	inputTokens := req.InputTokens
	if inputTokens <= 0 {
		inputTokens = sc.InputTokens.Typical
	}
	outputTokens := req.OutputTokens
	if outputTokens <= 0 {
		outputTokens = sc.OutputTokens.Typical
	}
	if inputTokens <= 0 || outputTokens <= 0 {
		return nil, errBadInput("invalid token lengths", "input/output tokens must be > 0")
	}

	applicable := applicableOptimizations(s.store.Optimizations, fw.Name)
	applied := chooseOptimizations(applicable, req.AutoOptimize, req.SelectedOptimizations)
	latencyFactor, throughputFactor, notes := combineOptimizationEffects(applicable, applied)

	ttftComputeMs := float64(inputTokens) * model.ParamsB * 0.03 / math.Max(hw.FP16TFlops/100.0, 0.1)
	ttftMemoryMs := float64(inputTokens) * model.ParamsB * 0.012 / math.Max(hw.MemoryBandwidthTBs, 0.1)
	baseTTFTms := math.Max(ttftComputeMs, ttftMemoryMs)

	tpotComputeMs := model.ParamsB * 0.14 / math.Max(hw.FP16TFlops/100.0, 0.1)
	tpotMemoryMs := (model.ParamsB*0.09 + float64(inputTokens)*0.0025) / math.Max(hw.MemoryBandwidthTBs, 0.1)
	baseTPOTms := math.Max(tpotComputeMs, tpotMemoryMs)

	ttftMs := round2(baseTTFTms * latencyFactor)
	tpotMs := round2(baseTPOTms * latencyFactor)
	e2eMs := round2(ttftMs + tpotMs*float64(outputTokens))
	throughputTokS := round2((1000.0 / math.Max(tpotMs, 0.1)) * throughputFactor)

	bottleneck := "显存/内存带宽"
	if ttftComputeMs+tpotComputeMs > ttftMemoryMs+tpotMemoryMs {
		bottleneck = "计算吞吐"
	}
	if hw.Interconnect.LinksPerDevice > 1 && model.ParamsB >= 30 {
		notes = append(notes, "大模型张量并行通信开销不可忽略，互联效率可能改变最终瓶颈。")
	}

	breakdown := buildBreakdown(ttftMs, tpotMs, outputTokens, bottleneck)

	var resp simulateResponse
	resp.Selection.Model = model.DisplayName
	resp.Selection.Hardware = hw.Name
	resp.Selection.Framework = fw.Name
	resp.Selection.Scenario = sc.Name
	resp.Selection.InputTokens = inputTokens
	resp.Selection.OutputTokens = outputTokens
	resp.Metrics.TTFTms = ttftMs
	resp.Metrics.TPOTms = tpotMs
	resp.Metrics.E2Ems = e2eMs
	resp.Metrics.ThroughputTokS = throughputTokS
	resp.Bottleneck = bottleneck
	resp.AppliedOptimizations = applied
	resp.Breakdown = breakdown
	resp.Notes = notes
	return &resp, nil
}

func buildBreakdown(ttftMs, tpotMs float64, outputTokens int, bottleneck string) []stageBreakdown {
	decodeTotal := tpotMs * float64(outputTokens)
	total := ttftMs + decodeTotal

	if bottleneck == "显存/内存带宽" {
		prefillParts := []struct {
			stage, desc string
			duration    float64
		}{
			{"预填充-矩阵计算", "预填充阶段的 QKV、投影和 FFN 稠密计算。", ttftMs * 0.44},
			{"预填充-注意力", "输入序列上的注意力与上下文聚合。", ttftMs * 0.31},
			{"预填充-并行通信", "预填充中的张量并行同步与跨卡通信。", ttftMs * 0.10},
			{"预填充-调度整理", "批次整理、KV 组织和执行前准备。", ttftMs * 0.15},
		}
		decodeParts := []struct {
			stage, desc string
			duration    float64
		}{
			{"解码-KV读取", "长上下文下 KV Cache 读取占比较高。", decodeTotal * 0.34},
			{"解码-注意力", "逐 Token 注意力更新。", decodeTotal * 0.27},
			{"解码-FFN", "逐 Token 的 FFN / MLP 计算。", decodeTotal * 0.22},
			{"解码-采样后处理", "采样、终止判断与响应封装。", decodeTotal * 0.17},
		}
		return timelineFromParts(total, append(prefillParts, decodeParts...))
	}

	prefillParts := []struct {
		stage, desc string
		duration    float64
	}{
		{"预填充-矩阵计算", "预填充阶段的 QKV、投影和 FFN 稠密计算。", ttftMs * 0.46},
		{"预填充-注意力", "输入序列上的注意力与上下文聚合。", ttftMs * 0.30},
		{"预填充-并行通信", "预填充中的张量并行同步与跨卡通信。", ttftMs * 0.09},
		{"预填充-调度整理", "批次整理、KV 组织和执行前准备。", ttftMs * 0.15},
	}
	decodeParts := []struct {
		stage, desc string
		duration    float64
	}{
		{"解码-KV读取", "解码阶段 KV Cache 读取。", decodeTotal * 0.18},
		{"解码-注意力", "逐 Token 注意力与 score/value 更新。", decodeTotal * 0.34},
		{"解码-FFN", "逐 Token 的 FFN / MLP 计算。", decodeTotal * 0.30},
		{"解码-采样后处理", "采样、终止判断与响应封装。", decodeTotal * 0.18},
	}
	return timelineFromParts(total, append(prefillParts, decodeParts...))
}

func timelineFromParts(total float64, parts []struct {
	stage, desc string
	duration    float64
}) []stageBreakdown {
	out := make([]stageBreakdown, 0, len(parts))
	cursor := 0.0
	for _, p := range parts {
		start := cursor
		end := cursor + p.duration
		out = append(out, stageBreakdown{
			Stage:       p.stage,
			StartMs:     round2(start),
			EndMs:       round2(end),
			DurationMs:  round2(p.duration),
			Percent:     round2((p.duration / math.Max(total, 0.1)) * 100),
			Description: p.desc,
		})
		cursor = end
	}
	return out
}

func applicableOptimizations(opts []library.Optimization, framework string) map[string]library.Optimization {
	out := make(map[string]library.Optimization, len(opts))
	for _, opt := range opts {
		if slices.Contains(opt.Frameworks, framework) {
			out[opt.ID] = opt
		}
	}
	return out
}

func chooseOptimizations(applicable map[string]library.Optimization, auto bool, selected []string) []string {
	if auto {
		ids := make([]string, 0, len(applicable))
		for id := range applicable {
			ids = append(ids, id)
		}
		slices.Sort(ids)
		return ids
	}

	seen := map[string]bool{}
	var applied []string
	var addWithDeps func(string)
	addWithDeps = func(id string) {
		if seen[id] {
			return
		}
		opt, ok := applicable[id]
		if !ok {
			return
		}
		seen[id] = true
		for _, dep := range opt.DependsOn {
			addWithDeps(dep)
		}
		applied = append(applied, id)
	}
	for _, id := range selected {
		addWithDeps(id)
	}
	return applied
}

func combineOptimizationEffects(applicable map[string]library.Optimization, applied []string) (float64, float64, []string) {
	latencyFactor := 1.0
	throughputFactor := 1.0
	notes := []string{}
	for _, id := range applied {
		opt := applicable[id]
		if opt.LatencyFactor > 0 {
			latencyFactor *= opt.LatencyFactor
		}
		if opt.ThroughputFactor > 0 {
			throughputFactor *= opt.ThroughputFactor
		}
		if opt.Category == "graph" {
			notes = append(notes, "图模式有助于降低稳态时延，但首次运行可能引入一次性编译开销。")
		}
		if opt.ID == "kv-int8" {
			notes = append(notes, "KV Int8 通过降低 KV 带宽压力，对长上下文解码路径尤其有帮助。")
		}
	}
	latencyFactor = clamp(latencyFactor, 0.45, 1.10)
	throughputFactor = clamp(throughputFactor, 1.0, 3.0)
	return latencyFactor, throughputFactor, notes
}

func clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func findByName[T any](items []T, want string, name func(T) string) (T, bool) {
	var zero T
	for _, item := range items {
		if name(item) == want {
			return item, true
		}
	}
	return zero, false
}

func errBadInput(kind, value string) error {
	return &badInputError{kind: kind, value: value}
}

type badInputError struct {
	kind  string
	value string
}

func (e *badInputError) Error() string {
	return e.kind + ": " + e.value
}
