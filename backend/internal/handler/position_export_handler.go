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

type PositionExportHandler struct {
	DB *pgxpool.Pool
}

func (h *PositionExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "missing position ids")
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generatePositionTemplate(ctx, tenantID)

	if err := h.fillPositionsData(ctx, f, tenantID, req.IDs); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fill export data")
		return
	}

	writeExcel(w, f, "岗位导出.xlsx")
}

func (h *PositionExportHandler) fillPositionsData(ctx context.Context, f *excelize.File, tenantID string, positionIDs []string) error {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	setCell := func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}

	type posRow struct {
		name, shortName, positionType, industry, majors, salaryRange, description, requirements, careerPath, certs, batch string
	}
	var posRows []posRow

	for _, pid := range positionIDs {
		var name, shortName, positionType, desc, careerPath string
		var salaryMin, salaryMax *int
		var industryID, batchID *string
		var requirements []string
		err := h.DB.QueryRow(ctx, `
			SELECT name, COALESCE(short_name,''), position_type, COALESCE(description,''),
				COALESCE(career_path,''), salary_min, salary_max, industry_id, requirements, batch_id
			FROM career_positions WHERE id=$1 AND tenant_id=$2
		`, pid, tenantID).Scan(&name, &shortName, &positionType, &desc, &careerPath, &salaryMin, &salaryMax, &industryID, &requirements)
		if err != nil {
			continue
		}

		industryName := ""
		if industryID != nil && *industryID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM industries WHERE id=$1`, *industryID).Scan(&industryName)
		}

		var majorNames []string
		majRows, _ := h.DB.Query(ctx, `SELECT m.name FROM majors m JOIN career_position_majors cpm ON cpm.major_id=m.id WHERE cpm.career_position_id=$1`, pid)
		for majRows.Next() {
			var mn string
			majRows.Scan(&mn)
			majorNames = append(majorNames, mn)
		}
		majRows.Close()

		var certNames []string
		certRows, _ := h.DB.Query(ctx, `SELECT cl.name FROM certificate_library cl JOIN position_certificates pc ON pc.certificate_library_id=cl.id WHERE pc.career_position_id=$1`, pid)
		for certRows.Next() {
			var cn string
			certRows.Scan(&cn)
			certNames = append(certNames, cn)
		}
		certRows.Close()

		batchName := ""
		if batchID != nil && *batchID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM batches WHERE id=$1`, *batchID).Scan(&batchName)
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
		h.DB.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1`, pid).Scan(&positionName)

		bindRows, err := h.DB.Query(ctx, `
			SELECT pr.name, ap.name, ap.category, pab.domain, pab.required_level, COALESCE(pab.rubric_description,'')
			FROM position_ability_bindings pab
			JOIN position_responsibilities pr ON pr.id = pab.responsibility_id
			JOIN ability_points ap ON ap.id = pab.ability_point_id
			WHERE pab.career_position_id=$1 AND pab.tenant_id=$2
			ORDER BY pr.sort_order
		`, pid, tenantID)
		if err != nil {
			continue
		}
		for bindRows.Next() {
			var respName, abilityName, category, domain, level, rubricDesc string
			bindRows.Scan(&respName, &abilityName, &category, &domain, &level, &rubricDesc)

			setCell("工作职责与能力点", fmt.Sprintf("A%d", bindRow), positionName)
			setCell("工作职责与能力点", fmt.Sprintf("B%d", bindRow), respName)
			setCell("工作职责与能力点", fmt.Sprintf("C%d", bindRow), abilityName)
			setCell("工作职责与能力点", fmt.Sprintf("D%d", bindRow), mapAbilityCategoryToChinese(category))
			setCell("工作职责与能力点", fmt.Sprintf("E%d", bindRow), domain)
			setCell("工作职责与能力点", fmt.Sprintf("F%d", bindRow), level)
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

func mapAbilityCategoryToChinese(c string) string {
	switch c {
	case "knowledge":
		return "知识"
	case "skill":
		return "技能"
	case "quality":
		return "素质"
	default:
		return c
	}
}
