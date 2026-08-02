package store

import (
	"context"
	"encoding/json"
	"errors"
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

// UsageExamInfo 查询考试安排的 exam_id 与总分。
func (s *ExamResultStore) UsageExamInfo(ctx context.Context, usageID string) (string, float64, error) {
	var examID string
	var totalScore float64
	err := s.q.QueryRow(ctx, `
		SELECT exam_id,
			COALESCE(
				NULLIF((SELECT total_score FROM exams WHERE id = exam_usages.exam_id), 0),
				(SELECT COALESCE(SUM(score), 0) FROM exam_questions WHERE exam_id = exam_usages.exam_id)
			)
		FROM exam_usages WHERE id = $1
	`, usageID).Scan(&examID, &totalScore)
	return examID, totalScore, err
}

// ExamQuestionAnswer 考试题目答案行。
type ExamQuestionAnswer struct {
	ID     string
	Type   string
	Answer []string
	Score  float64
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
func (s *ExamResultStore) FetchUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	var p UserProfile
	_ = s.q.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&p.Name)
	_ = s.q.QueryRow(ctx, `
		SELECT COALESCE(o.name, '') AS class_name, COALESCE(m.name, '') AS major_name, u.major_id, COALESCE(u.grade, '') AS grade
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = $1
	`, userID).Scan(&p.ClassName, &p.MajorName, &p.MajorID, &p.Grade)
	return &p, nil
}

// SaveResult 写入考试结果（幂等 upsert）。
func (s *ExamResultStore) SaveResult(ctx context.Context, tenantID, usageID, userID string, p *SaveExamResultParams) (*domain.ExamResult, error) {
	var result domain.ExamResult
	var submitTime, createdAt time.Time
	err := s.q.QueryRow(ctx, `
		INSERT INTO exam_results (tenant_id, exam_usage_id, user_id, student_name, class_name, grade, major_id, score, total_score, is_pass, answers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (exam_usage_id, user_id)
		DO UPDATE SET score = EXCLUDED.score, total_score = EXCLUDED.total_score, is_pass = EXCLUDED.is_pass, answers = EXCLUDED.answers, submit_time = NOW()
		RETURNING id, submit_time, created_at
	`, tenantID, usageID, userID, p.StudentName, p.ClassName, p.Grade, p.MajorID, p.Score, p.TotalScore, p.IsPass, p.Answers).Scan(&result.ID, &submitTime, &createdAt)
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
	result.SubmitTime = submitTime
	result.CreatedAt = createdAt
	return &result, nil
}

// SaveExamResultParams 保存考试结果参数。
type SaveExamResultParams struct {
	StudentName string
	ClassName   string
	Grade       string
	MajorID     *string
	Score       float64
	TotalScore  float64
	IsPass      bool
	Answers     domain.JSONMap
}

// SyncCourseEvaluation 同步课程统一评价（考试目标为课程时）。
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
		INSERT INTO course_evaluation_results (tenant_id, course_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (tenant_id, course_id, evaluatee_id, method_key)
		DO UPDATE SET
			total_score = EXCLUDED.total_score,
			max_score = EXCLUDED.max_score,
			status = CASE WHEN course_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
			objective_answers = EXCLUDED.objective_answers,
			graded_at = CASE
				WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.graded_at
				WHEN EXCLUDED.status = 'evaluated' THEN NOW()
				ELSE NULL
			END,
			updated_at = NOW()
	`, tenantID, courseID, methodKey, userID, status, score, maxScore, objectiveAnswers)
	return err
}

// SyncNodeEvaluation 同步节点统一评价（考试目标为节点时）。
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
		INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (tenant_id, node_id, evaluatee_id, method_key)
		DO UPDATE SET
			total_score = EXCLUDED.total_score,
			max_score = EXCLUDED.max_score,
			status = CASE WHEN node_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
			objective_answers = EXCLUDED.objective_answers,
			graded_at = CASE
				WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.graded_at
				WHEN EXCLUDED.status = 'evaluated' THEN NOW()
				ELSE NULL
			END,
			updated_at = NOW()
	`, tenantID, nodeID, methodKey, userID, status, score, maxScore, objectiveAnswers)
	return err
}

// SyncSceneEvaluation 同步场景统一评价（考试目标为任务时）。
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
			INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (tenant_id, task_id, evaluatee_id, method_key)
			DO UPDATE SET
				total_score = EXCLUDED.total_score,
				max_score = EXCLUDED.max_score,
				status = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE EXCLUDED.status END,
				objective_answers = EXCLUDED.objective_answers,
				graded_at = CASE
					WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.graded_at
					WHEN EXCLUDED.status = 'evaluated' THEN NOW()
					ELSE NULL
				END,
				updated_at = NOW()
		`, tenantID, t.scenarioID, t.taskID, methodKey, userID, status, score, maxScore, objectiveAnswers); err != nil {
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
		var answers domain.JSONMap
		if err := rows.Scan(&r.ID, &r.ExamUsageID, &r.UserID, &r.StudentName, &r.ClassName, &r.Grade, &r.MajorID, &r.MajorName, &r.Score, &r.TotalScore, &r.IsPass, &answers, &r.SubmitTime, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Answers = answers
		items = append(items, r)
	}
	return items, nil
}
