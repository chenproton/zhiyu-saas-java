package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TeachingPlanStore 教学计划持久化。
type TeachingPlanStore struct {
	q Queryer
}

// NewTeachingPlanStore 创建教学计划 store。
func NewTeachingPlanStore(q Queryer) *TeachingPlanStore {
	return &TeachingPlanStore{q: q}
}

// ProgramBrief 人培方案简要。
type ProgramBrief struct {
	ID        string
	MajorID   *string
	EntryYear *int
}

// TermWeeks 查询学期周数。
func (s *TeachingPlanStore) TermWeeks(ctx context.Context, id, tenantID string) (int, error) {
	var weeks int
	err := s.q.QueryRow(ctx, `SELECT weeks_count FROM terms WHERE id = $1 AND tenant_id = $2`, id, tenantID).Scan(&weeks)
	return weeks, err
}

// FetchProgramBrief 查询人培方案简要。
func (s *TeachingPlanStore) FetchProgramBrief(ctx context.Context, id, tenantID string) (*ProgramBrief, error) {
	var b ProgramBrief
	err := s.q.QueryRow(ctx, `
		SELECT id, major_id, entry_year FROM training_programs WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&b.ID, &b.MajorID, &b.EntryYear)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// PlanCourse 方案课程行。
type PlanCourse struct {
	CourseID   *string
	Name       string
	Code       *string
	PositionID *string
	Nature     *string
	Credits    float64
	Hours      int
}

// FetchProgramCourses 查询方案课程。
func (s *TeachingPlanStore) FetchProgramCourses(ctx context.Context, programID string) ([]PlanCourse, error) {
	rows, err := s.q.Query(ctx, `
		SELECT pc.course_id, pc.name, pc.code, pc.position_id, pc.nature, pc.credits, pc.hours
		FROM training_program_courses pc
		WHERE pc.program_id = $1
		ORDER BY pc.sort_order, pc.id
	`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PlanCourse
	for rows.Next() {
		var c PlanCourse
		if err := rows.Scan(&c.CourseID, &c.Name, &c.Code, &c.PositionID, &c.Nature, &c.Credits, &c.Hours); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

// ScenarioBrief 场景简要。
type ScenarioBrief struct {
	ID   string
	Name string
	Code *string
}

// FetchProgramClasses 查询人培方案关联专业在组织树中的全部班级节点。
// 匹配规则：组织树中类型为「专业」且名称与 majors 表一致的组织节点，取其下所有「班级」子节点。
func (s *TeachingPlanStore) FetchProgramClasses(ctx context.Context, tenantID, majorID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		WITH RECURSIVE major_org AS (
			SELECT o.id
			FROM organizations o
			JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
			WHERE o.tenant_id = $1 AND t.name = '专业'
			  AND o.name = (SELECT name FROM majors WHERE id = $2)
		),
		org_tree AS (
			SELECT o.id, o.type_id
			FROM organizations o
			JOIN major_org mo ON mo.id = o.id
			UNION ALL
			SELECT o.id, o.type_id
			FROM organizations o
			JOIN org_tree c ON c.id = o.parent_id
		)
		SELECT DISTINCT ot.id
		FROM org_tree ot
		JOIN organizations o ON o.id = ot.id
		JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
		WHERE t.name = '班级'
	`, tenantID, majorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		items = append(items, id)
	}
	return items, rows.Err()
}

// FetchPositionScenarios 查询岗位已发布场景。
func (s *TeachingPlanStore) FetchPositionScenarios(ctx context.Context, positionID string) ([]ScenarioBrief, error) {
	rows, err := s.q.Query(ctx, `SELECT id, name, code FROM scenarios WHERE career_position_id=$1 AND status='published'`, positionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ScenarioBrief
	for rows.Next() {
		var item ScenarioBrief
		if err := rows.Scan(&item.ID, &item.Name, &item.Code); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// FindExistingPlan 查询已有计划（生成校验）。
func (s *TeachingPlanStore) FindExistingPlan(ctx context.Context, programID, termID, tenantID string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		SELECT p.id FROM teaching_plans p
		WHERE p.program_id = $1 AND p.term_id = $2 AND p.tenant_id = $3
	`, programID, termID, tenantID).Scan(&id)
	return id, err
}

// ScheduledEntryCount 查询计划已排课条目数。
func (s *TeachingPlanStore) ScheduledEntryCount(ctx context.Context, planID string) (int, error) {
	var count int
	err := s.q.QueryRow(ctx, `
		SELECT COUNT(*) FROM teaching_plan_entries e
		JOIN schedule_entries se ON se.plan_entry_id = e.id
		WHERE e.plan_id = $1
	`, planID).Scan(&count)
	return count, err
}

// GeneratePlan 生成教学计划（事务：删旧+建计划+批量插入条目）。
func (s *TeachingPlanStore) GeneratePlan(ctx context.Context, tx Queryer, p *GeneratePlanParams, courses []PlanCourse, posScenMap map[string][]ScenarioBrief, weeksCount int) (string, error) {
	planID := uuid.NewString()
	if _, err := tx.Exec(ctx, `
		DELETE FROM teaching_plans WHERE program_id = $1 AND term_id = $2 AND tenant_id = $3
	`, p.ProgramID, p.TermID, p.TenantID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO teaching_plans (id, tenant_id, program_id, term_id, major_id, entry_year, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
	`, planID, p.TenantID, p.ProgramID, p.TermID, p.MajorID, p.EntryYear, p.CreatedBy); err != nil {
		return "", err
	}

	for _, c := range courses {
		entryType := "traditional"
		if c.PositionID != nil && *c.PositionID != "" {
			entryType = "scene"
		}
		weekHours := 0
		if c.Hours > 0 && weeksCount > 0 {
			weekHours = (c.Hours + weeksCount - 1) / weeksCount
		}
		if c.PositionID != nil && *c.PositionID != "" {
			for _, sc := range posScenMap[*c.PositionID] {
				entryID := uuid.NewString()
				if _, err := tx.Exec(ctx, `
					INSERT INTO teaching_plan_entries (id, plan_id, course_name, course_code, type, nature, credits, total_hours, week_hours, start_week, end_week, week_pattern, scenario_id, course_id, status)
					VALUES ($1, $2, $3, $4, 'scene', $5, $6, $7, $8, 1, $9, 'all', $10, $11, 'planned')
				`, entryID, planID, sc.Name, sc.Code, c.Nature,
					c.Credits, c.Hours, weekHours, weeksCount, sc.ID, c.CourseID); err != nil {
					return "", err
				}
				if err := insertEntryClasses(ctx, tx, entryID, p.ClassNodeIDs); err != nil {
					return "", err
				}
			}
		} else {
			entryID := uuid.NewString()
			if _, err := tx.Exec(ctx, `
				INSERT INTO teaching_plan_entries (id, plan_id, course_name, course_code, type, nature, credits, total_hours, week_hours, start_week, end_week, week_pattern, scenario_id, course_id, status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, 'all', $11, $12, 'planned')
			`, entryID, planID, c.Name, c.Code, entryType, c.Nature,
				c.Credits, c.Hours, weekHours, weeksCount, (*string)(nil), c.CourseID); err != nil {
				return "", err
			}
			if err := insertEntryClasses(ctx, tx, entryID, p.ClassNodeIDs); err != nil {
				return "", err
			}
		}
	}
	return planID, nil
}

// insertEntryClasses 为教学计划条目写入班级关联。
func insertEntryClasses(ctx context.Context, tx Queryer, entryID string, classNodeIDs []string) error {
	for _, cid := range classNodeIDs {
		if cid == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO teaching_plan_entry_classes (entry_id, class_node_id) VALUES ($1, $2)
		`, entryID, cid); err != nil {
			return err
		}
	}
	return nil
}

// GeneratePlanParams 生成参数。
type GeneratePlanParams struct {
	TenantID     string
	ProgramID    string
	TermID       string
	MajorID      *string
	EntryYear    *int
	CreatedBy    *string
	ClassNodeIDs []string
}

// List 查询教学计划列表。
func (s *TeachingPlanStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.TeachingPlan]) ([]domain.TeachingPlan, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanTeachingPlanRows)
}

// ListConfig 返回教学计划列表查询配置，SQL 片段沉淀在 store 层。
func (s *TeachingPlanStore) ListConfig() ListQueryConfig[domain.TeachingPlan] {
	return ListQueryConfig[domain.TeachingPlan]{
		Table:         "teaching_plans p LEFT JOIN training_programs tp ON tp.id = p.program_id LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN majors m ON m.id = p.major_id LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN affairs_batches ab ON ab.id = p.batch_id",
		SelectColumns: "p.id, p.program_id, COALESCE(tp.name, '') AS program_name, p.term_id, COALESCE(t.name, '') AS term_name, p.major_id, COALESCE(m.name, '') AS major_name, p.entry_year, p.status, (SELECT COUNT(*) FROM teaching_plan_entries e WHERE e.plan_id = p.id) AS entry_count, p.generated_at, p.confirmed_at, p.created_by, COALESCE(cu.name, '') AS created_by_name, p.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(p.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, p.batch_id, COALESCE(ab.name, '') AS batch_name, p.updated_at",
		TenantScoped:  true,
		TenantColumn:  "p.tenant_id",
		OrderBy:       "p.generated_at DESC",
		ScanRows:      ScanTeachingPlanRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("p.status = " + qb.NextArg(status))
			}
			if programID := p.Values["programId"]; programID != "" {
				qb.AddCondition("p.program_id = " + qb.NextArg(programID))
			}
			if termID := p.Values["termId"]; termID != "" {
				qb.AddCondition("p.term_id = " + qb.NextArg(termID))
			}
		},
	}
}

// Get 查询单个教学计划。
func (s *TeachingPlanStore) Get(ctx context.Context, id, tenantID string) (*domain.TeachingPlan, error) {
	var plan domain.TeachingPlan
	err := s.q.QueryRow(ctx, teachingPlanSelectSQL+` WHERE p.id = $1 AND p.tenant_id = $2`, id, tenantID).
		Scan(&plan.ID, &plan.ProgramID, &plan.ProgramName, &plan.TermID, &plan.TermName, &plan.MajorID, &plan.MajorName,
			&plan.EntryYear, &plan.Status, &plan.EntryCount, &plan.GeneratedAt, &plan.ConfirmedAt,
			&plan.CreatedBy, &plan.CreatedByName, &plan.Collaborators, &plan.CollaboratorNames,
			&plan.BatchID, &plan.BatchName, &plan.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

// GetByID 按 ID 查询单个教学计划（不限定租户，供内容动作流转后回查使用）。
func (s *TeachingPlanStore) GetByID(ctx context.Context, id string) (*domain.TeachingPlan, error) {
	var plan domain.TeachingPlan
	err := s.q.QueryRow(ctx, teachingPlanSelectSQL+` WHERE p.id = $1`, id).
		Scan(&plan.ID, &plan.ProgramID, &plan.ProgramName, &plan.TermID, &plan.TermName, &plan.MajorID, &plan.MajorName,
			&plan.EntryYear, &plan.Status, &plan.EntryCount, &plan.GeneratedAt, &plan.ConfirmedAt,
			&plan.CreatedBy, &plan.CreatedByName, &plan.Collaborators, &plan.CollaboratorNames,
			&plan.BatchID, &plan.BatchName, &plan.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

const teachingPlanSelectSQL = `
	SELECT p.id, p.program_id, COALESCE(tp.name, ''), p.term_id, COALESCE(t.name, ''), p.major_id, COALESCE(m.name, ''),
		p.entry_year, p.status,
		(SELECT COUNT(*) FROM teaching_plan_entries e2 WHERE e2.plan_id = p.id) AS entry_count,
		p.generated_at, p.confirmed_at,
		p.created_by, COALESCE(cu.name, ''), p.collaborators,
		COALESCE((SELECT array_agg(u2.name ORDER BY ord) FROM unnest(p.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u2 ON u2.id = c.id), '{}') AS collaborator_names,
		p.batch_id, COALESCE(ab.name, ''),
		p.updated_at
	FROM teaching_plans p
	LEFT JOIN training_programs tp ON tp.id = p.program_id
	LEFT JOIN terms t ON t.id = p.term_id
	LEFT JOIN majors m ON m.id = p.major_id
	LEFT JOIN users cu ON cu.id = p.created_by
	LEFT JOIN affairs_batches ab ON ab.id = p.batch_id
`

// ListPlanEntries 查询计划条目列表。
func (s *TeachingPlanStore) ListPlanEntries(ctx context.Context, planID, tenantID string) ([]domain.TeachingPlanEntry, error) {
	rows, err := s.q.Query(ctx, `
		SELECT e.id, e.plan_id, e.course_name, COALESCE(NULLIF(e.course_code, ''), c.code) AS course_code, e.type, e.nature, e.credits, e.total_hours,
			e.week_hours, e.start_week, e.end_week, e.week_pattern,
			e.class_node_id, COALESCE(o.name, ''), e.teacher_id, COALESCE(u.name, ''), e.teacher_type, e.venue_type,
			e.scenario_id, COALESCE(s.name, ''), COALESCE(cp.name, '') AS position_name, e.course_id, COALESCE(c.name, ''), e.status,
			COALESCE((SELECT array_agg(ec.class_node_id) FROM teaching_plan_entry_classes ec WHERE ec.entry_id = e.id), '{}') AS class_node_ids,
			COALESCE((SELECT array_agg(o2.name ORDER BY ec.class_node_id) FROM teaching_plan_entry_classes ec JOIN organizations o2 ON o2.id = ec.class_node_id WHERE ec.entry_id = e.id), '{}') AS class_names
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		LEFT JOIN organizations o ON o.id = e.class_node_id
		LEFT JOIN users u ON u.id = e.teacher_id
		LEFT JOIN scenarios s ON s.id = e.scenario_id
		LEFT JOIN career_positions cp ON cp.id = s.career_position_id
		LEFT JOIN courses c ON c.id = e.course_id
		WHERE e.plan_id = $1 AND p.tenant_id = $2
		ORDER BY e.start_week, e.course_name, e.id
	`, planID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.TeachingPlanEntry, 0)
	for rows.Next() {
		var e domain.TeachingPlanEntry
		if err := rows.Scan(&e.ID, &e.PlanID, &e.CourseName, &e.CourseCode, &e.Type, &e.Nature, &e.Credits, &e.TotalHours,
			&e.WeekHours, &e.StartWeek, &e.EndWeek, &e.WeekPattern,
			&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.TeacherType, &e.VenueType,
			&e.ScenarioID, &e.ScenarioName, &e.PositionName, &e.CourseID, &e.LinkedCourseName, &e.Status,
			&e.ClassNodeIDs, &e.ClassNames); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

// GetPlanEntry 查询单个计划条目。
func (s *TeachingPlanStore) GetPlanEntry(ctx context.Context, id, tenantID string) (*domain.TeachingPlanEntry, error) {
	var e domain.TeachingPlanEntry
	err := s.q.QueryRow(ctx, `
		SELECT e.id, e.plan_id, e.course_name, e.course_code, e.type, e.nature, e.credits, e.total_hours,
			e.week_hours, e.start_week, e.end_week, e.week_pattern,
			e.class_node_id, COALESCE(o.name, ''), e.teacher_id, COALESCE(u.name, ''), e.teacher_type, e.venue_type,
			e.scenario_id, COALESCE(s.name, ''), COALESCE(cp.name, '') AS position_name, e.course_id, COALESCE(c.name, ''), e.status,
			COALESCE((SELECT array_agg(ec.class_node_id) FROM teaching_plan_entry_classes ec WHERE ec.entry_id = e.id), '{}') AS class_node_ids,
			COALESCE((SELECT array_agg(o2.name ORDER BY ec.class_node_id) FROM teaching_plan_entry_classes ec JOIN organizations o2 ON o2.id = ec.class_node_id WHERE ec.entry_id = e.id), '{}') AS class_names
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		LEFT JOIN organizations o ON o.id = e.class_node_id
		LEFT JOIN users u ON u.id = e.teacher_id
		LEFT JOIN scenarios s ON s.id = e.scenario_id
		LEFT JOIN career_positions cp ON cp.id = s.career_position_id
		LEFT JOIN courses c ON c.id = e.course_id
		WHERE e.id = $1 AND p.tenant_id = $2
	`, id, tenantID).Scan(&e.ID, &e.PlanID, &e.CourseName, &e.CourseCode, &e.Type, &e.Nature, &e.Credits, &e.TotalHours,
		&e.WeekHours, &e.StartWeek, &e.EndWeek, &e.WeekPattern,
		&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.TeacherType, &e.VenueType,
		&e.ScenarioID, &e.ScenarioName, &e.PositionName, &e.CourseID, &e.LinkedCourseName, &e.Status,
		&e.ClassNodeIDs, &e.ClassNames)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// UpdatePlanEntry 更新计划条目（含多班级关联）。
func (s *TeachingPlanStore) UpdatePlanEntry(ctx context.Context, id, tenantID string, e *domain.TeachingPlanEntry, credits *float64, totalHours *int, classNodeIDs *[]string) error {
	if _, err := s.q.Exec(ctx, `
		UPDATE teaching_plan_entries e
		SET week_hours = $1, start_week = $2, end_week = $3, week_pattern = $4,
			class_node_id = $5, teacher_id = $6, teacher_type = $7, venue_type = $8, status = $9,
			credits = COALESCE($12, credits), total_hours = COALESCE($13, total_hours)
		FROM teaching_plans p
		WHERE e.id = $10 AND p.id = e.plan_id AND p.tenant_id = $11
	`, e.WeekHours, e.StartWeek, e.EndWeek, e.WeekPattern,
		e.ClassNodeID, e.TeacherID, e.TeacherType, e.VenueType, e.Status, id, tenantID,
		credits, totalHours); err != nil {
		return err
	}
	if classNodeIDs != nil {
		_, _ = s.q.Exec(ctx, `DELETE FROM teaching_plan_entry_classes WHERE entry_id = $1`, id)
		for _, cid := range *classNodeIDs {
			if cid != "" {
				_, _ = s.q.Exec(ctx, `INSERT INTO teaching_plan_entry_classes (entry_id, class_node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, cid)
			}
		}
	}
	return nil
}

// DeletePlanEntry 删除计划条目。
func (s *TeachingPlanStore) DeletePlanEntry(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `
		DELETE FROM teaching_plan_entries e USING teaching_plans p
		WHERE e.id = $1 AND p.id = e.plan_id AND p.tenant_id = $2
	`, id, tenantID)
	return err
}

// ConfirmPlan 确认计划（draft → published，兼容旧确认语义）。
func (s *TeachingPlanStore) ConfirmPlan(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE teaching_plans SET status = 'published', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	return err
}

// MarkConfirmed 发布流转成功后记录确认时间（与状态流转同一事务）。
func (s *TeachingPlanStore) MarkConfirmed(ctx context.Context, tx Queryer, id string) error {
	_, err := tx.Exec(ctx, `
		UPDATE teaching_plans SET confirmed_at = NOW() WHERE id = $1
	`, id)
	return err
}

// DeletePlan 删除计划（条目级联删除；被排课引用时由外键拒绝）。
func (s *TeachingPlanStore) DeletePlan(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM teaching_plans WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// UpdatePlanMeta 更新计划元数据（批次绑定 / 共建人）。
func (s *TeachingPlanStore) UpdatePlanMeta(ctx context.Context, id, tenantID string, batchID *string, collaborators *[]string) error {
	if batchID != nil {
		var bid *string
		if *batchID != "" {
			bid = batchID
		}
		if _, err := s.q.Exec(ctx, `
			UPDATE teaching_plans SET batch_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3
		`, bid, id, tenantID); err != nil {
			return err
		}
	}
	if collaborators != nil {
		if _, err := s.q.Exec(ctx, `
			UPDATE teaching_plans SET collaborators = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3
		`, *collaborators, id, tenantID); err != nil {
			return err
		}
	}
	return nil
}

// ScanTeachingPlanRows 扫描教学计划行。
func ScanTeachingPlanRows(rows pgx.Rows) ([]domain.TeachingPlan, error) {
	items := make([]domain.TeachingPlan, 0)
	for rows.Next() {
		var p domain.TeachingPlan
		if err := rows.Scan(&p.ID, &p.ProgramID, &p.ProgramName, &p.TermID, &p.TermName, &p.MajorID, &p.MajorName,
			&p.EntryYear, &p.Status, &p.EntryCount, &p.GeneratedAt, &p.ConfirmedAt,
			&p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames,
			&p.BatchID, &p.BatchName, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}
