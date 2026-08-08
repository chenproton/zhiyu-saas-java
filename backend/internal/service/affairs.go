package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ErrNoPeriodSlots 未配置节次。
var ErrNoPeriodSlots = errors.New("未配置节次")

// ErrNoVenues 未配置场地。
var ErrNoVenues = errors.New("未配置场地")

// AffairsService 教务排课业务编排。
type AffairsService struct {
	*Service
	st *store.Store
}

// NewAffairsService 创建教务服务。
func NewAffairsService(s *Service) *AffairsService {
	return &AffairsService{Service: s, st: s.Store()}
}

// ===== 场地 =====

// ListVenues 查询场地列表。
func (s *AffairsService) ListVenues(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Venue]) ([]domain.Venue, int, error) {
	return s.st.Scheduling().ListVenues(ctx, p, cfg)
}

// GetVenue 查询单个场地。
func (s *AffairsService) GetVenue(ctx context.Context, id, tenantID string) (*domain.Venue, error) {
	return s.st.Scheduling().GetVenue(ctx, id, tenantID)
}

// CreateVenue 创建场地。
func (s *AffairsService) CreateVenue(ctx context.Context, p *store.VenueParams) (*domain.Venue, error) {
	return s.st.Scheduling().CreateVenue(ctx, p)
}

// UpdateVenue 更新场地。
func (s *AffairsService) UpdateVenue(ctx context.Context, id, tenantID string, p *store.VenueParams) (*domain.Venue, error) {
	return s.st.Scheduling().UpdateVenue(ctx, id, tenantID, p)
}

// DeleteVenue 删除场地。
func (s *AffairsService) DeleteVenue(ctx context.Context, id, tenantID string) error {
	return s.st.Scheduling().DeleteVenue(ctx, id, tenantID)
}

// ===== 节次 =====

// ListPeriodSlots 查询节次列表。
func (s *AffairsService) ListPeriodSlots(ctx context.Context, tenantID string) ([]domain.PeriodSlot, error) {
	return s.st.Scheduling().ListPeriodSlots(ctx, tenantID)
}

// CreatePeriodSlot 创建节次。
func (s *AffairsService) CreatePeriodSlot(ctx context.Context, p *store.PeriodSlotParams) (*domain.PeriodSlot, error) {
	return s.st.Scheduling().CreatePeriodSlot(ctx, p)
}

// UpdatePeriodSlot 更新节次。
func (s *AffairsService) UpdatePeriodSlot(ctx context.Context, id, tenantID string, p *store.PeriodSlotParams) (*domain.PeriodSlot, error) {
	return s.st.Scheduling().UpdatePeriodSlot(ctx, id, tenantID, p)
}

// DeletePeriodSlot 删除节次。
func (s *AffairsService) DeletePeriodSlot(ctx context.Context, id, tenantID string) error {
	return s.st.Scheduling().DeletePeriodSlot(ctx, id, tenantID)
}

// ReplacePeriodSlots 事务内按名称整体替换节次，返回替换后的完整列表。
func (s *AffairsService) ReplacePeriodSlots(ctx context.Context, tenantID string, items []store.PeriodSlotParams) ([]domain.PeriodSlot, error) {
	var result []domain.PeriodSlot
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		var err error
		result, err = txStore.Scheduling().ReplacePeriodSlots(ctx, txStore.Q(), tenantID, items)
		return err
	})
	return result, err
}

// ===== 排课 =====

// ListSchedules 查询排课列表。
func (s *AffairsService) ListSchedules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ScheduleEntry]) ([]domain.ScheduleEntry, int, error) {
	return s.st.Scheduling().ListSchedules(ctx, p, cfg)
}

// GetSchedule 查询单个排课。
func (s *AffairsService) GetSchedule(ctx context.Context, id, tenantID string) (*domain.ScheduleEntry, error) {
	return s.st.Scheduling().GetSchedule(ctx, id, tenantID)
}

// CreateScheduleChecked 事务内完成「advisory 锁 + 冲突校验 + 插入」，
// 冲突时返回冲突列表不落库，避免检查与插入分离事务导致的并发竞态。
func (s *AffairsService) CreateScheduleChecked(ctx context.Context, tenantID string, p *store.ScheduleCreateParams) (string, []domain.ScheduleConflict, error) {
	var id string
	var conflicts []domain.ScheduleConflict
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Scheduling().LockScheduleTerm(ctx, txStore.Q(), tenantID, p.TermID); err != nil {
			return err
		}
		var err error
		conflicts, err = txStore.Scheduling().CheckScheduleConflictsTx(ctx, txStore.Q(), tenantID, p.TermID, conflictParamsFromCreate(p), "")
		if err != nil {
			return err
		}
		if len(conflicts) > 0 {
			return nil
		}
		id, err = txStore.Scheduling().CreateSchedule(ctx, txStore.Q(), p)
		return err
	})
	return id, conflicts, err
}

// UpdateScheduleChecked 事务内完成「advisory 锁 + 冲突校验 + 更新」，排除自身 id。
func (s *AffairsService) UpdateScheduleChecked(ctx context.Context, id, tenantID string, p *store.ScheduleCreateParams) ([]domain.ScheduleConflict, error) {
	var conflicts []domain.ScheduleConflict
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Scheduling().LockScheduleTerm(ctx, txStore.Q(), tenantID, p.TermID); err != nil {
			return err
		}
		var err error
		conflicts, err = txStore.Scheduling().CheckScheduleConflictsTx(ctx, txStore.Q(), tenantID, p.TermID, conflictParamsFromCreate(p), id)
		if err != nil {
			return err
		}
		if len(conflicts) > 0 {
			return nil
		}
		return txStore.Scheduling().UpdateSchedule(ctx, txStore.Q(), id, tenantID, p)
	})
	return conflicts, err
}

// conflictParamsFromCreate 从创建参数派生冲突校验参数。
func conflictParamsFromCreate(p *store.ScheduleCreateParams) *store.ScheduleConflictParams {
	return &store.ScheduleConflictParams{
		TermID:       p.TermID,
		PlanEntryID:  p.PlanEntryID,
		ClassNodeID:  p.ClassNodeID,
		ClassNodeIDs: p.ClassNodeIDs,
		TeacherID:    p.TeacherID,
		DayOfWeek:    p.DayOfWeek,
		Periods:      p.Periods,
		StartWeek:    p.StartWeek,
		EndWeek:      p.EndWeek,
		WeekPattern:  p.WeekPattern,
		VenueID:      p.VenueID,
	}
}

// DeleteScheduleWithRestore 删除排课并恢复计划条目为待排（事务内）。
func (s *AffairsService) DeleteScheduleWithRestore(ctx context.Context, id, tenantID string, planEntryID *string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Scheduling().DeleteScheduleWithRestore(ctx, txStore.Q(), id, tenantID, planEntryID)
	})
}

// FetchTermBrief 查询学期。
func (s *AffairsService) FetchTermBrief(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	return s.st.Scheduling().FetchTermBrief(ctx, id, tenantID)
}

// FallbackClassID 查询教学计划条目班级。
func (s *AffairsService) FallbackClassID(ctx context.Context, entryID string) *string {
	return s.st.Scheduling().FallbackClassID(ctx, entryID)
}

// PlanEntryTenantID 查询教学计划条目所属租户（排课归属校验用）。
func (s *AffairsService) PlanEntryTenantID(ctx context.Context, entryID string) (string, error) {
	return s.st.Scheduling().PlanEntryTenantID(ctx, entryID)
}

// ResolveCourseIDByCode 按编码解析课程。
func (s *AffairsService) ResolveCourseIDByCode(ctx context.Context, tenantID string, courseCode *string) *string {
	return s.st.Scheduling().ResolveCourseIDByCode(ctx, s.st.Q(), tenantID, courseCode)
}

// PlanEntryCourseID 查询教学计划条目课程 ID。
func (s *AffairsService) PlanEntryCourseID(ctx context.Context, entryID string) *string {
	return s.st.Scheduling().PlanEntryCourseID(ctx, s.st.Q(), entryID)
}

// ListTimetableEntries 查询课表条目。
func (s *AffairsService) ListTimetableEntries(ctx context.Context, tenantID, termID, classNodeID, teacherID, status string) ([]domain.ScheduleEntry, error) {
	return s.st.Scheduling().ListTimetableEntries(ctx, tenantID, termID, classNodeID, teacherID, status)
}

// AutoSchedule 编排：加载节次/场地/待排条目 + 锁内重读现有排课 + 内存冲突判断 + 批量插入。
// 冲突校验与插入整体在 advisory 锁事务内执行，防止并发自动/手动排课基于同一快照产生重叠排课。
func (s *AffairsService) AutoSchedule(ctx context.Context, tenantID, termID, planID string) (int, int, []string, error) {
	periodNames, err := s.st.Scheduling().PeriodSlotNames(ctx, tenantID)
	if err != nil {
		return 0, 0, nil, err
	}
	if len(periodNames) == 0 {
		return 0, 0, nil, ErrNoPeriodSlots
	}
	venues, err := s.st.Scheduling().ListVenueBriefs(ctx, tenantID)
	if err != nil {
		return 0, 0, nil, err
	}
	if len(venues) == 0 {
		return 0, 0, nil, ErrNoVenues
	}
	pending, err := s.st.Scheduling().ListPendingPlanEntries(ctx, tenantID, termID, planID)
	if err != nil {
		return 0, 0, nil, err
	}

	success := 0
	failed := 0
	failures := make([]string, 0)

	err = s.WithTx(ctx, func(txStore *store.Store) error {
		// advisory 锁串行化并发排课（自动+手动）
		if err := txStore.Scheduling().LockScheduleTerm(ctx, txStore.Q(), tenantID, termID); err != nil {
			return err
		}
		// 锁内重读现有排课，防止基于陈旧快照计算冲突
		existing, err := txStore.Scheduling().ListTermScheduleBriefs(ctx, txStore.Q(), tenantID, termID)
		if err != nil {
			return err
		}
		creates := make([]*store.ScheduleCreateParams, 0)
		for _, e := range pending {
			candidateVenues := venues
			if e.VenueType != "" {
				filtered := make([]store.VenueBrief, 0)
				for _, v := range venues {
					if v.Type == e.VenueType {
						filtered = append(filtered, v)
					}
				}
				if len(filtered) > 0 {
					candidateVenues = filtered
				}
			}

			placed := false
			entryType := e.EntryType
			if entryType == "theory" || entryType == "practice" {
				entryType = "traditional"
			}
			weekPattern := e.WeekPattern
			if weekPattern == "" {
				weekPattern = "all"
			}

		dayLoop:
			for day := 1; day <= 7; day++ {
				for _, periodName := range periodNames {
					for _, venue := range candidateVenues {
						// 运行内已放置的排课也参与冲突检查（防止同一次自动排课内部重复占用）
						// 全新切片避免 append 复用 existing 底层数组（其 cap 可能大于 len）
						checkSet := make([]store.TermScheduleBrief, 0, len(existing)+len(creates))
						checkSet = append(checkSet, existing...)
						checkSet = append(checkSet, createdBriefs(creates)...)
						if hasScheduleConflict(checkSet, &store.ScheduleConflictParams{
							PlanEntryID: store.StrPtrIfNonEmpty(e.ID),
							ClassNodeID: e.ClassNodeID,
							TeacherID:   store.StrPtrIfNonEmpty(e.TeacherID),
							DayOfWeek:   day,
							Periods:     domain.JSONSlice{periodName},
							StartWeek:   e.StartWeek,
							EndWeek:     e.EndWeek,
							WeekPattern: weekPattern,
							VenueID:     &venue.ID,
						}) {
							continue
						}
						creates = append(creates, &store.ScheduleCreateParams{
							TenantID:    tenantID,
							TermID:      termID,
							PlanEntryID: &e.ID,
							CourseName:  e.CourseName,
							CourseCode:  store.StrPtrIfNonEmpty(e.CourseCode),
							CourseID:    store.StrPtrIfNonEmpty(e.CourseID),
							Type:        entryType,
							ClassNodeID: e.ClassNodeID,
							TeacherID:   store.StrPtrIfNonEmpty(e.TeacherID),
							DayOfWeek:   day,
							Periods:     domain.JSONSlice{periodName},
							StartWeek:   e.StartWeek,
							EndWeek:     e.EndWeek,
							WeekPattern: weekPattern,
							VenueID:     &venue.ID,
							ScenarioID:  store.StrPtrIfNonEmpty(e.ScenarioID),
							Source:      "auto",
						})
						success++
						placed = true
						break dayLoop
					}
				}
			}

			if !placed {
				failed++
				failures = append(failures, fmt.Sprintf("%s：未找到可用时段", e.CourseName))
			}
		}

		if err := txStore.Scheduling().BatchCreateSchedules(ctx, txStore.Q(), creates); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, 0, nil, err
	}
	return success, failed, failures, nil
}

// createdBriefs 把本次自动排课已生成的参数转成冲突检查用 brief。
func createdBriefs(creates []*store.ScheduleCreateParams) []store.TermScheduleBrief {
	briefs := make([]store.TermScheduleBrief, 0, len(creates))
	for _, c := range creates {
		periods := make([]string, 0, len(c.Periods))
		for _, p := range c.Periods {
			if s, ok := p.(string); ok {
				periods = append(periods, s)
			}
		}
		briefs = append(briefs, store.TermScheduleBrief{
			PlanEntryID: c.PlanEntryID,
			ClassNodeID: c.ClassNodeID,
			TeacherID:   c.TeacherID,
			DayOfWeek:   c.DayOfWeek,
			Periods:     periods,
			StartWeek:   c.StartWeek,
			EndWeek:     c.EndWeek,
			WeekPattern: c.WeekPattern,
			VenueID:     c.VenueID,
		})
	}
	return briefs
}

// hasScheduleConflict 内存判断排课冲突（语义与 CheckScheduleConflicts 一致）：
// 同教学计划条目多班级同时上课不算冲突；教师/班级/场地任一重叠即冲突。
func hasScheduleConflict(existing []store.TermScheduleBrief, p *store.ScheduleConflictParams) bool {
	reqClasses := p.ClassNodeIDs
	if len(reqClasses) == 0 && p.ClassNodeID != "" {
		reqClasses = []string{p.ClassNodeID}
	}
	for _, ex := range existing {
		if ex.DayOfWeek != p.DayOfWeek {
			continue
		}
		if ex.EndWeek < p.StartWeek || ex.StartWeek > p.EndWeek {
			continue
		}
		exPattern := ex.WeekPattern
		if exPattern == "" {
			exPattern = "all"
		}
		if exPattern != "all" && p.WeekPattern != "all" && exPattern != p.WeekPattern {
			continue
		}
		if !periodsOverlap(ex.Periods, store.JSONSliceToStrings(p.Periods)) {
			continue
		}
		if p.PlanEntryID != nil && ex.PlanEntryID != nil && *ex.PlanEntryID == *p.PlanEntryID {
			continue
		}
		if p.TeacherID != nil && *p.TeacherID != "" && ex.TeacherID != nil && *ex.TeacherID == *p.TeacherID {
			return true
		}
		existingClasses := ex.ClassNodeIDs
		if len(existingClasses) == 0 && ex.ClassNodeID != "" {
			existingClasses = []string{ex.ClassNodeID}
		}
		for _, ec := range existingClasses {
			for _, rc := range reqClasses {
				if ec == rc {
					return true
				}
			}
		}
		if p.VenueID != nil && *p.VenueID != "" && ex.VenueID != nil && *ex.VenueID == *p.VenueID {
			return true
		}
	}
	return false
}

// periodsOverlap 判断两个节次列表是否有交集。
func periodsOverlap(a, b []string) bool {
	for _, x := range a {
		for _, y := range b {
			if x == y {
				return true
			}
		}
	}
	return false
}

// PublishSchedules 批量发布排课。
func (s *AffairsService) PublishSchedules(ctx context.Context, tenantID, termID string) (int64, int, error) {
	return s.st.Scheduling().PublishScheduleEntries(ctx, tenantID, termID)
}

// QueryerForStore 返回 Store（contentActions 用）。
func (s *AffairsService) Store() *store.Store {
	return s.st
}

// UserOrgNodeID 查询用户组织节点。
func (s *AffairsService) UserOrgNodeID(ctx context.Context, userID, tenantID string) *string {
	return s.st.Scheduling().UserOrgNodeID(ctx, userID, tenantID)
}

// FindTermForSchedule 查询含本人排课的最优学期。
func (s *AffairsService) FindTermForSchedule(ctx context.Context, tenantID, userID, classNodeID string) (string, error) {
	return s.st.Scheduling().FindTermForSchedule(ctx, tenantID, userID, classNodeID)
}

// TimetableVersion 查询课表版本。
func (s *AffairsService) TimetableVersion(ctx context.Context, tenantID, termID, status string) int {
	return s.st.Scheduling().TimetableVersion(ctx, tenantID, termID, status)
}

// ListScheduledExportMap 查询已排课导出映射。
func (s *AffairsService) ListScheduledExportMap(ctx context.Context, tenantID, termID string) ([]store.ScheduledExportMap, error) {
	return s.st.Scheduling().ListScheduledExportMap(ctx, tenantID, termID)
}

// ListPlanEntryBriefs 查询教学计划条目。
func (s *AffairsService) ListPlanEntryBriefs(ctx context.Context, tenantID, termID string) ([]store.PlanEntryBrief, error) {
	return s.st.Scheduling().ListPlanEntryBriefs(ctx, tenantID, termID)
}

// ListTeacherNames 查询教师名单。
func (s *AffairsService) ListTeacherNames(ctx context.Context, tenantID string) ([]string, error) {
	return s.st.Scheduling().ListTeacherNames(ctx, tenantID)
}

// ListClassNames 查询班级名单。
func (s *AffairsService) ListClassNames(ctx context.Context, tenantID string) ([]string, error) {
	return s.st.Scheduling().ListClassNames(ctx, tenantID)
}

// ListPeriodSlotsPage 分页查询节次（ListQueryConfig 通用路径）。
func (s *AffairsService) ListPeriodSlotsPage(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.PeriodSlot]) ([]domain.PeriodSlot, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, cfg, store.ScanPeriodSlotRows)
}

// GetPeriodSlot 查询单个节次。
func (s *AffairsService) GetPeriodSlot(ctx context.Context, id, tenantID string) (*domain.PeriodSlot, error) {
	return s.st.Scheduling().GetPeriodSlot(ctx, id, tenantID)
}

// ListVenueBriefs 查询场地简要列表。
func (s *AffairsService) ListVenueBriefs(ctx context.Context, tenantID string) ([]store.VenueBrief, error) {
	return s.st.Scheduling().ListVenueBriefs(ctx, tenantID)
}
