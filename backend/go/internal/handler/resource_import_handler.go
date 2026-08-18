package handler

// 资源 Excel 导入 HTTP 适配（门户基础数据 + 联盟业务）：
// 鉴权/租户/文件解析/响应映射，业务编排在 service.ResourceImportService
// （refactor-layering.md 分层契约）。

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// ResourceImportHandler handles Excel import for portal resources:
// industries, majors, organizations, students, teachers, and alliance business entities.
type ResourceImportHandler struct {
	Svc *service.ResourceImportService
}

// resourceImportResult 别名（唯一出处：service.ResourceImportService）。
type resourceImportResult = service.ResourceImportResult

// importFunc 各实体导入函数（service 方法引用）。
type importFunc func(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult)

func (h *ResourceImportHandler) PreviewIndustries(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "industries", h.Svc.DoImportIndustries, true)
}

func (h *ResourceImportHandler) PreviewMajors(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "majors", h.Svc.DoImportMajors, true)
}

func (h *ResourceImportHandler) PreviewOrganizations(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "organizations", h.Svc.DoImportOrganizations, true)
}

func (h *ResourceImportHandler) PreviewStudents(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "students", h.Svc.DoImportStudents, true)
}

func (h *ResourceImportHandler) PreviewTeachers(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "teachers", h.Svc.DoImportTeachers, true)
}

func (h *ResourceImportHandler) ImportIndustries(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "industries", h.Svc.DoImportIndustries, false)
}

func (h *ResourceImportHandler) ImportMajors(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "majors", h.Svc.DoImportMajors, false)
}

func (h *ResourceImportHandler) ImportOrganizations(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "organizations", h.Svc.DoImportOrganizations, false)
}

func (h *ResourceImportHandler) ImportStudents(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "students", h.Svc.DoImportStudents, false)
}

func (h *ResourceImportHandler) ImportTeachers(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "teachers", h.Svc.DoImportTeachers, false)
}

func (h *ResourceImportHandler) PreviewProjects(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-projects", h.Svc.DoImportProjects, true)
}

func (h *ResourceImportHandler) ImportProjects(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-projects", h.Svc.DoImportProjects, false)
}

func (h *ResourceImportHandler) PreviewAchievements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-achievements", h.Svc.DoImportAchievements, true)
}

func (h *ResourceImportHandler) ImportAchievements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-achievements", h.Svc.DoImportAchievements, false)
}

func (h *ResourceImportHandler) PreviewAgreements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-agreements", h.Svc.DoImportAgreements, true)
}

func (h *ResourceImportHandler) ImportAgreements(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-agreements", h.Svc.DoImportAgreements, false)
}

func (h *ResourceImportHandler) PreviewPermissions(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-permissions", h.Svc.DoImportPermissions, true)
}

func (h *ResourceImportHandler) ImportPermissions(w http.ResponseWriter, r *http.Request) {
	h.importExcel(w, r, "alliance-permissions", h.Svc.DoImportPermissions, false)
}

func (h *ResourceImportHandler) PreviewBrands(w http.ResponseWriter, r *http.Request) {
	brandType := r.URL.Query().Get("brandType")
	h.importExcel(w, r, "alliance-brands", func(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
		return h.Svc.DoImportBrands(ctx, xlsx, tenantID, userID, brandType, preview, overwrite, rename)
	}, true)
}

func (h *ResourceImportHandler) ImportBrands(w http.ResponseWriter, r *http.Request) {
	brandType := r.URL.Query().Get("brandType")
	h.importExcel(w, r, "alliance-brands", func(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) (*ImportPreviewResult, *resourceImportResult) {
		return h.Svc.DoImportBrands(ctx, xlsx, tenantID, userID, brandType, preview, overwrite, rename)
	}, false)
}

func (h *ResourceImportHandler) importExcel(w http.ResponseWriter, r *http.Request, entity string, fn importFunc, preview bool) {
	claims := middleware.CurrentUser(r)
	// alliance-* 导入面向业务角色（教师等，与 alliance 模块权限一致），
	// 组织架构/师生/专业行业等基础数据导入仍限门户系统管理员
	permit := canManageAlliance(r)
	if !strings.HasPrefix(entity, "alliance-") {
		permit = canManagePortal(r)
	}
	if claims == nil || !permit {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID
	overwrite := importOverwriteParam(r)
	rename := importRenameParam(r)

	r.Body = http.MaxBytesReader(w, r.Body, 60<<20)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "表单无效")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "解析Excel文件失败")
		return
	}
	defer xlsx.Close()

	previewRes, execRes := fn(r.Context(), xlsx, tenantID, userID, preview, overwrite, rename)

	if preview {
		slog.Info(fmt.Sprintf("[import/preview/%s] result: created=%d duplicates=%d failed=%d duplicateItems=%d errors=%d",
			entity, previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.DuplicateItems), len(previewRes.Errors)))
		for _, e := range previewRes.Errors {
			slog.Info(fmt.Sprintf("[import/preview/%s] error: %s", entity, e))
		}
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/%s] result: created=%d failed=%d skipped=%d errors=%d",
		entity, execRes.Created, execRes.Failed, execRes.Skipped, len(execRes.Errors)))
	for _, e := range execRes.Errors {
		slog.Info(fmt.Sprintf("[import/%s] error: %s", entity, e))
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":         execRes.Created,
		"failed":          execRes.Failed,
		"skipped":         execRes.Skipped,
		"entity":          entity,
		"industryCreated": execRes.IndustryCreated,
		"majorCreated":    execRes.MajorCreated,
		"orgCreated":      execRes.OrgCreated,
		"studentCreated":  execRes.StudentCreated,
		"teacherCreated":  execRes.TeacherCreated,
		"errors":          execRes.Errors,
	})
}
