package store

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// recordingQueryer 记录最后一次执行的 SQL，用于断言 UPDATE 语句不引用不存在列。
type recordingQueryer struct {
	fakePlanEntryQueryer
	lastExecSQL string
}

func (r *recordingQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	r.lastExecSQL = sql
	return pgconn.CommandTag{}, nil
}

// noopRow 用于绕过 UpdateItem/UpdatePoint/UpdateTask 内部的 fetch 校验，只关心 Exec SQL。
type noopRow struct{}

func (noopRow) Scan(dest ...any) error { return nil }

func (r *recordingQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return noopRow{}
}

// TestCertificationAbilityItemUpdateDoesNotReferenceUpdatedAt certification_ability_items
// 表基线无 updated_at 列，更新 SQL 引用该列会导致 500（与 staff_titles/exam_questions 同模式）。
func TestCertificationAbilityItemUpdateDoesNotReferenceUpdatedAt(t *testing.T) {
	q := &recordingQueryer{}
	s := NewCertificationStore(q, nil)

	_, _ = s.UpdateItem(context.Background(), "item-1", "tenant-1", "name", 1)
	if strings.Contains(strings.ToLower(q.lastExecSQL), "updated_at") {
		t.Fatalf("certification_ability_items UPDATE 不应引用 updated_at: %s", q.lastExecSQL)
	}
	if !strings.Contains(q.lastExecSQL, "UPDATE certification_ability_items") {
		t.Fatalf("未生成预期 UPDATE: %s", q.lastExecSQL)
	}
}

// TestCertificationAbilityPointUpdateDoesNotReferenceUpdatedAt certification_ability_points
// 表基线无 updated_at 列。
func TestCertificationAbilityPointUpdateDoesNotReferenceUpdatedAt(t *testing.T) {
	q := &recordingQueryer{}
	s := NewCertificationStore(q, nil)

	_, _ = s.UpdatePoint(context.Background(), "point-1", "tenant-1", &CertificationPointParams{})
	if strings.Contains(strings.ToLower(q.lastExecSQL), "updated_at") {
		t.Fatalf("certification_ability_points UPDATE 不应引用 updated_at: %s", q.lastExecSQL)
	}
	if !strings.Contains(q.lastExecSQL, "UPDATE certification_ability_points") {
		t.Fatalf("未生成预期 UPDATE: %s", q.lastExecSQL)
	}
}

// TestCertificationRelatedTaskUpdateDoesNotReferenceUpdatedAt certification_related_tasks
// 表基线无 updated_at 列。
func TestCertificationRelatedTaskUpdateDoesNotReferenceUpdatedAt(t *testing.T) {
	q := &recordingQueryer{}
	s := NewCertificationStore(q, nil)

	_, _ = s.UpdateTask(context.Background(), "task-1", "tenant-1", "task-2", 100, 0.5)
	if strings.Contains(strings.ToLower(q.lastExecSQL), "updated_at") {
		t.Fatalf("certification_related_tasks UPDATE 不应引用 updated_at: %s", q.lastExecSQL)
	}
	if !strings.Contains(q.lastExecSQL, "UPDATE certification_related_tasks") {
		t.Fatalf("未生成预期 UPDATE: %s", q.lastExecSQL)
	}
}
