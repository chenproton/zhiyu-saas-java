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

// ListConfig 返回评价结果列表查询配置，SQL 片段沉淀在 store 层。
// 学生（handler 注入 ownOnly=evaluateeId）仅可查看本人的评价结果，
// 但仍受 taskId/sceneId 等范围过滤约束，避免串场景展示其他场景的成绩。
func (s *EvaluationResultStore) ListConfig() ListQueryConfig[domain.SceneEvaluationResult] {
	return ListQueryConfig[domain.SceneEvaluationResult]{
		Table:         "scene_evaluation_results",
		SelectColumns: "id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ScanRows:      ScanSceneEvaluationResultRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if p.Values["ownOnly"] == "true" {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(p.Values["evaluateeId"]))
				if taskID := p.Values["taskId"]; taskID != "" {
					qb.AddCondition("task_id = " + qb.NextArg(taskID))
				}
				if sceneID := p.Values["sceneId"]; sceneID != "" {
					qb.AddCondition("scene_id = " + qb.NextArg(sceneID))
				}
				return
			}
			if taskID := p.Values["taskId"]; taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
			if sceneID := p.Values["sceneId"]; sceneID != "" {
				qb.AddCondition("scene_id = " + qb.NextArg(sceneID))
			}
			if methodKey := p.Values["methodKey"]; methodKey != "" {
				qb.AddCondition("method_key = " + qb.NextArg(methodKey))
			}
			if evaluateeID := p.Values["evaluateeId"]; evaluateeID != "" {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(evaluateeID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
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
	tag, err := s.q.Exec(ctx, `
		UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, drawn_questions = $4, subjective_content = $5, status = 'evaluated', graded_at = NOW(), graded_by = $6, updated_at = NOW()
		WHERE id = $7 AND status = 'pending'
	`, p.Score, p.Comment, p.EvalPointScores, p.DrawnQuestions, p.SubjectiveContent, graderID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
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

// FindLatestExamResult 查询任务下某测评方式对应的最新考试结果。
// 通过 resource_config 中的 paperId/examId 将考试安排绑定到该方式自身的试卷，
// 避免任务下多个试卷方式（paper/question_bank/quiz）之间互相串用考试结果。
func (s *EvaluationResultStore) FindLatestExamResult(ctx context.Context, taskID, methodKey, evaluateeID string) (string, error) {
	var examResultID string
	err := s.q.QueryRow(ctx, `
		SELECT er.id
		FROM exam_results er
		JOIN exam_usages eu ON er.exam_usage_id = eu.id
		JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)
		WHERE tem.task_id = $1 AND tem.method_key = $2 AND er.user_id = $3 AND eu.target_type = 'task'
			AND eu.exam_id = COALESCE(
				NULLIF(tem.resource_config->>'paperId', ''),
				NULLIF(tem.resource_config->>'examId', '')
			)::uuid
		ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
		LIMIT 1
	`, taskID, methodKey, evaluateeID).Scan(&examResultID)
	if err != nil {
		return "", err
	}
	return examResultID, nil
}

// UpdateExamResultScore 更新考试结果分数，并同步及格判定（60% 及格线，与提交时一致），
// 同时标记教师评分时间（graded_at 非空即视为已评分，用于重交保护）。
func (s *EvaluationResultStore) UpdateExamResultScore(ctx context.Context, examResultID string, score float64) error {
	_, err := s.q.Exec(ctx, `UPDATE exam_results SET score = $1, is_pass = ($1 >= total_score * 0.6), graded_at = NOW(), updated_at = NOW() WHERE id = $2`, score, examResultID)
	return err
}

// FindNodeExamResult 查询节点测评方式对应的考试结果。
// 通过节点 eval_data 中 methodResourceConfigs[methodKey].usageId 精确关联考试安排。
// 兼容混合课：usageId 存于 hybridEvalRules.<module>.evalRuleConfig.methodResourceConfigs，
// 合并时 key 拼为复合 key（如 preQuiz:quiz），与 node_evaluation_results.method_key 一致。
func (s *EvaluationResultStore) FindNodeExamResult(ctx context.Context, nodeID, methodKey, evaluateeID string) (string, error) {
	var examResultID string
	err := s.q.QueryRow(ctx, `
		SELECT er.id
		FROM exam_results er
		JOIN exam_usages eu ON er.exam_usage_id = eu.id
		JOIN system_course_nodes n ON n.id = eu.target_ids[1]
		WHERE n.id = $1 AND er.user_id = $3 AND eu.target_type = 'node'
			AND eu.id = (
				SELECT (rc.value->>'usageId')::uuid
				FROM jsonb_each(
					COALESCE(n.eval_data->'evalRuleConfig'->'methodResourceConfigs', '{}'::jsonb)
					|| COALESCE((
						SELECT jsonb_object_agg(hm.module_key || ':' || mc.key, mc.value)
						FROM jsonb_each(COALESCE(n.eval_data->'hybridEvalRules', '{}'::jsonb)) hm
						CROSS JOIN LATERAL jsonb_each(
							COALESCE(hm.value->'evalRuleConfig'->'methodResourceConfigs', '{}'::jsonb)
						) mc
					), '{}'::jsonb)
				) rc
				WHERE rc.key = $2 AND rc.value->>'usageId' IS NOT NULL
				LIMIT 1
			)
		ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
		LIMIT 1
	`, nodeID, methodKey, evaluateeID).Scan(&examResultID)
	if err != nil {
		return "", err
	}
	return examResultID, nil
}

// EvaluationResultGradeTarget 评分目标（task/method/evaluatee）。
type EvaluationResultGradeTarget struct {
	ID          string
	TaskID      string
	MethodKey   string
	EvaluateeID string
}

// BatchGetGradeTargets 批量查询评价结果的评分目标。
func (s *EvaluationResultStore) BatchGetGradeTargets(ctx context.Context, tx Queryer, ids []string) ([]EvaluationResultGradeTarget, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, task_id, method_key, evaluatee_id
		FROM scene_evaluation_results
		WHERE id = ANY($1::uuid[])
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var targets []EvaluationResultGradeTarget
	for rows.Next() {
		var t EvaluationResultGradeTarget
		if err := rows.Scan(&t.ID, &t.TaskID, &t.MethodKey, &t.EvaluateeID); err != nil {
			return nil, err
		}
		targets = append(targets, t)
	}
	return targets, rows.Err()
}

// EvaluationResultSubmitParams 提交参数。
type EvaluationResultSubmitParams struct {
	TenantID          string
	TaskID            string
	SceneID           *string
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
	var sceneID, comment, gradedBy, evaluatorID, evaluatorType, tenantID pgtype.Text
	var totalScore *float64
	var gradedAt *time.Time
	var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content,
			drawn_questions, comment, graded_at, graded_by
		FROM scene_evaluation_results WHERE id = $1
	`, id).Scan(
		&res.ID, &tenantID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
		&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
		&drawnQuestions, &comment, &gradedAt, &gradedBy,
	)
	if err != nil {
		return nil, err
	}
	if tenantID.Valid {
		res.TenantID = &tenantID.String
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
