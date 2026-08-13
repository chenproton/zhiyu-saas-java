package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		SelectColumns: "id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by, version",
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
// 提交固化（文档 5.3/13.A6）：scene_id 与 version 均以服务端解析为准——
// scene_id 由 task_id → scenario_tasks.scenario_id 反查（客户端传值不可信，直接覆盖）；
// version 取场景最新快照版本（expectedVersion 快照存在则采纳，否则回退最新，13.B2 降级语义）。
// 任务不存在（孤儿提交）时 scene_id/version 落 NULL，保持现状宽松行为。
func (s *EvaluationResultStore) Submit(ctx context.Context, p *EvaluationResultSubmitParams) (*domain.SceneEvaluationResult, error) {
	snap := NewSnapshotStore(s.q)
	var sceneID *string
	var sid string
	if err := s.q.QueryRow(ctx, `SELECT scenario_id FROM scenario_tasks WHERE id = $1`, p.TaskID).Scan(&sid); err == nil {
		sceneID = &sid
	} else if err != pgx.ErrNoRows {
		return nil, err
	}
	version := ""
	if sceneID != nil {
		v, err := snap.ExpectedOrLatestVersion(ctx, p.TenantID, SnapshotResourceScenario, *sceneID, p.ExpectedVersion)
		if err != nil {
			return nil, err
		}
		version = v
	}
	var versionArg any
	if version != "" {
		versionArg = version
	}
	var id string
	now := time.Now()
	err := s.q.QueryRow(ctx, `
		INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (tenant_id, task_id, evaluatee_id, method_key) DO UPDATE SET
			scene_id = EXCLUDED.scene_id,
			evaluator_id = EXCLUDED.evaluator_id,
			evaluator_type = EXCLUDED.evaluator_type,
			max_score = EXCLUDED.max_score,
			objective_answers = EXCLUDED.objective_answers,
			subjective_content = EXCLUDED.subjective_content,
			drawn_questions = EXCLUDED.drawn_questions,
			eval_point_scores = EXCLUDED.eval_point_scores,
			version = EXCLUDED.version,
			status = 'pending',
			graded_at = NULL,
			updated_at = EXCLUDED.updated_at
		WHERE scene_evaluation_results.graded_at IS NULL
		RETURNING id
	`, p.TenantID, p.TaskID, sceneID, p.MethodKey, p.EvaluateeID,
		p.EvaluatorID, p.EvaluatorType, p.MaxScore,
		p.EvalPointScores, p.ObjectiveAnswers, p.SubjectiveContent, p.DrawnQuestions, versionArg, now, now).Scan(&id)
	if err == pgx.ErrNoRows {
		// 已被教师评分的结果禁止重交覆盖
		return nil, ErrAlreadyGraded
	}
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Grade 评分（pending→evaluated）。
func (s *EvaluationResultStore) Grade(ctx context.Context, q Queryer, id, graderID string, p *EvaluationResultGradeParams) error {
	tag, err := q.Exec(ctx, `
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
		tag, err := tx.Exec(ctx, `
			UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, status = 'evaluated', graded_at = NOW(), graded_by = $4, updated_at = NOW()
			WHERE id = $5 AND status = 'pending'
		`, item.Score, item.Comment, item.EvalPointScores, graderID, item.ID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			// 该结果不在 pending 状态（已评分/已提交后再次评分）：整体中止并提示，避免对已评分结果静默成功
			return fmt.Errorf("结果 %s 不在待评分状态", item.ID)
		}
	}
	return nil
}

// FindLatestExamResult 查询任务下某测评方式对应的最新考试结果。
// 通过 resource_config 中的 paperId/examId 将考试安排绑定到该方式自身的试卷，
// 避免任务下多个试卷方式（paper/question_bank/quiz）之间互相串用考试结果。
// 注意：live resource_config 在资源改版后可能已变（文档 13.A8），
// 评分回写应优先走 FindExamResultForGrading（按成绩行盖章版本的快照定位）；本函数作为历史数据回退。
func (s *EvaluationResultStore) FindLatestExamResult(ctx context.Context, q Queryer, taskID, methodKey, evaluateeID string) (string, error) {
	var examResultID string
	err := q.QueryRow(ctx, `
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

// FindExamResultForGrading 反向回写链定位考试结果（文档 13.A8）：
// 优先按成绩行（scene_evaluation_results）盖章的 version 对应场景快照中该测评方法的
// resource_config（usageId / paperId / examId）反查 exam_results——不再依赖 live
// resource_config JSON 匹配（资源改版后 live 配置可能已变，找不到/找错对应考试记录）；
// 成绩行未盖章或快照缺档（历史数据）回退原 live JOIN 逻辑；找不到返回空串（调用方容错跳过，不视为错误）。
func (s *EvaluationResultStore) FindExamResultForGrading(ctx context.Context, q Queryer, sceneResultID, taskID, methodKey, evaluateeID string) (string, error) {
	var tenantID, sceneID, version *string
	err := q.QueryRow(ctx, `
		SELECT tenant_id, scene_id, version FROM scene_evaluation_results WHERE id = $1
	`, sceneResultID).Scan(&tenantID, &sceneID, &version)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	if tenantID != nil && sceneID != nil && version != nil && *version != "" {
		data, err := NewSnapshotStore(q).GetSnapshot(ctx, *tenantID, SnapshotResourceScenario, *sceneID, *version)
		if err == nil {
			// 快照存在即以快照为准：定位不到说明学生未经该版本安排交卷，容错不回写
			return s.findExamResultFromSnapshot(ctx, q, data, taskID, methodKey, evaluateeID)
		}
		if err != ErrNotFound {
			return "", err
		}
	}
	return s.FindLatestExamResult(ctx, q, taskID, methodKey, evaluateeID)
}

// scenarioSnapshotMethodDoc 场景快照中测评方法的回写定位字段（jsonb schema 见 snapshot_builders.go 头注释）。
type scenarioSnapshotMethodDoc struct {
	TaskEvaluationMethods []struct {
		TaskID         string          `json:"task_id"`
		MethodKey      string          `json:"method_key"`
		ResourceConfig json.RawMessage `json:"resource_config"`
	} `json:"task_evaluation_methods"`
}

// findExamResultFromSnapshot 按快照内测评方法配置定位考试结果：
// resource_config.usageId 精确反查；缺 usageId 时按 paperId/examId + 任务目标反查；
// 配置中两者皆无（非考试类方式）返回空串。
func (s *EvaluationResultStore) findExamResultFromSnapshot(ctx context.Context, q Queryer, data json.RawMessage, taskID, methodKey, evaluateeID string) (string, error) {
	var doc scenarioSnapshotMethodDoc
	if err := json.Unmarshal(data, &doc); err != nil {
		return "", fmt.Errorf("parse scenario snapshot: %w", err)
	}
	var usageID, examID string
	for _, m := range doc.TaskEvaluationMethods {
		if m.TaskID != taskID || m.MethodKey != methodKey {
			continue
		}
		var cfg struct {
			UsageID string `json:"usageId"`
			PaperID string `json:"paperId"`
			ExamID  string `json:"examId"`
		}
		if err := json.Unmarshal(m.ResourceConfig, &cfg); err != nil {
			continue
		}
		usageID = cfg.UsageID
		examID = cfg.PaperID
		if examID == "" {
			examID = cfg.ExamID
		}
		break
	}
	var id string
	if usageID != "" {
		err := q.QueryRow(ctx, `
			SELECT er.id FROM exam_results er
			WHERE er.exam_usage_id = $1 AND er.user_id = $2
			ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
			LIMIT 1
		`, usageID, evaluateeID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return id, err
	}
	if examID != "" {
		err := q.QueryRow(ctx, `
			SELECT er.id
			FROM exam_results er
			JOIN exam_usages eu ON er.exam_usage_id = eu.id
			WHERE eu.target_type = 'task' AND $1 = ANY(eu.target_ids) AND eu.exam_id = $2 AND er.user_id = $3
			ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
			LIMIT 1
		`, taskID, examID, evaluateeID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return id, err
	}
	return "", nil
}

// UpdateExamResultScore 更新考试结果分数，并同步及格判定（60% 及格线，与提交时一致），
// 同时标记教师评分时间（graded_at 非空即视为已评分，用于重交保护）。
func (s *EvaluationResultStore) UpdateExamResultScore(ctx context.Context, q Queryer, examResultID string, score float64) error {
	_, err := q.Exec(ctx, `UPDATE exam_results SET score = $1, is_pass = ($1 >= total_score * 0.6), graded_at = NOW(), updated_at = NOW() WHERE id = $2`, score, examResultID)
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
						SELECT jsonb_object_agg(hm.key || ':' || mc.key, mc.value)
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
	TenantID string
	TaskID   string
	// SceneID 客户端传值不可信（文档 13.A6）：Submit 内以 task_id 反查 scenario_id 覆盖，此字段仅为兼容保留。
	SceneID *string
	// ExpectedVersion 提交方页面加载时的版本提示（文档 13.B2）：快照存在则采纳，否则回退最新。
	ExpectedVersion   string
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
	var sceneID, comment, gradedBy, evaluatorID, evaluatorType, tenantID, version pgtype.Text
	var totalScore *float64
	var gradedAt *time.Time
	var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content,
			drawn_questions, comment, graded_at, graded_by, version
		FROM scene_evaluation_results WHERE id = $1
	`, id).Scan(
		&res.ID, &tenantID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
		&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
		&drawnQuestions, &comment, &gradedAt, &gradedBy, &version,
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
	if version.Valid {
		res.Version = &version.String
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
		var sceneID, comment, gradedBy, evaluatorID, evaluatorType, version pgtype.Text
		var totalScore *float64
		var gradedAt *time.Time
		var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
		if err := rows.Scan(
			&res.ID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
			&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
			&drawnQuestions, &comment, &gradedAt, &gradedBy, &version,
		); err != nil {
			return nil, err
		}
		if sceneID.Valid {
			res.SceneID = &sceneID.String
		}
		if version.Valid {
			res.Version = &version.String
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
	return items, rows.Err()
}
