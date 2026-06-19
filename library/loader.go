package library

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// document is the on-disk envelope for a curated seed file. Every file declares
// its schema version, kind, provenance, and a list of typed items.
type document[T any] struct {
	SchemaVersion int        `yaml:"schema_version"`
	Kind          Kind       `yaml:"kind"`
	Provenance    Provenance `yaml:"provenance"`
	Items         []T        `yaml:"items"`
}

// Store holds all curated reference data loaded from the data/ tree.
type Store struct {
	Models        []Model
	Hardware      []Hardware
	Frameworks    []Framework
	Scenarios     []Scenario
	PerfRecords   []PerfRecord
	Optimizations []Optimization
}

// Load reads every curated kind from root (the data/ directory) and returns a
// populated Store. Parsing is strict (unknown YAML fields are rejected, R10) and
// schema versions newer than the binary are rejected.
func Load(root string) (*Store, error) {
	s := &Store{}
	var err error
	if s.Models, err = loadKind[Model](root, KindModel); err != nil {
		return nil, err
	}
	if s.Hardware, err = loadKind[Hardware](root, KindHardware); err != nil {
		return nil, err
	}
	if s.Frameworks, err = loadKind[Framework](root, KindFramework); err != nil {
		return nil, err
	}
	if s.Scenarios, err = loadKind[Scenario](root, KindScenario); err != nil {
		return nil, err
	}
	if s.PerfRecords, err = loadKind[PerfRecord](root, KindPerfRecord); err != nil {
		return nil, err
	}
	if s.Optimizations, err = loadKind[Optimization](root, KindOptimization); err != nil {
		return nil, err
	}
	return s, nil
}

// kindDir maps a kind to its subdirectory under the data root.
func kindDir(k Kind) string {
	switch k {
	case KindModel:
		return "models"
	case KindHardware:
		return "hardware"
	case KindFramework:
		return "frameworks"
	case KindScenario:
		return "scenarios"
	case KindPerfRecord:
		return "perfdb"
	case KindOptimization:
		return "optimizations"
	default:
		return string(k)
	}
}

// loadKind reads and strictly decodes all *.yaml files for one kind. A missing
// directory yields an empty slice (a kind may simply have no seed yet).
func loadKind[T any](root string, kind Kind) ([]T, error) {
	dir := filepath.Join(root, kindDir(kind))
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("library: reading %s dir: %w", kind, err)
	}

	files := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, "_") || strings.HasPrefix(name, ".") {
			continue
		}
		if ext := strings.ToLower(filepath.Ext(name)); ext == ".yaml" || ext == ".yml" {
			files = append(files, name)
		}
	}
	sort.Strings(files) // deterministic load order (INV-6)

	var items []T
	for _, name := range files {
		path := filepath.Join(dir, name)
		doc, derr := decodeDocument[T](path, kind)
		if derr != nil {
			return nil, derr
		}
		items = append(items, doc.Items...)
	}
	return items, nil
}

// decodeDocument strictly decodes a single seed file and validates its envelope.
func decodeDocument[T any](path string, kind Kind) (*document[T], error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("library: opening %s: %w", path, err)
	}
	defer f.Close()

	dec := yaml.NewDecoder(f)
	dec.KnownFields(true)

	var doc document[T]
	if err := dec.Decode(&doc); err != nil {
		return nil, fmt.Errorf("library: parsing %s: %w", path, err)
	}
	if doc.SchemaVersion == 0 {
		return nil, fmt.Errorf("library: %s missing schema_version", path)
	}
	if doc.SchemaVersion > SchemaVersion {
		return nil, fmt.Errorf("library: %s schema_version %d newer than supported %d",
			path, doc.SchemaVersion, SchemaVersion)
	}
	if doc.Kind != kind {
		return nil, fmt.Errorf("library: %s declares kind %q but lives under %s",
			path, doc.Kind, kindDir(kind))
	}
	return &doc, nil
}
