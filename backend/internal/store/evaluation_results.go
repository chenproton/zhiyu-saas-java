package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// EvaluationResultStore 场景评价结果持久化。
type EvaluationResultStore struct {
	q Queryer
}

// NewEvaluationResultStore 创建评价结果 store。
func NewEvaluationResultStore(q Queryer) *EvaluationResultStore {
	return &EvaluationResultStore{q: q}
}

// List 查询评价结果列表。
func (s *EvaluationResultStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.SceneEvaluationResult]) ([]domain.SceneEvaluationResult, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanSceneEvaluationResultRows)
}

// Get 查询单个评价结果。
func (s *EvaluationResultStore) Get(ctx context.Context, id string) (*domain.SceneEvaluationResult, error) {
	res, err := s.fetchResult(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Submit 提交评价结果（幂等 upsert）。
func (s *EvaluationResultStore) Submit(ctx context.Context, p *EvaluationResultSubmitParams) (*domain.SceneEvaluationResult, error) {
	var id string
	now := time.Now()
	err := s.q.QueryRow(ctx, `
		INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (tenant_id, task_id, evaluatee_id, method_key) DO UPDATE SET
			scene_id = EXCLUDED.scene_id,
			objective_answers = EXCLUDED.objective_answers,
			subjective_content = EXCLUDED.subjective_content,
			drawn_questions = EXCLUDED.drawn_questions,
			eval_point_scores = EXCLUDED.eval_point_scores,
			status = 'pending',
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, p.TenantID, p.TaskID, p.SceneID, p.MethodKey, p.EvaluateeID,
		p.EvaluatorID, p.EvaluatorType, p.MaxScore,
		p.EvalPointScores, p.ObjectiveAnswers, p.SubjectiveContent, p.DrawnQuestions, now, now).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Grade 评分（pending→evaluated）。
func (s *EvaluationResultStore) Grade(ctx context.Context, id, graderID string, p *EvaluationResultGradeParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, drawn_questions = $4, subjective_content = $5, status = 'evaluated', graded_at = NOW(), graded_by = $6, updated_at = NOW()
		WHERE id = $7 AND status = 'pending'
	`, p.Score, p.Comment, p.EvalPointScores, p.DrawnQuestions, p.SubjectiveContent, graderID, id)
	return err
}

// BatchGrade 事务内批量评分。
func (s *EvaluationResultStore) BatchGrade(ctx context.Context, tx Queryer, graderID string, items []EvaluationResultGradeItem) error {
	for _, item := range items {
		if _, err := tx.Exec(ctx, `
			UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, status = 'evaluated', graded_at = NOW(), graded_by = $4, updated_at = NOW()
			WHERE id = $5 AND status = 'pending'
		`, item.Score, item.Comment, item.EvalPointScores, graderID, item.ID); err != nil {
			return err
		}
	}
	return nil
}

// FindLatestExamResult 查询任务最新考试结果。
func (s *EvaluationResultStore) FindLatestExamResult(ctx context.Context, taskID, methodKey, evaluateeID string) (string, error) {
	var examResultID string
	err := s.q.QueryRow(ctx, `
		SELECT er.id
		FROM exam_results er
		JOIN exam_usages eu ON er.exam_usage_id = eu.id
		JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)
		WHERE tem.task_id = $1 AND tem.method_key = $2 AND er.user_id = $3 AND eu.target_type = 'task'
		ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
		LIMIT 1
	`, taskID, methodKey, evaluateeID).Scan(&examResultID)
	if err != nil {
		return "", err
	}
	return examResultID, nil
}

// UpdateExamResultScore 更新考试结果分数。
func (s *EvaluationResultStore) UpdateExamResultScore(ctx context.Context, examResultID string, score float64) {
	_, _ = s.q.Exec(ctx, `UPDATE exam_results SET score = $1, updated_at = NOW() WHERE id = $2`, score, examResultID)
}

// EvaluationResultSubmitParams 提交参数。
type EvaluationResultSubmitParams struct {
	TenantID          string
	TaskID            string
	SceneID           *string
	MethodKey         string
	EvaluateeID       string
	EvaluatorID       string
	EvaluatorType     string
	MaxScore          float64
	EvalPointScores   domain.JSONMap
	ObjectiveAnswers  domain.JSONMap
	SubjectiveContent domain.JSONMap
	DrawnQuestions    domain.JSONMap
}

// EvaluationResultGradeParams 评分参数。
type EvaluationResultGradeParams struct {
	Score             float64
	Comment           *string
	EvalPointScores   domain.JSONMap
	DrawnQuestions    domain.JSONMap
	SubjectiveContent domain.JSONMap
}

// EvaluationResultGradeItem 批量评分项。
type EvaluationResultGradeItem struct {
	ID              string
	Score           float64
	Comment         *string
	EvalPointScores domain.JSONMap
}

func (s *EvaluationResultStore) fetchResult(ctx context.Context, id string) (*domain.SceneEvaluationResult, error) {
	var res domain.SceneEvaluationResult
	var sceneID, comment, gradedBy, evaluatorID, evaluatorType pgtype.Text
	var totalScore *float64
	var gradedAt *time.Time
	var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content,
			drawn_questions, comment, graded_at, graded_by
		FROM scene_evaluation_results WHERE id = $1
	`, id).Scan(
		&res.ID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
		&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
		&drawnQuestions, &comment, &gradedAt, &gradedBy,
	)
	if err != nil {
		return nil, err
	}
	if sceneID.Valid {
		res.SceneID = &sceneID.String
	}
	res.EvaluatorID = evaluatorID.String
	res.EvaluatorType = evaluatorType.String
	res.TotalScore = totalScore
	res.EvalPointScores = evalPointScores
	res.ObjectiveAnswers = objectiveAnswers
	res.SubjectiveContent = subjectiveContent
	res.DrawnQuestions = drawnQuestions
	if comment.Valid {
		res.Comment = &comment.String
	}
	if gradedBy.Valid {
		res.GradedBy = &gradedBy.String
	}
	res.GradedAt = gradedAt
	return &res, nil
}

// ScanSceneEvaluationResultRows 扫描评价结果行。
func ScanSceneEvaluationResultRows(rows pgx.Rows) ([]domain.SceneEvaluationResult, error) {
	items := make([]domain.SceneEvaluationResult, 0)
	for rows.Next() {
		var res domain.SceneEvaluationResult
		var sceneID, comment, gradedBy, evaluatorID, evaluatorType pgtype.Text
		var totalScore *float64
		var gradedAt *time.Time
		var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
		if err := rows.Scan(
			&res.ID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
			&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
			&drawnQuestions, &comment, &gradedAt, &gradedBy,
		); err != nil {
			return nil, err
		}
		if sceneID.Valid {
			res.SceneID = &sceneID.String
		}
		res.EvaluatorID = evaluatorID.String
		res.EvaluatorType = evaluatorType.String
		res.TotalScore = totalScore
		res.EvalPointScores = evalPointScores
		res.ObjectiveAnswers = objectiveAnswers
		res.SubjectiveContent = subjectiveContent
		res.DrawnQuestions = drawnQuestions
		if comment.Valid {
			res.Comment = &comment.String
		}
		if gradedBy.Valid {
			res.GradedBy = &gradedBy.String
		}
		res.GradedAt = gradedAt
		items = append(items, res)
	}
	return items, nil
}
