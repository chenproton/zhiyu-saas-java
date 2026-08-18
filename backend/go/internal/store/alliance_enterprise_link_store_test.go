package store

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeAggRows 模拟多行查询结果（服务台图表聚合用）。
type fakeAggRows struct {
	rows [][]any
	idx  int
	sql  string
	args []any
}

func (r *fakeAggRows) Next() bool {
	r.idx++
	return r.idx <= len(r.rows)
}

func (r *fakeAggRows) Scan(dest ...any) error {
	row := r.rows[r.idx-1]
	for i := range dest {
		if s, ok := dest[i].(*string); ok {
			*s = row[i].(string)
		} else if n, ok := dest[i].(*int); ok {
			*n = row[i].(int)
		}
	}
	return nil
}

func (r *fakeAggRows) Values() ([]any, error)                       { return r.rows[r.idx-1], nil }
func (r *fakeAggRows) RawValues() [][]byte                          { return nil }
func (r *fakeAggRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeAggRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeAggRows) Err() error                                   { return nil }
func (r *fakeAggRows) Close()                                       {}
func (r *fakeAggRows) Conn() *pgx.Conn                              { return nil }

// fakeAggQueryer 记录 Query 的 SQL/参数并返回预设多行。
type fakeAggQueryer struct {
	rows *fakeAggRows
}

func (q *fakeAggQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	q.rows.sql = sql
	q.rows.args = args
	return q.rows, nil
}

func (q *fakeAggQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func (q *fakeAggQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

// TestDashboardAggregates 企业服务台图表聚合：按月新增必须 JOIN partner_enterprises
// 按企业租户过滤（防止跨租户统计），且按正确维度分组。
func TestDashboardAggregates(t *testing.T) {
	t.Run("按月新增按月份分组", func(t *testing.T) {
		q := &fakeAggQueryer{rows: &fakeAggRows{
			rows: [][]any{{"2026-07", 1}, {"2026-08", 2}},
		}}
		s := NewAllianceEnterpriseLinkStore(q)

		got, err := s.CountMonthlyLinksByEnterpriseTenant(context.Background(), "ent-tenant", 6)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 2 || got[0].Month != "2026-07" || got[0].Count != 1 {
			t.Fatalf("返回数据错误: %+v", got)
		}
		for _, want := range []string{"JOIN partner_enterprises", "GROUP BY 1", "make_interval", "e.tenant_id"} {
			if !strings.Contains(q.rows.sql, want) {
				t.Fatalf("SQL 缺少 %q: %s", want, q.rows.sql)
			}
		}
	})
}

// TestCountMonthlyNewByEnterprise 近 6 个月新增（专家/岗位/场景）必须按租户与企业主体
// 双维度过滤，且按月份序列补齐 0 值。
func TestCountMonthlyNewByEnterprise(t *testing.T) {
	q := &fakeAggQueryer{rows: &fakeAggRows{
		rows: [][]any{{"2026-07", 1, 2, 0}, {"2026-08", 0, 1, 3}},
	}}
	s := NewPartnerStore(q)

	got, err := s.CountMonthlyNewByEnterprise(context.Background(), "ent-tenant", "ent-id", 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Experts != 1 || got[0].Positions != 2 || got[0].Scenarios != 0 {
		t.Fatalf("返回数据错误: %+v", got)
	}
	for _, want := range []string{
		"generate_series", "alliance_experts", "career_positions",
		"scenarios", "source_enterprise_id", "alliance_resource_grants",
	} {
		if !strings.Contains(q.rows.sql, want) {
			t.Fatalf("SQL 缺少 %q: %s", want, q.rows.sql)
		}
	}
	if q.rows.args[0] != "ent-tenant" || q.rows.args[1] != "ent-id" {
		t.Fatalf("参数错误: %v", q.rows.args)
	}
}

// TestCountMonthlyContentByEnterprise 合作内容月度统计（项目/协议/成果）必须按
// enterprise_ids 关联本企业过滤，三线按月份补齐 0 值。
func TestCountMonthlyContentByEnterprise(t *testing.T) {
	q := &fakeAggQueryer{rows: &fakeAggRows{
		rows: [][]any{{"2026-07", 1, 0, 2}, {"2026-08", 0, 1, 0}},
	}}
	s := NewAllianceStore(q)

	got, err := s.CountMonthlyContentByEnterprise(context.Background(), "ent-id", 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Projects != 1 || got[0].Agreements != 0 || got[0].Achievements != 2 {
		t.Fatalf("返回数据错误: %+v", got)
	}
	for _, want := range []string{
		"generate_series", "alliance_projects", "alliance_agreements",
		"alliance_achievements", "jsonb_array_elements_text", "enterprise_ids",
	} {
		if !strings.Contains(q.rows.sql, want) {
			t.Fatalf("SQL 缺少 %q: %s", want, q.rows.sql)
		}
	}
	if q.rows.args[0] != "ent-id" {
		t.Fatalf("参数错误: %v", q.rows.args)
	}
}
