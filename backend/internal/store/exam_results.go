package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ExamResultStore 考试结果持久化（含课程/节点/场景评价同步）。
type ExamResultStore struct {
	q Queryer
}

// NewExamResultStore 创建考试结果 store。
func NewExamResultStore(q Queryer) *ExamResultStore {
	return &ExamResultStore{q: q}
}

// List 查询考试结果列表。
func (s *ExamResultStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ExamResult]) ([]domain.ExamResult, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanExamResultRows)
}

// ListConfig 返回考试结果列表查询配置，SQL 片段沉淀在 store 层。
func (s *ExamResultStore) ListConfig() ListQueryConfig[domain.ExamResult] {
	return ListQueryConfig[domain.ExamResult]{
		Table:         "exam_results er LEFT JOIN majors m ON m.id = er.major_id",
		SelectColumns: "er.id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id, COALESCE(m.name, '') AS major_name, er.score, er.total_score, er.is_pass, er.answers, er.grading_status, er.grading_scores, er.grading_comment, er.grader_id, er.graded_at, er.submit_time, er.created_at, er.version",
		TenantScoped:  true,
		TenantColumn:  "er.tenant_id",
		OrderBy:       "er.score DESC, er.submit_time ASC",
		ScanRows:      ScanExamResultRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("er.exam_usage_id = " + qb.NextArg(p.Values["usageId"]))
			if uid := p.Values["userId"]; uid != "" {
				qb.AddCondition("er.user_id = " + qb.NextArg(uid))
			}
		},
	}
}

// Get 查询单个考试结果。
func (s *ExamResultStore) Get(ctx context.Context, id string) (*domain.ExamResult, error) {
	rows, err := s.q.Query(ctx, `
		SELECT er.id, er.tenant_id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id,
			COALESCE(m.name, ''), er.score, er.total_score, er.is_pass, er.answers,
			er.grading_status, er.grading_scores, er.grading_comment, er.grader_id, er.graded_at,
			er.submit_time, er.created_at, er.version
		FROM exam_results er
		LEFT JOIN majors m ON m.id = er.major_id
		WHERE er.id = $1
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, ErrNotFound
	}
	var r domain.ExamResult
	var tenantID *string
	if err := rows.Scan(&r.ID, &tenantID, &r.ExamUsageID, &r.UserID, &r.StudentName, &r.ClassName, &r.Grade, &r.MajorID, &r.MajorName, &r.Score, &r.TotalScore, &r.IsPass, &r.Answers, &r.GradingStatus, &r.GradingScores, &r.GradingComment, &r.GraderID, &r.GradedAt, &r.SubmitTime, &r.CreatedAt, &r.Version); err != nil {
		return nil, err
	}
	r.TenantID = tenantID
	return &r, rows.Err()
}

// ResultSubmitted 是否已有提交记录（重复作答控制）。
func (s *ExamResultStore) ResultSubmitted(ctx context.Context, usageID, userID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM exam_results
			WHERE exam_usage_id = $1 AND user_id = $2
		)
	`, usageID, userID).Scan(&exists)
	return exists, err
}

// Grade 教师评分：更新总分/及格/评分状态与逐题分数。
func (s *ExamResultStore) Grade(ctx context.Context, id, graderID string, p *GradeExamResultParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE exam_results SET
			score = $2, is_pass = $3, grading_status = 'evaluated',
			grading_scores = $4, grading_comment = $5, grader_id = $6, graded_at = NOW(),
			updated_at = NOW()
		WHERE id = $1
	`, id, p.Score, p.IsPass, p.GradingScores, p.GradingComment, graderID)
	return err
}

// GradeExamResultParams 教师评分参数。
type GradeExamResultParams struct {
	Score          float64
	IsPass         bool
	GradingScores  domain.JSONMap
	GradingComment *string
}

// ExamUsageTarget 考试安排的目标信息（用于班级可参加校验）。
type ExamUsageTarget struct {
	TargetType *string
	TargetIDs  []string
}

// UsageTarget 查询考试安排目标类型与目标列表。
func (s *ExamResultStore) UsageTarget(ctx context.Context, usageID string) (*ExamUsageTarget, error) {
	var t ExamUsageTarget
	var targetType *string
	err := s.q.QueryRow(ctx, `
		SELECT target_type, target_ids FROM exam_usages WHERE id = $1
	`, usageID).Scan(&targetType, &t.TargetIDs)
	if err != nil {
		return nil, err
	}
	t.TargetType = targetType
	return &t, nil
}

// UsageExamRef 查询考试安排绑定的试卷与固化版本（判分快照化的版本来源，文档 5.4）。
func (s *ExamResultStore) UsageExamRef(ctx context.Context, usageID string) (examID, examVersion string, err error) {
	err = s.q.QueryRow(ctx, `
		SELECT exam_id, COALESCE(exam_version, '') FROM exam_usages WHERE id = $1 AND status <> 'draft'
	`, usageID).Scan(&examID, &examVersion)
	return examID, examVersion, err
}

// FetchExamGradingData 判分数据（题目+总分）读取（文档 5.4/13.A5）：
// examVersion 对应快照存在 → 题目与总分取自快照（exam.total_score 缺省回退快照内题目分值求和）；
// 快照缺档（历史数据兼容，temp exam 已由兜底写快照）→ 回退 live exam_questions / exams.total_score。
func (s *ExamResultStore) FetchExamGradingData(ctx context.Context, tenantID, examID, examVersion string) ([]ExamQuestionAnswer, float64, error) {
	if tenantID != "" && examVersion != "" {
		data, err := NewSnapshotStore(s.q).GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, examVersion)
		if err == nil {
			return parseExamSnapshotGradingData(data)
		}
		if err != ErrNotFound {
			return nil, 0, err
		}
	}
	questions, err := s.FetchExamQuestions(ctx, examID)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.liveExamTotalScore(ctx, examID)
	if err != nil {
		return nil, 0, err
	}
	return questions, total, nil
}

// liveExamTotalScore live 总分：exams.total_score 缺省回退 SUM(exam_questions.score)。
func (s *ExamResultStore) liveExamTotalScore(ctx context.Context, examID string) (float64, error) {
	var total float64
	err := s.q.QueryRow(ctx, `
		SELECT COALESCE(
			NULLIF((SELECT total_score FROM exams WHERE id = $1), 0),
			(SELECT COALESCE(SUM(score), 0) FROM exam_questions WHERE exam_id = $1)
		)
	`, examID).Scan(&total)
	return total, err
}

// examSnapshotGradingDoc 试卷快照判分字段（jsonb schema 见 snapshot_builders.go 头注释）。
type examSnapshotGradingDoc struct {
	Exam struct {
		TotalScore float64 `json:"total_score"`
	} `json:"exam"`
	ExamQuestions []struct {
		ID     string          `json:"id"`
		Type   string          `json:"type"`
		Answer json.RawMessage `json:"answer"`
		Score  float64         `json:"score"`
	} `json:"exam_questions"`
}

// parseExamSnapshotGradingData 从试卷快照 jsonb 解析判分题目与总分。
func parseExamSnapshotGradingData(data json.RawMessage) ([]ExamQuestionAnswer, float64, error) {
	var doc examSnapshotGradingDoc
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, 0, fmt.Errorf("parse exam snapshot: %w", err)
	}
	questions := make([]ExamQuestionAnswer, 0, len(doc.ExamQuestions))
	for _, q := range doc.ExamQuestions {
		questions = append(questions, ExamQuestionAnswer{
			ID:     q.ID,
			Type:   q.Type,
			Answer: parseSnapshotAnswer(q.Answer),
			Score:  q.Score,
		})
	}
	total := doc.Exam.TotalScore
	if total == 0 {
		for _, q := range questions {
			total += q.Score
		}
	}
	return questions, total, nil
}

// parseSnapshotAnswer 解析快照内题目答案：answer 列是 text 存 JSON 字符串，
// to_jsonb 后为 JSON 字符串字面量；兼容直接是 JSON 数组的情况。
func parseSnapshotAnswer(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		var out []string
		_ = json.Unmarshal([]byte(s), &out)
		return out
	}
	var out []string
	_ = json.Unmarshal(raw, &out)
	return out
}

// ExamQuestionAnswer 考试题目答案行。
type ExamQuestionAnswer struct {
	ID     string
	Type   string
	Answer []string
	Score  float64
}

// UsageGradedByUser 查询该考试安排对应的场景评价是否已由教师评分（重交保护）。
// 仅当考试目标为任务且该方式已评分（graded_at 非空）时返回 true；
// 纯客观题自动 evaluated（无 graded_at）不算教师评分，允许重复作答。
func (s *ExamResultStore) UsageGradedByUser(ctx context.Context, usageID, userID, methodKey string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM exam_usages eu
			JOIN task_evaluation_methods tem
				ON tem.task_id = ANY(eu.target_ids) AND tem.method_key = $3
				AND eu.exam_id = COALESCE(
					NULLIF(tem.resource_config->>'paperId', ''),
					NULLIF(tem.resource_config->>'examId', '')
				)::uuid
			JOIN scene_evaluation_results ser ON ser.task_id = tem.task_id AND ser.evaluatee_id = $2 AND ser.method_key = $3
			WHERE eu.id = $1 AND ser.status = 'evaluated' AND ser.graded_at IS NOT NULL
		)
	`, usageID, userID, methodKey).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// ResultTeacherGraded 教师是否已对该考试结果评分（graded_at 非空，重交保护）。
func (s *ExamResultStore) ResultTeacherGraded(ctx context.Context, usageID, userID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM exam_results
			WHERE exam_usage_id = $1 AND user_id = $2 AND graded_at IS NOT NULL
		)
	`, usageID, userID).Scan(&exists)
	return exists, err
}

// UsageAllowRetake 查询考试安排是否允许重复作答。
// 场景任务/课程节点从测评方式配置读取 allowRetake；未配置或手动创建（class 等）默认不允许。
func (s *ExamResultStore) UsageAllowRetake(ctx context.Context, usageID string) (bool, error) {
	var allow bool
	err := s.q.QueryRow(ctx, `
		SELECT COALESCE(
			(
				SELECT (tem.resource_config->>'allowRetake')::boolean
				FROM exam_usages eu
				JOIN task_evaluation_methods tem
					ON tem.task_id = ANY(eu.target_ids)
					AND eu.exam_id = COALESCE(
						NULLIF(tem.resource_config->>'paperId', ''),
						NULLIF(tem.resource_config->>'examId', '')
					)::uuid
				WHERE eu.id = $1 AND eu.target_type = 'task'
					AND tem.resource_config->>'allowRetake' IS NOT NULL
				LIMIT 1
			),
			(
				SELECT (rc.value->>'allowRetake')::boolean
				FROM exam_usages eu
				JOIN system_course_nodes n ON n.id = eu.target_ids[1]
				CROSS JOIN LATERAL jsonb_each(
					COALESCE(n.eval_data->'evalRuleConfig'->'methodResourceConfigs', '{}'::jsonb)
					|| COALESCE((
						SELECT jsonb_object_agg(hm.key || ':' || mc.key, mc.value)
						FROM jsonb_each(COALESCE(n.eval_data->'hybridEvalRules', '{}'::jsonb)) hm
						CROSS JOIN LATERAL jsonb_each(
							COALESCE(hm.value->'evalRuleConfig'->'methodResourceConfigs', '{}'::jsonb)
						) mc
					), '{}'::jsonb)
				) rc
				WHERE eu.id = $1 AND eu.target_type = 'node'
					AND rc.value->>'examId' IS NOT NULL
					AND rc.value->>'examId' = eu.exam_id::text
					AND rc.value->>'allowRetake' IS NOT NULL
				LIMIT 1
			),
			false
		)
	`, usageID).Scan(&allow)
	if err != nil {
		return false, err
	}
	return allow, nil
}

// FetchExamQuestions 查询考试题目答案与分数。
func (s *ExamResultStore) FetchExamQuestions(ctx context.Context, examID string) ([]ExamQuestionAnswer, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, type, answer, score FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order
	`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var questions []ExamQuestionAnswer
	for rows.Next() {
		var q ExamQuestionAnswer
		var answerStr string
		if err := rows.Scan(&q.ID, &q.Type, &answerStr, &q.Score); err != nil {
			return nil, err
		}
		if answerStr != "" {
			_ = json.Unmarshal([]byte(answerStr), &q.Answer)
		}
		questions = append(questions, q)
	}
	return questions, rows.Err()
}

// UserProfile 用户考试身份信息。
type UserProfile struct {
	Name      string
	ClassName string
	Grade     string
	MajorName string
	MajorID   *string
}

// FetchUserProfile 查询用户姓名/班级/专业。
// 姓名查询失败不阻断交卷主链路，仅记录日志便于排障（宁缺名字不断流程）。
func (s *ExamResultStore) FetchUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	var p UserProfile
	if err := s.q.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&p.Name); err != nil {
		slog.Warn("fetch user profile name failed", "userID", userID, "error", err)
	}
	if err := s.q.QueryRow(ctx, `
		SELECT COALESCE(o.name, '') AS class_name, COALESCE(m.name, '') AS major_name, u.major_id
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = $1
	`, userID).Scan(&p.ClassName, &p.MajorName, &p.MajorID); err != nil {
		slog.Warn("fetch user profile class/major failed", "userID", userID, "error", err)
	}
	return &p, nil
}

// SaveResult 写入考试结果（幂等 upsert）。gradingStatus 由服务层按是否有主观题决定。
// 提交固化（文档 5.3）：version 盖章取 exam_usages.exam_version（安排绑定的试卷版本）。
func (s *ExamResultStore) SaveResult(ctx context.Context, tenantID, usageID, userID string, p *SaveExamResultParams) (*domain.ExamResult, error) {
	var result domain.ExamResult
	var submitTime, createdAt time.Time
	err := s.q.QueryRow(ctx, `
		INSERT INTO exam_results (tenant_id, exam_usage_id, user_id, student_name, class_name, grade, major_id, score, total_score, is_pass, answers, grading_status, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, (SELECT exam_version FROM exam_usages WHERE id = $2))
		ON CONFLICT (exam_usage_id, user_id)
		DO UPDATE SET score = EXCLUDED.score, total_score = EXCLUDED.total_score, is_pass = EXCLUDED.is_pass, answers = EXCLUDED.answers, grading_status = EXCLUDED.grading_status, version = EXCLUDED.version, submit_time = NOW()
		WHERE exam_results.graded_at IS NULL
		RETURNING id, submit_time, created_at, version
	`, tenantID, usageID, userID, p.StudentName, p.ClassName, p.Grade, p.MajorID, p.Score, p.TotalScore, p.IsPass, p.Answers, p.GradingStatus).Scan(&result.ID, &submitTime, &createdAt, &result.Version)
	if err == pgx.ErrNoRows {
		// 已被教师评分的结果禁止重交覆盖（重交保护的第二道防线）
		return nil, ErrAlreadyGraded
	}
	if err != nil {
		return nil, err
	}
	result.ExamUsageID = usageID
	result.UserID = userID
	result.StudentName = p.StudentName
	result.ClassName = p.ClassName
	result.Grade = p.Grade
	result.MajorID = p.MajorID
	result.Score = p.Score
	result.TotalScore = p.TotalScore
	result.IsPass = p.IsPass
	result.Answers = p.Answers
	result.GradingStatus = p.GradingStatus
	result.SubmitTime = submitTime
	result.CreatedAt = createdAt
	return &result, nil
}

// SaveExamResultParams 保存考试结果参数。
type SaveExamResultParams struct {
	StudentName   string
	ClassName     string
	Grade         string
	MajorID       *string
	Score         float64
	TotalScore    float64
	IsPass        bool
	Answers       domain.JSONMap
	GradingStatus string
}

// SyncCourseEvaluation 同步课程统一评价（考试目标为课程时）。
// version 盖章（文档 5.3/13.A7）：INSERT 取 exam_usages.exam_version；
// 已评分行 version 不动，未评分行随 EXCLUDED 更新。
func (s *ExamResultStore) SyncCourseEvaluation(ctx context.Context, tenantID, usageID, userID string, score, maxScore float64, objectiveAnswers domain.JSONMap, hasSubjective bool, methodKey string) error {
	if methodKey == "" {
		methodKey = "paper"
	}
	var courseID string
	err := s.q.QueryRow(ctx, `
		SELECT target_ids[1]
		FROM exam_usages
		WHERE id = $1 AND target_type = 'course' AND array_length(target_ids, 1) > 0
	`, usageID).Scan(&courseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	status := "evaluated"
	if hasSubjective {
		status = "pending"
	}
	_, err = s.q.Exec(ctx, `
		INSERT INTO course_evaluation_results (tenant_id, course_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT exam_version FROM exam_usages WHERE id = $9))
		ON CONFLICT (tenant_id, course_id, evaluatee_id, method_key)
		DO UPDATE SET
			total_score = CASE WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.total_score ELSE EXCLUDED.total_score END,
			max_score = EXCLUDED.max_score,
			status = CASE WHEN course_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
			objective_answers = EXCLUDED.objective_answers,
			version = CASE WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.version ELSE EXCLUDED.version END,
			graded_at = CASE
				WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.graded_at
				WHEN EXCLUDED.status = 'evaluated' THEN NOW()
				ELSE NULL
			END,
			updated_at = NOW()
	`, tenantID, courseID, methodKey, userID, status, score, maxScore, objectiveAnswers, usageID)
	return err
}

// SyncNodeEvaluation 同步节点统一评价（考试目标为节点时）。
// version 盖章语义同 SyncCourseEvaluation（文档 5.3/13.A7）。
func (s *ExamResultStore) SyncNodeEvaluation(ctx context.Context, tenantID, usageID, userID string, score, maxScore float64, objectiveAnswers domain.JSONMap, hasSubjective bool, methodKey string) error {
	if methodKey == "" {
		methodKey = "paper"
	}
	var nodeID string
	err := s.q.QueryRow(ctx, `
		SELECT target_ids[1]
		FROM exam_usages
		WHERE id = $1 AND target_type = 'node' AND array_length(target_ids, 1) > 0
	`, usageID).Scan(&nodeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	status := "evaluated"
	if hasSubjective {
		status = "pending"
	}
	_, err = s.q.Exec(ctx, `
		INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT exam_version FROM exam_usages WHERE id = $9))
		ON CONFLICT (tenant_id, node_id, evaluatee_id, method_key)
		DO UPDATE SET
			total_score = CASE WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.total_score ELSE EXCLUDED.total_score END,
			max_score = EXCLUDED.max_score,
			status = CASE WHEN node_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
			objective_answers = EXCLUDED.objective_answers,
			version = CASE WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.version ELSE EXCLUDED.version END,
			graded_at = CASE
				WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.graded_at
				WHEN EXCLUDED.status = 'evaluated' THEN NOW()
				ELSE NULL
			END,
			updated_at = NOW()
	`, tenantID, nodeID, methodKey, userID, status, score, maxScore, objectiveAnswers, usageID)
	return err
}

// SyncSceneEvaluation 同步场景统一评价（考试目标为任务时）。
// version 盖章语义同 SyncCourseEvaluation（文档 5.3/13.A7：已评分行 version 不动，未评分行随 EXCLUDED 更新）。
func (s *ExamResultStore) SyncSceneEvaluation(ctx context.Context, tenantID, usageID, userID string, score, maxScore float64, objectiveAnswers domain.JSONMap, hasSubjective bool, methodKey string) error {
	if methodKey == "" {
		methodKey = "paper"
	}
	rows, err := s.q.Query(ctx, `
		SELECT tem.method_key, tem.task_id, st.scenario_id
		FROM exam_usages eu
		JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)
		JOIN scenario_tasks st ON st.id = tem.task_id
		WHERE eu.id = $1
	`, usageID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	defer rows.Close()
	type syncRow struct {
		methodKey  string
		taskID     string
		scenarioID string
	}
	var targets []syncRow
	for rows.Next() {
		var r syncRow
		if err := rows.Scan(&r.methodKey, &r.taskID, &r.scenarioID); err != nil {
			return err
		}
		targets = append(targets, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	status := "evaluated"
	if hasSubjective {
		status = "pending"
	}
	for _, t := range targets {
		if t.methodKey != methodKey {
			continue
		}
		if _, err := s.q.Exec(ctx, `
			INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT exam_version FROM exam_usages WHERE id = $10))
			ON CONFLICT (tenant_id, task_id, evaluatee_id, method_key)
			DO UPDATE SET
				total_score = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.total_score ELSE EXCLUDED.total_score END,
				max_score = EXCLUDED.max_score,
				status = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
				objective_answers = EXCLUDED.objective_answers,
				version = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.version ELSE EXCLUDED.version END,
				graded_at = CASE
					WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.graded_at
					WHEN EXCLUDED.status = 'evaluated' THEN NOW()
					ELSE NULL
				END,
				updated_at = NOW()
		`, tenantID, t.taskID, t.scenarioID, methodKey, userID, status, score, maxScore, objectiveAnswers, usageID); err != nil {
			return err
		}
	}
	return nil
}

// ScanExamResultRows 扫描考试结果行。
func ScanExamResultRows(rows pgx.Rows) ([]domain.ExamResult, error) {
	var items []domain.ExamResult
	for rows.Next() {
		var r domain.ExamResult
		if err := scanExamResultRow(rows, &r); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// scanExamResultRow 扫描单行考试结果（含评分字段）。
func scanExamResultRow(rows pgx.Rows, r *domain.ExamResult) error {
	var answers, gradingScores domain.JSONMap
	var gradedAt *time.Time
	if err := rows.Scan(&r.ID, &r.ExamUsageID, &r.UserID, &r.StudentName, &r.ClassName, &r.Grade, &r.MajorID, &r.MajorName, &r.Score, &r.TotalScore, &r.IsPass, &answers, &r.GradingStatus, &gradingScores, &r.GradingComment, &r.GraderID, &gradedAt, &r.SubmitTime, &r.CreatedAt, &r.Version); err != nil {
		return err
	}
	r.Answers = answers
	r.GradingScores = gradingScores
	r.GradedAt = gradedAt
	return nil
}
