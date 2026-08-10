package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionExportHandler struct {
	Store *store.Store
}

func (h *PositionExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少岗位ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generatePositionTemplate(ctx, tenantID)

	if err := h.fillPositionsData(ctx, f, tenantID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "岗位导出.xlsx")
}

func (h *PositionExportHandler) fillPositionsData(ctx context.Context, f *excelize.File, tenantID string, positionIDs []string) error {
	setCell := newSetCell(f)

	type posRow struct {
		name, shortName, positionType, industry, majors, salaryRange, description, requirements, careerPath, certs, batch string
	}
	var posRows []posRow

	for _, pid := range positionIDs {
		var name, shortName, positionType, desc, careerPath string
		var salaryMin, salaryMax *int
		var industryID, batchID *string
		var requirements []string
		err := h.Store.Q().QueryRow(ctx, `
			SELECT name, COALESCE(short_name,''), position_type, COALESCE(description,''),
				COALESCE(career_path,''), salary_min, salary_max, industry_id, requirements, batch_id
			FROM career_positions WHERE id=$1 AND tenant_id=$2
		`, pid, tenantID).Scan(&name, &shortName, &positionType, &desc, &careerPath, &salaryMin, &salaryMax, &industryID, &requirements, &batchID)
		if err != nil {
			slog.Warn("导出岗位行跳过", "positionId", pid, "error", err)
			continue
		}

		industryName := ""
		if industryID != nil && *industryID != "" {
			if err := h.Store.Q().QueryRow(ctx, `SELECT name FROM industries WHERE id=$1 AND tenant_id=$2`, *industryID, tenantID).Scan(&industryName); err != nil {
				slog.Warn("导出岗位行业名查询失败", "industryId", *industryID, "error", err)
			}
		}

		var majorNames []string
		majRows, err := h.Store.Q().Query(ctx, `SELECT m.name FROM majors m JOIN career_position_majors cpm ON cpm.major_id=m.id JOIN career_positions cp ON cp.id=cpm.career_position_id WHERE cpm.career_position_id=$1 AND cp.tenant_id=$2`, pid, tenantID)
		if err != nil {
			slog.Warn("导出岗位专业列表查询失败", "positionId", pid, "error", err)
		} else {
			for majRows.Next() {
				var mn string
				if err := majRows.Scan(&mn); err != nil {
					slog.Warn("导出岗位专业行扫描失败", "positionId", pid, "error", err)
					continue
				}
				majorNames = append(majorNames, mn)
			}
			majRows.Close()
		}

		var certNames []string
		certRows, err := h.Store.Q().Query(ctx, `SELECT cl.name FROM certificate_library cl JOIN position_certificates pc ON pc.certificate_library_id=cl.id WHERE pc.career_position_id=$1 AND pc.tenant_id=$2`, pid, tenantID)
		if err != nil {
			slog.Warn("导出岗位证书列表查询失败", "positionId", pid, "error", err)
		} else {
			for certRows.Next() {
				var cn string
				if err := certRows.Scan(&cn); err != nil {
					slog.Warn("导出岗位证书行扫描失败", "positionId", pid, "error", err)
					continue
				}
				certNames = append(certNames, cn)
			}
			certRows.Close()
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			if err := h.Store.Q().QueryRow(ctx, `SELECT name FROM batches WHERE id=$1 AND tenant_id=$2`, *batchID, tenantID).Scan(&batchName); err != nil {
				slog.Warn("导出岗位批次名查询失败", "batchId", *batchID, "error", err)
			}
		}

		salaryStr := ""
		if salaryMin != nil && salaryMax != nil {
			salaryStr = fmt.Sprintf("%d-%d", *salaryMin, *salaryMax)
		}

		posTypeChinese := mapPositionTypeToChinese(positionType)

		posRows = append(posRows, posRow{
			name, shortName, posTypeChinese, industryName,
			strings.Join(majorNames, ","),
			salaryStr, desc,
			strings.Join(requirements, "\n"),
			careerPath,
			strings.Join(certNames, ","),
			batchName,
		})
	}

	slog.Info(fmt.Sprintf("[export/positions] collected %d basic info rows for %d position IDs", len(posRows), len(positionIDs)))

	for ri, row := range posRows {
		r := 3 + ri
		setCell("岗位基本信息", fmt.Sprintf("A%d", r), row.name)
		setCell("岗位基本信息", fmt.Sprintf("B%d", r), row.shortName)
		setCell("岗位基本信息", fmt.Sprintf("C%d", r), row.positionType)
		setCell("岗位基本信息", fmt.Sprintf("D%d", r), row.industry)
		setCell("岗位基本信息", fmt.Sprintf("E%d", r), row.majors)
		if row.salaryRange != "" {
			parts := strings.SplitN(row.salaryRange, "-", 2)
			if len(parts) == 2 {
				setCell("岗位基本信息", fmt.Sprintf("F%d", r), parts[0])
				setCell("岗位基本信息", fmt.Sprintf("G%d", r), parts[1])
			}
		}
		setCell("岗位基本信息", fmt.Sprintf("H%d", r), row.description)
		setCell("岗位基本信息", fmt.Sprintf("I%d", r), row.requirements)
		setCell("岗位基本信息", fmt.Sprintf("J%d", r), row.careerPath)
		setCell("岗位基本信息", fmt.Sprintf("K%d", r), row.certs)
		setCell("岗位基本信息", fmt.Sprintf("L%d", r), row.batch)
		f.SetRowHeight("岗位基本信息", r, 24)
	}

	bindRow := 3
	for _, pid := range positionIDs {
		var positionName string
		if err := h.Store.Q().QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1 AND tenant_id=$2`, pid, tenantID).Scan(&positionName); err != nil {
			slog.Warn("导出岗位绑定名称查询失败", "positionId", pid, "error", err)
		}

		bindRows, err := h.Store.Q().Query(ctx, `
			SELECT pr.name, ap.name, ap.attributes, pab.attributes, pab.domain, pab.required_level, COALESCE(pab.rubric_description,'')
			FROM position_ability_bindings pab
			JOIN position_responsibilities pr ON pr.id = pab.responsibility_id
			JOIN ability_points ap ON ap.id = pab.ability_point_id
			WHERE pab.career_position_id=$1 AND pab.tenant_id=$2
			ORDER BY pr.sort_order
		`, pid, tenantID)
		if err != nil {
			slog.Warn("导出岗位能力绑定查询失败", "positionId", pid, "error", err)
			continue
		}
		for bindRows.Next() {
			var respName, abilityName, domain, level, rubricDesc string
			var attributes, abilityAttrs []string
			if err := bindRows.Scan(&respName, &abilityName, &abilityAttrs, &attributes, &domain, &level, &rubricDesc); err != nil {
				slog.Warn("导出岗位能力绑定行扫描失败", "positionId", pid, "error", err)
				continue
			}

			attrStr := strings.Join(attributes, ",")
			if attrStr == "" {
				attrStr = strings.Join(abilityAttrs, ",")
			}

			setCell("工作职责与能力点", fmt.Sprintf("A%d", bindRow), positionName)
			setCell("工作职责与能力点", fmt.Sprintf("B%d", bindRow), respName)
			setCell("工作职责与能力点", fmt.Sprintf("C%d", bindRow), abilityName)
			setCell("工作职责与能力点", fmt.Sprintf("D%d", bindRow), attrStr)
			setCell("工作职责与能力点", fmt.Sprintf("E%d", bindRow), domain)
			setCell("工作职责与能力点", fmt.Sprintf("F%d", bindRow), mapRequiredLevelToChinese(level))
			setCell("工作职责与能力点", fmt.Sprintf("G%d", bindRow), rubricDesc)
			f.SetRowHeight("工作职责与能力点", bindRow, 24)
			bindRow++
		}
		bindRows.Close()
	}

	return nil
}

func mapPositionTypeToChinese(t string) string {
	switch t {
	case "enterprise":
		return "企业岗位"
	case "teaching":
		return "教学岗位"
	default:
		return "其他"
	}
}

func mapRequiredLevelToChinese(l string) string {
	switch strings.ToLower(strings.TrimSpace(l)) {
	case "understand", "了解", "l1":
		return "了解"
	case "comprehend", "理解", "l2":
		return "理解"
	case "master", "掌握", "l3":
		return "掌握"
	case "proficient", "熟练":
		return "熟练"
	case "expert", "精通":
		return "精通"
	default:
		return l
	}
}
