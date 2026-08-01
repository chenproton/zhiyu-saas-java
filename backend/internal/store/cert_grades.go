package store

import (
	"context"
)

// CertGradeStore 岗位等级认证数据持久化（只读聚合）。
type CertGradeStore struct {
	q Queryer
}

// NewCertGradeStore 创建岗位等级认证 store。
func NewCertGradeStore(q Queryer) *CertGradeStore {
	return &CertGradeStore{q: q}
}

// PositionTenantID 查询岗位所属租户。
func (s *CertGradeStore) PositionTenantID(ctx context.Context, positionID string) (string, error) {
	var tenantID string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM career_positions WHERE id = $1`, positionID).Scan(&tenantID)
	return tenantID, err
}

// CertGradeRow 认证等级数据行。
type CertGradeRow struct {
	ID                 string
	PositionID         string
	GradeYear          int
	TotalAbilityPoints int
	AvgAchievementRate *float64
	LastUpdated        *string
}

// ListGrades 查询岗位认证等级数据（按年份倒序）。
func (s *CertGradeStore) ListGrades(ctx context.Context, positionID string) ([]CertGradeRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, position_id, grade_year, total_ability_points, avg_achievement_rate, last_updated
		FROM certification_grade_data
		WHERE position_id = $1
		ORDER BY grade_year DESC
	`, positionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var grades []CertGradeRow
	for rows.Next() {
		var g CertGradeRow
		var lu *string
		if err := rows.Scan(&g.ID, &g.PositionID, &g.GradeYear, &g.TotalAbilityPoints, &g.AvgAchievementRate, &lu); err != nil {
			continue
		}
		g.LastUpdated = lu
		grades = append(grades, g)
	}
	return grades, rows.Err()
}

// CompRequirement 能力要求行。
type CompRequirement struct {
	GradeDataID  string
	DutyName     string
	ItemName     string
	TargetLevel  int
	CurrentLevel int
	Description  string
	SortOrder    int
}

// ListCompRequirements 查询能力要求（按 grade_data 与 sort_order）。
func (s *CertGradeStore) ListCompRequirements(ctx context.Context, gradeIDs []string) ([]CompRequirement, error) {
	rows, err := s.q.Query(ctx, `
		SELECT grade_data_id, duty_name, item_name, target_level, current_level,
			COALESCE(description, ''), sort_order
		FROM certification_competency_requirements
		WHERE grade_data_id = ANY($1)
		ORDER BY grade_data_id, sort_order
	`, gradeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CompRequirement
	for rows.Next() {
		var c CompRequirement
		if err := rows.Scan(&c.GradeDataID, &c.DutyName, &c.ItemName, &c.TargetLevel, &c.CurrentLevel, &c.Description, &c.SortOrder); err == nil {
			items = append(items, c)
		}
	}
	return items, rows.Err()
}

// LeaderboardEntry 排行榜行。
type LeaderboardEntry struct {
	GradeDataID     string
	StudentName     string
	ClassName       string
	MajorName       string
	AchievementRate float64
	GradeLabel      string
	SortOrder       int
	UserID          string
}

// ListLeaderboard 查询排行榜（按 grade_data 与 sort_order）。
func (s *CertGradeStore) ListLeaderboard(ctx context.Context, gradeIDs []string) ([]LeaderboardEntry, error) {
	rows, err := s.q.Query(ctx, `
		SELECT cgl.grade_data_id, cgl.student_name, COALESCE(cgl.class_name, ''), COALESCE(m.name, '') AS major_name,
			COALESCE(cgl.achievement_rate, 0), COALESCE(cgl.grade_label, ''), cgl.sort_order, cgl.user_id
		FROM certification_grade_leaderboard cgl
		LEFT JOIN majors m ON m.id = cgl.major_id
		WHERE cgl.grade_data_id = ANY($1)
		ORDER BY cgl.grade_data_id, cgl.sort_order
	`, gradeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []LeaderboardEntry
	for rows.Next() {
		var l LeaderboardEntry
		if err := rows.Scan(&l.GradeDataID, &l.StudentName, &l.ClassName, &l.MajorName, &l.AchievementRate, &l.GradeLabel, &l.SortOrder, &l.UserID); err == nil {
			items = append(items, l)
		}
	}
	return items, rows.Err()
}
