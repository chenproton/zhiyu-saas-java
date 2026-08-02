package store

import (
	"context"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// JobAbilityResultStore 岗位能力结果持久化。
type JobAbilityResultStore struct {
	q Queryer
}

// NewJobAbilityResultStore 创建岗位能力结果 store。
func NewJobAbilityResultStore(q Queryer) *JobAbilityResultStore {
	return &JobAbilityResultStore{q: q}
}

// JobAbilityResultRow 岗位能力结果行。
type JobAbilityResultRow struct {
	ID                    string
	CareerPositionID      string
	PositionName          string
	UserID                string
	UserName              string
	StudentNo             *string
	ClassName             *string
	MajorID               *string
	MajorName             *string
	TotalAbilityPoints    int
	AchievedAbilityPoints int
	AchievementRate       float64
	Grade                 *string
	EvaluatedAt           time.Time
}

// JobAbilityResultFilter 结果查询过滤。
type JobAbilityResultFilter struct {
	TenantID         string
	CareerPositionID string
	UserID           string
	Grade            string
	Search           string
}

// ListJobAbilityResults 查询岗位能力结果（分页）。
func (s *JobAbilityResultStore) ListJobAbilityResults(ctx context.Context, f JobAbilityResultFilter, limit, offset int) ([]JobAbilityResultRow, int, error) {
	qb := NewListQueryBuilder()
	qb.AddCondition("r.tenant_id = " + qb.NextArg(f.TenantID))
	if f.CareerPositionID != "" {
		qb.AddCondition("r.career_position_id = " + qb.NextArg(f.CareerPositionID))
	}
	if f.UserID != "" {
		qb.AddCondition("r.user_id = " + qb.NextArg(f.UserID))
	}
	if f.Grade != "" {
		qb.AddCondition("r.grade = " + qb.NextArg(f.Grade))
	}
	if f.Search != "" {
		qb.AddCondition("(u.name ILIKE " + qb.NextArg("%"+f.Search+"%") + " OR u.student_no ILIKE " + qb.NextArg("%"+f.Search+"%") + ")")
	}
	where := qb.WhereClause()

	var total int
	if err := s.q.QueryRow(ctx, `
		SELECT COUNT(*) FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE `+where, qb.Args()...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.q.Query(ctx, `
		SELECT r.id, r.career_position_id, COALESCE(cp.name, ''), r.user_id, COALESCE(u.name, ''), u.student_no,
			r.class_name, r.major_id, r.major_name,
			r.total_ability_points, r.achieved_ability_points, r.achievement_rate, r.grade, r.evaluated_at
		FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE `+where+`
		ORDER BY r.evaluated_at DESC
		LIMIT `+itoa(limit)+` OFFSET `+itoa(offset), qb.Args()...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]JobAbilityResultRow, 0)
	for rows.Next() {
		var item JobAbilityResultRow
		if err := rows.Scan(&item.ID, &item.CareerPositionID, &item.PositionName, &item.UserID, &item.UserName, &item.StudentNo,
			&item.ClassName, &item.MajorID, &item.MajorName,
			&item.TotalAbilityPoints, &item.AchievedAbilityPoints, &item.AchievementRate, &item.Grade, &item.EvaluatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

// GetJobAbilityResult 查询单个结果（含明细）。
func (s *JobAbilityResultStore) GetJobAbilityResult(ctx context.Context, id, tenantID string) (*JobAbilityResultRow, *domain.JSONSlice, *domain.JSONSlice, error) {
	var item JobAbilityResultRow
	var details, history domain.JSONSlice
	err := s.q.QueryRow(ctx, `
		SELECT r.id, r.career_position_id, COALESCE(cp.name, ''), r.user_id, COALESCE(u.name, ''), u.student_no,
			r.class_name, r.major_id, r.major_name,
			r.total_ability_points, r.achieved_ability_points, r.achievement_rate, r.grade, r.evaluated_at,
			r.ability_point_details, r.grade_history
		FROM job_ability_results r
		LEFT JOIN users u ON u.id = r.user_id
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.id = $1 AND r.tenant_id = $2
	`, id, tenantID).Scan(&item.ID, &item.CareerPositionID, &item.PositionName, &item.UserID, &item.UserName, &item.StudentNo,
		&item.ClassName, &item.MajorID, &item.MajorName,
		&item.TotalAbilityPoints, &item.AchievedAbilityPoints, &item.AchievementRate, &item.Grade, &item.EvaluatedAt,
		&details, &history)
	if err != nil {
		return nil, nil, nil, err
	}
	return &item, &details, &history, nil
}

// JobAbilitySummaryRow 岗位能力汇总行。
type JobAbilitySummaryRow struct {
	PositionID   string
	PositionName string
	StudentCount int
	AvgRate      float64
}

// Summary 查询岗位能力汇总。
func (s *JobAbilityResultStore) Summary(ctx context.Context, tenantID string) ([]JobAbilitySummaryRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT r.career_position_id, COALESCE(cp.name, ''), COUNT(*), COALESCE(AVG(r.achievement_rate), 0)
		FROM job_ability_results r
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.tenant_id = $1
		GROUP BY r.career_position_id, cp.name
		ORDER BY COUNT(*) DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]JobAbilitySummaryRow, 0)
	for rows.Next() {
		var item JobAbilitySummaryRow
		if err := rows.Scan(&item.PositionID, &item.PositionName, &item.StudentCount, &item.AvgRate); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// JobAbilityAggregateLog 汇聚日志。
type JobAbilityAggregateLog struct {
	ID               string
	CareerPositionID *string
	Status           string
	StudentCount     int
	UpdatedCount     int
	ErrorMessage     *string
	StartedAt        time.Time
	FinishedAt       *time.Time
}

// GetAggregateLogByID 查询汇聚日志。
func (s *JobAbilityResultStore) GetAggregateLogByID(ctx context.Context, logID string) (*JobAbilityAggregateLog, error) {
	var log JobAbilityAggregateLog
	err := s.q.QueryRow(ctx, `
		SELECT id, career_position_id, status, student_count, updated_count, error_message, started_at, finished_at
		FROM job_ability_aggregate_logs
		WHERE id = $1
	`, logID).Scan(&log.ID, &log.CareerPositionID, &log.Status, &log.StudentCount, &log.UpdatedCount, &log.ErrorMessage, &log.StartedAt, &log.FinishedAt)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// GetRecentAggregateLog 查询最近 1 小时汇聚日志。
func (s *JobAbilityResultStore) GetRecentAggregateLog(ctx context.Context, tenantID, positionID string) (*JobAbilityAggregateLog, error) {
	var log JobAbilityAggregateLog
	err := s.q.QueryRow(ctx, `
		SELECT id, career_position_id, status, student_count, updated_count, error_message, started_at, finished_at
		FROM job_ability_aggregate_logs
		WHERE tenant_id = $1 AND career_position_id = $2 AND started_at > NOW() - INTERVAL '1 hour'
		ORDER BY started_at DESC LIMIT 1
	`, tenantID, positionID).Scan(&log.ID, &log.CareerPositionID, &log.Status, &log.StudentCount, &log.UpdatedCount, &log.ErrorMessage, &log.StartedAt, &log.FinishedAt)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// CreateAggregateLog 写入一条 running 状态的汇聚日志并返回 id。
func (s *JobAbilityResultStore) CreateAggregateLog(ctx context.Context, tenantID, careerPositionID string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO job_ability_aggregate_logs (tenant_id, career_position_id, status)
		VALUES ($1, $2, 'running') RETURNING id
	`, tenantID, careerPositionID).Scan(&id)
	return id, err
}

// FinishAggregateLog 更新汇聚日志状态、统计数与错误信息。
func (s *JobAbilityResultStore) FinishAggregateLog(ctx context.Context, logID, status string, studentCount, updatedCount int, errMsg *string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE job_ability_aggregate_logs
		SET status = $1, student_count = $2, updated_count = $3, error_message = $4, finished_at = NOW()
		WHERE id = $5
	`, status, studentCount, updatedCount, errMsg, logID)
	return err
}

// ListCandidateStudents 查询任务集合下所有已评价的学生 ID（去重）。
func (s *JobAbilityResultStore) ListCandidateStudents(ctx context.Context, tenantID string, taskIDs []string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT evaluatee_id FROM scene_evaluation_results
		WHERE tenant_id = $1 AND task_id = ANY($2) AND status = 'evaluated'
		UNION
		SELECT evaluatee_id FROM course_evaluation_results
		WHERE tenant_id = $1 AND course_id = ANY($2) AND status = 'evaluated'
		UNION
		SELECT ner.evaluatee_id
		FROM node_evaluation_results ner
		JOIN system_course_nodes n ON n.id = ner.node_id
		WHERE ner.tenant_id = $1 AND n.course_id = ANY($2) AND ner.status = 'evaluated'
	`, tenantID, taskIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// StudentTaskScore 学生任务得分（已归一化到 0-100）。
type StudentTaskScore struct {
	StudentID string
	TaskID    string
	Score     float64
}

// LoadStudentTaskScores 加载指定学生和任务的归一化最高得分。
func (s *JobAbilityResultStore) LoadStudentTaskScores(ctx context.Context, tenantID string, taskIDs, studentIDs []string) ([]StudentTaskScore, error) {
	rows, err := s.q.Query(ctx, `
		SELECT evaluatee_id, task_id, MAX(score)
		FROM (
			SELECT evaluatee_id, task_id, total_score / NULLIF(max_score, 0) * 100 AS score
			FROM scene_evaluation_results
			WHERE tenant_id = $1 AND task_id = ANY($2) AND evaluatee_id = ANY($3) AND total_score IS NOT NULL AND status = 'evaluated'
			UNION ALL
			SELECT evaluatee_id, course_id AS task_id, total_score / NULLIF(max_score, 0) * 100 AS score
			FROM course_evaluation_results
			WHERE tenant_id = $1 AND course_id = ANY($2) AND evaluatee_id = ANY($3) AND total_score IS NOT NULL AND status = 'evaluated'
			UNION ALL
			SELECT ner.evaluatee_id, n.course_id AS task_id, ner.total_score / NULLIF(ner.max_score, 0) * 100 AS score
			FROM node_evaluation_results ner
			JOIN system_course_nodes n ON n.id = ner.node_id
			WHERE ner.tenant_id = $1 AND n.course_id = ANY($2) AND ner.evaluatee_id = ANY($3) AND ner.total_score IS NOT NULL AND ner.status = 'evaluated'
		) t
		GROUP BY evaluatee_id, task_id
	`, tenantID, taskIDs, studentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StudentTaskScore
	for rows.Next() {
		var item StudentTaskScore
		if err := rows.Scan(&item.StudentID, &item.TaskID, &item.Score); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// JobAbilityResultUpsertParams 岗位能力结果 upsert 参数。
type JobAbilityResultUpsertParams struct {
	TenantID              string
	CareerPositionID      string
	UserID                string
	ClassName             string
	MajorID               *string
	MajorName             string
	TotalAbilityPoints    int
	AchievedAbilityPoints int
	AchievementRate       float64
	Grade                 string
	AbilityPointDetails   []byte
}

// UpsertResult 插入或更新岗位能力结果。
func (s *JobAbilityResultStore) UpsertResult(ctx context.Context, p *JobAbilityResultUpsertParams) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO job_ability_results (
			tenant_id, career_position_id, user_id, class_name, major_id, major_name,
			total_ability_points, achieved_ability_points, achievement_rate, grade,
			ability_point_details, evaluated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (career_position_id, user_id) DO UPDATE SET
			tenant_id = EXCLUDED.tenant_id,
			class_name = EXCLUDED.class_name,
			major_id = EXCLUDED.major_id,
			major_name = EXCLUDED.major_name,
			total_ability_points = EXCLUDED.total_ability_points,
			achieved_ability_points = EXCLUDED.achieved_ability_points,
			achievement_rate = EXCLUDED.achievement_rate,
			grade = EXCLUDED.grade,
			ability_point_details = EXCLUDED.ability_point_details,
			grade_history = CASE
				WHEN job_ability_results.grade IS NOT NULL AND job_ability_results.grade IS DISTINCT FROM EXCLUDED.grade
				THEN job_ability_results.grade_history || jsonb_build_array(jsonb_build_object(
					'grade', job_ability_results.grade,
					'achievementRate', job_ability_results.achievement_rate,
					'evaluatedAt', job_ability_results.evaluated_at))
				ELSE job_ability_results.grade_history
			END,
			evaluated_at = EXCLUDED.evaluated_at
	`, p.TenantID, p.CareerPositionID, p.UserID, p.ClassName, p.MajorID, p.MajorName,
		p.TotalAbilityPoints, p.AchievedAbilityPoints, p.AchievementRate, p.Grade, p.AbilityPointDetails)
	return err
}

// RefreshRanks 同岗位下按达标率刷新班级/专业排名。
func (s *JobAbilityResultStore) RefreshRanks(ctx context.Context, careerPositionID, tenantID string) error {
	_, err := s.q.Exec(ctx, `
		WITH ranked AS (
			SELECT user_id,
				RANK() OVER (PARTITION BY class_name ORDER BY achievement_rate DESC) AS class_rank,
				COUNT(*) OVER (PARTITION BY class_name) AS class_total,
				RANK() OVER (PARTITION BY major_id ORDER BY achievement_rate DESC) AS major_rank,
				COUNT(*) OVER (PARTITION BY major_id) AS major_total
			FROM job_ability_results
			WHERE career_position_id = $1 AND tenant_id = $2
		)
		UPDATE student_ability_portraits p
		SET class_rank = r.class_rank, class_total = r.class_total,
			major_rank = r.major_rank, major_total = r.major_total,
			updated_at = NOW()
		FROM ranked r
		WHERE p.career_position_id = $1 AND p.user_id = r.user_id AND p.tenant_id = $2
	`, careerPositionID, tenantID)
	return err
}
