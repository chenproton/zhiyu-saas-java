package service

// ResourceExportService ResourceExportHandler 业务编排下沉（原 resource_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ResourceExportService 业务编排服务。
type ResourceExportService struct {
	s *Service
}

func NewResourceExportService(s *Service) *ResourceExportService {
	return &ResourceExportService{s: s}
}

func (s *ResourceExportService) FillOrganizations(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	dataStyle := MakeDataStyle(f)

	storeOrgs, err := store.ListExportOrganizations(ctx, s.s.Store().Q(), tenantID, ids)
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
		if name, err := store.GetOrgTypeName(ctx, s.s.Store().Q(), orgs[i].typeID); err != nil {
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
			if n, err := store.GetOrganizationName(ctx, s.s.Store().Q(), *o.parentID); err != nil {
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

func (s *ResourceExportService) FillStudents(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	return s.FillUsers(ctx, f, tenantID, domain.RoleStudent, ids)
}

func (s *ResourceExportService) FillTeachers(ctx context.Context, f *excelize.File, tenantID string, ids []string) error {
	return s.FillUsers(ctx, f, tenantID, domain.RoleTeacher, ids)
}

func (s *ResourceExportService) FillUsers(ctx context.Context, f *excelize.File, tenantID, roleCode string, ids []string) error {
	dataStyle := MakeDataStyle(f)

	storeUsers, err := store.ListExportUsers(ctx, s.s.Store().Q(), tenantID, roleCode, ids)
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
		setCell(fmt.Sprintf("D%d", r), s.buildOrgPath(ctx, tenantID, u.orgNodeID))
		if roleCode == domain.RoleTeacher {
			titles := s.lookupTitleNames(ctx, tenantID, u.titleIDs)
			setCell(fmt.Sprintf("E%d", r), strings.Join(titles, ","))
			setCell(fmt.Sprintf("F%d", r), mapUserStatusToChinese(u.status))
		} else {
			setCell(fmt.Sprintf("E%d", r), mapUserStatusToChinese(u.status))
		}
		f.SetRowHeight(sheetName, r, 24)
	}

	return nil
}

func (s *ResourceExportService) buildOrgPath(ctx context.Context, tenantID string, orgNodeID *string) string {
	if orgNodeID == nil || *orgNodeID == "" {
		return ""
	}
	chain, err := s.buildAncestorChain(ctx, tenantID, *orgNodeID)
	if err != nil || len(chain) == 0 {
		return ""
	}
	return strings.Join(chain, "-")
}

func (s *ResourceExportService) buildAncestorChain(ctx context.Context, tenantID, nodeID string) ([]string, error) {
	var chain []string
	currentID := nodeID
	seen := make(map[string]bool)
	for currentID != "" {
		if seen[currentID] {
			break
		}
		seen[currentID] = true
		name, parentID, err := store.GetOrgNodeNameAndParent(ctx, s.s.Store().Q(), tenantID, currentID)
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

func (s *ResourceExportService) lookupTitleNames(ctx context.Context, tenantID string, titleIDs []string) []string {
	var names []string
	for _, id := range titleIDs {
		if id == "" {
			continue
		}
		var name string
		if n, err := store.GetStaffTitleName(ctx, s.s.Store().Q(), tenantID, id); err == nil {
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
