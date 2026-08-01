package store

import (
	"context"
	"errors"

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
		SELECT pc.course_id, pc.name, pc.code, pc.career_position_id, pc.nature, pc.credits, pc.hours
		FROM program_courses pc
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
		INSERT INTO teaching_plans (id, tenant_id, program_id, term_id, major_id, entry_year, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'draft')
	`, planID, p.TenantID, p.ProgramID, p.TermID, p.MajorID, p.EntryYear); err != nil {
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
				if _, err := tx.Exec(ctx, `
					INSERT INTO teaching_plan_entries (id, plan_id, course_name, course_code, type, nature, credits, total_hours, week_hours, start_week, end_week, week_pattern, scenario_id, course_id, status)
					VALUES ($1, $2, $3, $4, 'scene', $5, $6, $7, $8, 1, $9, 'all', $10, $11, 'planned')
				`, uuid.NewString(), planID, sc.Name, sc.Code, c.Nature,
					c.Credits, c.Hours, weekHours, weeksCount, sc.ID, c.CourseID); err != nil {
					return "", err
				}
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO teaching_plan_entries (id, plan_id, course_name, course_code, type, nature, credits, total_hours, week_hours, start_week, end_week, week_pattern, scenario_id, course_id, status)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, 'all', $11, $12, 'planned')
			`, uuid.NewString(), planID, c.Name, c.Code, entryType, c.Nature,
				c.Credits, c.Hours, weekHours, weeksCount, (*string)(nil), c.CourseID); err != nil {
				return "", err
			}
		}
	}
	return planID, nil
}

// GeneratePlanParams 生成参数。
type GeneratePlanParams struct {
	TenantID  string
	ProgramID string
	TermID    string
	MajorID   *string
	EntryYear *int
}

// List 查询教学计划列表。
func (s *TeachingPlanStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.TeachingPlan]) ([]domain.TeachingPlan, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanTeachingPlanRows)
}

// Get 查询单个教学计划。
func (s *TeachingPlanStore) Get(ctx context.Context, id, tenantID string) (*domain.TeachingPlan, error) {
	var plan domain.TeachingPlan
	err := s.q.QueryRow(ctx, teachingPlanSelectSQL+` WHERE p.id = $1 AND p.tenant_id = $2`, id, tenantID).
		Scan(&plan.ID, &plan.ProgramID, &plan.ProgramName, &plan.TermID, &plan.TermName, &plan.MajorID, &plan.MajorName,
			&plan.EntryYear, &plan.Status, &plan.EntryCount, &plan.GeneratedAt, &plan.ConfirmedAt)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

const teachingPlanSelectSQL = `
	SELECT p.id, p.program_id, COALESCE(tp.name, ''), p.term_id, COALESCE(t.name, ''), p.major_id, COALESCE(m.name, ''),
		p.entry_year, p.status,
		(SELECT COUNT(*) FROM teaching_plan_entries e2 WHERE e2.plan_id = p.id) AS entry_count,
		p.generated_at, p.confirmed_at
	FROM teaching_plans p
	LEFT JOIN training_programs tp ON tp.id = p.program_id
	LEFT JOIN terms t ON t.id = p.term_id
	LEFT JOIN majors m ON m.id = p.major_id
`

// ListPlanEntries 查询计划条目列表。
func (s *TeachingPlanStore) ListPlanEntries(ctx context.Context, planID, tenantID string) ([]domain.TeachingPlanEntry, error) {
	rows, err := s.q.Query(ctx, `
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

// ConfirmPlan 确认计划。
func (s *TeachingPlanStore) ConfirmPlan(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE teaching_plans SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	return err
}

// ScanTeachingPlanRows 扫描教学计划行。
func ScanTeachingPlanRows(rows pgx.Rows) ([]domain.TeachingPlan, error) {
	items := make([]domain.TeachingPlan, 0)
	for rows.Next() {
		var p domain.TeachingPlan
		if err := rows.Scan(&p.ID, &p.ProgramID, &p.ProgramName, &p.TermID, &p.TermName, &p.MajorID, &p.MajorName,
			&p.EntryYear, &p.Status, &p.EntryCount, &p.GeneratedAt, &p.ConfirmedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

var _ = errors.Is
