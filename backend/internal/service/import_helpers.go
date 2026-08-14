package service

// 导入共享助手：Excel 列解析/枚举映射/名称后缀/覆盖权限/批量查找创建，
// 全部为业务纯函数或 store 委托（SQL 唯一所在地仍在 store）。
// handler 层保留薄别名（import_common.go），既有 handler 无需改名即可编译。

import (
	"context"
	"fmt"
	"math/rand/v2"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

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
	Created           int      `json:"created"`
	Failed            int      `json:"failed"`
	Skipped           int      `json:"skipped"`
	PermissionSkipped int      `json:"permissionSkipped,omitempty"`
	Entity            string   `json:"entity"`
	Errors            []string `json:"errors"`
}

// ParseImportBool 解析导入的布尔列：是/否、true/false、1/0（大小写不敏感），
// 空值返回 false；无法识别时也按 false 处理（页面开关默认关）。
func ParseImportBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "是", "true", "1", "yes", "y", "t":
		return true
	default:
		return false
	}
}

// JsonBytes 将任意值序列化为 JSON 字节，序列化失败时返回 "[]"。
func JsonBytes(v any) []byte {
	return store.MarshalJSONBytes(v, "[]")
}

// IsStrongPassword 密码强度：至少 8 位且含字母与数字
// （security-standards §1；注册/改密/重置/导入全部入口统一校验）。
func IsStrongPassword(password string) bool {
	if len(password) < 8 {
		return false
	}
	var hasLetter, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
		if hasLetter && hasDigit {
			return true
		}
	}
	return false
}

// LookupIDByName 按表名+租户+名称查询记录 ID（委托 store 白名单查询）。
func LookupIDByName(ctx context.Context, db store.Queryer, tableName, tenantID, name string) (string, error) {
	return store.LookupByTableAndName(ctx, db, tableName, tenantID, name)
}

// LookupIDsByNames 按租户+名称批量查找记录 ID（名称多值用分号分隔）。
func LookupIDsByNames(ctx context.Context, db store.Queryer, table, tenantID, names string) []string {
	return store.LookupIDsByNames(ctx, db, table, tenantID, names)
}

// LookupSingleIDByName 按租户+名称查找单个记录 ID（名称多值时取第一个）。
func LookupSingleIDByName(ctx context.Context, db store.Queryer, table, tenantID, names string) *string {
	return store.LookupSingleIDByName(ctx, db, table, tenantID, names)
}

// LookupBatchID 按租户+名称在批次表中查找记录 ID，找不到返回 nil。
func LookupBatchID(ctx context.Context, db store.Queryer, table, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	id, err := LookupIDByName(ctx, db, table, tenantID, name)
	if err != nil || id == "" {
		return nil
	}
	return &id
}

// LookupMajorID 按租户+名称（NFKC 归一化）查找专业 ID，找不到返回 nil。
func LookupMajorID(ctx context.Context, db store.Queryer, tenantID, name string) *string {
	return store.FindMajorIDByNormalizedName(ctx, db, tenantID, name)
}

// FindOrCreateKnowledgePoints 按租户+名称批量查找知识点，不存在则创建。
func FindOrCreateKnowledgePoints(ctx context.Context, db store.Queryer, tenantID string, names []string) []string {
	return store.FindOrCreateKnowledgePointsByNames(ctx, db, tenantID, names)
}

// FindOrCreateResources 按租户+名称批量查找资源库资源，不存在则按文件后缀推断类型创建
// （无后缀/未知后缀归入 other）。按 resourceType 分组后每组一次批量调用
// （每组 3 次查询而非 3N），返回命中的 ID 列表（顺序与输入一致）。
func FindOrCreateResources(ctx context.Context, db store.Queryer, tenantID string, names []string, userID string) []string {
	// 保序去重 + 按类型分组
	order := make([]string, 0, len(names))
	seen := make(map[string]bool, len(names))
	groups := map[string][]string{}
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		order = append(order, n)
		rt := ResourceTypeByExt(n)
		groups[rt] = append(groups[rt], n)
	}
	idByName := map[string]string{}
	for rt, batch := range groups {
		for _, id := range store.FindOrCreateResourcesByNames(ctx, db, tenantID, batch, rt, userID) {
			// batch 与返回 id 列表同序（store 实现保证）
			idByName[batch[0]] = id
			batch = batch[1:]
		}
	}
	ids := make([]string, 0, len(order))
	for _, n := range order {
		ids = append(ids, idByName[n])
	}
	return ids
}

// ResourceTypeByExt 根据文件名后缀推断资源类型，无法识别时返回 other。
// 后缀清单与前端 lib/resource-type-constants.tsx 的 resourceTypeExtensionMap 保持一致。
func ResourceTypeByExt(name string) string {
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

// SuffixedName 为名称追加 4 位随机数字后缀，如 "报告-3927"。
func SuffixedName(base string) string {
	return fmt.Sprintf("%s-%04d", base, rand.IntN(10000))
}

// UniqueSuffixed 生成不与现有记录冲突的候选名称/代码，至多重试 20 次。
func UniqueSuffixed(base string, exists func(candidate string) bool) string {
	for i := 0; i < 20; i++ {
		candidate := SuffixedName(base)
		if !exists(candidate) {
			return candidate
		}
	}
	return SuffixedName(base)
}

// CanOverwriteContent 判断当前用户是否可以覆盖目标内容：
// 创建者本人或参与共建才允许覆盖，否则覆盖时跳过并提示。
func CanOverwriteContent(creatorID string, collaboratorIDs []string, userID string) bool {
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

// Col 安全读取 Excel 行中的列值，越界时返回空字符串。
func Col(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

// SplitTrim 按分隔符拆分字符串并去除空白，空项被忽略。
func SplitTrim(s, sep string) []string {
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

// SplitNames 按中文分号/逗号拆分名称列表（模板中"关联"列统一使用中文分号「；」分隔）。
func SplitNames(s string) []string {
	if s == "" {
		return []string{}
	}
	return SplitTrim(s, "；")
}

// ParseNullableInt 将字符串解析为整数，空或无效时返回 nil。
func ParseNullableInt(s string) *int {
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

// NullableStr 去除空白后，空字符串返回 nil。
func NullableStr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// ParseIntDefault 将字符串解析为整数，空或无效时返回默认值。
func ParseIntDefault(s string, defaultVal int) int {
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

// ParseFloatDefault 将字符串解析为浮点数，空或无效时返回默认值。
func ParseFloatDefault(s string, defaultVal float64) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal
	}
	return v
}

// MapDictValue 将 Excel 中的中文/英文枚举值统一映射为内部英文值。
// 未识别时返回原值（trim 后）。
func MapDictValue(value string, pairs ...string) string {
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

// MapProjectPhase 项目阶段：启动/执行中/验收/关闭/已归档/已终止 ↔ initiation/execution/acceptance/closure/archived/terminated。
func MapProjectPhase(v string) string {
	return MapDictValue(v,
		"启动", "initiation", "发起", "initiation",
		"执行中", "execution", "执行", "execution",
		"验收", "acceptance",
		"关闭", "closure",
		"已归档", "archived", "归档", "archived",
		"已终止", "terminated", "终止", "terminated",
	)
}

// MapPublishStatus 发布状态：草稿/已发布/已归档 ↔ draft/published/archived。
func MapPublishStatus(v string) string {
	return MapDictValue(v,
		"草稿", "draft",
		"已发布", "published", "发布", "published",
		"已归档", "archived", "归档", "archived",
	)
}

// MapAchievementType 成果类型：岗位/场景/课程/自定义 ↔ job/scene/course/custom。
func MapAchievementType(v string) string {
	return MapDictValue(v,
		"岗位成果", "job", "岗位", "job",
		"场景成果", "scene", "场景", "scene",
		"课程成果", "course", "课程", "course",
		"自定义成果", "custom", "自定义", "custom", "其他", "custom",
	)
}

// MapAgreementStatus 协议状态：草稿/生效/已失效/已续签/已终止 ↔ draft/active/expired/renewed/terminated。
func MapAgreementStatus(v string) string {
	return MapDictValue(v,
		"草稿", "draft",
		"生效中", "active", "生效", "active", "有效", "active",
		"已失效", "expired", "失效", "expired", "已过期", "expired", "过期", "expired",
		"已续签", "renewed", "续签", "renewed",
		"已终止", "terminated", "终止", "terminated",
	)
}

// MapAccountType 账号类型：企业/专家 ↔ enterprise/expert。
func MapAccountType(v string) string {
	return MapDictValue(v,
		"企业账号", "enterprise", "企业", "enterprise",
		"专家账号", "expert", "专家", "expert",
	)
}

// MapBrandType 品牌类型：人才/雇主/岗位/专业/师资/文化 ↔ talent/employer/job/major/teacher/culture。
func MapBrandType(v string) string {
	return MapDictValue(v,
		"人才品牌", "talent", "人才", "talent",
		"雇主品牌", "employer", "雇主", "employer",
		"岗位品牌", "job", "岗位", "job",
		"专业品牌", "major", "专业", "major",
		"师资品牌", "teacher", "教师", "teacher", "师资", "teacher",
		"文化品牌", "culture", "文化", "culture",
	)
}
