package main

import (
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
	return NewServer(store, "../data")
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
