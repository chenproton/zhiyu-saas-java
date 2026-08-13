package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type CourseCloneHandler struct {
	Service *service.LessonContentService
}

type CloneCourseRequest struct {
	Name string `json:"name"`
}

func (h *CourseCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	safeHandler(w, r, "[CloneCourse]", func() {
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

		var req CloneCourseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
			respondError(w, http.StatusBadRequest, "无效请求体")
			return
		}

		newID, err := h.Service.CloneCourse(r.Context(), tenantID, id, req.Name, claims.UserID)
		if err != nil {
			if service.IsNotFound(err) {
				respondError(w, http.StatusNotFound, "课程不存在")
				return
			}
			if err == service.ErrCourseNotInTenant {
				respondError(w, http.StatusForbidden, "权限不足")
				return
			}
			if isUniqueViolation(err) {
				respondError(w, http.StatusConflict, "课程名称已存在，请使用其他名称")
				return
			}
			respondServerError(w, r, err, "克隆课程失败")
			return
		}

		course, err := h.Service.GetCourse(r.Context(), newID)
		if err != nil {
			respondServerError(w, r, err, "获取克隆课程失败")
			return
		}
		slog.Info("[CloneCourse] success", "new_course_id", newID)
		respondJSON(w, http.StatusCreated, course)
	})
}
