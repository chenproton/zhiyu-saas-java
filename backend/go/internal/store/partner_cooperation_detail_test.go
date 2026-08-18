package store

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// strptr 测试辅助：返回字符串指针。
func strptr(s string) *string { return &s }

// assignRow 按目标类型把预设行值写入 Scan 目标（覆盖 store 详情查询用到的类型）。
func assignRow(row []any, dest []any) {
	for i := range dest {
		if i >= len(row) {
			break
		}
		switch ptr := dest[i].(type) {
		case *string:
			if v, ok := row[i].(string); ok {
				*ptr = v
			}
		case **string:
			if v, ok := row[i].(*string); ok {
				*ptr = v
			}
		case *bool:
			if v, ok := row[i].(bool); ok {
				*ptr = v
			}
		case *int:
			if v, ok := row[i].(int); ok {
				*ptr = v
			}
		case *time.Time:
			if v, ok := row[i].(time.Time); ok {
				*ptr = v
			}
		case **time.Time:
			if v, ok := row[i].(*time.Time); ok {
				*ptr = v
			}
		case *json.RawMessage:
			if v, ok := row[i].(json.RawMessage); ok {
				*ptr = v
			}
		}
	}
}

// fakeDetailRow 单行查询结果（记录 SQL/参数，Scan 按类型写预设值）。
type fakeDetailRow struct {
	sql  string
	args []any
	vals []any
}

func (r *fakeDetailRow) Scan(dest ...any) error {
	assignRow(r.vals, dest)
	return nil
}

// fakeDetailRows 多行查询结果（记录 SQL/参数）。
type fakeDetailRows struct {
	sql  string
	args []any
	rows [][]any
	idx  int
}

func (r *fakeDetailRows) Next() bool {
	r.idx++
	return r.idx <= len(r.rows)
}

func (r *fakeDetailRows) Scan(dest ...any) error {
	assignRow(r.rows[r.idx-1], dest)
	return nil
}

func (r *fakeDetailRows) Values() ([]any, error)                       { return r.rows[r.idx-1], nil }
func (r *fakeDetailRows) RawValues() [][]byte                          { return nil }
func (r *fakeDetailRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeDetailRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeDetailRows) Err() error                                   { return nil }
func (r *fakeDetailRows) Close()                                       {}
func (r *fakeDetailRows) Conn() *pgx.Conn                              { return nil }

// fakeDetailQueryer 记录 Query/QueryRow 的 SQL 与参数。
type fakeDetailQueryer struct {
	row  *fakeDetailRow
	rows *fakeDetailRows
}

func (q *fakeDetailQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if q.rows != nil {
		q.rows.sql = sql
		q.rows.args = args
	}
	return q.rows, nil
}

func (q *fakeDetailQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if q.row != nil {
		q.row.sql = sql
		q.row.args = args
	}
	return q.row
}

func (q *fakeDetailQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

// assertCooperationDetailSQL 校验详情查询带合作关联过滤（link 未终止 + enterprise_ids 包含本企业）。
func assertCooperationDetailSQL(t *testing.T, sql string, wantTable string) {
	t.Helper()
	for _, want := range []string{
		"FROM " + wantTable + " x",
		"WHERE x.id = $2",
		"status <> 'terminated'",
		"jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = $1::text",
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("详情 SQL 缺少 %q\nSQL: %s", want, sql)
		}
	}
}

func TestGetCooperationProjectDetail(t *testing.T) {
	now := time.Now()
	q := &fakeDetailQueryer{
		row: &fakeDetailRow{vals: []any{
			"p1", "项目A", strptr("校企共建"), strptr("项目描述"), "initiation", "published",
			&now, &now, strptr("10万"), json.RawMessage(`["计算机学院"]`), true, now, now,
		}},
		rows: &fakeDetailRows{rows: [][]any{{
			"m1", "t1", "p1", "里程碑1", strptr("说明"), &now, &now, true, 1, now, now,
		}}},
	}
	s := NewPartnerStore(q)

	got, err := s.GetCooperationProject(context.Background(), "ent1", "p1")
	if err != nil {
		t.Fatal(err)
	}
	assertCooperationDetailSQL(t, q.row.sql, "alliance_projects")
	if len(q.row.args) != 2 || q.row.args[0] != "ent1" || q.row.args[1] != "p1" {
		t.Fatalf("参数错误: %v", q.row.args)
	}
	if got.Name != "项目A" || got.Phase != "initiation" || *got.Budget != "10万" {
		t.Fatalf("项目字段错误: %+v", got)
	}
	if len(got.SecondaryColleges) != 1 || got.SecondaryColleges[0] != "计算机学院" {
		t.Fatalf("二级学院解析错误: %v", got.SecondaryColleges)
	}
	if !strings.Contains(q.rows.sql, "FROM alliance_project_milestones") ||
		!strings.Contains(q.rows.sql, "WHERE project_id = $1") ||
		!strings.Contains(q.rows.sql, "ORDER BY sort_order, created_at") {
		t.Fatalf("里程碑查询错误: %s", q.rows.sql)
	}
	if len(got.Milestones) != 1 || got.Milestones[0].Name != "里程碑1" || !got.Milestones[0].IsCompleted {
		t.Fatalf("里程碑解析错误: %+v", got.Milestones)
	}
}

func TestGetCooperationAchievementDetail(t *testing.T) {
	now := time.Now()
	q := &fakeDetailQueryer{
		row: &fakeDetailRow{vals: []any{
			"a1", "成果A", "patent", strptr("成果描述"), &now, strptr("核心亮点"),
			json.RawMessage(`["张三"]`), json.RawMessage(`["李四"]`), json.RawMessage(`["计算机学院"]`),
			"published", 12, true, now, now,
		}},
		rows: &fakeDetailRows{rows: [][]any{}},
	}
	s := NewPartnerStore(q)

	got, err := s.GetCooperationAchievement(context.Background(), "ent1", "a1")
	if err != nil {
		t.Fatal(err)
	}
	assertCooperationDetailSQL(t, q.row.sql, "alliance_achievements")
	if len(q.row.args) != 2 || q.row.args[0] != "ent1" || q.row.args[1] != "a1" {
		t.Fatalf("参数错误: %v", q.row.args)
	}
	if got.Title != "成果A" || got.Type != "patent" || got.ViewCount != 12 {
		t.Fatalf("成果字段错误: %+v", got)
	}
	if len(got.OwnerPersons) != 1 || got.OwnerPersons[0] != "张三" {
		t.Fatalf("归属人解析错误: %v", got.OwnerPersons)
	}
	if len(got.CoBuilders) != 1 || got.CoBuilders[0] != "李四" {
		t.Fatalf("共建人解析错误: %v", got.CoBuilders)
	}
}

func TestGetCooperationAgreementDetail(t *testing.T) {
	now := time.Now()
	q := &fakeDetailQueryer{
		row: &fakeDetailRow{vals: []any{
			"g1", "协议A", strptr("框架协议"), strptr("协议正文"), &now, &now, "executing", true, now, now,
		}},
		rows: &fakeDetailRows{rows: [][]any{}},
	}
	s := NewPartnerStore(q)

	got, err := s.GetCooperationAgreement(context.Background(), "ent1", "g1")
	if err != nil {
		t.Fatal(err)
	}
	assertCooperationDetailSQL(t, q.row.sql, "alliance_agreements")
	if len(q.row.args) != 2 || q.row.args[0] != "ent1" || q.row.args[1] != "g1" {
		t.Fatalf("参数错误: %v", q.row.args)
	}
	if got.Name != "协议A" || *got.Type != "框架协议" || *got.Content != "协议正文" || got.Status != "executing" {
		t.Fatalf("协议字段错误: %+v", got)
	}
}
