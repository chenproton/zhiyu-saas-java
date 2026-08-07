package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

// Get 查询单个节点测评结果。
func (s *NodeEvaluationResultStore) Get(ctx context.Context, id string) (*domain.NodeEvaluationResult, error) {
	var r domain.NodeEvaluationResult
	var totalScore *float64
	var comment *string
	var gradedAt *time.Time
	var gradedBy *string
	var evaluatorID, evaluatorType pgtype.Text
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions,
			comment, graded_at, graded_by
		FROM node_evaluation_results WHERE id = $1
	`, id).Scan(
		&r.ID, &r.NodeID, &r.MethodKey, &r.EvaluateeID, &evaluatorID, &evaluatorType, &r.Status,
		&totalScore, &r.MaxScore, &r.EvalPointScores, &r.ObjectiveAnswers, &r.SubjectiveContent, &r.DrawnQuestions,
		&comment, &gradedAt, &gradedBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	r.EvaluatorID = evaluatorID.String
	r.EvaluatorType = evaluatorType.String
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
	return &r, nil
}

// Submit 提交节点测评结果（幂等 upsert）。
func (s *NodeEvaluationResultStore) Submit(ctx context.Context, p *NodeEvaluationResultSubmitParams) (*domain.NodeEvaluationResult, error) {
	var id string
	now := time.Now()
	err := s.q.QueryRow(ctx, `
		INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (tenant_id, node_id, evaluatee_id, method_key) DO UPDATE SET
			evaluator_id = EXCLUDED.evaluator_id,
			evaluator_type = EXCLUDED.evaluator_type,
			max_score = EXCLUDED.max_score,
			objective_answers = EXCLUDED.objective_answers,
			subjective_content = EXCLUDED.subjective_content,
			drawn_questions = EXCLUDED.drawn_questions,
			eval_point_scores = EXCLUDED.eval_point_scores,
			status = 'pending',
			graded_at = NULL,
			updated_at = EXCLUDED.updated_at
		WHERE node_evaluation_results.graded_at IS NULL
		RETURNING id
	`, p.TenantID, p.NodeID, p.MethodKey, p.EvaluateeID,
		p.EvaluatorID, p.EvaluatorType, p.MaxScore,
		p.EvalPointScores, p.ObjectiveAnswers, p.SubjectiveContent, p.DrawnQuestions, now, now).Scan(&id)
	if err == pgx.ErrNoRows {
		// 已被教师评分的结果禁止重交覆盖
		return nil, ErrAlreadyGraded
	}
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// GetByID 按租户+ID 查询单条节点测评结果。
func (s *NodeEvaluationResultStore) GetByID(ctx context.Context, tenantID, id string) (*domain.NodeEvaluationResult, error) {
	var r domain.NodeEvaluationResult
	var totalScore *float64
	var comment *string
	var gradedAt *time.Time
	var gradedBy *string
	var evaluatorID, evaluatorType pgtype.Text
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions,
			comment, graded_at, graded_by
		FROM node_evaluation_results WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(
		&r.ID, &r.NodeID, &r.MethodKey, &r.EvaluateeID, &evaluatorID, &evaluatorType, &r.Status,
		&totalScore, &r.MaxScore, &r.EvalPointScores, &r.ObjectiveAnswers, &r.SubjectiveContent, &r.DrawnQuestions,
		&comment, &gradedAt, &gradedBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	r.EvaluatorID = evaluatorID.String
	r.EvaluatorType = evaluatorType.String
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
	return &r, nil
}

// Grade 评分（pending→evaluated），租户隔离 + 仅可评未评分结果。
func (s *NodeEvaluationResultStore) Grade(ctx context.Context, tenantID, id, graderID string, p *NodeEvaluationResultGradeParams) error {
	tag, err := s.q.Exec(ctx, `
		UPDATE node_evaluation_results
		SET total_score = $1, comment = $2, eval_point_scores = $3, status = 'evaluated',
			graded_at = NOW(), graded_by = $4, updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6 AND status = 'pending'
	`, p.Score, p.Comment, p.EvalPointScores, graderID, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListByCourse 查询课程下全部节点的测评结果（教师评分列表用）。
func (s *NodeEvaluationResultStore) ListByCourse(ctx context.Context, tenantID, courseID string) ([]domain.NodeEvaluationResult, error) {
	rows, err := s.q.Query(ctx, `
		SELECT ner.id, ner.node_id, ner.method_key, ner.evaluatee_id, ner.evaluator_id, ner.evaluator_type, ner.status,
			ner.total_score, ner.max_score, ner.eval_point_scores, ner.objective_answers, ner.subjective_content, ner.drawn_questions,
			ner.comment, ner.graded_at, ner.graded_by
		FROM node_evaluation_results ner
		JOIN system_course_nodes n ON n.id = ner.node_id
		WHERE ner.tenant_id = $1 AND n.course_id = $2
		ORDER BY ner.created_at DESC
	`, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return ScanNodeEvaluationResultRows(rows)
}

// NodeEvaluationResultGradeParams 评分参数。
type NodeEvaluationResultGradeParams struct {
	Score           float64
	Comment         *string
	EvalPointScores domain.JSONMap
}

// NodeEvaluationResultSubmitParams 提交参数。
type NodeEvaluationResultSubmitParams struct {
	TenantID          string
	NodeID            string
	MethodKey         string
	EvaluateeID       string
	EvaluatorID       *string
	EvaluatorType     string
	MaxScore          float64
	EvalPointScores   domain.JSONMap
	ObjectiveAnswers  domain.JSONMap
	SubjectiveContent domain.JSONMap
	DrawnQuestions    domain.JSONMap
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
		var evaluatorID, evaluatorType pgtype.Text
		if err := rows.Scan(
			&r.ID, &r.NodeID, &r.MethodKey, &r.EvaluateeID, &evaluatorID, &evaluatorType, &r.Status,
			&totalScore, &r.MaxScore, &r.EvalPointScores, &r.ObjectiveAnswers, &r.SubjectiveContent, &r.DrawnQuestions,
			&comment, &gradedAt, &gradedBy,
		); err != nil {
			return nil, err
		}
		r.EvaluatorID = evaluatorID.String
		r.EvaluatorType = evaluatorType.String
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
	return items, rows.Err()
}
