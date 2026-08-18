package handler

import (
	"math"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestComputeAbilityIndicatorsCompetencyDenominator 回归问题 B：
// 岗位胜任度（比值法）的分母应只统计「有门槛（need>0）」的能力点权重，
// 要求等级为「了解」(understand, need=0) 的点不应稀释胜任度。
func TestComputeAbilityIndicatorsCompetencyDenominator(t *testing.T) {
	details := domain.JSONSlice{
		map[string]interface{}{"abilityPointName": "点A", "score": 80.0, "weight": 50.0, "requiredLevel": "master"},
		map[string]interface{}{"abilityPointName": "点B", "score": 100.0, "weight": 50.0, "requiredLevel": "understand"},
	}
	competency, cognition := computeAbilityIndicators(details)

	// 胜任度：点A (80-70)/70 = 0.142857...；点B need=0 应被剔除分母。
	// 新口径 = (0.142857×50) / 50 × 100 = 14.2857...
	wantCompetency := (80.0 - 70.0) / 70.0 * 100
	if math.Abs(competency-wantCompetency) > 1e-6 {
		t.Fatalf("competency = %v, want %v（understand 点不得稀释分母）", competency, wantCompetency)
	}
	// 认知得分不受影响：全部 weight>0 点参与 (80×50 + 100×50)/100 = 90
	wantCognition := (80.0*50.0 + 100.0*50.0) / 100.0
	if math.Abs(cognition-wantCognition) > 1e-6 {
		t.Fatalf("cognition = %v, want %v", cognition, wantCognition)
	}
}

// TestComputeAbilityIndicatorsAllUnderstand 全部能力点要求「了解」时，
// 胜任度分母为 0，应返回 0 而不 panic / NaN。
func TestComputeAbilityIndicatorsAllUnderstand(t *testing.T) {
	details := domain.JSONSlice{
		map[string]interface{}{"abilityPointName": "点A", "score": 100.0, "weight": 50.0, "requiredLevel": "understand"},
		map[string]interface{}{"abilityPointName": "点B", "score": 90.0, "weight": 50.0, "requiredLevel": "understand"},
	}
	competency, cognition := computeAbilityIndicators(details)
	if competency != 0 {
		t.Fatalf("全部 understand 时 competency = %v, want 0", competency)
	}
	wantCognition := (100.0*50.0 + 90.0*50.0) / 100.0
	if math.Abs(cognition-wantCognition) > 1e-6 {
		t.Fatalf("cognition = %v, want %v", cognition, wantCognition)
	}
}
