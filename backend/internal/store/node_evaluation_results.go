package store

import (
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// NodeEvaluationResultStore 节点测评结果持久化。
type NodeEvaluationResultStore struct {
	q Queryer
}

// NewNodeEvaluationResultStore 创建节点测评结果 store。
func NewNodeEvaluationResultStore(q Queryer) *NodeEvaluationResultStore {
	return &NodeEvaluationResultStore{q: q}
}

// ListConfig 返回节点测评结果列表查询配置，SQL 片段沉淀在 store 层。
func (s *NodeEvaluationResultStore) ListConfig() ListQueryConfig[domain.NodeEvaluationResult] {
	return ListQueryConfig[domain.NodeEvaluationResult]{
		Table: "node_evaluation_results",
		SelectColumns: "id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, " +
			"total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, " +
			"comment, graded_at, graded_by",
		TenantScoped: true,
		OrderBy:      "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if nodeID := p.Values["nodeId"]; nodeID != "" {
				qb.AddCondition("node_id = " + qb.NextArg(nodeID))
			}
			if p.Values["isStudent"] == "true" {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(p.Values["studentUserId"]))
				return
			}
			if evaluateeID := p.Values["evaluateeId"]; evaluateeID != "" {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(evaluateeID))
			}
		},
		ScanRows: ScanNodeEvaluationResultRows,
	}
}

// ScanNodeEvaluationResultRows 扫描节点测评结果行。
func ScanNodeEvaluationResultRows(rows pgx.Rows) ([]domain.NodeEvaluationResult, error) {
	var items []domain.NodeEvaluationResult
	for rows.Next() {
		var r domain.NodeEvaluationResult
		var totalScore *float64
		var comment *string
		var gradedAt *time.Time
		var gradedBy *string
		if err := rows.Scan(
			&r.ID, &r.NodeID, &r.MethodKey, &r.EvaluateeID, &r.EvaluatorID, &r.EvaluatorType, &r.Status,
			&totalScore, &r.MaxScore, &r.EvalPointScores, &r.ObjectiveAnswers, &r.SubjectiveContent, &r.DrawnQuestions,
			&comment, &gradedAt, &gradedBy,
		); err != nil {
			return nil, err
		}
		if totalScore != nil {
			r.TotalScore = totalScore
		}
		if comment != nil {
			r.Comment = comment
		}
		if gradedAt != nil {
			r.GradedAt = gradedAt
		}
		if gradedBy != nil {
			r.GradedBy = gradedBy
		}
		items = append(items, r)
	}
	return items, nil
}
