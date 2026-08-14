package store

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeImportQueryer 脚本化 Queryer：按 SQL 前缀返回预设行，并记录执行的 SQL 序列，
// 用于验证「批量 find-or-create 三次查询而非 3N 次」的行为契约。
type fakeImportQueryer struct {
	selectResults map[string][][]string // SQL 前缀 → 行集（name, id）
	execSQLs      []string
	queryCount    int
}

func (f *fakeImportQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	f.queryCount++
	key := strings.TrimSpace(sql)
	if strings.HasPrefix(key, "SELECT name, id FROM knowledge_points") {
		if v, ok := f.selectResults["kp_existing"]; ok {
			delete(f.selectResults, "kp_existing") // 第一次批量查已有
			return &fakeRows{rows: v}, nil
		}
		if v, ok := f.selectResults["kp_recheck"]; ok {
			delete(f.selectResults, "kp_recheck") // 插入后批量回查
			return &fakeRows{rows: v}, nil
		}
		return &fakeRows{}, nil
	}
	return &fakeRows{}, nil
}

func (f *fakeImportQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	f.queryCount++
	return &fakeRow{}
}

func (f *fakeImportQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.execSQLs = append(f.execSQLs, sql)
	return pgconn.CommandTag{}, nil
}

// fakeRows 最小 pgx.Rows 实现（仅 name/id 两列字符串）。
type fakeRows struct {
	rows [][]string
	i    int
}

func (r *fakeRows) Close()                                       {}
func (r *fakeRows) Err() error                                   { return nil }
func (r *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRows) Next() bool {
	r.i++
	return r.i <= len(r.rows)
}
func (r *fakeRows) Scan(dest ...any) error {
	row := r.rows[r.i-1]
	for j, d := range dest {
		if j >= len(row) {
			continue
		}
		if p, ok := d.(*string); ok {
			*p = row[j]
		}
	}
	return nil
}
func (r *fakeRows) Values() ([]any, error) { return nil, nil }
func (r *fakeRows) RawValues() [][]byte    { return nil }
func (r *fakeRows) Conn() *pgx.Conn        { return nil }

type fakeRow struct{}

func (r *fakeRow) Scan(dest ...any) error { return pgx.ErrNoRows }

// TestFindOrCreateKnowledgePointsBatchShape 验证批量 find-or-create 的查询形状：
// N 个名称 → 1 次批量查已有 + 1 次批量插入 + 1 次批量回查（3 次而非 3N 次），
// 且返回顺序与输入一致、去重、已有名称复用原 id。
func TestFindOrCreateKnowledgePointsBatchShape(t *testing.T) {
	q := &fakeImportQueryer{
		selectResults: map[string][][]string{
			"kp_existing": {{"已有A", "id-A"}},
			"kp_recheck":  {{"新建B", "id-B"}, {"新建C", "id-C"}},
		},
	}
	ids := FindOrCreateKnowledgePointsByNames(context.Background(), q, "t1", []string{"已有A", "新建B", " 新建C ", "新建B", ""})
	if len(ids) != 3 {
		t.Fatalf("返回 %d 个 id，期望 3（去重+去空白后）: %v", len(ids), ids)
	}
	if ids[0] != "id-A" || ids[1] != "id-B" || ids[2] != "id-C" {
		t.Fatalf("id 顺序/内容不符: %v", ids)
	}
	if q.queryCount != 2 {
		t.Fatalf("SELECT 次数 %d，期望 2（批量查已有+批量回查）", q.queryCount)
	}
	if len(q.execSQLs) != 1 || !strings.Contains(q.execSQLs[0], "INSERT INTO knowledge_points") {
		t.Fatalf("应恰好 1 条批量 INSERT，实际: %v", q.execSQLs)
	}
	insert := q.execSQLs[0]
	for _, want := range []string{"($1,$2,$3,$4)", "($5,$6,$7,$8)"} {
		if !strings.Contains(insert, want) {
			t.Fatalf("批量 INSERT 应为多行 VALUES，缺失占位符 %s: %s", want, insert)
		}
	}
}

// TestFindOrCreateKnowledgePointsEmpty 空/全空白输入返回空列表且零查询。
func TestFindOrCreateKnowledgePointsEmpty(t *testing.T) {
	q := &fakeImportQueryer{}
	if ids := FindOrCreateKnowledgePointsByNames(context.Background(), q, "t1", []string{"  "}); len(ids) != 0 {
		t.Fatalf("空输入应返回空: %v", ids)
	}
	if q.queryCount != 0 {
		t.Fatalf("空输入不应发查询，实际 %d 次", q.queryCount)
	}
}
