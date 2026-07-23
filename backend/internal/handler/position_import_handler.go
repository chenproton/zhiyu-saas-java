package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type PositionImportHandler struct {
	DB *pgxpool.Pool
}

func (h *PositionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	result := &importResult{}

	ctx := r.Context()
	positionMap := make(map[string]string)

	h.importPositions(ctx, xlsx, tenantID, userID, positionMap, result)
	if len(positionMap) == 0 && result.Failed == 0 {
		respondError(w, http.StatusBadRequest, "no valid position data found in Sheet1")
		return
	}

	h.importResponsibilities(ctx, xlsx, tenantID, userID, positionMap, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":          result.Created,
		"failed":           result.Failed,
		"skipped":          result.Skipped,
		"entity":           "岗位",
		"positionCreated":  result.PositionCreated,
		"responsibilities": result.RespCreated,
		"abilityBindings":  result.BindingCreated,
	})
}

func (h *PositionImportHandler) importPositions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, positionMap map[string]string, result *importResult) {
	rows, err := xlsx.GetRows("岗位基本信息")
	if err != nil {
		return
	}
	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}
		name := strings.TrimSpace(row[0])
		shortName := col(row, 1)
		positionType := mapPositionType(col(row, 2))
		industryName := col(row, 3)
		majorNames := splitTrim(col(row, 4), ",")
		salaryMin := parseNullableInt(col(row, 5))
		salaryMax := parseNullableInt(col(row, 6))
		description := nullableStr(col(row, 7))
		requirements := parseRequirements(col(row, 8))
		careerPath := nullableStr(col(row, 9))
		certNames := splitTrim(col(row, 10), ",")
		batchName := col(row, 11)

		industryID := h.lookupIndustry(ctx, tenantID, industryName)
		batchID := h.lookupBatch(ctx, tenantID, batchName, "batches")
		majorIDs := h.lookupMajors(ctx, tenantID, majorNames)

		positionID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO career_positions (id, tenant_id, name, short_name, industry_id, position_type,
				salary_min, salary_max, description, requirements, career_path, version, status, created_by, collaborators)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'v1.0','draft',$12,'{}')
		`, positionID, tenantID, name, shortName, industryID, positionType,
			salaryMin, salaryMax, description, requirements, careerPath, userID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]创建失败: %v", name, err))
			continue
		}

		if batchID != nil {
			h.DB.Exec(ctx, `UPDATE career_positions SET batch_id=$1 WHERE id=$2`, *batchID, positionID)
		}
		for _, mid := range majorIDs {
			h.DB.Exec(ctx, `INSERT INTO career_position_majors (id, career_position_id, major_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
				uuid.NewString(), positionID, mid)
		}

		for _, certName := range certNames {
			if certName == "" {
				continue
			}
			certID := h.findOrCreateCert(ctx, tenantID, certName)
			h.DB.Exec(ctx, `INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
				uuid.NewString(), tenantID, positionID, certID)
		}

		positionMap[name] = positionID
		result.PositionCreated++
		result.Created++
	}
}

func (h *PositionImportHandler) importResponsibilities(ctx context.Context, xlsx *excelize.File, tenantID, userID string, positionMap map[string]string, result *importResult) {
	rows, err := xlsx.GetRows("工作职责与能力点")
	if err != nil {
		return
	}
	sortCounter := make(map[string]int)

	seenResp := make(map[string]string)
	seenAbility := make(map[string]string)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" || strings.TrimSpace(row[1]) == "" {
			continue
		}
		positionName := strings.TrimSpace(row[0])
		respName := strings.TrimSpace(row[1])
		abilityName := strings.TrimSpace(col(row, 2))
		abilityCategory := mapAbilityCategory(col(row, 3))
		domainName := col(row, 4)
		requiredLevel := col(row, 5)
		rubricDescription := nullableStr(col(row, 6))

		positionID, ok := positionMap[positionName]
		if !ok {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("工作职责行[%s/%s]找不到岗位,已跳过", positionName, respName))
			continue
		}

		respKey := positionID + "|" + respName
		respID, ok := seenResp[respKey]
		if !ok {
			sortCounter[positionID]++
			respID = uuid.NewString()
			_, err := h.DB.Exec(ctx, `INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
				respID, tenantID, positionID, respName, sortCounter[positionID])
			if err != nil {
				var existingID string
				h.DB.QueryRow(ctx, `SELECT id FROM position_responsibilities WHERE career_position_id=$1 AND name=$2`, positionID, respName).Scan(&existingID)
				if existingID != "" {
					respID = existingID
				}
			}
			seenResp[respKey] = respID
			result.RespCreated++
			result.Created++
		}

		if abilityName == "" {
			continue
		}

		abilityKey := tenantID + "|" + abilityName
		abilityID, ok := seenAbility[abilityKey]
		if !ok {
			abilityID = h.findOrCreateAbilityPoint(ctx, tenantID, abilityName, abilityCategory)
			seenAbility[abilityKey] = abilityID
		}

		bindingID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, weight)
			VALUES ($1,$2,$3,$4,$5,'custom',$6,$7,$8,0)
		`, bindingID, tenantID, positionID, respID, abilityID, nullableStr(domainName), requiredLevel, rubricDescription)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("能力点绑定[%s/%s/%s]失败: %v", positionName, respName, abilityName, err))
			continue
		}
		result.BindingCreated++
		result.Created++

		if domainName != "" {
			h.ensureAbilityDomain(ctx, tenantID, positionID, domainName, bindingID)
		}
	}
}

func (h *PositionImportHandler) lookupIndustry(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *PositionImportHandler) lookupMajors(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return nil
	}
	var ids []string
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

func (h *PositionImportHandler) lookupBatch(ctx context.Context, tenantID, name, table string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, fmt.Sprintf(`SELECT id FROM %s WHERE tenant_id=$1 AND name=$2 LIMIT 1`, table), tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *PositionImportHandler) findOrCreateCert(ctx context.Context, tenantID, name string) string {
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM certificate_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err == nil {
		return id
	}
	id = uuid.NewString()
	h.DB.Exec(ctx, `INSERT INTO certificate_library (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
	var existing string
	h.DB.QueryRow(ctx, `SELECT id FROM certificate_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
	if existing != "" {
		return existing
	}
	return id
}

func (h *PositionImportHandler) findOrCreateAbilityPoint(ctx context.Context, tenantID, name, category string) string {
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err == nil {
		return id
	}
	id = uuid.NewString()
	h.DB.Exec(ctx, `INSERT INTO ability_points (id, tenant_id, name, category, is_public) VALUES ($1,$2,$3,$4,false) ON CONFLICT DO NOTHING`, id, tenantID, name, category)
	var existing string
	h.DB.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
	if existing != "" {
		return existing
	}
	return id
}

func (h *PositionImportHandler) ensureAbilityDomain(ctx context.Context, tenantID, positionID, domainName, bindingID string) {
	var domainID string
	err := h.DB.QueryRow(ctx, `SELECT id FROM ability_domains WHERE tenant_id=$1 AND career_position_id=$2 AND name=$3 LIMIT 1`, tenantID, positionID, domainName).Scan(&domainID)
	if err == nil {
		h.DB.Exec(ctx, `UPDATE ability_domains SET binding_ids = array_append(binding_ids, $1) WHERE id=$2 AND NOT ($1 = ANY(binding_ids))`, bindingID, domainID)
		return
	}
	domainID = uuid.NewString()
	h.DB.Exec(ctx, `INSERT INTO ability_domains (id, tenant_id, career_position_id, name, binding_ids) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
		domainID, tenantID, positionID, domainName, []string{bindingID})
}

type importResult struct {
	Created         int
	Failed          int
	Skipped         int
	PositionCreated int
	RespCreated     int
	BindingCreated  int
	Errors          []string
}

func col(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func splitTrim(s, sep string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, sep)
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func parseRequirements(s string) []string {
	if s == "" {
		return []string{}
	}
	lines := strings.Split(s, "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	if len(result) == 0 {
		return []string{}
	}
	return result
}

func mapPositionType(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "企业岗位":
		return "enterprise"
	case "教学岗位":
		return "teaching"
	case "其他":
		return "other"
	default:
		if t == "enterprise" || t == "teaching" || t == "other" {
			return t
		}
		return "other"
	}
}

func mapAbilityCategory(t string) string {
	t = strings.TrimSpace(t)
	switch t {
	case "知识":
		return "knowledge"
	case "技能":
		return "skill"
	case "素质":
		return "quality"
	default:
		if t == "knowledge" || t == "skill" || t == "quality" {
			return t
		}
		return "skill"
	}
}

func parseNullableInt(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

func parseNullableFloat(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}

func nullableStr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func itoaPtr(v int) *string {
	s := strconv.Itoa(v)
	return &s
}
