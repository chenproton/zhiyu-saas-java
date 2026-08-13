package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CourseStore 课程持久化。
type CourseStore struct {
	q        Queryer
	beginner txBeginner
}

// NewCourseStore 创建课程 store。
func NewCourseStore(q Queryer, beginner txBeginner) *CourseStore {
	return &CourseStore{q: q, beginner: beginner}
}

// List 查询课程列表。
func (s *CourseStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Course]) ([]domain.Course, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanCourseRows)
}

const courseListFrom = "courses c"
const courseListJoins = " LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id LEFT JOIN users cr_u ON cr_u.id = c.creator_id"
const courseListSelectColumns = `c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version, c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name, c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description, c.knowledge_point_ids::text[] AS knowledge_point_ids, c.ability_point_ids::text[] AS ability_point_ids, c.resource_ids::text[] AS resource_ids, c.eval_data, COALESCE(c.creator_id::text, '') AS creator_id, COALESCE(cr_u.name, c.creator_id::text, '') AS creator_name, c.co_creator_ids, c.batch_id, lb.name AS batch_name, COALESCE((SELECT COUNT(*) FROM system_course_nodes scn WHERE scn.course_id = c.id), 0) AS node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count, COALESCE(vc.cnt, 0) AS view_count, c.study_count, c.created_at, c.updated_at`

// ListConfig 返回课程列表查询配置，SQL 片段沉淀在 store 层。
func (s *CourseStore) ListConfig() ListQueryConfig[domain.Course] {
	return ListQueryConfig[domain.Course]{
		Table:         courseListFrom + courseListJoins,
		SelectColumns: courseListSelectColumns,
		TenantScoped:  true,
		TenantColumn:  "c.tenant_id",
		SearchColumns: []string{"c.name", "c.code"},
		SearchParam:   "search",
		OrderBy:       "c.created_at DESC",
		DefaultLimit:  50,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			courseType := p.Values["type"]
			category := p.Values["category"]
			status := p.Values["status"]
			batchID := p.Values["batchId"]
			if courseType != "" {
				qb.AddCondition("c.type = " + qb.NextArg(courseType))
			}
			if category != "" {
				qb.AddCondition("c.category = " + qb.NextArg(category))
			}
			if status != "" {
				qb.AddCondition("c.status = " + qb.NextArg(status))
			}
			if batchID != "" {
				qb.AddCondition("c.batch_id = " + qb.NextArg(batchID))
			}
		},
		ScanRows: ScanCourseRows,
	}
}

// Get 查询单个课程（租户限定）。
func (s *CourseStore) Get(ctx context.Context, id, tenantID string) (*domain.Course, error) {
	c, err := s.fetchCourseScoped(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// GetUnscoped 查询单个课程（不限定租户，供已校验归属后的读取路径使用）。
func (s *CourseStore) GetUnscoped(ctx context.Context, id string) (*domain.Course, error) {
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

// Update 更新课程（含 resource_count 重算，限定租户）。
func (s *CourseStore) Update(ctx context.Context, id, tenantID string, p *CourseUpdateParams) (*domain.Course, error) {
	if _, err := s.fetchCourseScoped(ctx, id, tenantID); err != nil {
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE courses SET name = $1, type = $2, category = $3, major_id = $4, teacher_id = $5,
			industry_id = $6, version = $7, online_hours = $8, offline_hours = $9, online_weight = $10,
			offline_weight = $11, semester = $12, class_name = $13, cover_color = $14, cover_image = $15,
			course_tag = $16, difficulty = $17, description = $18, co_creator_ids = $19, batch_id = $20,
			knowledge_point_ids = $21, ability_point_ids = $22, resource_ids = $23, eval_data = $24,
			resource_count = COALESCE(array_length($23::uuid[], 1), 0), updated_at = NOW()
		WHERE id = $25 AND tenant_id = $26
	`, p.Name, p.Type, p.Category, p.MajorID, p.TeacherID, p.IndustryID, p.Version,
		p.OnlineHours, p.OfflineHours, p.OnlineWeight, p.OfflineWeight, p.Semester, p.ClassName,
		p.CoverColor, p.CoverImage, p.CourseTag, p.Difficulty, p.Description, p.CoCreatorIds, p.BatchID,
		p.KnowledgePointIds, p.AbilityPointIds, p.ResourceIds, p.EvalData, id, tenantID)
	if err != nil {
		return nil, err
	}
	return s.fetchCourseScoped(ctx, id, tenantID)
}

// Delete 删除课程（先解绑引用与清理子表，限定租户；事务内保证原子）。
// 删除保护（文档 5.5）：存在课程/节点测评成绩时拒绝物理删除。
func (s *CourseStore) Delete(ctx context.Context, id, tenantID string) error {
	if _, err := s.fetchCourseScoped(ctx, id, tenantID); err != nil {
		return err
	}
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		var inUse bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM course_evaluation_results WHERE course_id = $1)
				OR EXISTS(
					SELECT 1 FROM node_evaluation_results
					WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = $1)
				)
		`, id).Scan(&inUse); err != nil {
			return err
		}
		if inUse {
			return ErrResourceInUse
		}
		if _, err := tx.Exec(ctx, `UPDATE training_program_courses SET course_id = NULL WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("unbind course from programs: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE teaching_plan_entries SET course_id = NULL WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("unbind course from teaching plans: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE schedule_entries SET course_id = NULL WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("unbind course from schedules: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM course_homework_submissions WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("delete course submissions: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM course_homeworks WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("delete course homeworks: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM course_evaluation_results WHERE course_id = $1`, id); err != nil {
			return fmt.Errorf("delete course eval results: %w", err)
		}
		// 课程级考试安排/作业测评一并清理，防止孤儿 usage 残留；
		// 已有成绩的安排保留（exam_results 经 FK CASCADE 会随安排删除，删除保护兜底）
		if _, err := tx.Exec(ctx, `
			DELETE FROM exam_usages WHERE target_type = 'course' AND $1::uuid = ANY(target_ids)
				AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = exam_usages.id)
		`, id); err != nil {
			return fmt.Errorf("delete course exam usages: %w", err)
		}
		// 从知识点/资源反向引用中移除该课程（granular_lesson_ids）
		if _, err := tx.Exec(ctx, `
			UPDATE knowledge_points SET granular_lesson_ids = array_remove(granular_lesson_ids, $1) WHERE $1::uuid = ANY(granular_lesson_ids)
		`, id); err != nil {
			return fmt.Errorf("unbind course from knowledge points: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM courses WHERE id = $1 AND tenant_id = $2`, id, tenantID); err != nil {
			return err
		}
		return nil
	})
}

// ReplaceCourseBindings 替换课程的知识点/资源绑定表。
func (s *CourseStore) ReplaceCourseBindings(ctx context.Context, courseID, tenantID, userID string, kpIDs, resIDs []string) error {
	if _, err := s.q.Exec(ctx, `DELETE FROM course_knowledge_bindings WHERE course_id = $1`, courseID); err != nil {
		return fmt.Errorf("delete course knowledge bindings: %w", err)
	}
	for _, kpID := range kpIDs {
		if _, err := s.q.Exec(ctx, `
			INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
			VALUES ($1, $2, $3, $4, 'course', $5)
			ON CONFLICT (course_id, knowledge_point_id, bind_type, source_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, kpID, userID); err != nil {
			return fmt.Errorf("insert course knowledge binding: %w", err)
		}
	}
	if _, err := s.q.Exec(ctx, `DELETE FROM course_resource_bindings WHERE course_id = $1`, courseID); err != nil {
		return fmt.Errorf("delete course resource bindings: %w", err)
	}
	for _, resID := range resIDs {
		if _, err := s.q.Exec(ctx, `
			INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (course_id, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, courseID, resID); err != nil {
			return fmt.Errorf("insert course resource binding: %w", err)
		}
	}
	return nil
}

// SyncKnowledgePointGranularLessons 同步知识点与颗粒课引用。
func (s *CourseStore) SyncKnowledgePointGranularLessons(ctx context.Context, tenantID, courseID string, kpIDs []string) error {
	if tenantID == "" {
		return nil
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_append(granular_lesson_ids, $1::uuid),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND id = ANY($3::uuid[]) AND NOT ($1::uuid = ANY(granular_lesson_ids))
	`, courseID, tenantID, kpIDs); err != nil {
		return fmt.Errorf("add granular lesson refs: %w", err)
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE knowledge_points
		SET granular_lesson_ids = array_remove(granular_lesson_ids, $1::uuid),
		    updated_at = NOW()
		WHERE tenant_id = $2 AND ($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))
		  AND $1::uuid = ANY(granular_lesson_ids)
	`, courseID, tenantID, kpIDs); err != nil {
		return fmt.Errorf("remove granular lesson refs: %w", err)
	}
	return nil
}

// CourseCreateParams 创建课程参数。
type CourseCreateParams struct {
	Code              string
	Name              string
	Type              string
	Category          string
	MajorID           *string
	TeacherID         *string
	IndustryID        *string
	Version           *string
	OnlineHours       *float64
	OfflineHours      *float64
	OnlineWeight      *float64
	OfflineWeight     *float64
	Semester          *string
	ClassName         *string
	CoverColor        *string
	CoverImage        *string
	CourseTag         *string
	Difficulty        *int
	Description       *string
	CreatorID         string
	CoCreatorIds      []string
	BatchID           *string
	KnowledgePointIds []string
	AbilityPointIds   []string
	ResourceIds       []string
	EvalData          domain.JSONMap
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
			COALESCE(c.creator_id::text, '') AS creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			COALESCE((SELECT COUNT(*) FROM system_course_nodes scn WHERE scn.course_id = c.id), 0) AS node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
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

// fetchCourseScoped 查询单个课程（限定租户）。
func (s *CourseStore) fetchCourseScoped(ctx context.Context, id, tenantID string) (*domain.Course, error) {
	var c domain.Course
	err := s.q.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version,
			c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name,
			c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description,
			c.knowledge_point_ids::text[] AS knowledge_point_ids,
			c.ability_point_ids::text[] AS ability_point_ids,
			c.resource_ids::text[] AS resource_ids,
			c.eval_data,
			COALESCE(c.creator_id::text, '') AS creator_id, c.co_creator_ids, c.batch_id, lb.name AS batch_name,
			COALESCE((SELECT COUNT(*) FROM system_course_nodes scn WHERE scn.course_id = c.id), 0) AS node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count,
			COALESCE(vc.cnt, 0) AS view_count,
			c.study_count, c.created_at, c.updated_at
		FROM courses c
		LEFT JOIN majors m ON m.id = c.major_id
		LEFT JOIN industries i ON i.id = c.industry_id
		LEFT JOIN lesson_batches lb ON lb.id = c.batch_id
		LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id
		WHERE c.id = $1 AND c.tenant_id = $2
	`, id, tenantID).Scan(
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
			&c.KnowledgePointIds, &c.AbilityPointIds, &c.ResourceIds, &c.EvalData, &c.CreatorID, &c.CreatorName, &c.CoCreatorIds, &c.BatchID, &c.BatchName,
			&c.NodeCount, &c.ResourceCount, &c.ViewCount, &c.StudyCount, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

// ListCourseKnowledgePointNames 查询课程绑定知识点名称（导出用）。
func (s *CourseStore) ListCourseKnowledgePointNames(ctx context.Context, q Queryer, tenantID, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT kp.name FROM knowledge_points kp
		JOIN course_knowledge_bindings cb ON cb.knowledge_point_id = kp.id
		WHERE cb.course_id=$1 AND cb.bind_type='course' AND cb.tenant_id=$2
		ORDER BY kp.name
	`, courseID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	return names
}

// PopulateKnowledgePointNames 为课程补充知识点名称，与 knowledge_point_ids 按序对齐。
// 避免前端依赖全量知识点列表接口（该接口 maxPageSize=200 会截断，导致引用旧知识点的课程预览缺失名称）。
func (s *CourseStore) PopulateKnowledgePointNames(ctx context.Context, items []domain.Course) {
	if len(items) == 0 {
		return
	}
	idSet := make(map[string]struct{})
	for _, it := range items {
		for _, v := range it.KnowledgePointIds {
			id, ok := v.(string)
			if !ok || id == "" || strings.HasPrefix(id, "kp-custom-") {
				continue
			}
			idSet[id] = struct{}{}
		}
	}
	if len(idSet) == 0 {
		return
	}
	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	nameByID := make(map[string]string, len(ids))
	rows, err := s.q.Query(ctx, `SELECT id, name FROM knowledge_points WHERE id = ANY($1)`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		nameByID[id] = name
	}
	for i := range items {
		if len(items[i].KnowledgePointIds) == 0 {
			continue
		}
		names := make(domain.JSONSlice, len(items[i].KnowledgePointIds))
		for j, v := range items[i].KnowledgePointIds {
			id, ok := v.(string)
			if ok {
				names[j] = nameByID[id]
			}
		}
		items[i].KnowledgePointNames = names
	}
}

// PopulateCourseKnowledgePointNames 为单个课程补充知识点名称。
// PopulateKnowledgePointNames 按切片元素原地写入，单课程场景需经此包装避免传入副本导致结果丢失。
func (s *CourseStore) PopulateCourseKnowledgePointNames(ctx context.Context, c *domain.Course) {
	items := []domain.Course{*c}
	s.PopulateKnowledgePointNames(ctx, items)
	c.KnowledgePointNames = items[0].KnowledgePointNames
}

// ListCourseResourceNames 查询课程绑定资源名称（导出用）。
func (s *CourseStore) ListCourseResourceNames(ctx context.Context, q Queryer, tenantID, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT rl.name FROM resource_library rl
		JOIN course_resource_bindings cb ON cb.resource_id = rl.id
		WHERE cb.course_id=$1 AND cb.tenant_id=$2
		ORDER BY rl.name
	`, courseID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			names = append(names, n)
		}
	}
	return names
}
