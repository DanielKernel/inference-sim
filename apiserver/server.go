package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/DanielKernel/inference-sim-platform/library"
)

// Server holds the loaded curated data and serves the platform HTTP API.
type Server struct {
	store   *library.Store
	dataDir string
	webDir  string
}

// NewServer constructs a Server over an already-loaded library Store.
func NewServer(store *library.Store, dataDir, webDir string) *Server {
	return &Server{store: store, dataDir: dataDir, webDir: webDir}
}

// Handler returns the root http.Handler with all routes and middleware applied.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/config", s.handleConfig)
	mux.HandleFunc("GET /api/library/{kind}", s.handleLibraryList)
	mux.HandleFunc("POST /api/simulate", s.handleSimulate)
	if s.webDir != "" {
		mux.HandleFunc("GET /", s.handleWeb)
	}
	return withCORS(mux)
}

// withCORS allows the React dev server (and any browser client) to call the API.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleConfig reports the loaded data location and per-kind entry counts.
func (s *Server) handleConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"schema_version": library.SchemaVersion,
		"data_dir":       s.dataDir,
		"counts": map[string]int{
			"models":        len(s.store.Models),
			"hardware":      len(s.store.Hardware),
			"frameworks":    len(s.store.Frameworks),
			"scenarios":     len(s.store.Scenarios),
			"perf_records":  len(s.store.PerfRecords),
			"optimizations": len(s.store.Optimizations),
		},
	})
}

// handleLibraryList returns all entries for one curated kind. Filtering and
// comparison endpoints are added in Phase 1; this is the scaffolding lister.
func (s *Server) handleLibraryList(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("kind")
	var items any
	switch kind {
	case "models":
		items = s.store.Models
	case "hardware":
		items = s.store.Hardware
	case "frameworks":
		items = s.store.Frameworks
	case "scenarios":
		items = s.store.Scenarios
	case "perf_records", "perfdb":
		items = s.store.PerfRecords
	case "optimizations":
		items = s.store.Optimizations
	default:
		writeError(w, http.StatusNotFound, "unknown library kind: "+kind)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// handleWeb serves the built SPA from webDir and falls back to index.html so
// client-side routes keep working when opened directly.
func (s *Server) handleWeb(w http.ResponseWriter, r *http.Request) {
	if s.webDir == "" {
		http.NotFound(w, r)
		return
	}
	reqPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
	if reqPath == "." || reqPath == "" {
		reqPath = "index.html"
	}
	target := filepath.Join(s.webDir, reqPath)
	if info, err := os.Stat(target); err == nil && !info.IsDir() {
		http.ServeFile(w, r, target)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.webDir, "index.html"))
}
