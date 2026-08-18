package service

// CsvImportService 基础实体 CSV 模板导入/导出业务编排：
// 行解析、预览去重、覆盖/改名策略全部收敛在此（原 import_export_handler.go 内联逻辑下沉）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CsvImportService 基础实体 CSV 导入编排服务。
type CsvImportService struct {
	s *Service
}

func NewCsvImportService(s *Service) *CsvImportService {
	return &CsvImportService{s: s}
}

// CsvImportRow 解析后的导入行（名称 + 编码）。
type CsvImportRow struct {
	RowNum int
	Name   string
	Code   string
}

// CsvImportOutcome 导入/预览结果（created/skipped/failed/permissionSkipped）。
type CsvImportOutcome struct {
	Created           int
	Skipped           int
	Failed            int
	PermissionSkipped int
	DuplicateItems    []ImportPreviewItem
	ParseErrors       []string
}

// ParseCSV 从 io.Reader 解析导入 CSV：表头按列名定位 name/code（兼容各实体别名），
// 返回数据行与解析错误。
func ParseCSV(r io.Reader) ([]CsvImportRow, []string, error) {
	reader := csv.NewReader(r)
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("CSV 为空或格式无效")
	}

	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[strings.TrimSpace(h)] = i
	}

	var rows []CsvImportRow
	var errors []string
	rowNum := 2
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errors = append(errors, fmt.Sprintf("第%d行读取失败", rowNum))
			rowNum++
			continue
		}
		if len(record) == 0 {
			rowNum++
			continue
		}

		name := strings.TrimSpace(getCol(record, colIdx, "name"))
		code := strings.TrimSpace(getCol(record, colIdx, "code"))
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "试卷名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "题库名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "课程名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "岗位名称"))
		}
		if name == "" {
			name = strings.TrimSpace(getCol(record, colIdx, "场景名称"))
		}
		if name == "" {
			errors = append(errors, fmt.Sprintf("第%d行名称不能为空", rowNum))
			rowNum++
			continue
		}
		if code == "" {
			code = fmt.Sprintf("IMP-%s", uuid.NewString()[:8])
		}

		rows = append(rows, CsvImportRow{RowNum: rowNum, Name: name, Code: code})
		rowNum++
	}
	return rows, errors, nil
}

// Preview 统计将创建/重复的条目，不写库。
func (s *CsvImportService) Preview(ctx context.Context, entity, tenantID, keyCol string, rows []CsvImportRow, parseErrors []string) *CsvImportOutcome {
	out := &CsvImportOutcome{ParseErrors: parseErrors}
	for _, row := range rows {
		key := row.Name
		if keyCol == "code" {
			key = row.Code
		}
		_, exists := s.findExistingByKey(ctx, entity, tenantID, keyCol, key)
		if exists {
			out.DuplicateItems = append(out.DuplicateItems, ImportPreviewItem{RowNum: row.RowNum, Key: key, Name: row.Name})
		} else {
			out.Created++
		}
	}
	return out
}

// Import 执行导入：overwrite 覆盖（含归属检查）、rename 追加后缀按新对象导入、
// 其余跳过。逐条目成功即落库（与原实现等价，无事务）。
func (s *CsvImportService) Import(ctx context.Context, entity, tenantID, keyCol, userID string, overwrite, rename bool, rows []CsvImportRow, parseErrors []string) *CsvImportOutcome {
	out := &CsvImportOutcome{ParseErrors: parseErrors}
	out.Failed = len(parseErrors)
	for _, row := range rows {
		key := row.Name
		if keyCol == "code" {
			key = row.Code
		}
		existingID, exists := s.findExistingByKey(ctx, entity, tenantID, keyCol, key)
		if exists {
			if overwrite {
				// 归属检查：非本人创建且未参与共建的资源跳过覆盖（与 Excel 导入路径一致）
				if creator, coCreatorIDs, found := store.GranularImportImportExportOwnerCheck(ctx, s.s.Store().Q(), entity, existingID); found {
					if !CanOverwriteContent(creator, coCreatorIDs, userID) {
						out.PermissionSkipped++
						continue
					}
				}
				if err := store.GranularImportImportExportUpdate(ctx, s.s.Store().Q(), entity, row.Name, row.Code, existingID); err != nil {
					out.Failed++
					continue
				}
				out.Created++
				continue
			}
			if rename {
				// 追加 4 位随机后缀生成新的唯一键，按新对象导入
				name, code := row.Name, row.Code
				for i := 0; i < 20; i++ {
					if keyCol == "code" {
						code = SuffixedName(row.Code)
						if _, again := s.findExistingByKey(ctx, entity, tenantID, keyCol, code); !again {
							break
						}
					} else {
						name = SuffixedName(row.Name)
						if _, again := s.findExistingByKey(ctx, entity, tenantID, keyCol, name); !again {
							break
						}
					}
				}
				id := uuid.NewString()
				if err := store.GranularImportImportExportInsert(ctx, s.s.Store().Q(), entity, id, tenantID, name, code, userID); err != nil {
					out.Failed++
					continue
				}
				out.Created++
				continue
			}
			out.Skipped++
			continue
		}

		id := uuid.NewString()
		if err := store.GranularImportImportExportInsert(ctx, s.s.Store().Q(), entity, id, tenantID, row.Name, row.Code, userID); err != nil {
			out.Failed++
			continue
		}
		out.Created++
	}
	return out
}

func (s *CsvImportService) findExistingByKey(ctx context.Context, entity, tenantID, keyCol, key string) (string, bool) {
	return store.GranularImportFindImportExportByKey(ctx, s.s.Store().Q(), entity, tenantID, keyCol, key)
}

func getCol(record []string, idx map[string]int, col string) string {
	i, ok := idx[col]
	if !ok || i >= len(record) {
		return ""
	}
	return record[i]
}
