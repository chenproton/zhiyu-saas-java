package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CourseStore 课程持久化。
type CourseStore struct {
	q Queryer
}

// NewCourseStore 创建课程 store。
func NewCourseStore(q Queryer) *CourseStore {
	return &CourseStore{q: q}
}

// List 查询课程列表。
func (s *CourseStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Course]) ([]domain.Course, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanCourseRows)
}

// Get 查询单个课程。
func (s *CourseStore) Get(ctx context.Context, id string) (*domain.Course, error) {
	c, err := s.fetchCourse(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Create 创建课程。
func (s *CourseStore) Create(ctx context.Context, tenantID string, p *CourseCreateParams) (*domain.Course, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17, $18, $19, $20, $21, $22, $23::uuid[], $24, $25::uuid[], $26::uuid[], $27::uuid[], $28, 0, 0, 0)
	`, id, tenantID, p.Code, p.Name, p.Type, p.Category, p.MajorID, p.TeacherID, p.IndustryID, p.Version,
		p.OnlineHours, p.OfflineHours, p.OnlineWeight, p.OfflineWeight, p.Semester, p.ClassName,
		p.CoverColor, p.CoverImage, p.CourseTag, p.Difficulty, p.Description, p.CreatorID, p.CoCreatorIds, p.BatchID,
		p.KnowledgePointIds, p.AbilityPointIds, p.ResourceIds, p.EvalData)
	if err != nil {
		return nil, err
	}
	return s.fetchCourse(ctx, id)
}

// Update 更新课程（含 resource_count 重算）。
func (s *CourseStore) Update(ctx context.Context, id string, p *CourseUpdateParams) (*domain.Course, error) {
	if _, err := s.fetchCourse(ctx, id); err != nil {
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE courses SET name = $1, type = $2, category = $3, major_id = $4, teacher_id = $5,
			industry_id = $6, version = $7, online_hours = $8, offline_hours = $9, online_weight = $10,
			offline_weight = $11, semester = $12, class_name = $13, cover_color = $14, cover_image = $15,
			course_tag = $16, difficulty = $17, description = $18, co_creator_ids = $19, batch_id = $20,
			knowledge_point_ids = $21, ability_point_ids = $22, resource_ids = $23, eval_data = $24,
			resource_count = COALESCE(array_length($23::uuid[], 1), 0), updated_at = NOW()
		WHERE id = $25
	`, p.Name, p.Type, p.Category, p.MajorID, p.TeacherID, p.IndustryID, p.Version,
		p.OnlineHours, p.OfflineHours, p.OnlineWeight, p.OfflineWeight, p.Semester, p.ClassName,
		p.CoverColor, p.CoverImage, p.CourseTag, p.Difficulty, p.Description, p.CoCreatorIds, p.BatchID,
		p.KnowledgePointIds, p.AbilityPointIds, p.ResourceIds, p.EvalData, id)
	if err != nil {
		return nil, err
	}
	return s.fetchCourse(ctx, id)
}

// Delete 删除课程（先解绑引用与清理子表）。
func (s *CourseStore) Delete(ctx context.Context, id string) error {
	_, _ = s.q.Exec(ctx, `UPDATE training_program_courses SET course_id = NULL WHERE course_id = $1`, id)
	_, _ = s.q.Exec(ctx, `UPDATE teaching_plan_entries SET course_id = NULL WHERE course_id = $1`, id)
	_, _ = s.q.Exec(ctx, `UPDATE schedule_entries SET course_id = NULL WHERE course_id = $1`, id)
	_, _ = s.q.Exec(ctx, `DELETE FROM course_homework_submissions WHERE course_id = $1`, id)
	_, _ = s.q.Exec(ctx, `DELETE FROM course_homeworks WHERE course_id = $1`, id)
	_, _ = s.q.Exec(ctx, `DELETE FROM course_evaluation_results WHERE course_id = $1`, id)
	_, err := s.q.Exec(ctx, `DELETE FROM courses WHERE id = $1`, id)
	return err
}

// ReplaceCourseBindings 替换课程的知识点/资源绑定表。
func (s *CourseStore) ReplaceCourseBindings(ctx context.Context, courseID, tenantID, userID string, kpIDs, resIDs []string) {
	_, _ = s.q.Exec(ctx, `DELETE FROM course_knowledge_bindings WHERE course_id = $1`, courseID)
	for _, kpID := range kpIDs {
		_, _ = s.q.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1, $2, $3, $4, 'course', $5)
			ON CONFLICT (course_id, knowledge_point_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, kpID, userID)
	}
	_, _ = s.q.Exec(ctx, `DELETE FROM course_resource_bindings WHERE course_id = $1`, courseID)
	for _, resID := range resIDs {
		_, _ = s.q.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (course_id, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, resID)
	}
}

// SyncKnowledgePointGranularLessons 同步知识点与颗粒课引用。
func (s *CourseStore) SyncKnowledgePointGranularLessons(ctx context.Context, tenantID, courseID string, kpIDs []string) {
	if tenantID == "" {
		return
	}
	_, _ = s.q.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_append(granular_lesson_ids, $1::text),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT ($1::text = ANY(granular_lesson_ids))
	`, courseID, tenantID, kpIDs)
	_, _ = s.q.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_remove(granular_lesson_ids, $1::text),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1::text = ANY(granular_lesson_ids)
	`, courseID, tenantID, kpIDs)
}

// CourseCreateParams 创建课程参数。
type CourseCreateParams struct {
	Code               string
	Name               string
	Type               string
	Category           string
	MajorID            *string
	TeacherID          *string
	IndustryID         *string
	Version            *string
	OnlineHours        *float64
	OfflineHours       *float64
	OnlineWeight       *float64
	OfflineWeight      *float64
	Semester           *string
	ClassName          *string
	CoverColor         *string
	CoverImage         *string
	CourseTag          *string
	Difficulty         *int
	Description        *string
	CreatorID          string
	CoCreatorIds       []string
	BatchID            *string
	KnowledgePointIds  []string
	AbilityPointIds    []string
	ResourceIds        []string
	EvalData           domain.JSONMap
}

// CourseUpdateParams 更新课程参数。
type CourseUpdateParams = CourseCreateParams

func (s *CourseStore) fetchCourse(ctx context.Context, id string) (*domain.Course, error) {
	var c domain.Course
	err := s.q.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description,
			c.knowledge_point_ids::text[] AS knowledge_point_ids,
			c.ability_point_ids::text[] AS ability_point_ids,
			c.resource_ids::text[] AS resource_ids,
			c.eval_data,
			c.creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			c.node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			COALESCE(vc.cnt, 0) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id
		WHERE c.id = $1
	`, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
		&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
		&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
		&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
		&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ScanCourseRows 扫描课程行。
func ScanCourseRows(rows pgx.Rows) ([]domain.Course, error) {
	items := make([]domain.Course, 0)
	for rows.Next() {
		var c domain.Course
		if err := rows.Scan(
			&c.ID, &c.Code, &c.Name, &c.Type, &c.Category, &c.MajorID, &c.MajorName, &c.TeacherID, &c.IndustryID, &c.IndustryName, &c.Version,
			&c.OnlineHours, &c.OfflineHours, &c.OnlineWeight, &c.OfflineWeight, &c.Semester, &c.ClassName,
			&c.Status, &c.CoverColor, &c.CoverImage, &c.CourseTag, &c.Difficulty, &c.Description,
			&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
			&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, nil
}
