package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// lookupIDByNameTables 是 lookupIDByName 允许查询的表名白名单。
var lookupIDByNameTables = []string{
	"ability_points", "ability_domains", "alliance_agreements", "alliance_enterprises",
	"alliance_experts", "alliance_projects", "batches", "career_positions", "certificate_library",
	"courses", "evaluation_batches", "exams", "industries", "institutions",
	"knowledge_points", "lesson_batches", "majors", "organizations", "question_banks", "questions",
	"resource_library", "roles", "scene_batches", "scenarios", "staff_titles", "subscription_packages", "terms", "users",
}

// lookupIDByName 按表名+租户+名称查询记录 ID，不存在时返回空字符串。
// 仅供 import/export 豁免区使用。
func lookupIDByName(ctx context.Context, db *pgxpool.Pool, tableName, tenantID, name string) (string, error) {
	table, err := store.SanitizeIdentifier(tableName, lookupIDByNameTables)
	if err != nil {
		return "", fmt.Errorf("不支持的表名: %s", tableName)
	}
	var id string
	err = db.QueryRow(ctx,
		fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND name=$2 LIMIT 1", table),
		tenantID, name,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		slog.Error("lookupIDByName查询失败", "table", tableName, "error", err)
		return "", err
	}
	return id, nil
}

// ImportPreviewItem 单条重复记录预览信息。
type ImportPreviewItem struct {
	RowNum int    `json:"rowNum"`
	Key    string `json:"key"`  // 业务主键值
	Name   string `json:"name"` // 显示名称
}

// ImportPreviewResult 导入 preview 接口统一返回结构。
type ImportPreviewResult struct {
	Created        int                 `json:"created"`
	Duplicates     int                 `json:"duplicates"`
	Failed         int                 `json:"failed"`
	DuplicateItems []ImportPreviewItem `json:"duplicateItems"`
	Errors         []string            `json:"errors"`
}

// ImportExecuteResult 导入执行接口的基础返回结构，各 handler 可在此基础上扩展。
type ImportExecuteResult struct {
	Created int      `json:"created"`
	Failed  int      `json:"failed"`
	Skipped int      `json:"skipped"`
	Entity  string   `json:"entity"`
	Errors  []string `json:"errors"`
}

// importOverwriteParam 从请求中获取是否覆盖已存在数据的标识。
func importOverwriteParam(r *http.Request) bool {
	return r.URL.Query().Get("overwrite") == "true"
}

// col 安全读取 Excel 行中的列值，越界时返回空字符串。
func col(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

// splitTrim 按分隔符拆分字符串并去除空白，空项被忽略。
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

// parseNullableInt 将字符串解析为整数，空或无效时返回 nil。
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

// parseNullableFloat 将字符串解析为浮点数，空或无效时返回 nil。
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

// nullableStr 去除空白后，空字符串返回 nil。
func nullableStr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// parseIntDefault 将字符串解析为整数，空或无效时返回默认值。
func parseIntDefault(s string, defaultVal int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

// mapDictValue 将 Excel 中的中文/英文枚举值统一映射为内部英文值。
// 未识别时返回原值（trim 后）。
func mapDictValue(value string, pairs ...string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	for i := 0; i+1 < len(pairs); i += 2 {
		if value == pairs[i] {
			return pairs[i+1]
		}
	}
	return value
}

// mapEnterpriseType 企业类型：合作企业/第三方雇主企业 ↔ cooperation/third-party。
// 兼容旧值 platform/school-based。
func mapEnterpriseType(v string) string {
	return mapDictValue(v,
		"合作企业", "cooperation", "校企合作企业", "cooperation",
		"第三方雇主企业", "third-party", "第三方", "third-party", "独立雇主企业", "third-party",
		"platform", "third-party", "school-based", "cooperation",
	)
}

// mapCoopStatus 合作状态：洽谈中/合作中/已暂停/已终止 ↔ negotiating/active/paused/terminated。
func mapCoopStatus(v string) string {
	return mapDictValue(v,
		"洽谈中", "negotiating", "洽谈", "negotiating",
		"合作中", "active", "合作", "active",
		"已暂停", "paused", "暂停", "paused",
		"已终止", "terminated", "终止", "terminated",
	)
}

// mapCoopRating 合作评级：战略/深度/一般 ↔ strategic/deep/general。
func mapCoopRating(v string) string {
	return mapDictValue(v,
		"战略合作", "strategic", "战略", "strategic",
		"深度合作", "deep", "深度", "deep",
		"一般合作", "general", "一般", "general",
	)
}

// mapProjectPhase 项目阶段：启动/执行中/验收/关闭/已归档/已终止 ↔ initiation/execution/acceptance/closure/archived/terminated。
func mapProjectPhase(v string) string {
	return mapDictValue(v,
		"启动", "initiation", "发起", "initiation",
		"执行中", "execution", "执行", "execution",
		"验收", "acceptance",
		"关闭", "closure",
		"已归档", "archived", "归档", "archived",
		"已终止", "terminated", "终止", "terminated",
	)
}

// mapPublishStatus 发布状态：草稿/已发布/已归档 ↔ draft/published/archived。
func mapPublishStatus(v string) string {
	return mapDictValue(v,
		"草稿", "draft",
		"已发布", "published", "发布", "published",
		"已归档", "archived", "归档", "archived",
	)
}

// mapAchievementType 成果类型：岗位/场景/课程/自定义 ↔ job/scene/course/custom。
func mapAchievementType(v string) string {
	return mapDictValue(v,
		"岗位成果", "job", "岗位", "job",
		"场景成果", "scene", "场景", "scene",
		"课程成果", "course", "课程", "course",
		"自定义成果", "custom", "自定义", "custom", "其他", "custom",
	)
}

// mapAgreementStatus 协议状态：草稿/生效/已失效/已续签/已终止 ↔ draft/active/expired/renewed/terminated。
func mapAgreementStatus(v string) string {
	return mapDictValue(v,
		"草稿", "draft",
		"生效中", "active", "生效", "active", "有效", "active",
		"已失效", "expired", "失效", "expired", "已过期", "expired", "过期", "expired",
		"已续签", "renewed", "续签", "renewed",
		"已终止", "terminated", "终止", "terminated",
	)
}

// mapAccountType 账号类型：企业/专家 ↔ enterprise/expert。
func mapAccountType(v string) string {
	return mapDictValue(v,
		"企业账号", "enterprise", "企业", "enterprise",
		"专家账号", "expert", "专家", "expert",
	)
}

// mapBrandType 品牌类型：人才/雇主/岗位/专业/师资/文化 ↔ talent/employer/job/major/teacher/culture。
func mapBrandType(v string) string {
	return mapDictValue(v,
		"人才品牌", "talent", "人才", "talent",
		"雇主品牌", "employer", "雇主", "employer",
		"岗位品牌", "job", "岗位", "job",
		"专业品牌", "major", "专业", "major",
		"师资品牌", "teacher", "教师", "teacher", "师资", "teacher",
		"文化品牌", "culture", "文化", "culture",
	)
}

// mapExpertRating 专家评级：金牌/银牌/铜牌 ↔ gold/silver/copper。
func mapExpertRating(v string) string {
	return mapDictValue(v,
		"金牌", "gold", "金牌专家", "gold",
		"银牌", "silver", "银牌专家", "silver",
		"铜牌", "copper", "铜牌专家", "copper",
	)
}

// parseUploadedExcel parses the multipart form and opens the uploaded Excel file.
func parseUploadedExcel(r *http.Request) (*excelize.File, []string, error) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		return nil, nil, fmt.Errorf("表单数据无效")
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		return nil, nil, fmt.Errorf("缺少上传文件")
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("解析 Excel 文件失败")
	}
	sheets := xlsx.GetSheetList()
	return xlsx, sheets, nil
}

// parseUploadedExcels parses the multipart form and opens all uploaded Excel files.
func parseUploadedExcels(r *http.Request) ([]*excelize.File, [][]string, error) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		return nil, nil, fmt.Errorf("表单数据无效")
	}
	fhs := r.MultipartForm.File["file"]
	if len(fhs) == 0 {
		return nil, nil, fmt.Errorf("缺少上传文件")
	}
	xlsxs := make([]*excelize.File, 0, len(fhs))
	sheetsList := make([][]string, 0, len(fhs))
	for _, fh := range fhs {
		f, err := fh.Open()
		if err != nil {
			return nil, nil, fmt.Errorf("打开文件 %s 失败", fh.Filename)
		}
		xlsx, err := excelize.OpenReader(f)
		f.Close()
		if err != nil {
			return nil, nil, fmt.Errorf("解析 Excel 文件 %s 失败", fh.Filename)
		}
		xlsxs = append(xlsxs, xlsx)
		sheetsList = append(sheetsList, xlsx.GetSheetList())
	}
	return xlsxs, sheetsList, nil
}

// MultiFileUpload 封装多文件上传的通用处理：解析、遍历、关闭、Sheet 列表。
type MultiFileUpload struct {
	Files  []*excelize.File
	sheets [][]string
}

// ParseMultiFileUpload 解析请求中的所有上传 Excel 文件。
func ParseMultiFileUpload(r *http.Request) (*MultiFileUpload, error) {
	xlsxs, sheetsList, err := parseUploadedExcels(r)
	if err != nil {
		return nil, err
	}
	return &MultiFileUpload{Files: xlsxs, sheets: sheetsList}, nil
}

// ForEach 遍历所有文件，依次调用 fn，并在每次调用后关闭文件。
func (m *MultiFileUpload) ForEach(fn func(*excelize.File)) {
	for _, f := range m.Files {
		fn(f)
		f.Close()
	}
}

// FirstSheets 返回第一个文件的 Sheet 名称列表，无文件时返回 nil。
func (m *MultiFileUpload) FirstSheets() []string {
	if len(m.sheets) > 0 {
		return m.sheets[0]
	}
	return nil
}

// importRequestContext bundles parsed auth and multi-file data from an import request.
type importRequestContext struct {
	Claims    *middleware.Claims
	TenantID  string
	UserID    string
	Overwrite bool
	MFU       *MultiFileUpload
}

// parseMultiImportRequest handles auth, tenant, and multi-file form parsing.
// Writes error response and returns nil on any failure.
func parseMultiImportRequest(w http.ResponseWriter, r *http.Request, requirePortalAdmin bool) *importRequestContext {
	claims := middleware.CurrentUser(r)
	if claims == nil || (requirePortalAdmin && !canManagePortal(claims)) {
		respondError(w, http.StatusForbidden, "权限不足")
		return nil
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return nil
	}
	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return nil
	}
	return &importRequestContext{
		Claims:    claims,
		TenantID:  tenantID,
		UserID:    claims.UserID,
		Overwrite: importOverwriteParam(r),
		MFU:       mfu,
	}
}

// findOrCreateKnowledgePoints 按租户+名称批量查找知识点，不存在则创建，返回命中的 ID 列表。
// 供课程/场景/颗粒课/题库题面等导入复用。
func findOrCreateKnowledgePoints(ctx context.Context, db *pgxpool.Pool, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := db.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, _ = db.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
		var existing string
		_ = db.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

// findOrCreateResources 按租户+名称批量查找资源库资源，不存在则以 document 类型创建，
// 返回命中的 ID 列表。供课程/场景/颗粒课导入复用。
func findOrCreateResources(ctx context.Context, db *pgxpool.Pool, tenantID string, names []string, userID string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := db.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, _ = db.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,'document'::resource_type,$4) ON CONFLICT DO NOTHING`,
			id, tenantID, name, userID)
		var existing string
		_ = db.QueryRow(ctx, `SELECT id FROM resource_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else {
			ids = append(ids, id)
		}
	}
	return ids
}

// lookupBatchID 按租户+名称在批次表中查找记录 ID，找不到返回 nil。
// 表名经 lookupIDByName 白名单校验。
func lookupBatchID(ctx context.Context, db *pgxpool.Pool, table, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	id, err := lookupIDByName(ctx, db, table, tenantID, name)
	if err != nil || id == "" {
		return nil
	}
	return &id
}

// lookupMajorID 按租户+名称（NFKC 归一化）查找专业 ID，找不到返回 nil。
func lookupMajorID(ctx context.Context, db *pgxpool.Pool, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := db.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}
