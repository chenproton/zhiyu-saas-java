package service

// PositionImportService 岗位 Excel 导入业务编排：岗位/职责/能力绑定两级导入、
// 覆盖/改名策略与字典查找创建全部收敛在此（原 position_import_handler.go 内联逻辑下沉）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PositionImportService 岗位 Excel 导入编排服务。
type PositionImportService struct {
	s *Service
}

func NewPositionImportService(s *Service) *PositionImportService {
	return &PositionImportService{s: s}
}

// PositionImportResult 岗位导入结果聚合。
type PositionImportResult struct {
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

// ImportPositions 导入「岗位基本信息」+「工作职责与能力点」两个 Sheet（无事务：
// 与原实现等价，逐条目成功即落库，失败计入 Errors）。
func (s *PositionImportService) ImportPositions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool) *PositionImportResult {
	result := &PositionImportResult{}
	positionMap := make(map[string]string)
	s.importPositions(ctx, xlsx, tenantID, userID, preview, overwrite, rename, positionMap, result)
	s.importResponsibilities(ctx, xlsx, tenantID, userID, preview, overwrite, rename, positionMap, result)
	return result
}

func (s *PositionImportService) importPositions(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, positionMap map[string]string, result *PositionImportResult) {
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
		shortName := Col(row, 1)
		positionType := "teaching"
		industryName := Col(row, 3)
		majorNames := SplitTrim(Col(row, 4), ",")
		salaryMin := ParseNullableInt(Col(row, 5))
		salaryMax := ParseNullableInt(Col(row, 6))
		description := NullableStr(Col(row, 7))
		requirements := parseRequirements(Col(row, 8))
		careerPath := NullableStr(Col(row, 9))
		certNames := SplitTrim(Col(row, 10), ",")
		batchName := Col(row, 11)

		industryID := s.lookupIndustry(ctx, tenantID, industryName)
		batchID := LookupBatchID(ctx, s.s.Store().Q(), "batches", tenantID, batchName)
		majorIDs := s.lookupMajors(ctx, tenantID, majorNames)

		dup, err := store.FindPositionByTenantAndName(ctx, s.s.Store().Q(), tenantID, name)
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
				if !CanOverwriteContent(existingCreator, existingCollaborators, userID) {
					result.PermissionSkipped++
					continue
				}
				err := store.UpdatePositionImportFields(ctx, s.s.Store().Q(), store.PositionImportUpdateParams{
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
				if err := store.ClearPositionImportRelations(ctx, s.s.Store().Q(), existingID); err != nil {
					slog.Warn("覆盖导入清理关联失败", "positionId", existingID, "error", err)
					clearFailed = true
				}
				for _, mid := range majorIDs {
					if err := store.InsertPositionMajor(ctx, s.s.Store().Q(), uuid.NewString(), existingID, mid); err != nil {
						slog.Warn("覆盖导入写入专业失败", "positionId", existingID, "error", err)
						clearFailed = true
					}
				}
				for _, certName := range certNames {
					if certName == "" {
						continue
					}
					certID := s.findOrCreateCert(ctx, tenantID, certName)
					if err := store.InsertPositionCertificate(ctx, s.s.Store().Q(), uuid.NewString(), tenantID, existingID, certID); err != nil {
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
			name = UniqueSuffixed(name, func(c string) bool {
				eid, _ := store.FindPositionIDByTenantAndName(ctx, s.s.Store().Q(), tenantID, c)
				return eid != ""
			})
		}

		if preview {
			result.Created++
			continue
		}

		positionID := uuid.NewString()
		code := store.GenerateEntityCode("GW")
		err = store.InsertImportPosition(ctx, s.s.Store().Q(), store.PositionImportInsertParams{
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
			_ = store.UpdatePositionBatchID(ctx, s.s.Store().Q(), *batchID, positionID)
		}
		for _, mid := range majorIDs {
			_ = store.InsertPositionMajor(ctx, s.s.Store().Q(), uuid.NewString(), positionID, mid)
		}

		for _, certName := range certNames {
			if certName == "" {
				continue
			}
			certID := s.findOrCreateCert(ctx, tenantID, certName)
			_ = store.InsertPositionCertificate(ctx, s.s.Store().Q(), uuid.NewString(), tenantID, positionID, certID)
		}

		positionMap[name] = positionID
		if origName != "" {
			positionMap[origName] = positionID
		}
		result.PositionCreated++
		result.Created++
	}
}

func (s *PositionImportService) importResponsibilities(ctx context.Context, xlsx *excelize.File, tenantID, userID string, preview, overwrite, rename bool, positionMap map[string]string, result *PositionImportResult) {
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
		abilityName := strings.TrimSpace(Col(row, 2))
		attributes := SplitTrim(Col(row, 3), ",")
		if len(attributes) == 0 {
			attributes = []string{}
		}
		domainName := Col(row, 4)
		requiredLevel := mapRequiredLevel(Col(row, 5))
		rubricDescription := NullableStr(Col(row, 6))

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
			if err := store.InsertPositionResponsibility(ctx, s.s.Store().Q(), respID, tenantID, positionID, respName, sortCounter[positionID]); err != nil {
				slog.Info(fmt.Sprintf("[import/positions] 职责[%s/%s]插入失败: %v", positionName, respName, err))
				var existingID string
				existingID, _ = store.FindResponsibilityIDByPositionAndName(ctx, s.s.Store().Q(), positionID, respName)
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
			abilityID = s.findOrCreateAbilityPoint(ctx, tenantID, abilityName, attributes)
			seenAbility[abilityKey] = abilityID
		}

		bindingID := uuid.NewString()
		err := store.InsertPositionAbilityBinding(ctx, s.s.Store().Q(), store.PositionAbilityBindingInsertParams{
			ID: bindingID, TenantID: tenantID, PositionID: positionID,
			ResponsibilityID: respID, AbilityPointID: abilityID,
			Domain: NullableStr(domainName), RequiredLevel: requiredLevel,
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
			s.ensureAbilityDomain(ctx, tenantID, positionID, domainName, bindingID)
		}
	}
}

func (s *PositionImportService) lookupIndustry(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	id, err := store.FindIndustryIDByTenantAndName(ctx, s.s.Store().Q(), tenantID, name)
	if err != nil {
		return nil
	}
	return &id
}

func (s *PositionImportService) lookupMajors(ctx context.Context, tenantID string, names []string) []string {
	if len(names) == 0 {
		return nil
	}
	var ids []string
	for _, name := range names {
		if name == "" {
			continue
		}
		if id := store.FindMajorIDByNormalizedName(ctx, s.s.Store().Q(), tenantID, name); id != nil {
			ids = append(ids, *id)
		}
	}
	return ids
}

func (s *PositionImportService) findOrCreateCert(ctx context.Context, tenantID, name string) string {
	id, err := store.FindCertificateLibraryID(ctx, s.s.Store().Q(), tenantID, name)
	if err == nil {
		return id
	}
	id = uuid.NewString()
	_ = store.InsertCertificateLibrary(ctx, s.s.Store().Q(), id, tenantID, name)
	existing, _ := store.FindCertificateLibraryID(ctx, s.s.Store().Q(), tenantID, name)
	if existing != "" {
		return existing
	}
	return id
}

func (s *PositionImportService) findOrCreateAbilityPoint(ctx context.Context, tenantID, name string, attributes []string) string {
	id, err := store.FindAbilityPointID(ctx, s.s.Store().Q(), tenantID, name)
	if err == nil {
		// 能力点已存在时，若导入提供了属性则尝试更新
		if len(attributes) > 0 {
			_ = store.UpdateAbilityPointAttributesIfEmpty(ctx, s.s.Store().Q(), id, attributes)
		}
		return id
	}
	id = uuid.NewString()
	code, codeErr := store.GenerateUniqueEntityCode(ctx, s.s.Store().Q(), "NL", "ability_points", tenantID)
	if codeErr != nil {
		code = store.GenerateEntityCode("NL")
	}
	_ = store.InsertAbilityPoint(ctx, s.s.Store().Q(), id, tenantID, name, attributes, code)
	existing, _ := store.FindAbilityPointID(ctx, s.s.Store().Q(), tenantID, name)
	if existing != "" {
		return existing
	}
	return id
}

func (s *PositionImportService) ensureAbilityDomain(ctx context.Context, tenantID, positionID, domainName, bindingID string) {
	domainID, err := store.FindAbilityDomainID(ctx, s.s.Store().Q(), tenantID, positionID, domainName)
	if err == nil {
		_ = store.AppendAbilityDomainBinding(ctx, s.s.Store().Q(), domainID, bindingID)
		return
	}
	domainID = uuid.NewString()
	_ = store.InsertAbilityDomain(ctx, s.s.Store().Q(), domainID, tenantID, positionID, domainName, bindingID)
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
