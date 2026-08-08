package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TrainingProgramHandler struct {
	Service *service.AffairsPlanService
}
type TrainingProgramRequest struct {
	Name         string   `json:"name"`
	Code         *string  `json:"code"`
	MajorID      *string  `json:"majorId"`
	EntryYear    int      `json:"entryYear"`
	Level        *string  `json:"level"`
	Duration     *int     `json:"duration"`
	TotalCredits *float64 `json:"totalCredits"`
	Description  *string  `json:"description"`
	BatchID      *string  `json:"batchId"`
}

type PutProgramCoursesRequest struct {
	Courses []ProgramCourseRequest `json:"courses"`
}

type ProgramCourseRequest struct {
	Name       string   `json:"name"`
	Code       *string  `json:"code"`
	Credits    *float64 `json:"credits"`
	Hours      *int     `json:"hours"`
	Semester   *int     `json:"semester"`
	Nature     string   `json:"nature"`
	Assessment *string  `json:"assessment"`
	PositionID *string  `json:"positionId"`
	CourseID   *string  `json:"courseId"`
	SortOrder  int      `json:"sortOrder"`
}

func (h *TrainingProgramHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().TrainingPrograms().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTrainingPrograms(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询人培方案失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.TrainingProgram]{Items: items, Total: total})
}

func (h *TrainingProgramHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	program, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	respondJSON(w, http.StatusOK, program)
}

func (h *TrainingProgramHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req TrainingProgramRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.EntryYear <= 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	code := req.Code
	if code == nil || *code == "" {
		gen, err := h.Service.GenerateEntityCode(r.Context(), "RP", "training_programs", tenantID)
		if err == nil {
			code = &gen
		}
	}
	program, err := h.Service.CreateTrainingProgram(r.Context(), tenantID, &store.TrainingProgramParams{
		Name: req.Name, Code: code, MajorID: emptyStrToNil(req.MajorID), EntryYear: req.EntryYear,
		Level: emptyStrToNil(req.Level), Duration: req.Duration, TotalCredits: req.TotalCredits,
		Description: emptyStrToNil(req.Description), CreatedBy: claims.UserID,
	})
	if err != nil {
		respondServerError(w, r, err, "创建人培方案失败")
		return
	}
	respondJSON(w, http.StatusCreated, program)
}

func (h *TrainingProgramHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	existing, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	var req TrainingProgramRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.EntryYear <= 0 {
		req.EntryYear = existing.EntryYear
	}
	if req.Code == nil {
		req.Code = existing.Code
	}
	if req.MajorID == nil {
		req.MajorID = existing.MajorID
	}
	if req.Level == nil {
		req.Level = existing.Level
	}
	if req.Duration == nil {
		req.Duration = existing.Duration
	}
	if req.TotalCredits == nil {
		req.TotalCredits = existing.TotalCredits
	}
	if req.Description == nil {
		req.Description = existing.Description
	}
	if req.BatchID == nil {
		req.BatchID = existing.BatchID
	}
	program, err := h.Service.UpdateTrainingProgram(r.Context(), id, tenantID, &store.TrainingProgramParams{
		Name: req.Name, Code: emptyStrToNil(req.Code), MajorID: emptyStrToNil(req.MajorID), EntryYear: req.EntryYear,
		Level: emptyStrToNil(req.Level), Duration: req.Duration, TotalCredits: req.TotalCredits,
		Description: emptyStrToNil(req.Description), BatchID: emptyStrToNil(req.BatchID),
	})
	if err != nil {
		respondServerError(w, r, err, "更新人培方案失败")
		return
	}
	respondJSON(w, http.StatusOK, program)
}

func (h *TrainingProgramHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	if err := h.Service.DeleteTrainingProgram(r.Context(), id, tenantID); err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusBadRequest, "该方案已被教学计划引用，无法删除")
			return
		}
		respondServerError(w, r, err, "删除人培方案失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TrainingProgramHandler) Publish(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	program, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	status := "published"
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Status != "" {
		status = req.Status
	}
	if status != "draft" && status != "published" {
		respondError(w, http.StatusBadRequest, "状态仅支持 draft/published")
		return
	}
	if program.Status == status {
		respondJSON(w, http.StatusOK, program)
		return
	}
	program, err = h.Service.UpdateTrainingProgramStatus(r.Context(), id, tenantID, status)
	if err != nil {
		respondServerError(w, r, err, "更新方案状态失败")
		return
	}
	respondJSON(w, http.StatusOK, program)
}

func (h *TrainingProgramHandler) ListCourses(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	courses, err := h.Service.ListTrainingProgramCourses(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询课程设置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": courses, "total": len(courses)})
}

func (h *TrainingProgramHandler) PutCourses(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetTrainingProgram(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	var req PutProgramCoursesRequest
	if !decodeBody(w, r, &req) {
		return
	}
	courses := make([]store.ProgramCourseItem, 0, len(req.Courses))
	for i, c := range req.Courses {
		if (c.PositionID == nil || *c.PositionID == "") && (c.CourseID == nil || *c.CourseID == "") {
			respondError(w, http.StatusBadRequest, "须至少关联岗位或体系课")
			return
		}
		nature := c.Nature
		if nature == "" {
			nature = "必修"
		}
		semester := c.Semester
		if semester == nil || *semester <= 0 {
			one := 1
			semester = &one
		}
		sortOrder := c.SortOrder
		if sortOrder == 0 {
			sortOrder = i
		}
		courses = append(courses, store.ProgramCourseItem{
			Name: c.Name, Code: emptyStrToNil(c.Code), Credits: c.Credits, Hours: c.Hours,
			Semester: semester, Nature: nature, Assessment: emptyStrToNil(c.Assessment),
			PositionID: emptyStrToNil(c.PositionID), CourseID: emptyStrToNil(c.CourseID), SortOrder: sortOrder,
		})
	}
	if err := h.Service.PutTrainingProgramCourses(r.Context(), id, courses); err != nil {
		respondServerError(w, r, err, "保存课程设置失败")
		return
	}
	coursesOut, err := h.Service.ListTrainingProgramCourses(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询方案课程失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": coursesOut, "total": len(coursesOut)})
}

func (h *TrainingProgramHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.TrainingProgramStoreRef(),
		table:      "training_programs",
		entityName: "training_program",
		targetType: "training_program",
		inviteCol:  "collaborators",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.Service.GetTrainingProgramByID(ctx, id)
		},
	}
}

func (h *TrainingProgramHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}
func (h *TrainingProgramHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}
func (h *TrainingProgramHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}
func (h *TrainingProgramHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}
func (h *TrainingProgramHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}
func (h *TrainingProgramHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}
func (h *TrainingProgramHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *TrainingProgramHandler) Clone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var req struct {
		Name *string `json:"name"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	src, err := h.Service.GetTrainingProgram(ctx, id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "人培方案不存在")
		return
	}
	if src.Status == "" {
		src.Status = "draft"
	}
	newName := src.Name + " (克隆)"
	if req.Name != nil && *req.Name != "" {
		newName = *req.Name
	}

	newID, err := h.Service.CloneTrainingProgram(ctx, tenantID, claims.UserID, src, newName)
	if err != nil {
		respondServerError(w, r, err, "克隆失败")
		return
	}
	program, err := h.Service.GetTrainingProgram(ctx, newID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询克隆计划失败")
		return
	}
	respondJSON(w, http.StatusCreated, program)
}
