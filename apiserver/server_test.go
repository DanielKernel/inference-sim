package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/DanielKernel/inference-sim-platform/library"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	store, err := library.Load(filepath.Join("..", "data"))
	if err != nil {
		t.Fatalf("loading data: %v", err)
	}
	return NewServer(store, "../data", "")
}

func TestHealth(t *testing.T) {
	srv := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status field = %q, want ok", body["status"])
	}
}

func TestConfigCounts(t *testing.T) {
	srv := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body struct {
		Counts map[string]int `json:"counts"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Counts["models"] < 2 {
		t.Errorf("models count = %d, want >= 2", body.Counts["models"])
	}
	if body.Counts["hardware"] < 3 {
		t.Errorf("hardware count = %d, want >= 3", body.Counts["hardware"])
	}
}

func TestLibraryList(t *testing.T) {
	srv := testServer(t)
	for _, kind := range []string{"models", "hardware", "frameworks", "scenarios", "perf_records", "optimizations"} {
		req := httptest.NewRequest(http.MethodGet, "/api/library/"+kind, nil)
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", kind, rec.Code)
		}
		var arr []any
		if err := json.Unmarshal(rec.Body.Bytes(), &arr); err != nil {
			t.Errorf("%s: decode: %v", kind, err)
			continue
		}
		if len(arr) == 0 {
			t.Errorf("%s: expected non-empty list", kind)
		}
	}
}

func TestLibraryListSupportsFiltering(t *testing.T) {
	srv := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/library/frameworks?q=vllm&limit=2", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var rows []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("expected at least one filtered framework")
	}
	if len(rows) > 2 {
		t.Fatalf("len(rows) = %d, want <= 2", len(rows))
	}
}

func TestLibraryCompare(t *testing.T) {
	srv := testServer(t)
	body := `{"keys":["ascend-910b","nvidia-h100"]}`
	req := httptest.NewRequest(http.MethodPost, "/api/library/hardware/compare", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Items      []map[string]any `json:"items"`
		DiffFields []string         `json:"diff_fields"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(resp.Items))
	}
	if len(resp.DiffFields) == 0 {
		t.Fatal("expected diff fields")
	}
}

func TestLibraryListUnknownKind(t *testing.T) {
	srv := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/library/bogus", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestCORSPreflight(t *testing.T) {
	srv := testServer(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("missing CORS allow-origin header")
	}
}

func TestSimulate(t *testing.T) {
	srv := testServer(t)
	body := `{
	  "model":"qwen3-32b",
	  "hardware":"ascend-910b",
	  "framework":"vllm-ascend",
	  "scenario":"rag",
	  "input_tokens":4096,
	  "output_tokens":512,
	  "auto_optimize":true
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/simulate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Metrics struct {
			TTFTms         float64 `json:"ttft_ms"`
			TPOTms         float64 `json:"tpot_ms"`
			ThroughputTokS float64 `json:"throughput_tok_s"`
		} `json:"metrics"`
		AppliedOptimizations []string `json:"applied_optimizations"`
		Breakdown            []any    `json:"breakdown"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Metrics.TTFTms <= 0 || resp.Metrics.TPOTms <= 0 || resp.Metrics.ThroughputTokS <= 0 {
		t.Fatalf("expected positive metrics, got %+v", resp.Metrics)
	}
	if len(resp.AppliedOptimizations) == 0 {
		t.Fatal("expected auto-optimized simulate response to include optimizations")
	}
	if len(resp.Breakdown) == 0 {
		t.Fatal("expected breakdown entries")
	}
}

func TestAnalyticEstimate(t *testing.T) {
	srv := testServer(t)
	body := `{
	  "model":"qwen3-32b",
	  "hardware":"ascend-910b",
	  "scenario":"rag"
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/analytic/estimate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Estimates struct {
			TTFTms float64 `json:"ttft_ms"`
			TPOTms float64 `json:"tpot_ms"`
		} `json:"estimates"`
		Roofline struct {
			RidgePoint float64 `json:"ridge_point"`
		} `json:"roofline"`
		Breakdown []any `json:"breakdown"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Estimates.TTFTms <= 0 || resp.Estimates.TPOTms <= 0 {
		t.Fatalf("expected positive estimates, got %+v", resp.Estimates)
	}
	if resp.Roofline.RidgePoint <= 0 {
		t.Fatalf("expected positive ridge point, got %v", resp.Roofline.RidgePoint)
	}
	if len(resp.Breakdown) == 0 {
		t.Fatal("expected analytic breakdown")
	}
}

func TestBLISSimulate(t *testing.T) {
	srv := testServer(t)
	body := `{
	  "model":"qwen3-8b",
	  "hardware":"nvidia-a100",
	  "scenario":"chatbot",
	  "latency_backend":"roofline",
	  "tp":1,
	  "num_instances":1,
	  "rate":1.5,
	  "num_requests":8,
	  "horizon_us":2000000,
	  "arrival_process":"poisson",
	  "routing_policy":"round-robin",
	  "scheduler":"fcfs",
	  "preemption_policy":"fcfs",
	  "total_kv_blocks":120000,
	  "max_running_reqs":32,
	  "max_scheduled_tokens":1024,
	  "seed":7
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/blis/simulate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Metrics struct {
			InjectedRequests  int     `json:"injected_requests"`
			CompletedRequests int     `json:"completed_requests"`
			TTFTMeanMs        float64 `json:"ttft_mean_ms"`
		} `json:"metrics"`
		Calibration struct {
			Status string `json:"status"`
		} `json:"calibration"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Metrics.InjectedRequests == 0 {
		t.Fatal("expected injected requests")
	}
	if resp.Metrics.TTFTMeanMs <= 0 {
		t.Fatalf("expected positive TTFT mean, got %v", resp.Metrics.TTFTMeanMs)
	}
	if resp.Calibration.Status == "" {
		t.Fatal("expected calibration status")
	}
}
