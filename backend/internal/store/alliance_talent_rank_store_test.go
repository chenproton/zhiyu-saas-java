package store

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// fakeRankRows 模拟多行查询（支持 *string/*int/*float64/*time.Time/指针指针 扫描）。
type fakeRankRows struct {
	rows [][]any
	idx  int
}

func (r *fakeRankRows) Next() bool {
	r.idx++
	return r.idx <= len(r.rows)
}

func (r *fakeRankRows) Scan(dest ...any) error {
	row := r.rows[r.idx-1]
	for i := range dest {
		switch d := dest[i].(type) {
		case *string:
			*d = row[i].(string)
		case *int:
			*d = row[i].(int)
		case *float64:
			*d = row[i].(float64)
		case *time.Time:
			*d = row[i].(time.Time)
		case **time.Time:
			if row[i] == nil {
				*d = nil
			} else {
				t := row[i].(time.Time)
				*d = &t
			}
		case **float64:
			if row[i] == nil {
				*d = nil
			} else {
				f := row[i].(float64)
				*d = &f
			}
		case **string:
			if row[i] == nil {
				*d = nil
			} else {
				s := row[i].(string)
				*d = &s
			}
		case *jsonRaw:
			*d = row[i].(jsonRaw)
		}
	}
	return nil
}

func (r *fakeRankRows) Values() ([]any, error)                       { return r.rows[r.idx-1], nil }
func (r *fakeRankRows) RawValues() [][]byte                          { return nil }
func (r *fakeRankRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeRankRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRankRows) Err() error                                   { return nil }
func (r *fakeRankRows) Close()                                       {}
func (r *fakeRankRows) Conn() *pgx.Conn                              { return nil }

type jsonRaw = []byte

// fakeRankRow 模拟单行查询结果。
type fakeRankRow struct {
	val any
}

func (r *fakeRankRow) Scan(dest ...any) error {
	if len(dest) > 0 {
		if d, ok := dest[0].(*int); ok {
			*d = r.val.(int)
		}
	}
	return nil
}

// fakeRankQueryer 按调用顺序返回预设行集，并记录 Exec 的 SQL/参数。
type fakeRankQueryer struct {
	queries [][][]any
	idx     int
	sqls    []string
	execSQL []string
	execArg []any
}

func (q *fakeRankQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	q.sqls = append(q.sqls, sql)
	rows := q.queries[q.idx]
	q.idx++
	return &fakeRankRows{rows: rows}, nil
}

func (q *fakeRankQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	q.sqls = append(q.sqls, sql)
	return &fakeRankRow{val: 1}
}

func (q *fakeRankQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	q.execSQL = append(q.execSQL, sql)
	q.execArg = args
	return pgconn.CommandTag{}, nil
}

func TestListTalentRanking(t *testing.T) {
	evalAt := time.Now()
	q := &fakeRankQueryer{queries: [][][]any{
		{ // 学生：专业 A（有评估，平均达成率 80）、专业 B（无评估）
			{"stu-1", "20240001", "张三", "major-a", "软件工程", "软件1班", "信息学院", 80.0, 75.0, 70.0, 88.0, 2, evalAt},
			{"stu-2", "20240002", "李四", "major-b", "会计", "会计1班", "财经学院", nil, nil, nil, nil, 0, nil},
		},
		{ // 岗位评估明细：学生1 两个岗位
			{"stu-1", "pos-1", "后端开发", 90.0, nil, nil, nil, 100, 90, "优秀", evalAt, jsonRaw(`[{"id":"p1"}]`)},
			{"stu-1", "pos-2", "前端开发", 70.0, nil, nil, nil, 100, 70, "良好", evalAt, nil},
		},
		{ // 专业排名配置：专业 A 未启用、前 5 名
			{"major-a", false, 5},
		},
	}}
	s := NewAllianceStore(q)

	groups, err := s.ListTalentRanking(context.Background(), "tenant-1", "张三")
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 {
		t.Fatalf("应返回 2 个专业分组，实际 %d", len(groups))
	}
	ga, gb := groups[0], groups[1]
	if ga.MajorID != "major-a" || ga.Enabled || ga.RankLimit != 5 {
		t.Fatalf("专业 A 应读取配置 enabled=false limit=5，实际 %+v", ga)
	}
	if len(ga.Students) != 1 || len(ga.Students[0].Positions) != 2 {
		t.Fatalf("专业 A 学生应附带 2 条岗位明细，实际 %+v", ga.Students)
	}
	if ga.Students[0].AvgAchievementRate == nil || *ga.Students[0].AvgAchievementRate != 80.0 {
		t.Fatalf("平均达成率错误: %v", ga.Students[0].AvgAchievementRate)
	}
	if gb.MajorID != "major-b" || !gb.Enabled || gb.RankLimit != 10 {
		t.Fatalf("专业 B 应回退默认 enabled=true limit=10，实际 %+v", gb)
	}
	if gb.Students[0].AvgAchievementRate != nil || gb.Students[0].PositionCount != 0 {
		t.Fatalf("无评估学生指标应为空且岗位数 0，实际 %+v", gb.Students[0])
	}
	// 搜索必须拼入学生 SQL（查询 1）
	if !strings.Contains(q.sqls[0], "ILIKE") {
		t.Fatalf("学生查询应包含搜索条件: %s", q.sqls[0])
	}
}

func TestListEmployerBrandsJoinEnterprise(t *testing.T) {
	q := &fakeRankQueryer{queries: [][][]any{
		{{"b-1", "tenant-1", "employer", "苏州智联", "published", true, false, nil, nil, nil, nil, nil, "ent-1", nil, nil, nil, nil, 0, 10, time.Now(), time.Now(),
			"苏州智联", "logo.png", "软件", "苏州", "简介", "91320000", "王经理", "13800000000", "w@example.com", "苏州市"}},
	}}
	s := NewAllianceStore(q)

	items, total, err := s.ListEmployerBrands(context.Background(), "tenant-1", "智联", 20, 0)
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("列表数据错误: total=%d len=%d", total, len(items))
	}
	if items[0].EnterpriseName == nil || *items[0].EnterpriseName != "苏州智联" {
		t.Fatalf("应附带引用企业名称: %+v", items[0].EnterpriseName)
	}
	if items[0].EnterpriseLogo == nil || *items[0].EnterpriseLogo != "logo.png" {
		t.Fatalf("应附带企业 logo: %+v", items[0].EnterpriseLogo)
	}
	joined := strings.Join(q.sqls, "\n")
	if !strings.Contains(joined, "LEFT JOIN partner_enterprises") || !strings.Contains(joined, "pe.name") {
		t.Fatalf("雇主列表必须 LEFT JOIN partner_enterprises:\n%s", joined)
	}
}

func TestSaveBrandMajorRankConfigsUpsert(t *testing.T) {
	q := &fakeRankQueryer{}
	s := NewAllianceStore(q)

	configs := []domain.BrandMajorRankConfig{
		{MajorID: "major-a", Enabled: false, RankLimit: 5},
		{MajorID: "", Enabled: true, RankLimit: 10},         // 无专业 ID，跳过
		{MajorID: "major-b", Enabled: true, RankLimit: 999}, // 超上限，跳过
	}
	if err := s.SaveBrandMajorRankConfigs(context.Background(), "tenant-1", configs); err != nil {
		t.Fatal(err)
	}
	if len(q.execSQL) != 1 {
		t.Fatalf("应只执行 1 条 upsert，实际 %d", len(q.execSQL))
	}
	if !strings.Contains(q.execSQL[0], "ON CONFLICT (tenant_id, major_id)") {
		t.Fatalf("配置保存必须是 upsert: %s", q.execSQL[0])
	}
	if q.execArg[0] != "tenant-1" || q.execArg[1] != "major-a" || q.execArg[2] != false || q.execArg[3] != 5 {
		t.Fatalf("upsert 参数错误: %v", q.execArg)
	}
}
