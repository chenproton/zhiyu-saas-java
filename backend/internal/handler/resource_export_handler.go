package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ResourceExportHandler handles Excel export for portal resources:
// organizations, students and teachers.
type ResourceExportHandler struct {
	Store *store.Store
}

func (h *ResourceExportHandler) ExportOrganizations(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "organizations", h.fillOrganizations)
}

func (h *ResourceExportHandler) ExportStudents(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "students", h.fillStudents)
}

func (h *ResourceExportHandler) ExportTeachers(w http.ResponseWriter, r *http.Request) {
	h.exportExcel(w, r, "teachers", h.fillTeachers)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// No body or empty body means export all.
		req.IDs = nil
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

func (h *ResourceExportHandler) fillOrganizations(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	dataStyle := makeDataStyle(f)

	storeOrgs, err := store.ListExportOrganizations(ctx, h.Store.Q(), tenantID, ids)
	if err != nil {
		return err
	}

	type orgRow struct {
		id       string
		name     string
		typeID   string
		typeName string
		parentID *string
		sort     int
	}
	var orgs []orgRow
	for _, o := range storeOrgs {
		orgs = append(orgs, orgRow{id: o.ID, name: o.Name, typeID: o.TypeID, parentID: o.ParentID, sort: o.Sort})
	}

	for i := range orgs {
		var typeName string
		if name, err := store.GetOrgTypeName(ctx, h.Store.Q(), orgs[i].typeID); err != nil {
			slog.Warn("导出组织类型名查询失败", "typeId", orgs[i].typeID, "error", err)
		} else {
			typeName = name
		}
		orgs[i].typeName = typeName
	}

	parentNames := make(map[string]string)
	for _, o := range orgs {
		if o.parentID != nil && *o.parentID != "" {
			var name string
			if n, err := store.GetOrganizationName(ctx, h.Store.Q(), *o.parentID); err != nil {
				slog.Warn("导出组织上级名称查询失败", "orgId", *o.parentID, "error", err)
			} else {
				name = n
			}
			if name != "" {
				parentNames[*o.parentID] = name
			}
		}
	}

	setCell := func(cell, val string) {
		f.SetCellValue("组织架构", cell, val)
		f.SetCellStyle("组织架构", cell, cell, dataStyle)
	}

	for ri, row := range orgs {
		r := 3 + ri
		setCell(fmt.Sprintf("A%d", r), row.name)
		setCell(fmt.Sprintf("B%d", r), row.typeName)
		parentName := ""
		if row.parentID != nil {
			parentName = parentNames[*row.parentID]
		}
		setCell(fmt.Sprintf("C%d", r), parentName)
		setCell(fmt.Sprintf("D%d", r), fmt.Sprintf("%d", row.sort))
		f.SetRowHeight("组织架构", r, 24)
	}

	return nil
}

func (h *ResourceExportHandler) fillStudents(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	return h.fillUsers(ctx, f, tenantID, domain.RoleStudent, ids)
}

func (h *ResourceExportHandler) fillTeachers(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	return h.fillUsers(ctx, f, tenantID, domain.RoleTeacher, ids)
}

func (h *ResourceExportHandler) fillUsers(ctx context.Context, f *excelize.File, tenantID, roleCode string, ids []string) error {
	dataStyle := makeDataStyle(f)

	storeUsers, err := store.ListExportUsers(ctx, h.Store.Q(), tenantID, roleCode, ids)
	if err != nil {
		return err
	}

	type userRow struct {
		id        string
		username  string
		name      string
		status    string
		orgNodeID *string
		titleIDs  []string
	}
	var users []userRow
	for _, u := range storeUsers {
		users = append(users, userRow{id: u.ID, username: u.Username, name: u.Name, status: u.Status, orgNodeID: u.OrgNodeID, titleIDs: u.TitleIDs})
	}

	sheetName := "学生列表"
	if roleCode == domain.RoleTeacher {
		sheetName = "教师列表"
	}

	setCell := func(cell, val string) {
		f.SetCellValue(sheetName, cell, val)
		f.SetCellStyle(sheetName, cell, cell, dataStyle)
	}

	for ri, u := range users {
		r := 3 + ri
		setCell(fmt.Sprintf("A%d", r), u.username)
		setCell(fmt.Sprintf("B%d", r), u.name)
		// Password is not exported; leave blank.
		setCell(fmt.Sprintf("C%d", r), "")
		setCell(fmt.Sprintf("D%d", r), h.buildOrgPath(ctx, tenantID, u.orgNodeID))
		if roleCode == domain.RoleTeacher {
			titles := h.lookupTitleNames(ctx, tenantID, u.titleIDs)
			setCell(fmt.Sprintf("E%d", r), strings.Join(titles, ","))
			setCell(fmt.Sprintf("F%d", r), mapUserStatusToChinese(u.status))
		} else {
			setCell(fmt.Sprintf("E%d", r), mapUserStatusToChinese(u.status))
		}
		f.SetRowHeight(sheetName, r, 24)
	}

	return nil
}

func (h *ResourceExportHandler) buildOrgPath(ctx context.Context, tenantID string, orgNodeID *string) string {
	if orgNodeID == nil || *orgNodeID == "" {
		return ""
	}
	chain, err := h.buildAncestorChain(ctx, tenantID, *orgNodeID)
	if err != nil || len(chain) == 0 {
		return ""
	}
	return strings.Join(chain, "-")
}

func (h *ResourceExportHandler) buildAncestorChain(ctx context.Context, tenantID, nodeID string) ([]string, error) {
	var chain []string
	currentID := nodeID
	seen := make(map[string]bool)
	for currentID != "" {
		if seen[currentID] {
			break
		}
		seen[currentID] = true
		name, parentID, err := store.GetOrgNodeNameAndParent(ctx, h.Store.Q(), tenantID, currentID)
		if err != nil {
			return nil, err
		}
		chain = append([]string{name}, chain...)
		currentID = ""
		if parentID != nil {
			currentID = *parentID
		}
	}
	return chain, nil
}

func (h *ResourceExportHandler) lookupTitleNames(ctx context.Context, tenantID string, titleIDs []string) []string {
	var names []string
	for _, id := range titleIDs {
		if id == "" {
			continue
		}
		var name string
		if n, err := store.GetStaffTitleName(ctx, h.Store.Q(), tenantID, id); err == nil {
			name = n
		}
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func mapUserStatusToChinese(status string) string {
	switch status {
	case "active":
		return "在职"
	case "inactive":
		return "离职"
	case "disabled":
		return "禁用"
	case "graduated":
		return "毕业"
	case "completed":
		return "结业"
	default:
		return status
	}
}
