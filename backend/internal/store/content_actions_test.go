package store

import (
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// 状态流转矩阵：from → 允许的 to 集合。
var transitionMatrix = map[domain.ContentStatus][]domain.ContentStatus{
	domain.StatusDraft:     {domain.StatusPending, domain.StatusArchived},
	domain.StatusRejected:  {domain.StatusDraft, domain.StatusPending, domain.StatusArchived},
	domain.StatusPending:   {domain.StatusDraft, domain.StatusApproved, domain.StatusRejected},
	domain.StatusApproved:  {domain.StatusDraft, domain.StatusPublished, domain.StatusArchived},
	domain.StatusPublished: {domain.StatusDraft, domain.StatusArchived},
	domain.StatusArchived:  {domain.StatusDraft},
}

func TestCanTransition(t *testing.T) {
	for from, tos := range transitionMatrix {
		for _, to := range tos {
			if !canTransition(from, to) {
				t.Errorf("canTransition(%s, %s) = false, want true", from, to)
			}
		}
	}
}

func TestCanTransitionRejectsIllegal(t *testing.T) {
	all := []domain.ContentStatus{
		domain.StatusDraft, domain.StatusPending, domain.StatusApproved,
		domain.StatusRejected, domain.StatusPublished, domain.StatusArchived,
	}
	for _, from := range all {
		for _, to := range all {
			expected := false
			for _, allowed := range transitionMatrix[from] {
				if allowed == to {
					expected = true
					break
				}
			}
			if got := canTransition(from, to); got != expected {
				t.Errorf("canTransition(%s, %s) = %v, want %v", from, to, got, expected)
			}
		}
	}
}

// 关键业务规则：已发布内容不可直接删除/审核，必须先撤回草稿。
func TestTransitionBusinessRules(t *testing.T) {
	cases := []struct {
		name string
		from domain.ContentStatus
		to   domain.ContentStatus
		want bool
	}{
		{"发布后不可直接审核", domain.StatusPublished, domain.StatusApproved, false},
		{"发布后不可直接删除", domain.StatusPublished, domain.StatusArchived, true},
		{"审核中不可直接发布", domain.StatusPending, domain.StatusPublished, false},
		{"草稿可提交审核", domain.StatusDraft, domain.StatusPending, true},
		{"驳回可重新提交", domain.StatusRejected, domain.StatusPending, true},
		{"通过后可发布", domain.StatusApproved, domain.StatusPublished, true},
		{"归档不可直接发布", domain.StatusArchived, domain.StatusPublished, false},
	}
	for _, c := range cases {
		if got := canTransition(c.from, c.to); got != c.want {
			t.Errorf("%s: canTransition(%s, %s) = %v, want %v", c.name, c.from, c.to, got, c.want)
		}
	}
}

func TestSanitizeIdentifierAllowsKnownTables(t *testing.T) {
	for _, table := range AllowedContentTables {
		got, err := SanitizeIdentifier(table, AllowedContentTables)
		if err != nil || got != table {
			t.Errorf("SanitizeIdentifier(%q) = %q, %v; want %q, nil", table, got, err, table)
		}
	}
}

func TestSanitizeIdentifierRejectsInjection(t *testing.T) {
	bad := []string{
		"career_positions; DROP TABLE users",
		"career_positions WHERE 1=1",
		"courses--",
		"courses OR 1=1",
		"",
	}
	for _, b := range bad {
		if _, err := SanitizeIdentifier(b, AllowedContentTables); err == nil {
			t.Errorf("SanitizeIdentifier(%q) expected error", b)
		}
	}
}

func TestInviteColumnWhitelist(t *testing.T) {
	for _, col := range AllowedInviteColumns {
		got, err := SanitizeIdentifier(col, AllowedInviteColumns)
		if err != nil || got != col {
			t.Errorf("SanitizeIdentifier(%q) = %q, %v; want %q, nil", col, got, err, col)
		}
	}
	if _, err := SanitizeIdentifier("collaborator_ids; UPDATE users", AllowedInviteColumns); err == nil {
		t.Error("invite column injection should be rejected")
	}
}

func TestParsePageLimitClamps(t *testing.T) {
	if v, _ := ParsePageLimit("", 10); v != 10 {
		t.Errorf("empty -> %d, want 10", v)
	}
	if v, _ := ParsePageLimit("5000", 10); v != maxPageSize {
		t.Errorf("5000 -> %d, want %d", v, maxPageSize)
	}
	if v, _ := ParsePageLimit("0", 10); v != 10 {
		t.Errorf("0 -> %d, want 10", v)
	}
	if v, _ := ParsePageLimit("-3", 10); v != 10 {
		t.Errorf("-3 -> %d, want 10", v)
	}
	if v, _ := ParsePageLimit("25", 10); v != 25 {
		t.Errorf("25 -> %d, want 25", v)
	}
	if _, err := ParsePageLimit("abc", 10); err == nil {
		t.Error("non-numeric should return error")
	}
}

func TestNextVersion(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"初始版本发布", "V1.0", "V1.1"},
		{"小写前缀", "v1.0", "V1.1"},
		{"无前缀", "1.0", "V1.1"},
		{"缺次版本", "v1", "V1.1"},
		{"双重前缀历史脏值", "vV1.0", "V1.1"},
		{"次版本满十进位", "V1.9", "V2.0"},
		{"大版本进位", "V9.9", "V10.0"},
		{"忽略第三段补丁号", "V2.3.4", "V2.4"},
		{"空值按 V1.0 起算", "", "V1.1"},
		{"无法解析按 V1.0 起算", "abc", "V1.1"},
	}
	for _, c := range cases {
		if got := NextVersion(c.in); got != c.want {
			t.Errorf("NextVersion(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
