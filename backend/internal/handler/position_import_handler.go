package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionImportHandler struct {
	Store *store.Store
}

func (h *PositionImportHandler) processImport(r *http.Request, w http.ResponseWriter, preview bool) {
	irc := parseMultiImportRequest(w, r, false)
	if irc == nil {
		return
	}

	ctx := r.Context()
	aggregated := &importResult{}

	irc.MFU.ForEach(func(xlsx *excelize.File) {
		positionMap := make(map[string]string)
		h.importPositions(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename, positionMap, aggregated)
		h.importResponsibilities(ctx, xlsx, irc.TenantID, irc.UserID, preview, irc.Overwrite, irc.Rename, positionMap, aggregated)
	})

	if preview {
		previewRes := ImportPreviewResult{
			Created:        aggregated.Created,
			Failed:         aggregated.Failed,
			Duplicates:     len(aggregated.DuplicateItems),
			DuplicateItems: aggregated.DuplicateItems,
			Errors:         aggregated.Errors,
		}
		slog.Info(fmt.Sprintf("[import/preview/positions] result: created=%d duplicates=%d failed=%d errors=%d",
			previewRes.Created, previewRes.Duplicates, previewRes.Failed, len(previewRes.Errors)))
		respondJSON(w, http.StatusOK, previewRes)
		return
	}

	slog.Info(fmt.Sprintf("[import/positions] result: created=%d failed=%d skipped=%d positions=%d responsibilities=%d bindings=%d errors=%d",
		aggregated.Created, aggregated.Failed, aggregated.Skipped, aggregated.PositionCreated, aggregated.RespCreated, aggregated.BindingCreated, len(aggregated.Errors)))
	for _, e := range aggregated.Errors {
		slog.Info(fmt.Sprintf("[import/positions] error: %s", e))
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created":           aggregated.Created,
		"failed":            aggregated.Failed,
		"skipped":           aggregated.Skipped,
		"permissionSkipped": aggregated.PermissionSkipped,
		"entity":            "岗位",
		"positionCreated":   aggregated.PositionCreated,
		"responsibilities":  aggregated.RespCreated,
		"abilityBindings":   aggregated.BindingCreated,
		"errors":            aggregated.Errors,
		"sheets":            irc.MFU.FirstSheets(),
	})
}

func (h *PositionImportHandler) PreviewExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, true)
}

func (h *PositionImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	h.processImport(r, w, false)
}

func (h *PositionImportHandler) importPositions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, positionMap map[string]string, result *importResult) {
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
		positionType := "teaching"
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
		batchID := lookupBatchID(ctx, h.Store.Q(), "batches", tenantID, batchName)
		majorIDs := h.lookupMajors(ctx, tenantID, majorNames)

		dup, err := store.FindPositionByTenantAndName(ctx, h.Store.Q(), tenantID, name)
		existingID, existingCreator, existingCollaborators := dup.ID, dup.CreatedBy, dup.Collaborators
		exists := err == nil && existingID != ""

		origName := ""
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
			if !overwrite && !rename {
				result.Skipped++
				continue
			}
			if overwrite {
				if !canOverwriteContent(existingCreator, existingCollaborators, userID) {
					result.PermissionSkipped++
					continue
				}
				err := store.UpdatePositionImportFields(ctx, h.Store.Q(), store.PositionImportUpdateParams{
					ID: existingID, TenantID: tenantID, Name: name, ShortName: shortName,
					IndustryID: industryID, PositionType: positionType,
					SalaryMin: salaryMin, SalaryMax: salaryMax, Description: description,
					Requirements: requirements, CareerPath: careerPath, BatchID: batchID,
				})
				if err != nil {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]更新失败: %v", name, err))
					continue
				}
				// 覆盖时清空原有关联数据，随后根据新文件内容重新写入（错误计入 Failed 而非静默）
				clearFailed := false
				if err := store.ClearPositionImportRelations(ctx, h.Store.Q(), existingID); err != nil {
					slog.Warn("覆盖导入清理关联失败", "positionId", existingID, "error", err)
					clearFailed = true
				}
				for _, mid := range majorIDs {
					if err := store.InsertPositionMajor(ctx, h.Store.Q(), uuid.NewString(), existingID, mid); err != nil {
						slog.Warn("覆盖导入写入专业失败", "positionId", existingID, "error", err)
						clearFailed = true
					}
				}
				for _, certName := range certNames {
					if certName == "" {
						continue
					}
					certID := h.findOrCreateCert(ctx, tenantID, certName)
					if err := store.InsertPositionCertificate(ctx, h.Store.Q(), uuid.NewString(), tenantID, existingID, certID); err != nil {
						slog.Warn("覆盖导入写入证书失败", "positionId", existingID, "error", err)
						clearFailed = true
					}
				}
				if clearFailed {
					result.Failed++
					result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]关联数据写入失败", name))
					continue
				}
				positionMap[name] = existingID
				continue
			}
			// rename 模式：追加随机后缀生成新名称，按新对象导入
			origName = name
			name = uniqueSuffixed(name, func(c string) bool {
				eid, _ := store.FindPositionIDByTenantAndName(ctx, h.Store.Q(), tenantID, c)
				return eid != ""
			})
		}

		if preview {
			result.Created++
			continue
		}

		positionID := uuid.NewString()
		code := generateEntityCode("GW")
		err = store.InsertImportPosition(ctx, h.Store.Q(), store.PositionImportInsertParams{
			ID: positionID, TenantID: tenantID, Code: code, Name: name, ShortName: shortName,
			IndustryID: industryID, PositionType: positionType,
			SalaryMin: salaryMin, SalaryMax: salaryMax, Description: description,
			Requirements: requirements, CareerPath: careerPath, CreatedBy: userID,
		})
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("岗位[%s]创建失败: %v", name, err))
			continue
		}
		slog.Info(fmt.Sprintf("[import/positions] created position %s (id=%s)", name, positionID))
		if batchID != nil {
			_ = store.UpdatePositionBatchID(ctx, h.Store.Q(), *batchID, positionID)
		}
		for _, mid := range majorIDs {
			_ = store.InsertPositionMajor(ctx, h.Store.Q(), uuid.NewString(), positionID, mid)
		}

		for _, certName := range certNames {
			if certName == "" {
				continue
			}
			certID := h.findOrCreateCert(ctx, tenantID, certName)
			_ = store.InsertPositionCertificate(ctx, h.Store.Q(), uuid.NewString(), tenantID, positionID, certID)
		}

		positionMap[name] = positionID
		if origName != "" {
			positionMap[origName] = positionID
		}
		result.PositionCreated++
		result.Created++
	}
}

func (h *PositionImportHandler) importResponsibilities(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, positionMap map[string]string, result *importResult) {
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
			if err := store.InsertPositionResponsibility(ctx, h.Store.Q(), respID, tenantID, positionID, respName, sortCounter[positionID]); err != nil {
				slog.Info(fmt.Sprintf("[import/positions] 职责[%s/%s]插入失败: %v", positionName, respName, err))
				var existingID string
				existingID, _ = store.FindResponsibilityIDByPositionAndName(ctx, h.Store.Q(), positionID, respName)
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
			abilityID = h.findOrCreateAbilityPoint(ctx, tenantID, abilityName, attributes)
			seenAbility[abilityKey] = abilityID
		}

		bindingID := uuid.NewString()
		err := store.InsertPositionAbilityBinding(ctx, h.Store.Q(), store.PositionAbilityBindingInsertParams{
			ID: bindingID, TenantID: tenantID, PositionID: positionID,
			ResponsibilityID: respID, AbilityPointID: abilityID,
			Domain: nullableStr(domainName), RequiredLevel: requiredLevel,
			RubricDescription: rubricDescription, Attributes: attributes,
		})
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
	id, err := store.FindIndustryIDByTenantAndName(ctx, h.Store.Q(), tenantID, name)
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
		if id := store.FindMajorIDByNormalizedName(ctx, h.Store.Q(), tenantID, name); id != nil {
			ids = append(ids, *id)
		}
	}
	return ids
}

func (h *PositionImportHandler) findOrCreateCert(ctx context.Context, tenantID, name string) string {
	id, err := store.FindCertificateLibraryID(ctx, h.Store.Q(), tenantID, name)
	if err == nil {
		return id
	}
	id = uuid.NewString()
	_ = store.InsertCertificateLibrary(ctx, h.Store.Q(), id, tenantID, name)
	existing, _ := store.FindCertificateLibraryID(ctx, h.Store.Q(), tenantID, name)
	if existing != "" {
		return existing
	}
	return id
}

func (h *PositionImportHandler) findOrCreateAbilityPoint(ctx context.Context, tenantID, name string, attributes []string) string {
	id, err := store.FindAbilityPointID(ctx, h.Store.Q(), tenantID, name)
	if err == nil {
		// 能力点已存在时，若导入提供了属性则尝试更新
		if len(attributes) > 0 {
			_ = store.UpdateAbilityPointAttributesIfEmpty(ctx, h.Store.Q(), id, attributes)
		}
		return id
	}
	id = uuid.NewString()
	code, codeErr := store.GenerateUniqueEntityCode(ctx, h.Store.Q(), "NL", "ability_points", tenantID)
	if codeErr != nil {
		code = store.GenerateEntityCode("NL")
	}
	_ = store.InsertAbilityPoint(ctx, h.Store.Q(), id, tenantID, name, attributes, code)
	existing, _ := store.FindAbilityPointID(ctx, h.Store.Q(), tenantID, name)
	if existing != "" {
		return existing
	}
	return id
}

func (h *PositionImportHandler) ensureAbilityDomain(ctx context.Context, tenantID, positionID, domainName, bindingID string) {
	domainID, err := store.FindAbilityDomainID(ctx, h.Store.Q(), tenantID, positionID, domainName)
	if err == nil {
		_ = store.AppendAbilityDomainBinding(ctx, h.Store.Q(), domainID, bindingID)
		return
	}
	domainID = uuid.NewString()
	_ = store.InsertAbilityDomain(ctx, h.Store.Q(), domainID, tenantID, positionID, domainName, bindingID)
}

type importResult struct {
	Created           int
	Failed            int
	Skipped           int
	PermissionSkipped int
	PositionCreated   int
	RespCreated       int
	BindingCreated    int
	Errors            []string
	DuplicateItems    []ImportPreviewItem
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
