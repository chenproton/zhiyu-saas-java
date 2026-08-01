package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
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

var _ = pgx.ErrNoRows
