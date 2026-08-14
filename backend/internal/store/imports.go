package store

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
)

// 导入支撑：import handler 复用的批量查找/创建/归置操作，SQL 唯一所在地。
// 全部方法接受 Queryer（*pgxpool.Pool / pgx.Tx / 事务内 Store），供导入事务复用。

// FindOrCreateKnowledgePointsByNames 按租户+名称批量查找知识点，不存在则创建
// （ON CONFLICT DO NOTHING + 回查，并发安全），返回命中的 ID 列表。
func FindOrCreateKnowledgePointsByNames(ctx context.Context, q Queryer, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		code, codeErr := GenerateUniqueEntityCode(ctx, q, "KP", "knowledge_points", tenantID)
		if codeErr != nil {
			code = GenerateEntityCode("KP")
		}
		_, execErr := q.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name, code) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, id, tenantID, name, code)
		if execErr != nil {
			slog.Warn("导入知识点创建失败", "error", execErr, "name", name)
		}
		var existing string
		if scanErr := q.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing); scanErr != nil {
			slog.Warn("导入知识点回查失败", "error", scanErr, "name", name)
		}
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

// FindOrCreateResourcesByNames 按租户+名称批量查找资源库资源，不存在则按
// resourceType 创建（ON CONFLICT DO NOTHING + 回查），返回命中的 ID 列表。
func FindOrCreateResourcesByNames(ctx context.Context, q Queryer, tenantID string, names []string, resourceType, userID string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, execErr := q.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,$4::resource_type,$5) ON CONFLICT DO NOTHING`,
			id, tenantID, name, resourceType, userID)
		if execErr != nil {
			slog.Warn("导入资源创建失败", "error", execErr, "name", name)
		}
		var existing string
		if scanErr := q.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing); scanErr != nil {
			slog.Warn("导入资源回查失败", "error", scanErr, "name", name)
		}
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

// FindMajorIDByNormalizedName 按租户+名称（NFKC 归一化）查找专业 ID，找不到返回 nil。
func FindMajorIDByNormalizedName(ctx context.Context, q Queryer, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

// ProgramCourseImportItem 方案课程导入行（ReplaceProgramCourses 用）。
type ProgramCourseImportItem struct {
	ID         string
	Name       string
	Credits    int
	Hours      int
	Nature     string
	PositionID *string
	CourseID   *string
}

// ReplaceProgramCourses 清空方案课程列表并按新数据重建（同事务内）。
func ReplaceProgramCourses(ctx context.Context, q Queryer, programID string, courses []ProgramCourseImportItem) error {
	if _, err := q.Exec(ctx, `DELETE FROM training_program_courses WHERE program_id = $1`, programID); err != nil {
		return err
	}
	for i, c := range courses {
		if _, err := q.Exec(ctx,
			`INSERT INTO training_program_courses (id, program_id, name, credits, hours, semester, nature, position_id, course_id, sort_order) VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9)`,
			c.ID, programID, c.Name, c.Credits, c.Hours, c.Nature, c.PositionID, c.CourseID, i); err != nil {
			return err
		}
	}
	return nil
}

// ImportTerm 学期查重+插入，返回是否新建。
func ImportTerm(ctx context.Context, q Queryer, tenantID, name, startDate, endDate string, weeks int) (bool, error) {
	var exists string
	if err := q.QueryRow(ctx, `SELECT id FROM terms WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err == nil {
		return false, nil
	}
	_, err := q.Exec(ctx, `INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count) VALUES ($1,$2,$3,$4::date,$5::date,$6)`,
		uuid.NewString(), tenantID, name, startDate, endDate, weeks)
	return err == nil, err
}

// ImportVenue 场地查重+插入，返回是否新建。
func ImportVenue(ctx context.Context, q Queryer, tenantID, name, vtype string, capacity *int) (bool, error) {
	var exists string
	if err := q.QueryRow(ctx, `SELECT id FROM venues WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err == nil {
		return false, nil
	}
	_, err := q.Exec(ctx, `INSERT INTO venues (id, tenant_id, name, type, capacity) VALUES ($1,$2,$3,$4,$5)`,
		uuid.NewString(), tenantID, name, vtype, capacity)
	return err == nil, err
}

// ImportPeriodSlot 节次查重+插入，返回是否新建。
func ImportPeriodSlot(ctx context.Context, q Queryer, tenantID, name, slotType string, startTime, endTime *string, sortOrder int) (bool, error) {
	var exists string
	if err := q.QueryRow(ctx, `SELECT id FROM period_slots WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&exists); err == nil {
		return false, nil
	}
	_, err := q.Exec(ctx, `INSERT INTO period_slots (id, tenant_id, name, slot_type, start_time, end_time, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.NewString(), tenantID, name, slotType, startTime, endTime, sortOrder)
	return err == nil, err
}

// SchedulePlanEntry 排课导入匹配到的教学计划条目。
type SchedulePlanEntry struct {
	ID          string
	TeacherID   *string
	ClassNodeID *string
	ScenarioID  *string
	CourseID    *string
	CourseCode  *string
}

// FindPlanEntryByCourse 按租户+学期+课程名匹配教学计划条目（含场景/课程/编码），未命中返回空结构。
func FindPlanEntryByCourse(ctx context.Context, q Queryer, tenantID, termID, courseName string) (SchedulePlanEntry, error) {
	var pe SchedulePlanEntry
	err := q.QueryRow(ctx, `
		SELECT e.id::text, e.teacher_id::text, e.class_node_id::text, e.scenario_id::text, e.course_id::text, e.course_code
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		WHERE p.tenant_id = $1 AND p.term_id = $2 AND e.course_name = $3 LIMIT 1
	`, tenantID, termID, courseName).Scan(&pe.ID, &pe.TeacherID, &pe.ClassNodeID, &pe.ScenarioID, &pe.CourseID, &pe.CourseCode)
	return pe, err
}

// ClearDraftScheduleEntries 清空某学期草稿区排课（不触碰已发布版本）。
func ClearDraftScheduleEntries(ctx context.Context, q Queryer, tenantID, termID string) error {
	_, err := q.Exec(ctx, `DELETE FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2 AND status = 'draft'`, tenantID, termID)
	return err
}

// ResetPlanEntriesToPlanned 将某学期全部教学计划条目恢复为待排。
func ResetPlanEntriesToPlanned(ctx context.Context, q Queryer, tenantID, termID string) error {
	_, err := q.Exec(ctx, `
		UPDATE teaching_plan_entries e SET status = 'planned'
		FROM teaching_plans p WHERE p.id = e.plan_id AND p.tenant_id = $1 AND p.term_id = $2
	`, tenantID, termID)
	return err
}

// FindOrgIDByName 按租户+名称查找组织（班级）ID。
func FindOrgIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id::text FROM organizations WHERE tenant_id = $1 AND name = $2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// FindTeacherIDByName 按租户+姓名/用户名查找教师 ID。
func FindTeacherIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id::text FROM users WHERE tenant_id=$1 AND (name=$2 OR username=$2) LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// FindVenueIDByName 按租户+名称查找场地 ID。
func FindVenueIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id::text FROM venues WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// ScheduleEntryInsertParams 排课条目插入参数。
type ScheduleEntryInsertParams struct {
	ID          string
	TenantID    string
	TermID      string
	PlanEntryID string
	CourseName  string
	CourseCode  *string
	CourseID    *string
	EntryType   string
	ClassIDs    []string
	TeacherID   *string
	Day         int
	Periods     []string
	StartWeek   int
	EndWeek     int
	WeekPattern string
	VenueID     *string
	ScenarioID  *string
}

// InsertScheduleEntry 插入草稿排课条目。
func InsertScheduleEntry(ctx context.Context, q Queryer, p ScheduleEntryInsertParams) error {
	if len(p.ClassIDs) == 0 {
		return fmt.Errorf("排课条目缺少班级信息")
	}
	_, err := q.Exec(ctx, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
			class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
			venue_id, scenario_id, source, status, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'imported', 'draft', 1)
	`, p.ID, p.TenantID, p.TermID, p.PlanEntryID, p.CourseName, p.CourseCode, p.CourseID, p.EntryType,
		p.ClassIDs[0], p.ClassIDs, p.TeacherID, p.Day, p.Periods, p.StartWeek, p.EndWeek, p.WeekPattern,
		p.VenueID, p.ScenarioID)
	return err
}

// MarkPlanEntryScheduled 标记教学计划条目已排。
func MarkPlanEntryScheduled(ctx context.Context, q Queryer, planEntryID string) error {
	_, err := q.Exec(ctx, `UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = $1`, planEntryID)
	return err
}

// InferTermByCourseName 按租户+课程名推断所属学期，找不到返回空串。
func InferTermByCourseName(ctx context.Context, q Queryer, tenantID, courseName string) (string, error) {
	var termID string
	err := q.QueryRow(ctx, `
		SELECT p.term_id::text FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		WHERE p.tenant_id = $1 AND e.course_name = $2 LIMIT 1
	`, tenantID, courseName).Scan(&termID)
	if err != nil {
		return "", err
	}
	return termID, nil
}
