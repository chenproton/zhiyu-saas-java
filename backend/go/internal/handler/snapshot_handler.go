package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// SnapshotHandler 资源快照 bundle 读取（学生/教师共用只读）。
// 学生角色响应经 StripStudentAnswers 剥离内嵌答案/解析（文档 5.2 安全要求）。
type SnapshotHandler struct {
	Service *service.SnapshotService
}

func (h *SnapshotHandler) GetScenarioSnapshot(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, store.SnapshotResourceScenario)
}

func (h *SnapshotHandler) GetCourseSnapshot(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, store.SnapshotResourceCourse)
}

func (h *SnapshotHandler) GetExamSnapshot(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, store.SnapshotResourceExam)
}

func (h *SnapshotHandler) GetQuestionBankSnapshot(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, store.SnapshotResourceQuestionBank)
}

func (h *SnapshotHandler) GetPositionSnapshot(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, store.SnapshotResourcePosition)
}

// serve 公共读取路径：租户校验（claims 租户 + store 层 SQL tenant_id 双重限定）+ 版本解析 + 学生剥离。
func (h *SnapshotHandler) serve(w http.ResponseWriter, r *http.Request, resourceType string) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	version := r.URL.Query().Get("version")

	data, _, err := h.Service.GetBundle(r.Context(), tenantID, resourceType, id, version)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "资源不存在或未发布")
			return
		}
		respondServerError(w, r, err, "查询资源快照失败")
		return
	}
	if middleware.HasRole(claims, domain.RoleStudent) {
		data = service.StripStudentAnswers(resourceType, data)
	}
	respondJSON(w, http.StatusOK, data)
}
