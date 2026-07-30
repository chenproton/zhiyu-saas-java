package handler

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type NodeEvaluationResultHandler struct {
	DB *pgxpool.Pool
}

func (h *NodeEvaluationResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")
	evaluateeID := r.URL.Query().Get("evaluateeId")
	if nodeID == "" {
		respondError(w, http.StatusBadRequest, "缺少节点ID")
		return
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.NodeEvaluationResult]{
		Table: "node_evaluation_results",
		SelectColumns: "id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, " +
			"total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, " +
			"comment, graded_at, graded_by",
		TenantScoped: true,
		OrderBy:      "created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			qb.addCondition("node_id = " + qb.nextArg(nodeID))
			if evaluateeID != "" {
				qb.addCondition("evaluatee_id = " + qb.nextArg(evaluateeID))
			}
		},
		ScanRows: h.scanRows,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询节点测评结果失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total})
}

func (h *NodeEvaluationResultHandler) scanRows(rows pgx.Rows) ([]domain.NodeEvaluationResult, error) {
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
