package handler_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestHybridGradeWritebackExamResult 混合课教师评分后回写考试结果分数（exam_results）。
func TestHybridGradeWritebackExamResult(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	courseID := uuid.NewString()
	nodeID := uuid.NewString()
	studentID := uuid.NewString()
	examID := uuid.NewString()
	usageID := uuid.NewString()

	execOrFail(t, env, ctx, `
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id)
		VALUES ($1, $2, '混合课回写测试', 'hybrid', '专业核心课程', 'published', $3, $4)
	`, courseID, "HYB-WB-"+uuid.NewString()[:8], testhelper.TestOperatorID, tenantID)
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", courseID)

	// 节点 eval_data：混合课课前测验规则 + 已生成的 usageId
	evalData := map[string]interface{}{
		"hybridEvalRules": map[string]interface{}{
			"preQuiz": map[string]interface{}{
				"methods": []interface{}{"quiz"},
				"evalRuleConfig": map[string]interface{}{
					"evaluationMethods": []interface{}{"quiz"},
					"methodResourceConfigs": map[string]interface{}{
						"quiz": map[string]interface{}{
							"examId": examID,
							"usageId": usageID,
						},
					},
				},
			},
		},
	}
	evalDataJSON, _ := json.Marshal(evalData)
	execOrFail(t, env, ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, sort_order, tenant_id, eval_data, status)
		VALUES ($1, $2, '混合节点', 0, $3, $4::jsonb, 'published')
	`, nodeID, courseID, tenantID, string(evalDataJSON))
	defer env.DB.Exec(ctx, "DELETE FROM system_course_nodes WHERE id = $1", nodeID)

	// 考试 + 安排（target_type='node'）+ 学生考试结果
	execOrFail(t, env, ctx, `
		INSERT INTO exams (id, tenant_id, name, status, duration, creator_id, code, is_temp)
		VALUES ($1, $2, '课前测验考试', 'published', 30, $3, $4, true)
	`, examID, tenantID, testhelper.TestOperatorID, "SJ-HYB-WB-"+uuid.NewString()[:8])
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", examID)

	execOrFail(t, env, ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, '课前测验安排', 'node', $4, 'published', $5)
	`, usageID, tenantID, examID, []string{nodeID}, testhelper.TestOperatorID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_usages WHERE id = $1", usageID)

	execOrFail(t, env, ctx, `
		INSERT INTO exam_results (id, tenant_id, exam_usage_id, user_id, score, total_score, grading_status)
		VALUES ($1, $2, $3, $4, 60, 100, 'pending')
	`, uuid.NewString(), tenantID, usageID, studentID)
	defer env.DB.Exec(ctx, "DELETE FROM exam_results WHERE exam_usage_id = $1", usageID)

	// 节点测评结果（pending，含主观题待教师评分）
	resultID := uuid.NewString()
	execOrFail(t, env, ctx, `
		INSERT INTO node_evaluation_results (id, tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score)
		VALUES ($1, $2, $3, 'preQuiz:quiz', $4, 'pending', 60, 100)
	`, resultID, tenantID, nodeID, studentID)
	defer env.DB.Exec(ctx, "DELETE FROM node_evaluation_results WHERE id = $1", resultID)

	// 教师评分 → 应回写 exam_results 分数
	st := store.New(env.DB)
	svc := service.New(st)
	nodeResultSvc := service.NewNodeEvaluationResultService(svc)
	err := nodeResultSvc.Grade(ctx, tenantID, resultID, testhelper.TestOperatorID, &store.NodeEvaluationResultGradeParams{
		Score:   85,
		Comment: nil,
	})
	if err != nil {
		t.Fatalf("grade: %v", err)
	}

	var examScore float64
	err = env.DB.QueryRow(ctx, `
		SELECT score FROM exam_results er
		JOIN exam_usages eu ON er.exam_usage_id = eu.id
		WHERE eu.id = $1 AND er.user_id = $2
	`, usageID, studentID).Scan(&examScore)
	if err != nil {
		t.Fatalf("query exam result score: %v", err)
	}
	if examScore != 85 {
		t.Fatalf("expected exam result score 85 after grade, got %v", examScore)
	}

	// 节点测评结果状态已更新
	var status string
	err = env.DB.QueryRow(ctx, `SELECT status FROM node_evaluation_results WHERE id = $1`, resultID).Scan(&status)
	if err != nil {
		t.Fatalf("query node eval status: %v", err)
	}
	if status != "evaluated" {
		t.Fatalf("expected evaluated, got %s", status)
	}
}
