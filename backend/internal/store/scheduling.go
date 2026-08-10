package store

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// SchedulingStore 排课域持久化（场地/节次/排课/教学计划）。
type SchedulingStore struct {
	q Queryer
}

// NewSchedulingStore 创建排课 store。
func NewSchedulingStore(q Queryer) *SchedulingStore {
	return &SchedulingStore{q: q}
}

// ===== 场地 =====

// ListVenues 查询场地列表。
func (s *SchedulingStore) ListVenues(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Venue]) ([]domain.Venue, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanVenueRows)
}

// ScanVenueRows 扫描场地行。
func ScanVenueRows(rows pgx.Rows) ([]domain.Venue, error) {
	items := make([]domain.Venue, 0)
	for rows.Next() {
		var v domain.Venue
		if err := rows.Scan(&v.ID, &v.Name, &v.Type, &v.Capacity, &v.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, nil
}

// GetVenue 查询单个场地。
func (s *SchedulingStore) GetVenue(ctx context.Context, id, tenantID string) (*domain.Venue, error) {
	var v domain.Venue
	var capacity *int
	err := s.q.QueryRow(ctx, `
		SELECT id, name, type, capacity, created_at
		FROM venues WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&v.ID, &v.Name, &v.Type, &capacity, &v.CreatedAt)
	if err != nil {
		return nil, err
	}
	v.Capacity = capacity
	return &v, nil
}

// CreateVenue 创建场地。
func (s *SchedulingStore) CreateVenue(ctx context.Context, p *VenueParams) (*domain.Venue, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO venues (id, tenant_id, name, type, capacity)
		VALUES (gen_random_uuid(), $1, $2, $3, $4)
		RETURNING id
	`, p.TenantID, p.Name, p.Type, p.Capacity).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetVenue(ctx, id, p.TenantID)
}

// UpdateVenue 更新场地。
func (s *SchedulingStore) UpdateVenue(ctx context.Context, id, tenantID string, p *VenueParams) (*domain.Venue, error) {
	if _, err := s.GetVenue(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE venues SET name = $1, type = $2, capacity = $3
		WHERE id = $4 AND tenant_id = $5
	`, p.Name, p.Type, p.Capacity, id, tenantID); err != nil {
		return nil, err
	}
	return s.GetVenue(ctx, id, tenantID)
}

// DeleteVenue 删除场地。
func (s *SchedulingStore) DeleteVenue(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM venues WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// VenueParams 场地参数。
type VenueParams struct {
	TenantID string
	Name     string
	Type     string
	Capacity *int
}

// ===== 节次 =====

// ListPeriodSlots 查询节次列表。
func (s *SchedulingStore) ListPeriodSlots(ctx context.Context, tenantID string) ([]domain.PeriodSlot, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, name, slot_type, sort_order, start_time, end_time
		FROM period_slots WHERE tenant_id = $1 ORDER BY sort_order ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return ScanPeriodSlotRows(rows)
}

// CreatePeriodSlot 创建节次。
func (s *SchedulingStore) CreatePeriodSlot(ctx context.Context, p *PeriodSlotParams) (*domain.PeriodSlot, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO period_slots (id, tenant_id, name, slot_type, sort_order, start_time, end_time)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, p.TenantID, p.Name, p.Type, p.SortOrder, p.StartTime, p.EndTime).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.fetchPeriodSlot(ctx, id, p.TenantID)
}

// UpdatePeriodSlot 更新节次。
func (s *SchedulingStore) UpdatePeriodSlot(ctx context.Context, id, tenantID string, p *PeriodSlotParams) (*domain.PeriodSlot, error) {
	if _, err := s.fetchPeriodSlot(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE period_slots SET name = $1, slot_type = $2, sort_order = $3, start_time = $4, end_time = $5
		WHERE id = $6 AND tenant_id = $7
	`, p.Name, p.Type, p.SortOrder, p.StartTime, p.EndTime, id, tenantID); err != nil {
		return nil, err
	}
	return s.fetchPeriodSlot(ctx, id, tenantID)
}

// GetPeriodSlot 查询单个节次。
func (s *SchedulingStore) GetPeriodSlot(ctx context.Context, id, tenantID string) (*domain.PeriodSlot, error) {
	return s.fetchPeriodSlot(ctx, id, tenantID)
}

// DeletePeriodSlot 删除节次。
func (s *SchedulingStore) DeletePeriodSlot(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM period_slots WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ReplacePeriodSlots 事务内按名称整体替换节次：同名节次更新、新增列表中不存在的、删除列表外的旧节次。
// items 非空由调用方保证。
func (s *SchedulingStore) ReplacePeriodSlots(ctx context.Context, q Queryer, tenantID string, items []PeriodSlotParams) ([]domain.PeriodSlot, error) {
	rows, err := q.Query(ctx, `SELECT id, name FROM period_slots WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	existing := make(map[string]string, 16) // name → id
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			rows.Close()
			return nil, err
		}
		existing[name] = id
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	kept := make(map[string]struct{}, len(items))
	for _, p := range items {
		kept[p.Name] = struct{}{}
		if id, ok := existing[p.Name]; ok {
			if _, err := q.Exec(ctx, `
				UPDATE period_slots SET slot_type = $1, sort_order = $2, start_time = $3, end_time = $4
				WHERE id = $5 AND tenant_id = $6
			`, p.Type, p.SortOrder, p.StartTime, p.EndTime, id, tenantID); err != nil {
				return nil, err
			}
			continue
		}
		if _, err := q.Exec(ctx, `
			INSERT INTO period_slots (id, tenant_id, name, slot_type, sort_order, start_time, end_time)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		`, tenantID, p.Name, p.Type, p.SortOrder, p.StartTime, p.EndTime); err != nil {
			return nil, err
		}
	}

	// 删除列表外旧节次（名称可能重复，按 id 逐个删除）
	for name, id := range existing {
		if _, ok := kept[name]; !ok {
			if _, err := q.Exec(ctx, `DELETE FROM period_slots WHERE id = $1 AND tenant_id = $2`, id, tenantID); err != nil {
				return nil, err
			}
		}
	}

	result, err := q.Query(ctx, `
		SELECT id, name, slot_type, sort_order, start_time, end_time
		FROM period_slots WHERE tenant_id = $1 ORDER BY sort_order ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer result.Close()
	return ScanPeriodSlotRows(result)
}

// PeriodSlotParams 节次参数。
type PeriodSlotParams struct {
	TenantID  string
	Name      string
	Type      string
	SortOrder int
	StartTime *string
	EndTime   *string
}

func (s *SchedulingStore) fetchPeriodSlot(ctx context.Context, id, tenantID string) (*domain.PeriodSlot, error) {
	var p domain.PeriodSlot
	var startTime, endTime *time.Time
	err := s.q.QueryRow(ctx, `
		SELECT id, name, slot_type, sort_order, start_time, end_time
		FROM period_slots WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&p.ID, &p.Name, &p.Type, &p.SortOrder, &startTime, &endTime)
	if err != nil {
		return nil, err
	}
	if startTime != nil {
		str := startTime.Format("15:04")
		p.StartTime = &str
	}
	if endTime != nil {
		str := endTime.Format("15:04")
		p.EndTime = &str
	}
	return &p, nil
}

// ScanPeriodSlotRows 扫描节次行。
func ScanPeriodSlotRows(rows pgx.Rows) ([]domain.PeriodSlot, error) {
	items := make([]domain.PeriodSlot, 0)
	for rows.Next() {
		var p domain.PeriodSlot
		var startTime, endTime *time.Time
		if err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.SortOrder, &startTime, &endTime); err != nil {
			return nil, err
		}
		if startTime != nil {
			str := startTime.Format("15:04")
			p.StartTime = &str
		}
		if endTime != nil {
			str := endTime.Format("15:04")
			p.EndTime = &str
		}
		items = append(items, p)
	}
	return items, nil
}

// ===== 排课 =====

// ListSchedules 查询排课列表。
func (s *SchedulingStore) ListSchedules(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ScheduleEntry]) ([]domain.ScheduleEntry, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg)
}

// GetSchedule 查询单个排课。
func (s *SchedulingStore) GetSchedule(ctx context.Context, id, tenantID string) (*domain.ScheduleEntry, error) {
	e, err := s.fetchScheduleEntry(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

// CreateSchedule 创建排课（事务：插入排课 + 标记教学计划条目已排）。
func (s *SchedulingStore) CreateSchedule(ctx context.Context, tx Queryer, p *ScheduleCreateParams) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
			class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
			venue_id, scenario_id, source, status, version)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft', 1)
		RETURNING id
	`, p.TenantID, p.TermID, p.PlanEntryID, p.CourseName, p.CourseCode, p.CourseID, p.Type,
		p.ClassNodeID, p.ClassNodeIDs, p.TeacherID, p.DayOfWeek, p.Periods, p.StartWeek, p.EndWeek, p.WeekPattern,
		p.VenueID, p.ScenarioID, p.Source).Scan(&id)
	if err != nil {
		return "", err
	}
	if p.PlanEntryID != nil && *p.PlanEntryID != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = $1
		`, *p.PlanEntryID); err != nil {
			return "", err
		}
	}
	return id, nil
}

// UpdateSchedule 更新排课。
func (s *SchedulingStore) UpdateSchedule(ctx context.Context, tx Queryer, id, tenantID string, p *ScheduleCreateParams) error {
	_, err := tx.Exec(ctx, `
		UPDATE schedule_entries SET term_id = $1, plan_entry_id = $2, course_name = $3, course_code = $4, course_id = $5, type = $6,
			class_node_id = $7, class_node_ids = $8, teacher_id = $9, day_of_week = $10, periods = $11,
			start_week = $12, end_week = $13, week_pattern = $14, venue_id = $15, scenario_id = $16, updated_at = NOW()
		WHERE id = $17 AND tenant_id = $18
	`, p.TermID, p.PlanEntryID, p.CourseName, p.CourseCode, p.CourseID, p.Type,
		p.ClassNodeID, p.ClassNodeIDs, p.TeacherID, p.DayOfWeek, p.Periods, p.StartWeek, p.EndWeek, p.WeekPattern,
		p.VenueID, p.ScenarioID, id, tenantID)
	return err
}

// LockScheduleTerm 以租户+学期粒度的 advisory 锁串行化排课变更，避免冲突校验与插入间的并发竞态。
// 须在事务内调用，锁随事务提交/回滚自动释放。
func (s *SchedulingStore) LockScheduleTerm(ctx context.Context, q Queryer, tenantID, termID string) error {
	_, err := q.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, tenantID+"|"+termID)
	return err
}

// DeleteScheduleWithRestore 删除排课并恢复计划条目为待排（事务内）。
func (s *SchedulingStore) DeleteScheduleWithRestore(ctx context.Context, tx Queryer, id, tenantID string, planEntryID *string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM schedule_entries WHERE id = $1 AND tenant_id = $2`, id, tenantID); err != nil {
		return err
	}
	if planEntryID != nil && *planEntryID != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE teaching_plan_entries SET status = 'planned'
			WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM schedule_entries WHERE plan_entry_id = $1 AND status = 'draft')
		`, *planEntryID); err != nil {
			return err
		}
	}
	return nil
}

// ScheduleCreateParams 排课参数。
type ScheduleCreateParams struct {
	TenantID     string
	TermID       string
	PlanEntryID  *string
	CourseName   string
	CourseCode   *string
	CourseID     *string
	Type         string
	ClassNodeID  string
	ClassNodeIDs []string
	TeacherID    *string
	DayOfWeek    int
	Periods      domain.JSONSlice
	StartWeek    int
	EndWeek      int
	WeekPattern  string
	VenueID      *string
	ScenarioID   *string
	Source       string
}

// ===== 冲突/查询辅助 =====

// CheckScheduleConflictsTx 在指定事务/连接上执行冲突校验（服务层事务内复用）。
func (s *SchedulingStore) CheckScheduleConflictsTx(ctx context.Context, q Queryer, tenantID, termID string, p *ScheduleConflictParams, excludeID string) ([]domain.ScheduleConflict, error) {
	return checkScheduleConflicts(ctx, q, tenantID, termID, p, excludeID)
}

// checkScheduleConflicts 在指定 Queryer（连接或事务）上执行冲突查询，供事务内复用。
func checkScheduleConflicts(ctx context.Context, q Queryer, tenantID, termID string, p *ScheduleConflictParams, excludeID string) ([]domain.ScheduleConflict, error) {
	periods := JSONSliceToStrings(p.Periods)
	if len(periods) == 0 {
		return nil, nil
	}
	weekPattern := p.WeekPattern
	if weekPattern == "" {
		weekPattern = "all"
	}
	reqClasses := p.ClassNodeIDs
	if len(reqClasses) == 0 && p.ClassNodeID != "" {
		reqClasses = []string{p.ClassNodeID}
	}

	rows, err := q.Query(ctx, `
		SELECT se.id, se.course_name, COALESCE(o.name, ''), COALESCE(u.name, ''), COALESCE(v.name, ''),
			se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern,
			se.teacher_id, se.class_node_id, se.venue_id, se.plan_entry_id, se.class_node_ids
		FROM schedule_entries se
		LEFT JOIN organizations o ON o.id = se.class_node_id
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		WHERE se.tenant_id = $1 AND se.term_id = $2 AND se.status = 'draft' AND se.day_of_week = $3
			AND NOT (se.end_week < $4 OR se.start_week > $5)
			AND (se.week_pattern = $6 OR se.week_pattern = 'all' OR $6 = 'all')
			AND se.periods ?| $7
			AND ($8 = '' OR se.id::text <> $8)
	`, tenantID, termID, p.DayOfWeek, p.StartWeek, p.EndWeek, weekPattern, periods, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conflicts := make([]domain.ScheduleConflict, 0)
	for rows.Next() {
		var c domain.ScheduleConflict
		var rowTeacherID, rowClassNodeID, rowVenueID, rowPlanEntryID *string
		var rowClassNodeIDs []string
		if err := rows.Scan(&c.EntryID, &c.CourseName, &c.ClassName, &c.TeacherName, &c.VenueName,
			&c.DayOfWeek, &c.Periods, &c.StartWeek, &c.EndWeek, &c.WeekPattern,
			&rowTeacherID, &rowClassNodeID, &rowVenueID, &rowPlanEntryID, &rowClassNodeIDs); err != nil {
			return nil, err
		}

		// 同一门课（同一教学计划条目）多个班级同时上课不判冲突
		if rowPlanEntryID != nil && p.PlanEntryID != nil && *rowPlanEntryID == *p.PlanEntryID {
			continue
		}

		if p.TeacherID != nil && *p.TeacherID != "" && rowTeacherID != nil && *rowTeacherID == *p.TeacherID {
			dup := c
			dup.Kind = "teacher"
			conflicts = append(conflicts, dup)
		}
		// 班级冲突：任一班重叠即冲突
		existingClasses := rowClassNodeIDs
		if len(existingClasses) == 0 && rowClassNodeID != nil {
			existingClasses = []string{*rowClassNodeID}
		}
		classOverlap := false
		for _, ec := range existingClasses {
			for _, rc := range reqClasses {
				if ec == rc {
					classOverlap = true
					break
				}
			}
			if classOverlap {
				break
			}
		}
		if classOverlap {
			dup := c
			dup.Kind = "class"
			conflicts = append(conflicts, dup)
		}
		if p.VenueID != nil && *p.VenueID != "" && rowVenueID != nil && *rowVenueID == *p.VenueID {
			dup := c
			dup.Kind = "venue"
			conflicts = append(conflicts, dup)
		}
	}
	return conflicts, rows.Err()
}

// ScheduleConflictParams 冲突校验参数。
type ScheduleConflictParams struct {
	TermID       string
	PlanEntryID  *string
	ClassNodeID  string
	ClassNodeIDs []string
	TeacherID    *string
	DayOfWeek    int
	Periods      domain.JSONSlice
	StartWeek    int
	EndWeek      int
	WeekPattern  string
	VenueID      *string
}

// ResolveCourseIDByCode 按课程编码查询课程。
func (s *SchedulingStore) ResolveCourseIDByCode(ctx context.Context, q Queryer, tenantID string, courseCode *string) *string {
	if courseCode == nil || *courseCode == "" {
		return nil
	}
	var id string
	if err := q.QueryRow(ctx, `SELECT id FROM courses WHERE tenant_id = $1 AND code = $2`, tenantID, *courseCode).Scan(&id); err != nil {
		return nil
	}
	return &id
}

// PlanEntryTenantID 查询教学计划条目所属租户（排课归属校验用）。
// 注意：teaching_plan_entries 自身无 tenant_id，需通过 plan_id 关联 teaching_plans 读取。
func (s *SchedulingStore) PlanEntryTenantID(ctx context.Context, entryID string) (string, error) {
	var tenantID string
	err := s.q.QueryRow(ctx, `
		SELECT tp.tenant_id
		FROM teaching_plan_entries tpe
		JOIN teaching_plans tp ON tp.id = tpe.plan_id
		WHERE tpe.id = $1
	`, entryID).Scan(&tenantID)
	return tenantID, err
}

// PlanEntryCourseID 查询教学计划条目的课程 ID。
func (s *SchedulingStore) PlanEntryCourseID(ctx context.Context, q Queryer, entryID string) *string {
	var courseID *string
	if err := q.QueryRow(ctx, `SELECT course_id FROM teaching_plan_entries WHERE id = $1`, entryID).Scan(&courseID); err != nil {
		slog.Warn("plan entry course id query failed", "entryID", entryID, "error", err)
		return nil
	}
	return courseID
}

// FallbackClassID 查询教学计划条目的班级（多班级优先）。
func (s *SchedulingStore) FallbackClassID(ctx context.Context, entryID string) *string {
	var fallbackClassID *string
	if err := s.q.QueryRow(ctx, `
		SELECT ec.class_node_id FROM teaching_plan_entry_classes ec WHERE ec.entry_id = $1 LIMIT 1
	`, entryID).Scan(&fallbackClassID); err != nil {
		slog.Warn("fallback class id query failed", "entryID", entryID, "error", err)
		return nil
	}
	if fallbackClassID == nil {
		if err := s.q.QueryRow(ctx, `
			SELECT class_node_id FROM teaching_plan_entries WHERE id = $1
		`, entryID).Scan(&fallbackClassID); err != nil {
			slog.Warn("fallback class id (entry field) query failed", "entryID", entryID, "error", err)
			return nil
		}
	}
	return fallbackClassID
}

// FetchTermBrief 查询学期摘要。
func (s *SchedulingStore) FetchTermBrief(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	var t domain.Term
	err := s.q.QueryRow(ctx, `
		SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
		FROM terms WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&t.ID, &t.Name, &t.StartDate, &t.EndDate)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// PeriodSlotNames 加载节次名称。
func (s *SchedulingStore) PeriodSlotNames(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT name FROM period_slots WHERE tenant_id = $1 ORDER BY sort_order ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names := make([]string, 0)
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			continue
		}
		names = append(names, n)
	}
	return names, rows.Err()
}

// VenueBrief 场地简要。
type VenueBrief struct {
	ID   string
	Name string
	Type string
}

// ListVenueBriefs 加载场地简要。
func (s *SchedulingStore) ListVenueBriefs(ctx context.Context, tenantID string) ([]VenueBrief, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, name, type FROM venues WHERE tenant_id = $1 ORDER BY name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []VenueBrief
	for rows.Next() {
		var v VenueBrief
		if err := rows.Scan(&v.ID, &v.Name, &v.Type); err != nil {
			continue
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

// PendingPlanEntry 待排教学计划条目。
type PendingPlanEntry struct {
	ID          string
	CourseName  string
	CourseCode  string
	EntryType   string
	StartWeek   int
	EndWeek     int
	WeekPattern string
	ClassNodeID string
	TeacherID   string
	VenueType   string
	ScenarioID  string
	CourseID    string
}

// ListPendingPlanEntries 加载待排教学计划条目。
func (s *SchedulingStore) ListPendingPlanEntries(ctx context.Context, tenantID, termID, planID string) ([]PendingPlanEntry, error) {
	var planFilter string
	args := []any{tenantID, termID}
	if planID != "" {
		planFilter = " AND p.id = $3"
		args = append(args, planID)
	}
	rows, err := s.q.Query(ctx, `
		SELECT e.id, e.course_name, e.course_code, e.type, e.start_week, e.end_week, e.week_pattern,
			COALESCE(e.class_node_id::text, ''), COALESCE(e.teacher_id::text, ''), COALESCE(e.venue_type, ''),
			COALESCE(e.scenario_id::text, ''), COALESCE(e.course_id::text, '')
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		WHERE p.tenant_id = $1 AND p.term_id = $2 AND p.status = 'published' AND e.status = 'planned'`+planFilter+`
		ORDER BY e.start_week, e.course_name
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PendingPlanEntry
	for rows.Next() {
		var e PendingPlanEntry
		if err := rows.Scan(&e.ID, &e.CourseName, &e.CourseCode, &e.EntryType, &e.StartWeek, &e.EndWeek, &e.WeekPattern,
			&e.ClassNodeID, &e.TeacherID, &e.VenueType, &e.ScenarioID, &e.CourseID); err != nil {
			continue
		}
		if e.ClassNodeID == "" {
			continue
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

// TermScheduleBrief 学期已排条目概要（自动排课内存冲突判断用）。
type TermScheduleBrief struct {
	ID           string
	PlanEntryID  *string
	ClassNodeID  string
	ClassNodeIDs []string
	TeacherID    *string
	DayOfWeek    int
	Periods      []string
	StartWeek    int
	EndWeek      int
	WeekPattern  string
	VenueID      *string
}

// ListTermScheduleBriefs 加载某学期全部已排条目（轻量字段，供自动排课批量冲突判断）。
func (s *SchedulingStore) ListTermScheduleBriefs(ctx context.Context, q Queryer, tenantID, termID string) ([]TermScheduleBrief, error) {
	rows, err := q.Query(ctx, `
		SELECT se.id, se.plan_entry_id, COALESCE(se.class_node_id::text, ''), COALESCE(se.class_node_ids, '{}'),
			se.teacher_id, se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern, se.venue_id
		FROM schedule_entries se
		WHERE se.tenant_id = $1 AND se.term_id = $2 AND se.status = 'draft'
	`, tenantID, termID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []TermScheduleBrief
	for rows.Next() {
		var b TermScheduleBrief
		var planEntryID, teacherID, venueID *string
		var periods []string
		if err := rows.Scan(&b.ID, &planEntryID, &b.ClassNodeID, &b.ClassNodeIDs, &teacherID,
			&b.DayOfWeek, &periods, &b.StartWeek, &b.EndWeek, &b.WeekPattern, &venueID); err != nil {
			return nil, err
		}
		b.PlanEntryID = planEntryID
		b.TeacherID = teacherID
		b.VenueID = venueID
		b.Periods = periods
		items = append(items, b)
	}
	return items, rows.Err()
}

// PublishScheduleEntries 批量发布排课，返回发布数与新版本（service 层 WithTx 事务内调用）。
// 草稿与已发布并存：发布 = 用当前草稿整体覆盖已发布（删旧 published 行 + 从 draft 复制为新 published 行），
// 草稿保留继续调整，再次发布再次覆盖。版本号为已发布区最大值 +1，首次发布为 1。
func (s *SchedulingStore) PublishScheduleEntries(ctx context.Context, tx Queryer, tenantID, termID string) (int64, int, error) {
	// 已发布区当前版本
	var curVersion int
	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(version), 0) FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2 AND status = 'published'
	`, tenantID, termID).Scan(&curVersion)
	newVersion := curVersion + 1

	if _, err := tx.Exec(ctx, `DELETE FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2 AND status = 'published'`, tenantID, termID); err != nil {
		return 0, 0, err
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
			class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
			venue_id, scenario_id, source, status, version)
		SELECT gen_random_uuid(), tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
			class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
			venue_id, scenario_id, source, 'published', $3
		FROM schedule_entries
		WHERE tenant_id = $1 AND term_id = $2 AND status = 'draft'
	`, tenantID, termID, newVersion)
	if err != nil {
		return 0, 0, err
	}
	return tag.RowsAffected(), newVersion, nil
}

// ListTimetableEntries 查询课表条目。
func (s *SchedulingStore) ListTimetableEntries(ctx context.Context, tenantID, termID, classNodeID, teacherID, status string) ([]domain.ScheduleEntry, error) {
	query := `
		SELECT se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type,
			se.class_node_id, se.class_node_ids, se.teacher_id, se.day_of_week, se.periods, se.start_week, se.end_week,
			se.week_pattern, se.venue_id, se.scenario_id, se.source, se.status, se.version,
			COALESCE(t.name, '') AS teacher_name, COALESCE(v.name, '') AS venue_name,
			COALESCE(o.name, '') AS class_name, COALESCE(sce.name, '') AS scenario_name
		FROM schedule_entries se
		LEFT JOIN users t ON t.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		LEFT JOIN organizations o ON o.id = se.class_node_id
		LEFT JOIN scenarios sce ON sce.id = se.scenario_id
		WHERE se.tenant_id = $1 AND se.term_id = $2`
	args := []any{tenantID, termID}
	if classNodeID != "" {
		query += ` AND ($` + Itoa(len(args)+1) + ` = ANY(se.class_node_ids) OR se.class_node_id = $` + Itoa(len(args)+1) + `)`
		args = append(args, classNodeID)
	}
	if teacherID != "" {
		query += ` AND se.teacher_id = $` + Itoa(len(args)+1)
		args = append(args, teacherID)
	}
	if status != "" {
		query += ` AND se.status = $` + Itoa(len(args)+1)
		args = append(args, status)
	}
	query += ` ORDER BY se.day_of_week, se.periods`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.ScheduleEntry, 0)
	for rows.Next() {
		var e domain.ScheduleEntry
		var planEntryID, courseCode, teacherID2, venueID, scenarioID *string
		var teacherName, venueName, className, scenarioName string
		if err := rows.Scan(&e.ID, &e.TermID, &planEntryID, &e.CourseName, &courseCode, &e.CourseID, &e.Type,
			&e.ClassNodeID, &e.ClassNodeIDs, &teacherID2, &e.DayOfWeek, &e.Periods, &e.StartWeek, &e.EndWeek,
			&e.WeekPattern, &venueID, &scenarioID, &e.Source, &e.Status, &e.Version,
			&teacherName, &venueName, &className, &scenarioName); err != nil {
			continue
		}
		e.PlanEntryID = planEntryID
		e.CourseCode = courseCode
		e.TeacherID = teacherID2
		e.VenueID = venueID
		e.ScenarioID = scenarioID
		e.TeacherName = teacherName
		e.VenueName = venueName
		e.ClassName = className
		e.ScenarioName = scenarioName
		items = append(items, e)
	}
	return items, rows.Err()
}

func (s *SchedulingStore) fetchScheduleEntry(ctx context.Context, id, tenantID string) (*domain.ScheduleEntry, error) {
	var e domain.ScheduleEntry
	var planEntryID, courseCode, teacherID2, venueID, scenarioID *string
	var teacherName, venueName, className, scenarioName string
	err := s.q.QueryRow(ctx, `
		SELECT se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type,
			se.class_node_id, se.class_node_ids, se.teacher_id, se.day_of_week, se.periods, se.start_week, se.end_week,
			se.week_pattern, se.venue_id, se.scenario_id, se.source, se.status, se.version,
			COALESCE(t.name, '') AS teacher_name, COALESCE(v.name, '') AS venue_name,
			COALESCE(o.name, '') AS class_name, COALESCE(sce.name, '') AS scenario_name
		FROM schedule_entries se
		LEFT JOIN users t ON t.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		LEFT JOIN organizations o ON o.id = se.class_node_id
		LEFT JOIN scenarios sce ON sce.id = se.scenario_id
		WHERE se.id = $1 AND se.tenant_id = $2
	`, id, tenantID).Scan(
		&e.ID, &e.TermID, &planEntryID, &e.CourseName, &courseCode, &e.CourseID, &e.Type,
		&e.ClassNodeID, &e.ClassNodeIDs, &teacherID2, &e.DayOfWeek, &e.Periods, &e.StartWeek, &e.EndWeek,
		&e.WeekPattern, &venueID, &scenarioID, &e.Source, &e.Status, &e.Version,
		&teacherName, &venueName, &className, &scenarioName)
	if err != nil {
		return nil, err
	}
	e.PlanEntryID = planEntryID
	e.CourseCode = courseCode
	e.TeacherID = teacherID2
	e.VenueID = venueID
	e.ScenarioID = scenarioID
	e.TeacherName = teacherName
	e.VenueName = venueName
	e.ClassName = className
	e.ScenarioName = scenarioName
	return &e, nil
}

// ScanScheduleEntryListRows 扫描排课列表行（含 class_name/class_names 等联表列）。
func ScanScheduleEntryListRows(rows pgx.Rows) ([]domain.ScheduleEntry, error) {
	items := make([]domain.ScheduleEntry, 0)
	for rows.Next() {
		var e domain.ScheduleEntry
		if err := rows.Scan(&e.ID, &e.TermID, &e.PlanEntryID, &e.CourseName, &e.CourseCode, &e.CourseID, &e.Type,
			&e.ClassNodeID, &e.ClassName, &e.TeacherID, &e.TeacherName, &e.DayOfWeek, &e.Periods,
			&e.StartWeek, &e.EndWeek, &e.WeekPattern, &e.VenueID, &e.VenueName,
			&e.ScenarioID, &e.ScenarioName, &e.Source, &e.Status, &e.Version, &e.CreatedAt, &e.UpdatedAt,
			&e.ClassNodeIDs, &e.ClassNames); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, nil
}

const scheduleEntrySelectColumns = "se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type, se.class_node_id, COALESCE(o.name, '') AS class_name, se.teacher_id, COALESCE(u.name, '') AS teacher_name, se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern, se.venue_id, COALESCE(v.name, '') AS venue_name, se.scenario_id, COALESCE(sc.name, '') AS scenario_name, se.source, se.status, se.version, se.created_at, se.updated_at, COALESCE(se.class_node_ids, '{}') AS class_node_ids, COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names"

const scheduleEntryListFrom = "schedule_entries se LEFT JOIN organizations o ON o.id = se.class_node_id LEFT JOIN users u ON u.id = se.teacher_id LEFT JOIN venues v ON v.id = se.venue_id LEFT JOIN scenarios sc ON sc.id = se.scenario_id"

func scheduleListFilter(p ListParams, qb *ListQueryBuilder) {
	if termID := p.Values["termId"]; termID != "" {
		qb.AddCondition("se.term_id = " + qb.NextArg(termID))
	}
	if status := p.Values["status"]; status != "" {
		qb.AddCondition("se.status = " + qb.NextArg(status))
	}
	if classNodeID := p.Values["classNodeId"]; classNodeID != "" {
		qb.AddCondition("(se.class_node_id = " + qb.NextArg(classNodeID) + " OR " + qb.NextArg(classNodeID) + " = ANY(se.class_node_ids))")
	}
	if teacherID := p.Values["teacherId"]; teacherID != "" {
		qb.AddCondition("se.teacher_id = " + qb.NextArg(teacherID))
	}
	if entryType := p.Values["type"]; entryType != "" {
		qb.AddCondition("se.type = " + qb.NextArg(entryType))
	}
}

// ListConfig 返回排课列表查询配置，SQL 片段沉淀在 store 层。
func (s *SchedulingStore) ListSchedulesConfig() ListQueryConfig[domain.ScheduleEntry] {
	return ListQueryConfig[domain.ScheduleEntry]{
		Table:         scheduleEntryListFrom,
		SelectColumns: scheduleEntrySelectColumns,
		TenantScoped:  true,
		TenantColumn:  "se.tenant_id",
		OrderBy:       "se.day_of_week ASC, se.start_week ASC",
		DefaultLimit:  200,
		ExtraFilter:   scheduleListFilter,
		ScanRows:      ScanScheduleEntryListRows,
	}
}

// ListVenuesConfig 返回场地列表查询配置。
func (s *SchedulingStore) ListVenuesConfig() ListQueryConfig[domain.Venue] {
	return ListQueryConfig[domain.Venue]{
		Table:         "venues",
		SelectColumns: "id, name, type, capacity, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "name",
		ScanRows:      ScanVenueRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if venueType := p.Values["type"]; venueType != "" {
				qb.AddCondition("type = " + qb.NextArg(venueType))
			}
		},
	}
}

// ListPeriodSlotsConfig 返回节次列表查询配置。
func (s *SchedulingStore) ListPeriodSlotsConfig() ListQueryConfig[domain.PeriodSlot] {
	return ListQueryConfig[domain.PeriodSlot]{
		Table:         "period_slots",
		SelectColumns: "id, name, slot_type, sort_order, start_time, end_time",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC",
		ScanRows:      ScanPeriodSlotRows,
	}
}

// UserOrgNodeID 查询用户组织节点。
func (s *SchedulingStore) UserOrgNodeID(ctx context.Context, userID, tenantID string) *string {
	var nodeID *string
	_ = s.q.QueryRow(ctx, `
		SELECT org_node_id FROM users WHERE id = $1 AND tenant_id = $2
	`, userID, tenantID).Scan(&nodeID)
	return nodeID
}

// FindTermForSchedule 查询含本人排课的最优学期。
func (s *SchedulingStore) FindTermForSchedule(ctx context.Context, tenantID, userID, classNodeID string) (string, error) {
	scopeCond := "se.teacher_id = $2::uuid"
	scopeArgs := []any{tenantID, userID}
	if classNodeID != "" {
		scopeCond = "(se.class_node_id = $2::uuid OR $2::uuid = ANY(se.class_node_ids))"
		scopeArgs = []any{tenantID, classNodeID}
	}
	var termID string
	err := s.q.QueryRow(ctx, `
		SELECT t.id FROM terms t
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS cnt FROM schedule_entries se
			WHERE se.term_id = t.id AND se.tenant_id = t.tenant_id
			  AND `+scopeCond+`
		) s ON true
		WHERE t.tenant_id = $1
		ORDER BY t.is_current DESC, COALESCE(s.cnt, 0) DESC, t.start_date DESC
		LIMIT 1
	`, scopeArgs...).Scan(&termID)
	return termID, err
}

// TimetableVersion 查询课表版本号。
func (s *SchedulingStore) TimetableVersion(ctx context.Context, tenantID, termID, status string) int {
	var version int
	_ = s.q.QueryRow(ctx, `
		SELECT COALESCE(MAX(version), 1) FROM schedule_entries WHERE tenant_id = $1 AND term_id = $2 AND status = $3
	`, tenantID, termID, status).Scan(&version)
	return version
}

// ScheduledExportMap 查询已排课导出映射。
type ScheduledExportMap struct {
	PlanEntryID *string
	Day         int
	Periods     domain.JSONSlice
	TeacherName string
	VenueName   string
	ClassNames  []string
}

// ListScheduledExportMap 查询已排课导出映射。
func (s *SchedulingStore) ListScheduledExportMap(ctx context.Context, tenantID, termID string) ([]ScheduledExportMap, error) {
	rows, err := s.q.Query(ctx, `
		SELECT se.plan_entry_id, se.day_of_week, se.periods,
			COALESCE(u.name, '') AS teacher_name, COALESCE(v.name, '') AS venue_name,
			COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names
		FROM schedule_entries se
		LEFT JOIN users u ON u.id = se.teacher_id
		LEFT JOIN venues v ON v.id = se.venue_id
		WHERE se.tenant_id = $1 AND se.term_id = $2 AND se.status = 'draft'
	`, tenantID, termID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ScheduledExportMap
	for rows.Next() {
		var m ScheduledExportMap
		if err := rows.Scan(&m.PlanEntryID, &m.Day, &m.Periods, &m.TeacherName, &m.VenueName, &m.ClassNames); err == nil {
			items = append(items, m)
		}
	}
	return items, rows.Err()
}

// PlanEntryBrief 教学计划条目简要。
type PlanEntryBrief struct {
	ID          string
	CourseName  string
	EntryType   string
	StartWeek   int
	EndWeek     int
	WeekPattern string
}

// ListPlanEntryBriefs 查询教学计划全部条目。
func (s *SchedulingStore) ListPlanEntryBriefs(ctx context.Context, tenantID, termID string) ([]PlanEntryBrief, error) {
	rows, err := s.q.Query(ctx, `
		SELECT e.id, e.course_name, e.type, e.start_week, e.end_week, e.week_pattern
		FROM teaching_plan_entries e
		JOIN teaching_plans p ON p.id = e.plan_id
		WHERE p.term_id = $1 AND p.tenant_id = $2
		ORDER BY e.start_week, e.course_name, e.id
	`, termID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PlanEntryBrief
	for rows.Next() {
		var e PlanEntryBrief
		if err := rows.Scan(&e.ID, &e.CourseName, &e.EntryType, &e.StartWeek, &e.EndWeek, &e.WeekPattern); err != nil {
			continue
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListTeacherNames 查询教师名单。
func (s *SchedulingStore) ListTeacherNames(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT DISTINCT u.name FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r2 ON r2.id = ur.role_id
		WHERE u.tenant_id = $1 AND u.name <> '' AND u.status = 'active' AND r2.code = 'teacher'
		ORDER BY u.name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil && n != "" {
			items = append(items, n)
		}
	}
	return items, rows.Err()
}

// ListVenueNames 查询场地名单。
func (s *SchedulingStore) ListVenueNames(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT name FROM venues WHERE tenant_id = $1 ORDER BY name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			items = append(items, n)
		}
	}
	return items, rows.Err()
}

// ListClassNames 查询班级名单。
func (s *SchedulingStore) ListClassNames(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `
		SELECT o.name FROM organizations o
		JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
		WHERE o.tenant_id = $1 AND t.name = '班级'
		ORDER BY o.name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			items = append(items, n)
		}
	}
	return items, rows.Err()
}

// BatchCreateSchedules 批量插入排课并标记计划条目（自动排课用，事务内执行）。
func (s *SchedulingStore) BatchCreateSchedules(ctx context.Context, tx Queryer, params []*ScheduleCreateParams) error {
	for _, p := range params {
		if _, err := tx.Exec(ctx, `
			INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
				class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
				venue_id, scenario_id, source, status, version)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft', 1)
		`, p.TenantID, p.TermID, p.PlanEntryID, p.CourseName, p.CourseCode, p.CourseID, p.Type,
			p.ClassNodeID, p.ClassNodeIDs, p.TeacherID, p.DayOfWeek, p.Periods, p.StartWeek, p.EndWeek, p.WeekPattern,
			p.VenueID, p.ScenarioID, p.Source); err != nil {
			return err
		}
		if p.PlanEntryID != nil && *p.PlanEntryID != "" {
			if _, err := tx.Exec(ctx, `
				UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = $1
			`, *p.PlanEntryID); err != nil {
				return err
			}
		}
	}
	return nil
}
