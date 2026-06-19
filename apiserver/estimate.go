package main

import (
	"math"

	"github.com/DanielKernel/inference-sim-platform/library"
)

type metricEstimate struct {
	TTFTms                float64
	TPOTms                float64
	E2Ems                 float64
	ThroughputTokS        float64
	Bottleneck            string
	Breakdown             []stageBreakdown
	PrefillComputeMs      float64
	PrefillMemoryMs       float64
	DecodeComputeMs       float64
	DecodeMemoryMs        float64
	ArithmeticIntensityPF float64
	ArithmeticIntensityDC float64
	RidgePoint            float64
}

func estimateMetrics(model library.Model, hw library.Hardware, inputTokens, outputTokens int, latencyFactor, throughputFactor float64) metricEstimate {
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

	pfFlops := float64(inputTokens) * float64(model.Architecture.NumLayers) * float64(model.Architecture.HiddenSize) * 12
	pfBytes := float64(inputTokens) * float64(model.Architecture.NumLayers) * float64(model.Architecture.HiddenSize) * 4
	dcFlops := float64(model.Architecture.NumLayers) * float64(model.Architecture.HiddenSize) * 24
	dcBytes := float64(model.Architecture.NumLayers) * (float64(model.Architecture.HiddenSize)*6 + float64(inputTokens)*2)
	aiPF := round2(pfFlops / math.Max(pfBytes, 1))
	aiDC := round2(dcFlops / math.Max(dcBytes, 1))
	ridgePoint := round2((hw.FP16TFlops * 1000) / math.Max(hw.MemoryBandwidthTBs*1000, 0.1))

	return metricEstimate{
		TTFTms:                ttftMs,
		TPOTms:                tpotMs,
		E2Ems:                 e2eMs,
		ThroughputTokS:        throughputTokS,
		Bottleneck:            bottleneck,
		Breakdown:             buildBreakdown(ttftMs, tpotMs, outputTokens, bottleneck),
		PrefillComputeMs:      round2(ttftComputeMs),
		PrefillMemoryMs:       round2(ttftMemoryMs),
		DecodeComputeMs:       round2(tpotComputeMs),
		DecodeMemoryMs:        round2(tpotMemoryMs),
		ArithmeticIntensityPF: aiPF,
		ArithmeticIntensityDC: aiDC,
		RidgePoint:            ridgePoint,
	}
}
