package handler

// 资源导出 HTTP 适配：鉴权/租户/请求体/模板生成/响应写出，
// 数据填充编排在 service.ResourceExportService（refactor-layering.md 分层契约）。

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ResourceExportHandler handles Excel export for portal resources:
// organizations, students and teachers.
type ResourceExportHandler struct {
	Store *store.Store
	Svc   *service.ResourceExportService
}

func (h *ResourceExportHandler) ExportOrganizations(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "organizations", h.Svc.FillOrganizations)
}

func (h *ResourceExportHandler) ExportStudents(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "students", h.Svc.FillStudents)
}

func (h *ResourceExportHandler) ExportTeachers(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "teachers", h.Svc.FillTeachers)
}

type exportFillFunc func(ctx context.Context, f *excelize.File, tenantID string, ids []string) error

func (h *ResourceExportHandler) exportExcel(w http.ResponseWriter, r *http.Request, entity string, fill exportFillFunc) {
	claims := middleware.CurrentUser(r)
	if claims == nil || !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	// 空 body（EOF）导出全部；非法 JSON 返回 400，避免畸形请求触发全量导出
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}

	var f *excelize.File
	switch entity {
	case "organizations":
		f = th.generateOrganizationTemplate(ctx, tenantID)
	case "students":
		f = th.generateStudentTemplate(ctx, tenantID)
	case "teachers":
		f = th.generateTeacherTemplate(ctx, tenantID)
	default:
		respondError(w, http.StatusBadRequest, "不支持的实体")
		return
	}

	if err := fill(ctx, f, tenantID, req.IDs); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	filename := map[string]string{
		"organizations": "组织架构导出.xlsx",
		"students":      "学生导出.xlsx",
		"teachers":      "教师导出.xlsx",
	}[entity]
	writeExcel(w, r, f, filename)
}
