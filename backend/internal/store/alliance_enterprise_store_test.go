package store

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// publicAccessQueryer 记录 QueryRow 的 SQL/参数并按预设返回 EXISTS 结果。
type publicAccessQueryer struct {
	result bool
	sql    string
	args   []any
}

type fakeExistsRow struct{ result bool }

func (r fakeExistsRow) Scan(dest ...any) error {
	*(dest[0].(*bool)) = r.result
	return nil
}

func (q *publicAccessQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	q.sql = sql
	q.args = args
	return fakeExistsRow{result: q.result}
}

func (q *publicAccessQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (q *publicAccessQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

// TestHasPublicEnterpriseAccess 跨租户公开企业文件放行判定：
// SQL 约束（enable_public + is_public 未终止链接）与参数顺序（文件租户在前）。
func TestHasPublicEnterpriseAccess(t *testing.T) {
	q := &publicAccessQueryer{result: true}
	s := NewAllianceStore(q)

	ok, err := s.HasPublicEnterpriseAccess(context.Background(), "ent-tenant", "school-tenant")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("期望返回 true")
	}
	if q.args[0] != "ent-tenant" || q.args[1] != "school-tenant" {
		t.Fatalf("参数顺序错误: %v", q.args)
	}
	for _, want := range []string{"enable_public", "is_public", "status <> 'terminated'", "partner_enterprises", "alliance_enterprise_links"} {
		if !strings.Contains(q.sql, want) {
			t.Fatalf("SQL 缺少 %q: %s", want, q.sql)
		}
	}

	q.result = false
	ok, err = s.HasPublicEnterpriseAccess(context.Background(), "ent-tenant", "school-tenant")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("期望返回 false")
	}
}
