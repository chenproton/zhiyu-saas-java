package handler

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestTeachingPlanDetailResponseFlatShape 验证教学计划详情响应为扁平结构：
// plan 字段直接铺平到顶层（id/programName/status），与前端 TeachingPlanDetail 类型对齐。
// 若响应为 {"plan":{...},"entries":[...]}，前端 onGenerated 中 plan.id 为 undefined，
// 会跳转到 /affairs/teaching-plans/undefined 并 404。
func TestTeachingPlanDetailResponseFlatShape(t *testing.T) {
	resp := TeachingPlanDetailResponse{
		TeachingPlan: domain.TeachingPlan{
			ID:          "plan-1",
			ProgramID:   "prog-1",
			ProgramName: "人培方案A",
			TermID:      "term-1",
			TermName:    "2026春",
			EntryYear:   2025,
			Status:      "draft",
			EntryCount:  2,
			GeneratedAt: time.Now(),
		},
		Entries: []domain.TeachingPlanEntry{
			{ID: "entry-1", PlanID: "plan-1", CourseName: "课程1", Credits: 2, TotalHours: 32},
		},
	}
	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := m["plan"]; ok {
		t.Fatalf("响应不应包含嵌套 plan 字段: %s", raw)
	}
	if m["id"] != "plan-1" {
		t.Fatalf("顶层 id = %v, want plan-1: %s", m["id"], raw)
	}
	if m["status"] != "draft" {
		t.Fatalf("顶层 status = %v, want draft: %s", m["status"], raw)
	}
	entries, ok := m["entries"].([]interface{})
	if !ok || len(entries) != 1 {
		t.Fatalf("entries 应为长度 1 的数组: %s", raw)
	}
}
