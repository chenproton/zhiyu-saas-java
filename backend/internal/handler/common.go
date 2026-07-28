package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// ErrMissingTenant is returned by executeListQuery when the caller has no tenant.
// Handlers should check for this error with errors.Is and respond 403.
var ErrMissingTenant = errors.New("missing tenant")

// sanitizeIdentifier validates that identifier is one of the allowed values.
// It returns the identifier unchanged if valid, otherwise an error.
func sanitizeIdentifier(identifier string, allowed []string) (string, error) {
	for _, a := range allowed {
		if identifier == a {
			return identifier, nil
		}
	}
	return "", fmt.Errorf("invalid identifier: %s", identifier)
}

// coalesceStringSlice 将 nil 切片转为空切片，避免 SQL 参数中写入 NULL。
func coalesceStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// generateSecurePassword 生成指定长度的随机十六进制密码。
func generateSecurePassword(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// isStrongPassword requires at least 8 characters and at least one letter and one digit.
func isStrongPassword(password string) bool {
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

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// MaxPageSize limits the number of items per page to prevent unbounded queries.
const MaxPageSize = 200

func parseInt(s string, defaultVal int) (int, error) {
	if s == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal, err
	}
	return v, nil
}

func parsePageLimit(s string, defaultVal int) (int, error) {
	v, err := parseInt(s, defaultVal)
	if err != nil {
		return defaultVal, err
	}
	if v > MaxPageSize {
		v = MaxPageSize
	}
	if v < 1 {
		v = defaultVal
	}
	return v, nil
}

func itoa(i int) string {
	return strconv.Itoa(i)
}

// withTx 创建事务、执行 fn，根据 fn 返回值决定 commit 或 rollback。
// fn 返回 error 时自动 rollback，否则 commit。
func withTx(ctx context.Context, db *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// lookupIDByNameTables 是 lookupIDByName 允许查询的表名白名单。
var lookupIDByNameTables = []string{
	"ability_points", "ability_domains", "career_positions", "certificate_library",
	"courses", "evaluation_batches", "exams", "industries", "institutions",
	"knowledge_points", "majors", "organizations", "question_banks", "questions",
	"resource_library", "roles", "scenarios", "staff_titles", "subscription_packages", "users",
}

// lookupIDByName 按表名+租户+名称查询记录 ID，不存在时返回空字符串。
func lookupIDByName(ctx context.Context, db *pgxpool.Pool, tableName, tenantID, name string) (string, error) {
	table, err := sanitizeIdentifier(tableName, lookupIDByNameTables)
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

func parseFloat(s string, defaultVal float64) (float64, error) {
	if s == "" {
		return defaultVal, nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal, err
	}
	return v, nil
}

// platformAdminOnly returns true if the caller is a platform admin.
func platformAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, "platform_admin")
}

// schoolAdminOnly returns true if the caller is a school admin.
func schoolAdminOnly(claims *middleware.Claims) bool {
	return middleware.HasRole(claims, "school_admin")
}

// canManagePortal returns true for portal system management.
// It prefers the permission-based system menu check so that custom roles
// granted system settings menus also work, while keeping school_admin and
// platform_admin as fallbacks for backward compatibility.
func canManagePortal(claims *middleware.Claims) bool {
	return middleware.HasSystemPermission(claims) || schoolAdminOnly(claims) || canManagePlatform(claims)
}

// canManagePlatform returns true for platform-level configuration/operation.
func canManagePlatform(claims *middleware.Claims) bool {
	return platformAdminOnly(claims)
}

// canModifyContent returns true for business-resource write operations.
func canModifyContent(claims *middleware.Claims) bool {
	if claims == nil {
		return false
	}
	for _, code := range []string{"teacher", "school_admin", "enterprise_mentor"} {
		if middleware.HasRole(claims, code) {
			return true
		}
	}
	return false
}

// canReadTenantScoped returns true if the caller has a tenant to scope reads to.
// 教育域数据一律租户内可见，不再为 platform_admin 提供跨租户特权
// （跨租户运营操作走 superadmin 控制台的独立路径）。
func canReadTenantScoped(claims *middleware.Claims) bool {
	if claims == nil {
		return false
	}
	return claims.TenantID != nil && *claims.TenantID != ""
}

// tenantFilter returns the tenant_id value to filter by. ok=false when the
// caller has no tenant and cannot access tenant-scoped data.
func tenantFilter(claims *middleware.Claims) (tenantID string, ok bool) {
	if claims == nil {
		return "", false
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		return "", false
	}
	return *claims.TenantID, true
}

// requireTenant resolves the caller's tenant for tenant-scoped writes.
// Writes a 403 response and returns ok=false when the caller has no tenant.
func requireTenant(w http.ResponseWriter, r *http.Request) (string, bool) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return "", false
	}
	return *claims.TenantID, true
}

// institutionFilter returns the institution_id value to filter by, or an empty
// string when the caller is a platform admin. ok=false means the caller has no
// institution and cannot read institution-scoped lists.
func institutionFilter(claims *middleware.Claims) (institutionID string, ok bool) {
	if claims == nil {
		return "", false
	}
	if platformAdminOnly(claims) {
		return "", true
	}
	if claims.InstitutionID == nil || *claims.InstitutionID == "" {
		return "", false
	}
	return *claims.InstitutionID, true
}

func ptrEqual[T comparable](a, b *T) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// verifyTenantOwnership checks that the entity's tenantID matches the caller's tenant.
// Writes a 403 response and returns false when they don't match.
func verifyTenantOwnership(w http.ResponseWriter, r *http.Request, entityTenantID string) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return false
	}
	if entityTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "无权操作：资源不属于您的租户")
		return false
	}
	return true
}

// verifyRequestTenant validates that the tenantId from the request body matches the
// caller's tenant. Writes a 403 and returns false if they differ.
func verifyRequestTenant(w http.ResponseWriter, r *http.Request, requestTenantID string) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return false
	}
	if requestTenantID != *claims.TenantID {
		respondError(w, http.StatusForbidden, "无权操作：不能为其他租户创建资源")
		return false
	}
	return true
}

const entityCodeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// generateEntityCode returns a human-readable code like "GW-A3B7C9D1".
func generateEntityCode(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// Fall back to a deterministic but still formatted value on entropy failure.
		return fmt.Sprintf("%s-%08d", prefix, 0)
	}
	for i := range b {
		b[i] = entityCodeAlphabet[int(b[i])%len(entityCodeAlphabet)]
	}
	return fmt.Sprintf("%s-%s", prefix, string(b))
}

// generateUniqueEntityCode generates a code and ensures it does not already exist
// in the given tenant-scoped table. It retries a few times on collision.
func generateUniqueEntityCode(ctx context.Context, db interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}, prefix, table, tenantID string) (string, error) {
	if _, err := sanitizeIdentifier(table, allowedUniqueCodeTables); err != nil {
		return "", err
	}
	for i := 0; i < 10; i++ {
		code := generateEntityCode(prefix)
		var exists bool
		err := db.QueryRow(ctx, fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id=$1 AND code=$2)", table), tenantID, code).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", fmt.Errorf("生成唯一%s编码失败", prefix)
}

// allowedUniqueCodeTables lists the tables that may be passed to generateUniqueEntityCode.
var allowedUniqueCodeTables = []string{
	"career_positions",
	"courses",
	"exams",
	"question_banks",
	"questions",
	"scenarios",
}

// listQueryBuilder accumulates WHERE conditions and positional arguments for
// the generic list query helper. Use nextArg to reserve the next placeholder(s)
// and addCondition to append a condition using those placeholders.
type listQueryBuilder struct {
	where []string
	args  []any
	idx   int
}

func (qb *listQueryBuilder) nextArg(args ...any) string {
	out := make([]string, len(args))
	for i, a := range args {
		out[i] = "$" + itoa(qb.idx)
		qb.args = append(qb.args, a)
		qb.idx++
	}
	if len(out) == 1 {
		return out[0]
	}
	return strings.Join(out, ", ")
}

func (qb *listQueryBuilder) addCondition(cond string) {
	qb.where = append(qb.where, cond)
}

func (qb *listQueryBuilder) whereClause() string {
	if len(qb.where) == 0 {
		return "1=1"
	}
	return strings.Join(qb.where, " AND ")
}

// listQueryFilter adds extra WHERE conditions to a list query. Callers should
// use qb.nextArg to obtain the correct placeholder and addCondition to append.
type listQueryFilter func(r *http.Request, qb *listQueryBuilder)

// listQueryConfig configures executeListQuery for a specific entity type.
type listQueryConfig[T any] struct {
	Table         string
	SelectColumns string
	TenantScoped  bool
	TenantColumn  string
	SearchColumns []string
	SearchParam   string // query parameter name for search; defaults to "search"
	OrderBy       string
	NoPagination  bool // when true, no LIMIT/OFFSET is appended (full list)
	DefaultLimit  int  // fallback page size when limit param is missing; defaults to 50
	ExtraFilter   listQueryFilter
	ScanRows      func(pgx.Rows) ([]T, error)
}

type listQueryDB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// Allowed identifiers for executeListQuery configuration. These are hardcoded by
// callers; the whitelist prevents accidental SQL identifier injection if any
// value becomes dynamic in the future.
var (
	allowedListQueryTables = []string{
		"ability_domains",
		"ability_points",
		"appeal_records",
		"approval_records",
		"banner_configs",
		"career_positions cp",
		"cert_issuance_records",
		"certificate_library",
		"certification_rules",
		"courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id",
		"evaluation_methods",
		"exam_results er LEFT JOIN majors m ON m.id = er.major_id",
		"exam_usages",
		"exams e",
		"graduation_project_topics",
		"hybrid_node_modules",
		"industries",
		"knowledge_points",
		"learn_roads",
		"majors",
		"micro_cert_templates",
		"node_homeworks",
		"node_quizzes",
		"on_site_question_library",
		"org_types",
		"organizations",
		"platform_links",
		"position_ability_bindings",
		"position_favorites pf JOIN career_positions cp ON cp.id = pf.career_position_id",
		"position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		"position_responsibilities",
		"questions",
		"random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		"resource_codes",
		"roles",
		"rubric_templates",
		"scenario_grade_mappings",
		"scenario_tasks",
		"scenario_weight_configs",
		"scenarios s",
		"scene_evaluation_results",
		"staff_titles",
		"student_ability_archives",
		"student_ability_portraits",
		"system_course_nodes n",
		"tenants",
		"users",
		"workflows",
	}

	allowedListQuerySelectColumns = []string{
		"b.id, b.name, b.code, b.org_node_id, b.major_id, COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count, b.published_count, b.pending_count, b.created_at, b.updated_at",
		"eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
		"er.id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id, COALESCE(m.name, '') AS major_name, er.score, er.total_score, er.is_pass, er.answers, er.submit_time, er.created_at",
		"id, career_position_id, name, description, binding_ids, sort_order",
		"id, career_position_id, name, description, sort_order",
		"id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight",
		"id, career_position_id, status, rule_source, created_at, updated_at",
		"id, category_id, name, enabled, sub_category_name, description, doc_link",
		"id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at",
		"id, name, career_position_id, college, source, status, capacity, applied_count, advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at",
		"id, name, code, description, category, attributes, is_public, creator_id, created_at",
		"id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, created_at, updated_at",
		"id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, admin_ids, status, created_at, updated_at",
		"id, name, description, position_ids, steps, created_at, updated_at",
		"id, node_id, module_key, mode, data",
		"id, node_id, title, requirement, need_attachment, deadline",
		"id, node_id, title, type, time_limit",
		"id, platform, url, enabled",
		"id, scenario_id, task_id, level, min_score, max_score, description, color",
		"id, scenario_id, task_id, weight",
		"id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by",
		"id, template_id, user_id, cert_number, issue_date, expire_date, status, revoked_at, revoke_reason",
		"id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		"id, tenant_id, code, name, description, permissions, user_count, status, created_at",
		"id, tenant_id, code, name, description, type, created_at",
		"id, tenant_id, code, name, description, user_count, status, created_at",
		"id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at",
		"id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id, created_at, updated_at",
		"id, tenant_id, name, category, description, is_default, created_at",
		"id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at",
		"id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at",
		"id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at",
		"id, tenant_id, name, url, description, image_url, creator_id, created_at",
		"id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at",
		"id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id, history, created_at, updated_at",
		"id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at",
		"id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at",
		"id, user_id, type, reason, status, created_at",
		"lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
		"n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name, n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours, n.duration, n.difficulty, n.knowledge_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status",
		"pr.id, pr.major_id, COALESCE(m.name, '') AS major_name, pr.career_position_id, pr.position_type, pr.reason, pr.sort_order, pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at",
		"rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at",
		"sb.id, sb.name, sb.code, sb.org_node_id, sb.major_id, COALESCE(m.name, '') AS major_name, sb.workflow_id, sb.status, sb.scenario_count, sb.created_at, sb.updated_at",
	}

	allowedListQueryOrderBy = []string{
		"c.created_at DESC",
		"cp.created_at DESC",
		"e.created_at DESC",
		"er.score DESC, er.submit_time ASC",
		"id DESC",
		"issue_date DESC",
		"min_score ASC",
		"module_key ASC",
		"n.sort_order ASC, n.id ASC",
		"name",
		"pf.created_at DESC",
		"platform ASC",
		"pr.sort_order ASC, pr.created_at DESC",
		"s.created_at DESC",
		"sort_order",
		"sort_order ASC",
		"sort_order ASC, created_at ASC",
		"sort_order ASC, created_at DESC",
		"sort_order ASC, id ASC",
		"updated_at DESC",
	}

	allowedListQueryTenantColumns = []string{
		"",
		"c.tenant_id",
		"cp.tenant_id",
		"e.tenant_id",
		"id",
		"pr.tenant_id",
		"s.tenant_id",
	}

	allowedListQuerySearchColumns = []string{
		"c.code",
		"c.name",
		"code",
		"content",
		"cp.name",
		"description",
		"e.description",
		"e.name",
		"email",
		"m.name",
		"name",
		"question_text",
		"rdq.description",
		"rdq.name",
		"s.code",
		"s.name",
		"title",
		"username",
	}
)

// executeListQuery builds and runs a paginated, tenant-scoped list query with
// optional search and extra filters. It returns the scanned items, total count
// and an error. A "missing tenant" error means the caller has no tenant and
// should respond with 403.
func executeListQuery[T any](ctx context.Context, db listQueryDB, r *http.Request, cfg listQueryConfig[T], scanRows ...func(pgx.Rows) ([]T, error)) ([]T, int, error) {
	scanner := cfg.ScanRows
	if len(scanRows) > 0 {
		scanner = scanRows[0]
	}
	if scanner == nil {
		return nil, 0, errors.New("scanRows not configured")
	}

	if _, err := sanitizeIdentifier(cfg.Table, allowedListQueryTables); err != nil {
		return nil, 0, err
	}
	if _, err := sanitizeIdentifier(cfg.SelectColumns, allowedListQuerySelectColumns); err != nil {
		return nil, 0, err
	}
	if _, err := sanitizeIdentifier(cfg.OrderBy, allowedListQueryOrderBy); err != nil {
		return nil, 0, err
	}
	if _, err := sanitizeIdentifier(cfg.TenantColumn, allowedListQueryTenantColumns); err != nil {
		return nil, 0, err
	}
	for _, col := range cfg.SearchColumns {
		if _, err := sanitizeIdentifier(col, allowedListQuerySearchColumns); err != nil {
			return nil, 0, err
		}
	}

	qb := &listQueryBuilder{idx: 1}

	if cfg.TenantScoped {
		tenantID, ok := tenantFilter(middleware.CurrentUser(r))
		if !ok {
			return nil, 0, ErrMissingTenant
		}
		col := cfg.TenantColumn
		if col == "" {
			col = "tenant_id"
		}
		qb.addCondition(col + " = " + qb.nextArg(tenantID))
	}

	searchParam := cfg.SearchParam
	if searchParam == "" {
		searchParam = "search"
	}
	search := r.URL.Query().Get(searchParam)
	if search != "" && len(cfg.SearchColumns) > 0 {
		ph := qb.nextArg("%" + search + "%")
		conds := make([]string, len(cfg.SearchColumns))
		for i, col := range cfg.SearchColumns {
			conds[i] = col + " ILIKE " + ph
		}
		qb.addCondition("(" + strings.Join(conds, " OR ") + ")")
	}

	if cfg.ExtraFilter != nil {
		cfg.ExtraFilter(r, qb)
	}

	where := qb.whereClause()
	countQuery := "SELECT COUNT(*) FROM " + cfg.Table + " WHERE " + where
	var total int
	if err := db.QueryRow(ctx, countQuery, qb.args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count query failed: %w", err)
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	defaultLimit := cfg.DefaultLimit
	if defaultLimit <= 0 {
		defaultLimit = 50
	}
	limit := defaultLimit
	offset := 0
	if v, err := parsePageLimit(limitStr, defaultLimit); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	orderBy := cfg.OrderBy
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	query := "SELECT " + cfg.SelectColumns + " FROM " + cfg.Table + " WHERE " + where + " ORDER BY " + orderBy
	if !cfg.NoPagination {
		limPh := qb.nextArg(limit)
		offPh := qb.nextArg(offset)
		query += " LIMIT " + limPh + " OFFSET " + offPh
	}

	rows, err := db.Query(ctx, query, qb.args...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	items, err := scanner(rows)
	if err != nil {
		return nil, total, err
	}
	return items, total, nil
}

// recordView inserts a view log entry for the given target.
func recordView(ctx context.Context, db *pgxpool.Pool, targetType, targetID string, claims *middleware.Claims) error {
	var userID, tenantID any
	if claims != nil {
		userID = claims.UserID
		if claims.TenantID != nil {
			tenantID = *claims.TenantID
		}
	}
	_, err := db.Exec(ctx, `
		INSERT INTO view_logs (target_type, target_id, user_id, tenant_id)
		VALUES ($1, $2, $3, $4)
	`, targetType, targetID, userID, tenantID)
	return err
}
