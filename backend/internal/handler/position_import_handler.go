package handler

import (
	"context"
	"fmt"
	"log/slog"
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

func (h *PositionImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	xlsx, _, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	result := &importResult{}
	positionMap := make(map[string]string)

	ctx := r.Context()
	h.importPositions(ctx, xlsx, tenantID, claims.UserID, true, false, positionMap, result)
	h.importResponsibilities(ctx, xlsx, tenantID, claims.UserID, true, false, positionMap, result)

	respondJSON(w, http.StatusOK, ImportPreviewResult{
		Created:        result.Created,
		Duplicates:     len(result.DuplicateItems),
		Failed:         result.Failed,
		DuplicateItems: result.DuplicateItems,
		Errors:         result.Errors,
	})
}

func (h *PositionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID
	overwrite := importOverwriteParam(r)

	xlsx, sheets, err := parseUploadedExcel(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return
	}
	defer xlsx.Close()

	result := &importResult{}
	ctx := r.Context()
	positionMap := make(map[string]string)

	h.importPositions(ctx, xlsx, tenantID, userID, false, overwrite, positionMap, result)
	if len(positionMap) == 0 && result.Failed == 0 {
		respondError(w, http.StatusBadRequest, "Sheet1中未找到有效岗位数据")
		return
	}

	h.importResponsibilities(ctx, xlsx, tenantID, userID, false, overwrite, positionMap, result)

	slog.Info(fmt.Sprintf("[import/positions] result: created=%d failed=%d skipped=%d positions=%d responsibilities=%d bindings=%d errors=%d",
		result.Created, result.Failed, result.Skipped, result.PositionCreated, result.RespCreated, result.BindingCreated, len(result.Errors)))
	for _, e := range result.Errors {
		slog.Info(fmt.Sprintf("[import/positions] error: %s", e))
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":          result.Created,
		"failed":           result.Failed,
		"skipped":          result.Skipped,
		"entity":           "岗位",
		"positionCreated":  result.PositionCreated,
		"responsibilities": result.RespCreated,
		"abilityBindings":  result.BindingCreated,
		"errors":           result.Errors,
		"sheets":           sheets,
	})
}

func (h *PositionImportHandler) importPositions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, positionMap map[string]string, result *importResult) {
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

		var existingID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existingID)
		exists := err == nil && existingID != ""

		if exists {
			if preview {
				if len(result.DuplicateItems) < 100 {
					result.DuplicateItems = append(result.DuplicateItems, ImportPreviewItem{
						RowNum: i + 1,
						Key:    name,
						Name:   name,
					})
				}
				result.Skipped++
				continue
			}
			if !overwrite {
				result.Skipped++
				continue
			}
			_, err := h.DB.Exec(ctx, `
				UPDATE career_positions
				SET name=$3, short_name=$4, industry_id=$5, position_type=$6,
				    salary_min=$7, salary_max=$8, description=$9, requirements=$10,
				    career_path=$11, batch_id=$12
				WHERE id=$1 AND tenant_id=$2
			`, existingID, tenantID, name, shortName, industryID, positionType,
				salaryMin, salaryMax, description, requirements, careerPath, batchID)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]更新失败: %v", name, err))
				continue
			}
			// 覆盖时清空原有关联数据，随后根据新文件内容重新写入
			h.DB.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id=$1`, existingID)
			h.DB.Exec(ctx, `DELETE FROM position_certificates WHERE career_position_id=$1`, existingID)
			h.DB.Exec(ctx, `DELETE FROM position_responsibilities WHERE career_position_id=$1`, existingID)
			h.DB.Exec(ctx, `DELETE FROM position_ability_bindings WHERE career_position_id=$1`, existingID)

			for _, mid := range majorIDs {
				h.DB.Exec(ctx, `INSERT INTO career_position_majors (id, career_position_id, major_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
					uuid.NewString(), existingID, mid)
			}
			for _, certName := range certNames {
				if certName == "" {
					continue
				}
				certID := h.findOrCreateCert(ctx, tenantID, certName)
				h.DB.Exec(ctx, `INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
					uuid.NewString(), tenantID, existingID, certID)
			}
			positionMap[name] = existingID
			continue
		}

		if preview {
			result.Created++
			continue
		}

		positionID := uuid.NewString()
		code := generateEntityCode("GW")
		_, err = h.DB.Exec(ctx, `
			INSERT INTO career_positions (id, tenant_id, code, name, short_name, industry_id, position_type,
				salary_min, salary_max, description, requirements, career_path, version, status, created_by, collaborators)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'v1.0','draft',$13,'{}')
		`, positionID, tenantID, code, name, shortName, industryID, positionType,
			salaryMin, salaryMax, description, requirements, careerPath, userID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]创建失败: %v", name, err))
			continue
		}
		slog.Info(fmt.Sprintf("[import/positions] created position %s (id=%s)", name, positionID))
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

func (h *PositionImportHandler) importResponsibilities(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite bool, positionMap map[string]string, result *importResult) {
	if preview {
		return
	}

	rows, err := xlsx.GetRows("工作职责与能力点")
	if err != nil {
		slog.Info(fmt.Sprintf("[import/positions] sheet '工作职责与能力点' not found: %v", err))
		return
	}
	slog.Info(fmt.Sprintf("[import/positions] found %d rows in '工作职责与能力点' sheet", len(rows)))
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
		attributes := splitTrim(col(row, 3), ",")
		if len(attributes) == 0 {
			attributes = []string{}
		}
		abilityCategory := inferAbilityCategory(attributes)
		domainName := col(row, 4)
		requiredLevel := mapRequiredLevel(col(row, 5))
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
				slog.Info(fmt.Sprintf("[import/positions] 职责[%s/%s]插入失败: %v", positionName, respName, err))
				var existingID string
				h.DB.QueryRow(ctx, `SELECT id FROM position_responsibilities WHERE career_position_id=$1 AND name=$2`, positionID, respName).Scan(&existingID)
				if existingID != "" {
					respID = existingID
				}
			}
			if respID == "" {
				result.Failed++
				msg := fmt.Sprintf("职责[%s/%s]创建后仍未获取到ID,跳过能力绑定", positionName, respName)
				result.Errors = append(result.Errors, msg)
				slog.Info(fmt.Sprintf("[import/positions] %s", msg))
				continue
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
			abilityID = h.findOrCreateAbilityPoint(ctx, tenantID, abilityName, abilityCategory, attributes)
			seenAbility[abilityKey] = abilityID
		}

		bindingID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, weight, attributes)
			VALUES ($1,$2,$3,$4,$5,'custom',$6,$7,$8,0,$9)
		`, bindingID, tenantID, positionID, respID, abilityID, nullableStr(domainName), requiredLevel, rubricDescription, attributes)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("能力点绑定[%s/%s/%s]失败: %v", positionName, respName, abilityName, err)
			result.Errors = append(result.Errors, msg)
			slog.Info(fmt.Sprintf("[import/positions] row=%d %s (positionID=%s respID=%s abilityID=%s level=%v attrs=%v)", i+1, msg, positionID, respID, abilityID, requiredLevel, attributes))
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
		err := h.DB.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
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

func (h *PositionImportHandler) findOrCreateAbilityPoint(ctx context.Context, tenantID, name, category string, attributes []string) string {
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err == nil {
		// 能力点已存在时，若导入提供了属性则尝试更新
		if len(attributes) > 0 {
			h.DB.Exec(ctx, `UPDATE ability_points SET attributes=$1 WHERE id=$2 AND (attributes IS NULL OR attributes = '{}')`, attributes, id)
		}
		return id
	}
	id = uuid.NewString()
	h.DB.Exec(ctx, `INSERT INTO ability_points (id, tenant_id, name, category, is_public, attributes) VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT DO NOTHING`, id, tenantID, name, category, attributes)
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
	DuplicateItems  []ImportPreviewItem
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

func inferAbilityCategory(attrs []string) string {
	for _, a := range attrs {
		switch strings.TrimSpace(a) {
		case "技能":
			return "skill"
		case "知识":
			return "knowledge"
		case "素质", "素养":
			return "quality"
		}
	}
	return "skill"
}

func mapRequiredLevel(l string) string {
	switch strings.TrimSpace(l) {
	case "了解":
		return "understand"
	case "理解":
		return "comprehend"
	case "掌握":
		return "master"
	case "熟练":
		return "proficient"
	case "精通":
		return "expert"
	default:
		return l
	}
}

func itoaPtr(v int) *string {
	s := strconv.Itoa(v)
	return &s
}
