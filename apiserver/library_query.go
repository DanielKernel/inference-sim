package main

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/DanielKernel/inference-sim-platform/library"
)

type compareRequest struct {
	Keys []string `json:"keys"`
}

type compareResponse struct {
	Items      any      `json:"items"`
	DiffFields []string `json:"diff_fields"`
}

func (s *Server) handleLibraryCompare(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("kind")
	var req compareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid compare request: "+err.Error())
		return
	}
	if len(req.Keys) < 2 {
		writeError(w, http.StatusBadRequest, "compare requires at least two keys")
		return
	}

	switch kind {
	case "models":
		items := selectByNames(s.store.Models, req.Keys, func(item library.Model) string { return item.Name })
		writeJSON(w, http.StatusOK, compareResponse{Items: items, DiffFields: diffModelFields(items)})
	case "hardware":
		items := selectByNames(s.store.Hardware, req.Keys, func(item library.Hardware) string { return item.Name })
		writeJSON(w, http.StatusOK, compareResponse{Items: items, DiffFields: diffHardwareFields(items)})
	case "frameworks":
		items := selectByNames(s.store.Frameworks, req.Keys, func(item library.Framework) string { return item.Name })
		writeJSON(w, http.StatusOK, compareResponse{Items: items, DiffFields: diffFrameworkFields(items)})
	case "scenarios":
		items := selectByNames(s.store.Scenarios, req.Keys, func(item library.Scenario) string { return item.Name })
		writeJSON(w, http.StatusOK, compareResponse{Items: items, DiffFields: diffScenarioFields(items)})
	case "optimizations":
		items := selectByNames(s.store.Optimizations, req.Keys, func(item library.Optimization) string { return item.ID })
		writeJSON(w, http.StatusOK, compareResponse{Items: items, DiffFields: diffOptimizationFields(items)})
	default:
		writeError(w, http.StatusBadRequest, "compare is not supported for kind: "+kind)
	}
}

func filterByQuery[T any](items []T, q, field, value string, search func(T) string, fieldValue func(T, string) string) []T {
	q = strings.TrimSpace(strings.ToLower(q))
	field = strings.TrimSpace(field)
	value = strings.TrimSpace(strings.ToLower(value))
	filtered := make([]T, 0, len(items))
	for _, item := range items {
		if q != "" && !strings.Contains(strings.ToLower(search(item)), q) {
			continue
		}
		if field != "" && value != "" && strings.ToLower(fieldValue(item, field)) != value {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func applyLimit[T any](items []T, raw string) []T {
	if raw == "" {
		return items
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit <= 0 || limit >= len(items) {
		return items
	}
	return items[:limit]
}

func selectByNames[T any](items []T, keys []string, key func(T) string) []T {
	selected := make([]T, 0, len(keys))
	for _, want := range keys {
		for _, item := range items {
			if key(item) == want {
				selected = append(selected, item)
				break
			}
		}
	}
	return selected
}

func searchText(parts ...string) string {
	return strings.Join(parts, " ")
}

func diffModelFields(items []library.Model) []string {
	return diffFields(len(items), func(i int) []string {
		return []string{
			items[i].Category,
			items[i].Developer,
			strconv.FormatFloat(items[i].ParamsB, 'f', 2, 64),
			strconv.Itoa(items[i].Architecture.NumLayers),
			strconv.Itoa(items[i].Architecture.HiddenSize),
			strconv.Itoa(items[i].Architecture.MaxSeqLen),
			strings.Join(items[i].QuantSupport, ","),
		}
	}, []string{"category", "developer", "params_b", "num_layers", "hidden_size", "max_seq_len", "quant_support"})
}

func diffHardwareFields(items []library.Hardware) []string {
	return diffFields(len(items), func(i int) []string {
		return []string{
			items[i].Vendor,
			items[i].DeviceType,
			items[i].ChipType,
			strconv.FormatFloat(items[i].FP16TFlops, 'f', 2, 64),
			strconv.FormatFloat(items[i].MemoryBandwidthTBs, 'f', 2, 64),
			strconv.FormatFloat(items[i].MemoryGiB, 'f', 2, 64),
			items[i].Calibration.Status,
		}
	}, []string{"vendor", "device_type", "chip_type", "fp16_tflops", "memory_bandwidth_tbs", "memory_gib", "calibration_status"})
}

func diffFrameworkFields(items []library.Framework) []string {
	return diffFields(len(items), func(i int) []string {
		return []string{
			items[i].Vendor,
			items[i].LatestVersion,
			strings.Join(items[i].SupportedHardware, ","),
			strconv.Itoa(len(items[i].Optimizations)),
		}
	}, []string{"vendor", "latest_version", "supported_hardware", "optimization_count"})
}

func diffScenarioFields(items []library.Scenario) []string {
	return diffFields(len(items), func(i int) []string {
		return []string{
			items[i].Category,
			strconv.Itoa(items[i].InputTokens.Typical),
			strconv.Itoa(items[i].OutputTokens.Typical),
		}
	}, []string{"category", "input_tokens.typical", "output_tokens.typical"})
}

func diffOptimizationFields(items []library.Optimization) []string {
	return diffFields(len(items), func(i int) []string {
		return []string{
			items[i].Category,
			strings.Join(items[i].Frameworks, ","),
			strconv.FormatFloat(items[i].LatencyFactor, 'f', 2, 64),
			strconv.FormatFloat(items[i].ThroughputFactor, 'f', 2, 64),
			strings.Join(items[i].DependsOn, ","),
		}
	}, []string{"category", "frameworks", "latency_factor", "throughput_factor", "depends_on"})
}

func diffFields(itemCount int, values func(int) []string, labels []string) []string {
	if itemCount < 2 {
		return nil
	}
	first := values(0)
	diffs := make([]string, 0, len(labels))
	for idx, label := range labels {
		same := true
		for itemIdx := 1; itemIdx < itemCount; itemIdx++ {
			current := values(itemIdx)
			if current[idx] != first[idx] {
				same = false
				break
			}
		}
		if !same {
			diffs = append(diffs, label)
		}
	}
	return diffs
}

func filterLibraryModels(items []library.Model, q, field, value, limit string) []library.Model {
	filtered := filterByQuery(items, q, field, value, func(item library.Model) string {
		return searchText(item.Name, item.DisplayName, item.Developer, item.Category, strings.Join(item.Tags, " "), strings.Join(item.QuantSupport, " "))
	}, func(item library.Model, field string) string {
		switch field {
		case "category":
			return item.Category
		case "developer":
			return item.Developer
		default:
			return ""
		}
	})
	return applyLimit(filtered, limit)
}

func filterLibraryHardware(items []library.Hardware, q, field, value, limit string) []library.Hardware {
	filtered := filterByQuery(items, q, field, value, func(item library.Hardware) string {
		return searchText(item.Name, item.Vendor, item.DeviceType, item.ChipType, strings.Join(item.Tags, " "))
	}, func(item library.Hardware, field string) string {
		switch field {
		case "vendor":
			return item.Vendor
		case "device_type":
			return item.DeviceType
		default:
			return ""
		}
	})
	return applyLimit(filtered, limit)
}

func filterLibraryFrameworks(items []library.Framework, q, field, value, limit string) []library.Framework {
	filtered := filterByQuery(items, q, field, value, func(item library.Framework) string {
		optimizationNames := make([]string, 0, len(item.Optimizations))
		for _, opt := range item.Optimizations {
			optimizationNames = append(optimizationNames, opt.Name, opt.Category)
		}
		return searchText(item.Name, item.Vendor, item.LatestVersion, strings.Join(item.Tags, " "), strings.Join(item.SupportedHardware, " "), strings.Join(optimizationNames, " "))
	}, func(item library.Framework, field string) string {
		switch field {
		case "vendor":
			return item.Vendor
		default:
			return ""
		}
	})
	return applyLimit(filtered, limit)
}

func filterLibraryScenarios(items []library.Scenario, q, field, value, limit string) []library.Scenario {
	filtered := filterByQuery(items, q, field, value, func(item library.Scenario) string {
		return searchText(item.Name, item.Category, item.Description, strings.Join(item.Tags, " "), strings.Join(item.Examples, " "))
	}, func(item library.Scenario, field string) string {
		switch field {
		case "category":
			return item.Category
		default:
			return ""
		}
	})
	return applyLimit(filtered, limit)
}

func filterLibraryPerf(items []library.PerfRecord, q, field, value, limit string) []library.PerfRecord {
	filtered := filterByQuery(items, q, field, value, func(item library.PerfRecord) string {
		return searchText(item.Model, item.Hardware, item.Framework, item.FrameworkVersion, item.SourceAuthority, item.Driver, item.TestConditions, item.Source.Title)
	}, func(item library.PerfRecord, field string) string {
		switch field {
		case "model":
			return item.Model
		case "hardware":
			return item.Hardware
		case "framework":
			return item.Framework
		case "source_authority":
			return item.SourceAuthority
		default:
			return ""
		}
	})
	return applyLimit(filtered, limit)
}

func filterLibraryOptimizations(items []library.Optimization, q, field, value, limit string) []library.Optimization {
	filtered := filterByQuery(items, q, field, value, func(item library.Optimization) string {
		return searchText(item.ID, item.Name, item.Category, item.Description, item.Applicability, strings.Join(item.Frameworks, " "))
	}, func(item library.Optimization, field string) string {
		switch field {
		case "category":
			return item.Category
		case "framework":
			if slices.Contains(item.Frameworks, value) {
				return value
			}
		}
		return ""
	})
	return applyLimit(filtered, limit)
}
