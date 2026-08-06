package handler

import (
	"strings"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

func TestTeachingPlanLabelMappings(t *testing.T) {
	cases := []struct {
		name string
		got  string
		want string
	}{
		{"type theory", teachingPlanTypeLabel("theory"), "课程"},
		{"type traditional", teachingPlanTypeLabel("traditional"), "课程"},
		{"type practice", teachingPlanTypeLabel("practice"), "实践"},
		{"type scene", teachingPlanTypeLabel("scene"), "场景"},
		{"type unknown", teachingPlanTypeLabel("unknown"), "课程"},
		{"week all", teachingPlanWeekPatternLabel("all"), "每周"},
		{"week odd", teachingPlanWeekPatternLabel("odd"), "单周"},
		{"week even", teachingPlanWeekPatternLabel("even"), "双周"},
		{"status draft", teachingPlanStatusLabel("draft"), "草稿"},
		{"status confirmed", teachingPlanStatusLabel("confirmed"), "已确认"},
		{"status planned", teachingPlanStatusLabel("planned"), "待排课"},
		{"status scheduled", teachingPlanStatusLabel("scheduled"), "已排课"},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s = %q, want %q", c.name, c.got, c.want)
		}
	}
}

func TestBuildTeachingPlanExcel(t *testing.T) {
	confirmedAt := time.Date(2026, 7, 1, 10, 0, 0, 0, time.Local)
	plan := &domain.TeachingPlan{
		ID:          "plan-1",
		ProgramName: "计算机应用技术人培方案",
		TermName:    "2026春",
		MajorName:   "计算机应用技术",
		EntryYear:   2025,
		Status:      "confirmed",
		EntryCount:  2,
		GeneratedAt: time.Date(2026, 6, 1, 9, 30, 0, 0, time.Local),
		ConfirmedAt: &confirmedAt,
	}
	entries := []domain.TeachingPlanEntry{
		{
			ID: "entry-1", PlanID: "plan-1", CourseName: "数据结构", Type: "traditional",
			Credits: 3.5, TotalHours: 56, WeekHours: 4, StartWeek: 1, EndWeek: 14,
			WeekPattern: "all", ClassNames: []string{"计应2501", "计应2502"},
			TeacherName: "张老师", VenueType: strPtr("机房"), Status: "planned",
		},
		{
			ID: "entry-2", PlanID: "plan-1", CourseName: "电商客服场景实训", Type: "scene",
			Credits: 2, TotalHours: 32, WeekHours: 4, StartWeek: 15, EndWeek: 18,
			WeekPattern: "odd", ClassName: "电商2501", TeacherName: "李老师",
			ScenarioName: "电商客服场景", PositionName: "客服专员", Status: "scheduled",
		},
	}

	f := buildTeachingPlanExcel(plan, entries)
	if f == nil {
		t.Fatal("buildTeachingPlanExcel 返回 nil")
	}
	sheets := f.GetSheetList()
	for _, want := range []string{"计划信息", "教学计划条目"} {
		found := false
		for _, s := range sheets {
			if s == want {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("缺少 Sheet %q，实际: %v", want, sheets)
		}
	}

	// 计划信息 Sheet：字段-值配对
	if v, _ := f.GetCellValue("计划信息", "A1"); v != "人培方案" {
		t.Errorf("计划信息 A1 = %q, want 人培方案", v)
	}
	if v, _ := f.GetCellValue("计划信息", "B1"); v != "计算机应用技术人培方案" {
		t.Errorf("计划信息 B1 = %q, want 人培方案名称", v)
	}
	if v, _ := f.GetCellValue("计划信息", "B5"); v != "已确认" {
		t.Errorf("计划信息 B5 = %q, want 已确认", v)
	}

	// 教学计划条目 Sheet：表头与数据
	hdr, _ := f.GetCellValue("教学计划条目", "A1")
	if hdr != "序号" {
		t.Errorf("教学计划条目 A1 = %q, want 序号", hdr)
	}
	if v, _ := f.GetCellValue("教学计划条目", "B2"); v != "数据结构" {
		t.Errorf("教学计划条目 B2 = %q, want 数据结构", v)
	}
	if v, _ := f.GetCellValue("教学计划条目", "D2"); v != "课程" {
		t.Errorf("教学计划条目 D2 = %q, want 课程", v)
	}
	if v, _ := f.GetCellValue("教学计划条目", "J2"); !strings.Contains(v, "计应2501") {
		t.Errorf("教学计划条目 J2 = %q, want 包含计应2501", v)
	}
	if v, _ := f.GetCellValue("教学计划条目", "D3"); v != "场景" {
		t.Errorf("教学计划条目 D3 = %q, want 场景", v)
	}
	if v, _ := f.GetCellValue("教学计划条目", "O3"); v != "已排课" {
		t.Errorf("教学计划条目 O3 = %q, want 已排课", v)
	}
}

func strPtr(s string) *string { return &s }
