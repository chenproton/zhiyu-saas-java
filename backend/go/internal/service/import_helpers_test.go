package service

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeResourceQueryer 脚本化 Queryer：记录按名称批量查询/插入次数，
// 验证 FindOrCreateResources 按类型分组后每组仅 3 次 SQL。
type fakeResourceQueryer struct {
	selectCalls int
	insertCalls int
}

func (f *fakeResourceQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	f.selectCalls++
	// 回查不返回行：全部走「新建」路径
	return &fakeResRows{}, nil
}

func (f *fakeResourceQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func (f *fakeResourceQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if strings.Contains(sql, "INSERT INTO resource_library") {
		f.insertCalls++
	}
	return pgconn.CommandTag{}, nil
}

type fakeResRows struct{ i int }

func (r *fakeResRows) Close()                                       {}
func (r *fakeResRows) Err() error                                   { return nil }
func (r *fakeResRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeResRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeResRows) Next() bool                                   { return false }
func (r *fakeResRows) Scan(dest ...any) error                       { return nil }
func (r *fakeResRows) Values() ([]any, error)                       { return nil, nil }
func (r *fakeResRows) RawValues() [][]byte                          { return nil }
func (r *fakeResRows) Conn() *pgx.Conn                              { return nil }

// TestFindOrCreateResourcesBatchByType 验证按扩展名分组批量：
// 混合 3 种类型 + 重复名 + 空白，应恰好 3 组（每组 1 查 + 1 插 + 1 回查）。
func TestFindOrCreateResourcesBatchByType(t *testing.T) {
	q := &fakeResourceQueryer{}
	ids := FindOrCreateResources(context.Background(), q, "t1",
		[]string{"a.pdf", "b.pdf", "c.mp4", "d.mp4", "e.zip", "a.pdf", "  "}, "u1")
	if len(ids) != 5 {
		t.Fatalf("期望 5 个 id（去重去空白后），实际 %d", len(ids))
	}
	if q.insertCalls != 3 {
		t.Fatalf("应按类型分 3 组批量插入，实际 %d 次 INSERT", q.insertCalls)
	}
	if q.selectCalls != 6 {
		t.Fatalf("每组 2 次查询（查已有+回查）×3 组 = 6，实际 %d", q.selectCalls)
	}
}
