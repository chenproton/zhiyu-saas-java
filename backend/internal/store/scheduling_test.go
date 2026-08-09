package store

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakePlanEntryRow 模拟 pgx.Row，返回固定租户或错误。
type fakePlanEntryRow struct {
	tenantID string
	err      error
}

func (f *fakePlanEntryRow) Scan(dest ...any) error {
	if f.err != nil {
		return f.err
	}
	if s, ok := dest[0].(*string); ok {
		*s = f.tenantID
	}
	return nil
}

// fakePlanEntryQueryer 记录最后一次 QueryRow 的 SQL 与参数并返回预设 Row。
type fakePlanEntryQueryer struct {
	lastSQL  string
	lastArgs []any
	row      pgx.Row
}

func (f *fakePlanEntryQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (f *fakePlanEntryQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	f.lastSQL = sql
	f.lastArgs = args
	return f.row
}

func (f *fakePlanEntryQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

// TestPlanEntryTenantIDReadsFromTeachingPlans 教学计划条目本身无 tenant_id，
// 校验时必须通过 plan_id JOIN teaching_plans 读取租户；此测试防止回归旧版
// "SELECT tenant_id FROM teaching_plan_entries" 导致的 404。
func TestPlanEntryTenantIDReadsFromTeachingPlans(t *testing.T) {
	q := &fakePlanEntryQueryer{row: &fakePlanEntryRow{tenantID: "tenant-abc"}}
	s := NewSchedulingStore(q)

	tenant, err := s.PlanEntryTenantID(context.Background(), "entry-123")
	if err != nil {
		t.Fatalf("PlanEntryTenantID  unexpected error: %v", err)
	}
	if tenant != "tenant-abc" {
		t.Fatalf("tenant = %q, want %q", tenant, "tenant-abc")
	}
	if len(q.lastArgs) != 1 || q.lastArgs[0] != "entry-123" {
		t.Fatalf("args = %v, want [entry-123]", q.lastArgs)
	}
	upper := strings.ToUpper(q.lastSQL)
	if !strings.Contains(upper, "TEACHING_PLANS") || !strings.Contains(upper, "JOIN") {
		t.Fatalf("SQL 未通过 teaching_plans JOIN 读取租户: %s", q.lastSQL)
	}
}

func TestPlanEntryTenantIDReturnsError(t *testing.T) {
	q := &fakePlanEntryQueryer{row: &fakePlanEntryRow{err: errors.New("not found")}}
	s := NewSchedulingStore(q)

	_, err := s.PlanEntryTenantID(context.Background(), "entry-missing")
	if err == nil {
		t.Fatal("期望返回错误")
	}
}
