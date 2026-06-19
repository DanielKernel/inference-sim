package library

import (
	"os"
	"path/filepath"
	"testing"
)

// repoDataDir returns the path to the committed data/ tree relative to this package.
func repoDataDir(t *testing.T) string {
	t.Helper()
	dir := filepath.Join("..", "data")
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("data dir not found at %s: %v", dir, err)
	}
	return dir
}

func TestLoadSeedData(t *testing.T) {
	store, err := Load(repoDataDir(t))
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	tests := []struct {
		name    string
		gotLen  int
		wantMin int
	}{
		{"models", len(store.Models), 2},
		{"hardware", len(store.Hardware), 3},
		{"frameworks", len(store.Frameworks), 1},
		{"scenarios", len(store.Scenarios), 4},
		{"perf_records", len(store.PerfRecords), 1},
		{"optimizations", len(store.Optimizations), 5},
	}
	for _, tc := range tests {
		if tc.gotLen < tc.wantMin {
			t.Errorf("%s: got %d entries, want >= %d", tc.name, tc.gotLen, tc.wantMin)
		}
	}
}

func TestLoadParsesNestedFields(t *testing.T) {
	store, err := Load(repoDataDir(t))
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	var q32 *Model
	for i := range store.Models {
		if store.Models[i].Name == "qwen3-32b" {
			q32 = &store.Models[i]
			break
		}
	}
	if q32 == nil {
		t.Fatal("qwen3-32b not loaded")
	}
	if q32.Architecture.HiddenSize != 5120 {
		t.Errorf("hidden_size = %d, want 5120", q32.Architecture.HiddenSize)
	}
	if q32.Architecture.AttentionType != "gqa" {
		t.Errorf("attention_type = %q, want gqa", q32.Architecture.AttentionType)
	}
	if len(q32.KeyAlgorithms) == 0 {
		t.Error("expected key_algorithms to be populated")
	}
}

func TestLoadRejectsUnknownField(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "models")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	bad := `schema_version: 1
kind: model
items:
  - name: bogus
    not_a_real_field: 42
`
	if err := os.WriteFile(filepath.Join(dir, "bad.yaml"), []byte(bad), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root); err == nil {
		t.Fatal("expected strict-parse error for unknown field, got nil")
	}
}

func TestLoadRejectsKindMismatch(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "models")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	mismatch := `schema_version: 1
kind: hardware
items: []
`
	if err := os.WriteFile(filepath.Join(dir, "x.yaml"), []byte(mismatch), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root); err == nil {
		t.Fatal("expected kind-mismatch error, got nil")
	}
}

func TestLoadRejectsFutureSchemaVersion(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "scenarios")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	future := `schema_version: 999
kind: scenario
items: []
`
	if err := os.WriteFile(filepath.Join(dir, "x.yaml"), []byte(future), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(root); err == nil {
		t.Fatal("expected future-schema-version error, got nil")
	}
}

func TestLoadMissingDirIsEmptyNotError(t *testing.T) {
	root := t.TempDir() // no subdirectories at all
	store, err := Load(root)
	if err != nil {
		t.Fatalf("Load on empty root returned error: %v", err)
	}
	if len(store.Models) != 0 || len(store.Hardware) != 0 {
		t.Error("expected empty store for empty root")
	}
}
