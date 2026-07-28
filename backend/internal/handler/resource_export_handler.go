package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// ResourceExportHandler handles Excel export for portal resources:
// organizations, students and teachers.
type ResourceExportHandler struct {
	DB *pgxpool.Pool
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
	th := &TemplateHandler{DB: h.DB}

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
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	filename := map[string]string{
		"organizations": "组织架构导出.xlsx",
		"students":      "学生导出.xlsx",
		"teachers":      "教师导出.xlsx",
	}[entity]
	writeExcel(w, f, filename)
}

func (h *ResourceExportHandler) fillOrganizations(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	dataStyle := makeDataStyle(f)

	var query string
	var args []interface{}
	if len(ids) > 0 {
		placeholders := make([]string, len(ids))
		for i := range ids {
			placeholders[i] = fmt.Sprintf("$%d", i+2)
			args = append(args, ids[i])
		}
		query = fmt.Sprintf(`
			SELECT id, name, type_id, parent_id, sort_order
			FROM organizations
			WHERE tenant_id=$1 AND id IN (%s)
			ORDER BY sort_order, name
		`, strings.Join(placeholders, ","))
	} else {
		query = `
			SELECT id, name, type_id, parent_id, sort_order
			FROM organizations
			WHERE tenant_id=$1
			ORDER BY sort_order, name
		`
	}
	args = append([]interface{}{tenantID}, args...)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	type orgRow struct {
		id       string
		name     string
		typeID   string
		typeName string
		parentID *string
		sort     int
	}
	var orgs []orgRow
	for rows.Next() {
		var r orgRow
		if err := rows.Scan(&r.id, &r.name, &r.typeID, &r.parentID, &r.sort); err != nil {
			continue
		}
		orgs = append(orgs, r)
	}

	for i := range orgs {
		var typeName string
		h.DB.QueryRow(ctx, `SELECT name FROM org_types WHERE id=$1`, orgs[i].typeID).Scan(&typeName)
		orgs[i].typeName = typeName
	}

	parentNames := make(map[string]string)
	for _, o := range orgs {
		if o.parentID != nil && *o.parentID != "" {
			var name string
			h.DB.QueryRow(ctx, `SELECT name FROM organizations WHERE id=$1`, *o.parentID).Scan(&name)
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
	return h.fillUsers(ctx, f, tenantID, "student", ids)
}

func (h *ResourceExportHandler) fillTeachers(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	return h.fillUsers(ctx, f, tenantID, "teacher", ids)
}

func (h *ResourceExportHandler) fillUsers(ctx context.Context, f *excelize.File, tenantID, roleCode string, ids []string) error {
	dataStyle := makeDataStyle(f)

	var idFilter string
	var args []interface{}
	args = append(args, tenantID, roleCode)
	if len(ids) > 0 {
		placeholders := make([]string, len(ids))
		for i := range ids {
			placeholders[i] = fmt.Sprintf("$%d", i+3)
			args = append(args, ids[i])
		}
		idFilter = fmt.Sprintf("AND u.id IN (%s)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`
		SELECT u.id, u.username, u.name, u.status, u.org_node_id, u.title_ids
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id=$1 AND r.code=$2 AND r.tenant_id=$1 %s
		ORDER BY u.name, u.username
	`, idFilter)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userRow struct {
		id        string
		username  string
		name      string
		status    string
		orgNodeID *string
		titleIDs  []string
	}
	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.id, &u.username, &u.name, &u.status, &u.orgNodeID, &u.titleIDs); err != nil {
			continue
		}
		users = append(users, u)
	}

	sheetName := "学生列表"
	if roleCode == "teacher" {
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
		if roleCode == "teacher" {
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
		var name string
		var parentID *string
		err := h.DB.QueryRow(ctx, `
			SELECT name, parent_id FROM organizations WHERE tenant_id=$1 AND id=$2
		`, tenantID, currentID).Scan(&name, &parentID)
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
		h.DB.QueryRow(ctx, `SELECT name FROM staff_titles WHERE tenant_id=$1 AND id=$2`, tenantID, id).Scan(&name)
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
