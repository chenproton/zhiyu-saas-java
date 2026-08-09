package store

import "testing"

// TestWorkflowListIDsFilter 验证 ids 逗号拼接参数拆分为数组并显式转 uuid[]，
// 防止标量字符串传入 ANY() 报 malformed array literal（/job/approvals 等审批页 500 回归）。
func TestWorkflowListIDsFilter(t *testing.T) {
	cfg := NewWorkflowStore(nil).ListConfig()

	qb := NewListQueryBuilder()
	cfg.ExtraFilter(ListParams{Values: map[string]string{"ids": "a, b ,,c"}}, qb)
	if got := qb.WhereClause(); got != "id = ANY($1::uuid[])" {
		t.Fatalf("ids 条件装配错误: %s", got)
	}
	args := qb.Args()
	if len(args) != 1 {
		t.Fatalf("参数数量错误: %v", args)
	}
	parts, ok := args[0].([]string)
	if !ok {
		t.Fatalf("ids 参数应为 []string, got %T", args[0])
	}
	if len(parts) != 3 || parts[0] != "a" || parts[1] != "b" || parts[2] != "c" {
		t.Fatalf("ids 拆分错误: %v", parts)
	}

	// 全为空片段时不加条件（WhereClause 无条件时返回 1=1）
	qb2 := NewListQueryBuilder()
	cfg.ExtraFilter(ListParams{Values: map[string]string{"ids": " , ,"}}, qb2)
	if got := qb2.WhereClause(); got != "1=1" {
		t.Fatalf("空 ids 不应生成条件: %q", got)
	}
}
