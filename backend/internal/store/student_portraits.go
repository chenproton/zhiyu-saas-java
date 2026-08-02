package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// StudentPortraitStore 学生画像/档案持久化。
type StudentPortraitStore struct {
	q Queryer
}

// NewStudentPortraitStore 创建学生画像 store。
func NewStudentPortraitStore(q Queryer) *StudentPortraitStore {
	return &StudentPortraitStore{q: q}
}

// ListPortraits 查询学生画像列表。
func (s *StudentPortraitStore) ListPortraits(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.StudentAbilityPortrait]) ([]domain.StudentAbilityPortrait, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanStudentPortraitRows)
}

// GetPortrait 查询单个画像。
func (s *StudentPortraitStore) GetPortrait(ctx context.Context, id, tenantID string) (*domain.StudentAbilityPortrait, error) {
	p, err := s.fetchPortrait(ctx, `WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// GetPortraitByUserPosition 查询用户岗位画像。
func (s *StudentPortraitStore) GetPortraitByUserPosition(ctx context.Context, userID, careerPositionID string) (*domain.StudentAbilityPortrait, error) {
	p, err := s.fetchPortrait(ctx, `WHERE user_id = $1 AND career_position_id = $2`, userID, careerPositionID)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// ListArchives 查询学生档案列表。
func (s *StudentPortraitStore) ListArchives(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.StudentAbilityArchive]) ([]domain.StudentAbilityArchive, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanStudentArchiveRows)
}

// GetArchive 查询单个档案。
func (s *StudentPortraitStore) GetArchive(ctx context.Context, id string) (*domain.StudentAbilityArchive, error) {
	a, err := s.fetchArchive(ctx, id)
	if err != nil {
		return nil, err
	}
	return a, nil
}

// CreateArchive 创建学生档案。
func (s *StudentPortraitStore) CreateArchive(ctx context.Context, p *StudentArchiveCreateParams) (*domain.StudentAbilityArchive, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO student_ability_archives (id, tenant_id, user_id, material_type, material_name, issuing_org, obtain_date,
			audit_status, converted_credit, direction, is_enabled)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', 0, $7, true)
		RETURNING id
	`, p.TenantID, p.UserID, p.MaterialType, p.MaterialName, p.IssuingOrg, p.ObtainDate, p.Direction).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetArchive(ctx, id)
}

// DeleteArchive 删除档案。
func (s *StudentPortraitStore) DeleteArchive(ctx context.Context, id, tenantID string) (bool, error) {
	tag, err := s.q.Exec(ctx, `
		DELETE FROM student_ability_archives WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// StudentArchiveCreateParams 档案参数。
type StudentArchiveCreateParams struct {
	TenantID     string
	UserID       string
	MaterialType *string
	MaterialName string
	IssuingOrg   *string
	ObtainDate   *string
	Direction    *string
}

func (s *StudentPortraitStore) fetchPortrait(ctx context.Context, where string, args ...any) (*domain.StudentAbilityPortrait, error) {
	var p domain.StudentAbilityPortrait
	var overallGrade *string
	var classRank, classTotal, majorRank, majorTotal *int
	var attendanceRate *float64
	var diplomaBadge, dualBadge *string
	err := s.q.QueryRow(ctx, `
		SELECT id, user_id, career_position_id, overall_grade, domain_scores,
			class_rank, class_total, major_rank, major_total, recommend_positions, updated_at,
			completed_courses, completed_scenes, total_credits, archive_count, course_records,
			graduation_qualified, attendance_rate, diploma_badge, dual_badge
		FROM student_ability_portraits `+where+`
	`, args...).Scan(
		&p.ID, &p.UserID, &p.CareerPositionID, &overallGrade, &p.DomainScores,
		&classRank, &classTotal, &majorRank, &majorTotal, &p.RecommendPositions, &p.UpdatedAt,
		&p.CompletedCourses, &p.CompletedScenes, &p.TotalCredits, &p.ArchiveCount, &p.CourseRecords,
		&p.GraduationQualified, &attendanceRate, &diplomaBadge, &dualBadge,
	)
	if err != nil {
		return nil, err
	}
	p.OverallGrade = overallGrade
	p.ClassRank = classRank
	p.ClassTotal = classTotal
	p.MajorRank = majorRank
	p.MajorTotal = majorTotal
	p.AttendanceRate = attendanceRate
	p.DiplomaBadge = diplomaBadge
	p.DualBadge = dualBadge
	return &p, nil
}

func (s *StudentPortraitStore) fetchArchive(ctx context.Context, id string) (*domain.StudentAbilityArchive, error) {
	var a domain.StudentAbilityArchive
	var issuingOrg, obtainDate, level, remark *string
	err := s.q.QueryRow(ctx, `
		SELECT id, user_id, material_type, material_name, issuing_org, obtain_date,
			level, audit_status, audit_remark, converted_credit, direction, is_enabled, created_at
		FROM student_ability_archives WHERE id = $1
	`, id).Scan(
		&a.ID, &a.UserID, &a.MaterialType, &a.MaterialName, &issuingOrg, &obtainDate,
		&level, &a.AuditStatus, &remark, &a.ConvertedCredit, &a.Direction, &a.IsEnabled, &a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	a.IssuingOrg = issuingOrg
	a.ObtainDate = obtainDate
	a.Level = level
	a.AuditRemark = remark
	return &a, nil
}

// ScanStudentPortraitRows 扫描画像行。
func ScanStudentPortraitRows(rows pgx.Rows) ([]domain.StudentAbilityPortrait, error) {
	items := make([]domain.StudentAbilityPortrait, 0)
	for rows.Next() {
		var p domain.StudentAbilityPortrait
		var overallGrade *string
		var classRank, classTotal, majorRank, majorTotal *int
		var attendanceRate *float64
		var diplomaBadge, dualBadge *string
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.CareerPositionID, &overallGrade, &p.DomainScores,
			&classRank, &classTotal, &majorRank, &majorTotal, &p.RecommendPositions, &p.UpdatedAt,
			&p.CompletedCourses, &p.CompletedScenes, &p.TotalCredits, &p.ArchiveCount, &p.CourseRecords,
			&p.GraduationQualified, &attendanceRate, &diplomaBadge, &dualBadge,
		); err != nil {
			return nil, err
		}
		p.OverallGrade = overallGrade
		p.ClassRank = classRank
		p.ClassTotal = classTotal
		p.MajorRank = majorRank
		p.MajorTotal = majorTotal
		p.AttendanceRate = attendanceRate
		p.DiplomaBadge = diplomaBadge
		p.DualBadge = dualBadge
		items = append(items, p)
	}
	return items, nil
}

// ScanStudentArchiveRows 扫描档案行。
func ScanStudentArchiveRows(rows pgx.Rows) ([]domain.StudentAbilityArchive, error) {
	items := make([]domain.StudentAbilityArchive, 0)
	for rows.Next() {
		var a domain.StudentAbilityArchive
		var issuingOrg, obtainDate, level, remark *string
		if err := rows.Scan(&a.ID, &a.UserID, &a.MaterialType, &a.MaterialName, &issuingOrg, &obtainDate,
			&level, &a.AuditStatus, &remark, &a.ConvertedCredit, &a.Direction, &a.IsEnabled, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.IssuingOrg = issuingOrg
		a.ObtainDate = obtainDate
		a.Level = level
		a.AuditRemark = remark
		items = append(items, a)
	}
	return items, nil
}

// RecommendPosition 画像推荐岗位。
type RecommendPosition struct {
	PositionID   string  `json:"positionId"`
	PositionName string  `json:"positionName"`
	MatchRate    float64 `json:"matchRate"`
	Grade        string  `json:"grade,omitempty"`
}

// StudentPortraitUpsertParams 学生画像 upsert 参数。
type StudentPortraitUpsertParams struct {
	TenantID           string
	UserID             string
	CareerPositionID   string
	OverallGrade       string
	DomainScores       []byte
	RecommendPositions []byte
}

// FetchRecommendPositions 取该用户所有岗位汇聚结果按达标率排序的前 3 名。
func (s *StudentPortraitStore) FetchRecommendPositions(ctx context.Context, userID string) ([]RecommendPosition, error) {
	rows, err := s.q.Query(ctx, `
		SELECT r.career_position_id, COALESCE(cp.name, ''), r.achievement_rate, COALESCE(r.grade, '')
		FROM job_ability_results r
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.user_id = $1
		ORDER BY r.achievement_rate DESC
		LIMIT 3
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]RecommendPosition, 0)
	for rows.Next() {
		var p RecommendPosition
		if err := rows.Scan(&p.PositionID, &p.PositionName, &p.MatchRate, &p.Grade); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// UpsertPortrait 插入或更新学生画像。
func (s *StudentPortraitStore) UpsertPortrait(ctx context.Context, p *StudentPortraitUpsertParams) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO student_ability_portraits (
			tenant_id, user_id, career_position_id, overall_grade,
			domain_scores, recommend_positions, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (user_id, career_position_id) DO UPDATE SET
			tenant_id = EXCLUDED.tenant_id,
			overall_grade = EXCLUDED.overall_grade,
			domain_scores = EXCLUDED.domain_scores,
			recommend_positions = EXCLUDED.recommend_positions,
			updated_at = EXCLUDED.updated_at
	`, p.TenantID, p.UserID, p.CareerPositionID, p.OverallGrade, p.DomainScores, p.RecommendPositions)
	return err
}
