package store

import "testing"

// TestEvaluationResultOwnOnlyScopes 验证学生（ownOnly）查询仍叠加 taskId/sceneId 范围过滤，
// 防止旧场景/其他任务的成绩串到当前场景展示。
func TestEvaluationResultOwnOnlyScopes(t *testing.T) {
	cfg := NewEvaluationResultStore(nil).ListConfig()

	qb := NewListQueryBuilder()
	qb.AddCondition("tenant_id = " + qb.NextArg("t1"))
	cfg.ExtraFilter(ListParams{Values: map[string]string{
		"ownOnly":     "true",
		"evaluateeId": "u1",
		"taskId":      "task1",
		"sceneId":     "scene1",
	}}, qb)
	want := "tenant_id = $1 AND evaluatee_id = $2 AND task_id = $3 AND scene_id = $4"
	if got := qb.WhereClause(); got != want {
		t.Fatalf("ownOnly 条件装配错误:\n  got:  %s\n  want: %s", got, want)
	}
	if len(qb.Args()) != 4 {
		t.Fatalf("参数数量错误: %v", qb.Args())
	}

	qb2 := NewListQueryBuilder()
	qb2.AddCondition("tenant_id = " + qb2.NextArg("t1"))
	cfg.ExtraFilter(ListParams{Values: map[string]string{
		"ownOnly":     "true",
		"evaluateeId": "u1",
	}}, qb2)
	if got := qb2.WhereClause(); got != "tenant_id = $1 AND evaluatee_id = $2" {
		t.Fatalf("无范围过滤时条件错误: %s", got)
	}

	// 教师/管理员（非 ownOnly）行为保持不变
	qb3 := NewListQueryBuilder()
	qb3.AddCondition("tenant_id = " + qb3.NextArg("t1"))
	cfg.ExtraFilter(ListParams{Values: map[string]string{
		"taskId":  "task1",
		"sceneId": "scene1",
		"status":  "evaluated",
	}}, qb3)
	if got := qb3.WhereClause(); got != "tenant_id = $1 AND task_id = $2 AND scene_id = $3 AND status = $4" {
		t.Fatalf("非 ownOnly 条件错误: %s", got)
	}
}
