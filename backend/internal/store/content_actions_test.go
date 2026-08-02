package store

import (
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// 状态流转图完整性：每个状态至少可到达一个目标状态（除归档为终态），
// 且不允许自环（除非显式声明）。
func TestCanTransition(t *testing.T) {
	statuses := []domain.ContentStatus{
		domain.StatusDraft,
		domain.StatusRejected,
		domain.StatusPending,
		domain.StatusApproved,
		domain.StatusPublished,
		domain.StatusArchived,
	}

	for _, from := range statuses {
		targets := allowedStatusTransitions[from]
		if len(targets) == 0 {
			if from != domain.StatusArchived {
				t.Errorf("%s 缺少可达目标状态", from)
			}
			continue
		}
		for _, to := range targets {
			if !canTransition(from, to) {
				t.Errorf("canTransition(%s, %s) 应为 true", from, to)
			}
			if from == to {
				t.Errorf("%s 不允许自环", from)
			}
		}
	}

	// 双向可达性校验：关键流转必须经过审批
	if !canTransition(domain.StatusPending, domain.StatusDraft) {
		t.Error("pending -> draft 应被允许（审批撤回）")
	}
	if canTransition(domain.StatusArchived, domain.StatusPublished) {
		t.Error("archived -> published 不应被允许")
	}
	if canTransition(domain.StatusDraft, domain.StatusPublished) {
		t.Error("draft -> published 必须经过审批，不应直接可达")
	}
	if canTransition(domain.StatusDraft, domain.StatusApproved) {
		t.Error("draft -> approved 必须经过审批，不应直接可达")
	}
}

// 状态流转图中不允许出现"悬空目标"（目标不在合法状态集合内）。
func TestAllowedTransitionsTargetsAreValid(t *testing.T) {
	valid := map[domain.ContentStatus]bool{
		domain.StatusDraft:     true,
		domain.StatusRejected:  true,
		domain.StatusPending:   true,
		domain.StatusApproved:  true,
		domain.StatusPublished: true,
		domain.StatusArchived:  true,
	}
	for from, targets := range allowedStatusTransitions {
		for _, to := range targets {
			if !valid[to] {
				t.Errorf("%s -> %s: 目标状态不合法", from, to)
			}
		}
	}
}

// 白名单表/列：每个实体表必须声明，防止新增实体漏配。
func TestAllowedContentTables(t *testing.T) {
	expected := map[string]bool{
		"career_positions":  true,
		"courses":           true,
		"exams":             true,
		"question_banks":    true,
		"scenarios":         true,
		"training_programs": true,
	}
	for _, table := range AllowedContentTables {
		if !expected[table] {
			t.Errorf("白名单存在未声明表: %s", table)
		}
	}
	for table := range expected {
		found := false
		for _, t2 := range AllowedContentTables {
			if t2 == table {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("白名单缺少表: %s", table)
		}
	}
}

// SanitizeIdentifier 白名单校验（纯函数，无需 DB）。
func TestSanitizeIdentifierUniqueness(t *testing.T) {
	allowed := []string{"a", "b"}
	if _, err := SanitizeIdentifier("a", allowed); err != nil {
		t.Errorf("合法标识符不应报错: %v", err)
	}
	if _, err := SanitizeIdentifier("c", allowed); err == nil {
		t.Error("非法标识符应报错")
	}
}
