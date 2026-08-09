package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// lookupIDByNameTables 是 lookupIDByName 允许查询的表名白名单。
// lookupIDByName 按表名+租户+名称查询记录 ID（委托 store 白名单查询，SQL 唯一所在地）。
func lookupIDByName(ctx context.Context, db store.Queryer, tableName, tenantID, name string) (string, error) {
	return store.LookupByTableAndName(ctx, db, tableName, tenantID, name)
}

// lookupIDsByNames 按租户+名称批量查找记录 ID（名称多值用分号分隔），
// 未命中的名称忽略，返回命中的 ID 列表。
func lookupIDsByNames(ctx context.Context, db store.Queryer, table, tenantID, names string) []string {
	return store.LookupIDsByNames(ctx, db, table, tenantID, names)
}

// lookupSingleIDByName 按租户+名称查找单个记录 ID（名称多值时取第一个），
// 未命中时返回 nil。
func lookupSingleIDByName(ctx context.Context, db store.Queryer, table, tenantID, names string) *string {
	return store.LookupSingleIDByName(ctx, db, table, tenantID, names)
}

// jsonBytes 将任意值序列化为 JSON 字节，序列化失败时返回 "[]"。
func jsonBytes(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("[]")
	}
	return b
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
	Created int `json:"created"`
	Failed  int `json:"failed"`
	Skipped int `json:"skipped"`
	// PermissionSkipped 无权限覆盖（非本人创建且未参与共建）而跳过的条数。
	PermissionSkipped int      `json:"permissionSkipped,omitempty"`
	Entity            string   `json:"entity"`
	Errors            []string `json:"errors"`
}

// importOverwriteParam 从请求中获取是否覆盖已存在数据的标识。
func importOverwriteParam(r *http.Request) bool {
	return r.URL.Query().Get("overwrite") == "true"
}

// importRenameParam 从请求中获取是否对重名数据追加随机后缀后按新对象导入的标识。
func importRenameParam(r *http.Request) bool {
	return r.URL.Query().Get("rename") == "true"
}

// suffixedName 为名称追加 4 位随机数字后缀，如 "报告-3927"。
func suffixedName(base string) string {
	return fmt.Sprintf("%s-%04d", base, rand.IntN(10000))
}

// uniqueSuffixed 生成不与现有记录冲突的候选名称/代码：追加 4 位随机数字后缀，
// 由 exists 回调校验是否已被占用，至多重试 20 次。
func uniqueSuffixed(base string, exists func(candidate string) bool) string {
	for i := 0; i < 20; i++ {
		candidate := suffixedName(base)
		if !exists(candidate) {
			return candidate
		}
	}
	return suffixedName(base)
}

// canOverwriteContent 判断当前用户是否可以覆盖目标内容：
// 创建者本人或参与共建（协作者数组包含当前用户）才允许覆盖，否则覆盖时跳过并提示。
func canOverwriteContent(creatorID string, collaboratorIDs []string, userID string) bool {
	if creatorID != "" && creatorID == userID {
		return true
	}
	for _, id := range collaboratorIDs {
		if id == userID {
			return true
		}
	}
	return false
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
	Rename    bool
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
		Rename:    importRenameParam(r),
		MFU:       mfu,
	}
}

// findOrCreateKnowledgePoints 按租户+名称批量查找知识点，不存在则创建，返回命中的 ID 列表。
// 供课程/场景/颗粒课/题库题面等导入复用。
func findOrCreateKnowledgePoints(ctx context.Context, db store.Queryer, tenantID string, names []string) []string {
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
		code, codeErr := store.GenerateUniqueEntityCode(ctx, db, "KP", "knowledge_points", tenantID)
		if codeErr != nil {
			code = store.GenerateEntityCode("KP")
		}
		_, _ = db.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name, code) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, id, tenantID, name, code)
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

// findOrCreateResources 按租户+名称批量查找资源库资源，不存在则按文件后缀推断类型创建
// （无后缀/未知后缀归入 other），返回命中的 ID 列表。供课程/场景/颗粒课导入复用。
func findOrCreateResources(ctx context.Context, db store.Queryer, tenantID string, names []string, userID string) []string {
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
		_, _ = db.Exec(ctx, `INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by) VALUES ($1,$2,$3,$4::resource_type,$5) ON CONFLICT DO NOTHING`,
			id, tenantID, name, resourceTypeByExt(name), userID)
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

// resourceTypeByExt 根据文件名后缀推断资源类型，无法识别（无后缀/未知后缀/URL 等）时返回 other。
// 后缀清单与前端 lib/resource-type-constants.tsx 的 resourceTypeExtensionMap 保持一致；
// zip 同时属于 archive 与 software，这里优先按 archive 处理。
func resourceTypeByExt(name string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	switch ext {
	case "pdf", "doc", "docx", "docm", "dot", "dotx", "dotm", "wps", "wpt",
		"rtf", "odt", "ott", "fodt", "pages",
		"ppt", "pptx", "dps", "odp", "otp", "sxi", "vsd", "vsdx",
		"txt", "md", "log", "json", "properties", "yaml", "yml", "gitignore",
		"xml", "xbrl", "html", "htm",
		"java", "py", "c", "cpp", "h", "php", "go", "js", "css", "lua", "sh",
		"rb", "sql", "bat", "m", "bas", "prg", "cmd", "cs", "ftl", "asp", "jsp", "aspx",
		"ofd", "epub", "eml", "xmind", "drawio", "bpmn", "dcm",
		"dwg", "dxf", "dwf", "dwfx", "dwt", "dng", "cf2", "plt",
		"stl", "obj", "3ds", "ply", "off", "3dm", "fbx", "dae", "wrl", "3mf",
		"glb", "gltf", "o3dv", "stp", "step", "iges", "igs", "brep", "bim", "fcstd", "ifc":
		return string(domain.ResourceTypeDocument)
	case "xls", "xlsx", "xlsm", "xlt", "xltx", "xltm", "xlam", "xla",
		"et", "ett", "ods", "ots", "csv", "tsv":
		return string(domain.ResourceTypeSpreadsheet)
	case "jpg", "jpeg", "png", "gif", "bmp", "webp", "ico", "jfif",
		"svg", "tif", "tiff", "tga", "psd", "eps", "wmf", "emf":
		return string(domain.ResourceTypeImage)
	case "mp3", "wav", "m4a", "flac", "aac", "ogg":
		return string(domain.ResourceTypeAudio)
	case "mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "mpeg", "3gp", "rm",
		"mpd", "m3u8", "ts":
		return string(domain.ResourceTypeVideo)
	case "zip", "rar", "7z", "tar", "gz", "bz2", "jar", "gzip":
		return string(domain.ResourceTypeArchive)
	case "exe", "dmg", "pkg", "deb", "rpm", "msi", "apk":
		return string(domain.ResourceTypeSoftware)
	default:
		return string(domain.ResourceTypeOther)
	}
}

// lookupBatchID 按租户+名称在批次表中查找记录 ID，找不到返回 nil。
// 表名经 lookupIDByName 白名单校验。
func lookupBatchID(ctx context.Context, db store.Queryer, table, tenantID, name string) *string {
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
func lookupMajorID(ctx context.Context, db store.Queryer, tenantID, name string) *string {
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
