package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/DanielKernel/inference-sim-platform/library"
	blissim "github.com/inference-sim/inference-sim/sim"
	bliscluster "github.com/inference-sim/inference-sim/sim/cluster"
	blisworkload "github.com/inference-sim/inference-sim/sim/workload"
)

type blisMetricsSummary struct {
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
}

type blisReplayRequest struct {
	TraceHeaderPath    string `json:"trace_header_path"`
	TraceDataPath      string `json:"trace_data_path"`
	Model              string `json:"model"`
	Hardware           string `json:"hardware"`
	LatencyBackend     string `json:"latency_backend"`
	TP                 int    `json:"tp"`
	NumInstances       int    `json:"num_instances"`
	TotalKVBlocks      int64  `json:"total_kv_blocks"`
	MaxRunningReqs     int64  `json:"max_running_reqs"`
	MaxScheduledTokens int64  `json:"max_scheduled_tokens"`
	Scheduler          string `json:"scheduler"`
	PreemptionPolicy   string `json:"preemption_policy"`
	RoutingPolicy      string `json:"routing_policy"`
	SessionMode        string `json:"session_mode"`
	ThinkTimeMs        int    `json:"think_time_ms"`
	HorizonUs          int64  `json:"horizon_us"`
	Seed               int64  `json:"seed"`
}

type blisReplayResponse struct {
	Trace struct {
		HeaderPath   string `json:"header_path"`
		DataPath     string `json:"data_path"`
		SessionMode  string `json:"session_mode"`
		RequestCount int    `json:"request_count"`
	} `json:"trace"`
	Metrics    blisMetricsSummary       `json:"metrics"`
	SimResults []blisworkload.SimResult `json:"sim_results"`
	Notes      []string                 `json:"notes"`
}

type blisObserveRequest struct {
	ServerURL       string  `json:"server_url"`
	Model           string  `json:"model"`
	WorkloadPreset  string  `json:"workload_preset"`
	Rate            float64 `json:"rate"`
	NumRequests     int     `json:"num_requests"`
	PromptTokens    int     `json:"prompt_tokens"`
	OutputTokens    int     `json:"output_tokens"`
	PrefixTokens    int     `json:"prefix_tokens"`
	APIFormat       string  `json:"api_format"`
	RTTMs           float64 `json:"rtt_ms"`
	RecordITL       bool    `json:"record_itl"`
	Concurrency     int     `json:"concurrency"`
	ThinkTimeMs     int     `json:"think_time_ms"`
	TimeoutSeconds  int     `json:"timeout_seconds"`
	PrewarmDuration string  `json:"prewarm_duration"`
}

type blisObserveResponse struct {
	Artifacts struct {
		TraceHeaderPath string `json:"trace_header_path"`
		TraceDataPath   string `json:"trace_data_path"`
		ITLPath         string `json:"itl_path,omitempty"`
	} `json:"artifacts"`
	Metrics blisMetricsSummary `json:"metrics"`
	Stdout  string             `json:"stdout,omitempty"`
	Stderr  string             `json:"stderr,omitempty"`
}

type blisCalibrateRequest struct {
	TraceHeaderPath string                   `json:"trace_header_path"`
	TraceDataPath   string                   `json:"trace_data_path"`
	SimResults      []blisworkload.SimResult `json:"sim_results"`
	WarmUpRequests  int                      `json:"warm_up_requests"`
	NetworkRTTUs    int64                    `json:"network_rtt_us"`
	BandwidthMbps   float64                  `json:"bandwidth_mbps"`
	ITLDataPath     string                   `json:"itl_data_path"`
}

type blisCalibrateResponse struct {
	Report *blisworkload.CalibrationReport `json:"report"`
}

type blisTraceArtifacts struct {
	TraceHeaderPath string
	TraceDataPath   string
	ITLPath         string
}

func (s *Server) handleBLISReplay(w http.ResponseWriter, r *http.Request) {
	var req blisReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid BLIS replay request: "+err.Error())
		return
	}
	resp, err := s.runBLISReplay(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleBLISObserve(w http.ResponseWriter, r *http.Request) {
	var req blisObserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid BLIS observe request: "+err.Error())
		return
	}
	resp, err := s.runBLISObserve(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleBLISCalibrate(w http.ResponseWriter, r *http.Request) {
	var req blisCalibrateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid BLIS calibrate request: "+err.Error())
		return
	}
	resp, err := s.runBLISCalibrate(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) runBLISReplay(req blisReplayRequest) (*blisReplayResponse, error) {
	req.TraceHeaderPath, req.TraceDataPath = s.resolveBLISTracePaths(req.TraceHeaderPath, req.TraceDataPath)
	if req.TraceHeaderPath == "" || req.TraceDataPath == "" {
		return nil, errors.New("trace_header_path and trace_data_path are required (or run BLIS observe first to reuse the latest trace)")
	}
	traceData, err := blisworkload.LoadTraceV2(req.TraceHeaderPath, req.TraceDataPath)
	if err != nil {
		return nil, fmt.Errorf("loading trace: %w", err)
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	model, ok := findByName(s.store.Models, req.Model, func(item library.Model) string { return item.Name })
	if !ok {
		return nil, errBadInput("unknown model", req.Model)
	}
	hwName := req.Hardware
	if hwName == "" {
		hwName = defaultHardwareName(s.store.Hardware)
	}
	hw, ok := findByName(s.store.Hardware, hwName, func(item library.Hardware) string { return item.Name })
	if !ok {
		return nil, errBadInput("unknown hardware", hwName)
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
	if req.TotalKVBlocks <= 0 {
		req.TotalKVBlocks = 200000
	}
	if req.MaxRunningReqs <= 0 {
		req.MaxRunningReqs = 128
	}
	if req.MaxScheduledTokens <= 0 {
		req.MaxScheduledTokens = 2048
	}
	if req.Scheduler == "" {
		req.Scheduler = "fcfs"
	}
	if req.PreemptionPolicy == "" {
		req.PreemptionPolicy = "fcfs"
	}
	if req.RoutingPolicy == "" {
		req.RoutingPolicy = "round-robin"
	}
	if req.SessionMode == "" {
		req.SessionMode = "fixed"
	}

	var requests []*blissim.Request
	var sessionMgr *blisworkload.SessionManager
	if req.SessionMode == "closed-loop" {
		var thinkTimeSampler blisworkload.LengthSampler
		if req.ThinkTimeMs > 0 {
			thinkTimeSampler, err = blisworkload.ParseThinkTimeDist(fmt.Sprintf("constant:value=%dms", req.ThinkTimeMs))
			if err != nil {
				return nil, fmt.Errorf("parsing think time: %w", err)
			}
		}
		replayHorizonPrelim := req.HorizonUs
		if replayHorizonPrelim <= 0 {
			replayHorizonPrelim = computeReplayHorizonFromTrace(traceData)
		}
		var blueprints []blisworkload.SessionBlueprint
		requests, blueprints, err = blisworkload.LoadTraceV2SessionBlueprints(traceData, req.Seed, thinkTimeSampler, replayHorizonPrelim)
		if err != nil {
			return nil, fmt.Errorf("building session blueprints: %w", err)
		}
		if len(blueprints) > 0 {
			sessionMgr = blisworkload.NewSessionManager(blueprints)
		}
	} else {
		requests, err = blisworkload.LoadTraceV2Requests(traceData, req.Seed)
		if err != nil {
			return nil, fmt.Errorf("building replay requests: %w", err)
		}
	}
	horizon := req.HorizonUs
	if horizon <= 0 {
		horizon = computeReplayHorizon(requests)
	}

	config := buildBLISDeploymentConfig(model, hw, backend, req.TP, req.NumInstances, horizon, req.Seed, req.TotalKVBlocks, req.MaxRunningReqs, req.MaxScheduledTokens, req.Scheduler, req.PreemptionPolicy, req.RoutingPolicy)
	var onRequestDone func(*blissim.Request, int64) []*blissim.Request
	if sessionMgr != nil {
		onRequestDone = sessionMgr.OnComplete
	}
	cs, err := runClusterSafely(config, requests, onRequestDone)
	if err != nil {
		return nil, err
	}
	if err := cs.Run(); err != nil {
		return nil, fmt.Errorf("replay simulation failed: %w", err)
	}
	output := cs.AggregatedMetrics().BuildOutput("cluster", nil)
	var resp blisReplayResponse
	resp.Trace.HeaderPath = req.TraceHeaderPath
	resp.Trace.DataPath = req.TraceDataPath
	resp.Trace.SessionMode = req.SessionMode
	resp.Trace.RequestCount = len(traceData.Records)
	resp.Metrics = toMetricsSummary(output)
	resp.SimResults = extractSimResults(cs.AggregatedMetrics())
	s.rememberBLISTrace(blisTraceArtifacts{
		TraceHeaderPath: req.TraceHeaderPath,
		TraceDataPath:   req.TraceDataPath,
	})
	s.rememberBLISResults(resp.SimResults)
	resp.Notes = []string{
		"Replay 复用了 BLIS TraceV2 装载与 cluster DES 路径。",
		"如 trace 含 session 轮次，可切换 closed-loop 以使用 SessionManager 驱动后续 follow-up。",
	}
	return &resp, nil
}

func (s *Server) runBLISObserve(ctx context.Context, req blisObserveRequest) (*blisObserveResponse, error) {
	if err := validateLocalObserveURL(req.ServerURL); err != nil {
		return nil, err
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	if req.TimeoutSeconds <= 0 {
		req.TimeoutSeconds = 60
	}
	if req.NumRequests <= 0 {
		req.NumRequests = 20
	}
	if req.APIFormat == "" {
		req.APIFormat = "completions"
	}
	if req.WorkloadPreset == "" && req.Rate <= 0 && req.Concurrency <= 0 {
		req.Rate = 2
	}
	if req.PromptTokens <= 0 {
		req.PromptTokens = 512
	}
	if req.OutputTokens <= 0 {
		req.OutputTokens = 256
	}
	artifactDir, err := s.ensureArtifactsDir()
	if err != nil {
		return nil, err
	}
	runID := strconv.FormatInt(time.Now().UnixNano(), 10)
	traceHeader := filepath.Join(artifactDir, "observe-"+runID+".yaml")
	traceData := filepath.Join(artifactDir, "observe-"+runID+".csv")
	itlOutput := ""
	args := []string{
		"observe",
		"--server-url", req.ServerURL,
		"--model", req.Model,
		"--trace-header", traceHeader,
		"--trace-data", traceData,
		"--api-format", req.APIFormat,
		"--timeout", strconv.Itoa(req.TimeoutSeconds),
	}
	if req.WorkloadPreset != "" {
		defaultsPath, err := s.resolveBLISDefaultsPath()
		if err != nil {
			return nil, err
		}
		args = append(args, "--workload", req.WorkloadPreset)
		args = append(args, "--defaults-filepath", defaultsPath)
	}
	if req.Rate > 0 {
		args = append(args, "--rate", fmt.Sprintf("%g", req.Rate))
	}
	if req.Concurrency > 0 {
		args = append(args, "--concurrency", strconv.Itoa(req.Concurrency))
	}
	args = append(args, "--num-requests", strconv.Itoa(req.NumRequests))
	args = append(args, "--prompt-tokens", strconv.Itoa(req.PromptTokens))
	args = append(args, "--output-tokens", strconv.Itoa(req.OutputTokens))
	if req.PrefixTokens > 0 {
		args = append(args, "--prefix-tokens", strconv.Itoa(req.PrefixTokens))
	}
	if req.RTTMs > 0 {
		args = append(args, "--rtt-ms", fmt.Sprintf("%g", req.RTTMs))
	}
	if req.ThinkTimeMs > 0 {
		args = append(args, "--think-time-ms", strconv.Itoa(req.ThinkTimeMs))
	}
	if req.RecordITL {
		itlOutput = filepath.Join(artifactDir, "observe-"+runID+".itl.csv")
		args = append(args, "--record-itl", "--itl-output", itlOutput)
	}
	if req.PrewarmDuration != "" {
		args = append(args, "--prewarm-duration", req.PrewarmDuration)
	}
	stdout, stderr, err := s.runBLISCLI(ctx, args, 20*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("observe failed: %w; stderr=%s", err, stderr)
	}
	metrics, err := extractMetricsSummary(stdout)
	if err != nil {
		return nil, fmt.Errorf("observe metrics parse failed: %w", err)
	}
	var resp blisObserveResponse
	resp.Artifacts.TraceHeaderPath = traceHeader
	resp.Artifacts.TraceDataPath = traceData
	resp.Artifacts.ITLPath = itlOutput
	resp.Metrics = metrics
	resp.Stdout = stdout
	resp.Stderr = stderr
	s.rememberBLISTrace(blisTraceArtifacts{
		TraceHeaderPath: traceHeader,
		TraceDataPath:   traceData,
		ITLPath:         itlOutput,
	})
	return &resp, nil
}

func (s *Server) resolveBLISDefaultsPath() (string, error) {
	candidates := []string{
		filepath.Join(s.repoRoot, "third_party", "inference-sim", "defaults.yaml"),
		filepath.Join(s.repoRoot, "defaults.yaml"),
	}
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("BLIS defaults.yaml not found; checked %s", strings.Join(candidates, ", "))
}

func (s *Server) runBLISCalibrate(req blisCalibrateRequest) (*blisCalibrateResponse, error) {
	req.TraceHeaderPath, req.TraceDataPath = s.resolveBLISTracePaths(req.TraceHeaderPath, req.TraceDataPath)
	if req.TraceHeaderPath == "" || req.TraceDataPath == "" {
		return nil, errors.New("trace_header_path and trace_data_path are required (or run BLIS observe first to reuse the latest trace)")
	}
	if req.ITLDataPath == "" {
		req.ITLDataPath = s.latestBLISTrace().ITLPath
	}
	if len(req.SimResults) == 0 {
		req.SimResults = s.latestBLISResults()
	}
	if len(req.SimResults) == 0 {
		return nil, errors.New("sim_results are required (or run BLIS replay first to reuse the latest sim results)")
	}
	traceData, err := blisworkload.LoadTraceV2(req.TraceHeaderPath, req.TraceDataPath)
	if err != nil {
		return nil, fmt.Errorf("loading trace: %w", err)
	}
	config := &blisworkload.CalibrationConfig{
		WarmUpRequests: req.WarmUpRequests,
		NetworkRTTUs:   req.NetworkRTTUs,
		BandwidthMbps:  req.BandwidthMbps,
	}
	var report *blisworkload.CalibrationReport
	if req.ITLDataPath != "" {
		itlRecords, err := blisworkload.LoadITL(req.ITLDataPath)
		if err != nil {
			return nil, fmt.Errorf("loading ITL data: %w", err)
		}
		pairs, err := blisworkload.PrepareCalibrationPairsWithITL(traceData.Records, req.SimResults, itlRecords, config)
		if err != nil {
			return nil, fmt.Errorf("preparing calibration pairs: %w", err)
		}
		report, err = blisworkload.BuildCalibrationReport(pairs, &blisworkload.ConfigMatchInfo{})
		if err != nil {
			return nil, fmt.Errorf("building calibration report: %w", err)
		}
	} else {
		pairs, _, err := blisworkload.PrepareCalibrationPairs(traceData.Records, req.SimResults, config)
		if err != nil {
			return nil, fmt.Errorf("preparing calibration pairs: %w", err)
		}
		report, err = blisworkload.BuildCalibrationReport(pairs, &blisworkload.ConfigMatchInfo{})
		if err != nil {
			return nil, fmt.Errorf("building calibration report: %w", err)
		}
	}
	return &blisCalibrateResponse{Report: report}, nil
}

func (s *Server) resolveBLISTracePaths(headerPath, dataPath string) (string, string) {
	headerPath = strings.TrimSpace(headerPath)
	dataPath = strings.TrimSpace(dataPath)
	if headerPath != "" && dataPath != "" {
		return headerPath, dataPath
	}
	latest := s.latestBLISTrace()
	if headerPath == "" {
		headerPath = latest.TraceHeaderPath
	}
	if dataPath == "" {
		dataPath = latest.TraceDataPath
	}
	return headerPath, dataPath
}

func (s *Server) rememberBLISTrace(artifacts blisTraceArtifacts) {
	s.blisStateMu.Lock()
	defer s.blisStateMu.Unlock()
	s.lastBLISTrace = artifacts
}

func (s *Server) latestBLISTrace() blisTraceArtifacts {
	s.blisStateMu.RLock()
	defer s.blisStateMu.RUnlock()
	return s.lastBLISTrace
}

func (s *Server) rememberBLISResults(results []blisworkload.SimResult) {
	copied := append([]blisworkload.SimResult(nil), results...)
	s.blisStateMu.Lock()
	defer s.blisStateMu.Unlock()
	s.lastBLISResults = copied
}

func (s *Server) latestBLISResults() []blisworkload.SimResult {
	s.blisStateMu.RLock()
	defer s.blisStateMu.RUnlock()
	return append([]blisworkload.SimResult(nil), s.lastBLISResults...)
}

func buildBLISDeploymentConfig(model library.Model, hw library.Hardware, backend string, tp, numInstances int, horizon, seed, totalKVBlocks, maxRunningReqs, maxScheduledTokens int64, scheduler, preemptionPolicy, routingPolicy string) bliscluster.DeploymentConfig {
	modelConfig := toBLISModelConfig(model)
	hwConfig := toBLISHardwareConfig(hw)
	return bliscluster.DeploymentConfig{
		SimConfig: blissim.SimConfig{
			Horizon:             horizon,
			Seed:                seed,
			KVCacheConfig:       blissim.NewKVCacheConfig(totalKVBlocks, 16, 0, 0.9, 100.0, 0),
			BatchConfig:         blissim.NewBatchConfig(maxRunningReqs, maxScheduledTokens, 0),
			LatencyCoeffs:       blissim.NewLatencyCoeffs([]float64{0, 0, 0}, []float64{0, 0, 0}),
			ModelHardwareConfig: blissim.NewModelHardwareConfig(modelConfig, hwConfig, model.Name, hw.Name, tp, 1, false, "", backend, int64(model.Architecture.MaxSeqLen)),
			PolicyConfig:        blissim.NewPolicyConfig(scheduler, preemptionPolicy),
			WorkloadConfig:      blissim.NewWorkloadConfig(),
		},
		NumInstances:            numInstances,
		AdmissionPolicy:         "always-admit",
		RoutingPolicy:           routingPolicy,
		SnapshotRefreshInterval: 0,
		CacheSignalDelay:        bliscluster.DefaultCacheSignalDelay,
	}
}

func defaultHardwareName(items []library.Hardware) string {
	for _, item := range items {
		if item.DeviceType == "gpu" {
			return item.Name
		}
	}
	if len(items) > 0 {
		return items[0].Name
	}
	return ""
}

func computeReplayHorizonFromTrace(traceData *blisworkload.TraceV2) int64 {
	var maxArrival int64
	for _, record := range traceData.Records {
		if record.ArrivalTimeUs > maxArrival {
			maxArrival = record.ArrivalTimeUs
		}
	}
	return computeReplayHorizonFromMaxArrival(maxArrival)
}

func computeReplayHorizon(requests []*blissim.Request) int64 {
	var maxArrival int64
	for _, req := range requests {
		if req.ArrivalTime > maxArrival {
			maxArrival = req.ArrivalTime
		}
	}
	return computeReplayHorizonFromMaxArrival(maxArrival)
}

func computeReplayHorizonFromMaxArrival(maxArrival int64) int64 {
	if maxArrival <= 0 {
		return 1_000_000
	}
	return maxArrival * 2
}

func extractSimResults(m *blissim.Metrics) []blisworkload.SimResult {
	results := make([]blisworkload.SimResult, 0, len(m.RequestTTFTs))
	for reqID, ttftUs := range m.RequestTTFTs {
		e2eUs, hasE2E := m.RequestE2Es[reqID]
		if !hasE2E {
			continue
		}
		rm, hasReq := m.Requests[reqID]
		if !hasReq {
			continue
		}
		numStr := strings.TrimPrefix(reqID, "request_")
		id, err := strconv.Atoi(numStr)
		if err != nil {
			continue
		}
		results = append(results, blisworkload.SimResult{
			RequestID:    id,
			TTFT:         ttftUs,
			E2E:          e2eUs,
			InputTokens:  rm.NumPrefillTokens,
			OutputTokens: rm.NumDecodeTokens,
			SLOClass:     rm.SLOClass,
			Model:        rm.Model,
			ITLMeanUs:    m.RequestITLs[reqID],
		})
	}
	return results
}

func toMetricsSummary(output blissim.MetricsOutput) blisMetricsSummary {
	return blisMetricsSummary{
		CompletedRequests: output.CompletedRequests,
		InjectedRequests:  output.InjectedRequests,
		TTFTMeanMs:        round2(output.TTFTMeanMs),
		TTFTP95Ms:         round2(output.TTFTP95Ms),
		E2EP95Ms:          round2(output.E2EP95Ms),
		ITLMeanMs:         round2(output.ITLMeanMs),
		ResponsesPerSec:   round2(output.ResponsesPerSec),
		TokensPerSec:      round2(output.TokensPerSec),
		DroppedUnservable: output.DroppedUnservable,
		TimedOutRequests:  output.TimedOutRequests,
		PreemptionCount:   output.PreemptionCount,
	}
}

func (s *Server) ensureArtifactsDir() (string, error) {
	if s.artifactsDir != "" {
		return s.artifactsDir, nil
	}
	dir, err := os.MkdirTemp("", "inference-sim-platform-*")
	if err != nil {
		return "", fmt.Errorf("creating artifacts dir: %w", err)
	}
	s.artifactsDir = dir
	return dir, nil
}

func (s *Server) ensureBLISBinary() (string, error) {
	s.blisBinaryBuild.Do(func() {
		dir, err := s.ensureArtifactsDir()
		if err != nil {
			s.blisBinaryErr = err
			return
		}
		target := filepath.Join(dir, "blis-bridge")
		buildCmd := exec.Command("go", "build", "-o", target, "./third_party/inference-sim")
		buildCmd.Dir = s.repoRoot
		if err := buildCmd.Run(); err != nil {
			s.blisBinaryErr = fmt.Errorf("building BLIS bridge binary: %w", err)
			return
		}
		s.blisBinaryPath = target
	})
	return s.blisBinaryPath, s.blisBinaryErr
}

func (s *Server) runBLISCLI(parent context.Context, args []string, timeout time.Duration) (string, string, error) {
	binaryPath, err := s.ensureBLISBinary()
	if err != nil {
		return "", "", err
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, binaryPath, args...)
	cmd.Dir = s.repoRoot
	var stdoutBuf bytes.Buffer
	var stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf
	err = cmd.Run()
	return stdoutBuf.String(), stderrBuf.String(), err
}

func validateLocalObserveURL(raw string) error {
	if raw == "" {
		return errors.New("server_url is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid server_url: %w", err)
	}
	host := parsed.Hostname()
	if host == "" {
		return errors.New("server_url must include a host")
	}
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return nil
	}
	if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
		return nil
	}
	return errors.New("observe only allows localhost or loopback server_url values")
}

func extractMetricsSummary(stdout string) (blisMetricsSummary, error) {
	var summary blisMetricsSummary
	marker := "=== Simulation Metrics ==="
	start := strings.Index(stdout, marker)
	if start == -1 {
		return summary, errors.New("metrics marker not found in stdout")
	}
	jsonStart := strings.Index(stdout[start:], "{")
	if jsonStart == -1 {
		return summary, errors.New("metrics JSON start not found")
	}
	jsonStart += start
	jsonEnd := findMatchingBrace(stdout[jsonStart:])
	if jsonEnd == -1 {
		return summary, errors.New("metrics JSON end not found")
	}
	jsonBlob := stdout[jsonStart : jsonStart+jsonEnd+1]
	var raw blissim.MetricsOutput
	if err := json.Unmarshal([]byte(jsonBlob), &raw); err != nil {
		return summary, fmt.Errorf("decoding metrics JSON: %w", err)
	}
	return toMetricsSummary(raw), nil
}

func runClusterSafely(config bliscluster.DeploymentConfig, requests []*blissim.Request, onRequestDone func(*blissim.Request, int64) []*blissim.Request) (_ *bliscluster.ClusterSimulator, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("invalid BLIS deployment config: %v", recovered)
		}
	}()
	return bliscluster.NewClusterSimulator(config, requests, onRequestDone), nil
}

func findMatchingBrace(text string) int {
	depth := 0
	inString := false
	escaped := false
	for idx, r := range text {
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if r == '\\' {
				escaped = true
				continue
			}
			if r == '"' {
				inString = false
			}
			continue
		}
		switch r {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return idx
			}
		}
	}
	return -1
}
