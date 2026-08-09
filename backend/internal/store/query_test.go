package store

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

// ===== SanitizeIdentifier 白名单校验 =====

func TestSanitizeIdentifier(t *testing.T) {
	cases := []struct {
		name string
		id   string
		ok   bool
	}{
		{"合法标识", "users", true},
		{"非法标识（注入尝试）", "users; DROP TABLE users", false},
		{"非法标识（任意字符串）", "任意内容", false},
		{"空串按配置决定", "", true}, // 空 TenantColumn 在白名单中
		{"SQL 注入 UNION", "id UNION SELECT password FROM users", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			allowed := allowedListQueryTables
			if c.id == "" {
				allowed = allowedListQueryTenantColumns
			}
			_, err := SanitizeIdentifier(c.id, allowed)
			if c.ok && err != nil {
				t.Fatalf("期望合法，实际报错: %v", err)
			}
			if !c.ok && err == nil {
				t.Fatalf("期望拒绝 %q，实际通过", c.id)
			}
		})
	}
}

// TestExecuteListQueryRejectsUntrustedConfig 确保白名单拦截注入（不经 DB）。
func TestExecuteListQueryRejectsUntrustedConfig(t *testing.T) {
	ctx := context.Background()
	db := &fakeListDB{}
	cfg := ListQueryConfig[struct{}]{
		Table:         "users; DROP TABLE users",
		SelectColumns: "id",
		TenantScoped:  true,
		TenantColumn:  "tenant_id",
		ScanRows:      func(pgx.Rows) ([]struct{}, error) { return nil, nil },
	}
	_, _, err := ExecuteListQuery(ctx, db, ListParams{TenantID: "t1"}, cfg)
	if err == nil {
		t.Fatal("注入表名应被白名单拒绝")
	}
}

// TestExecuteListQueryMissingTenant 租户必填校验。
func TestExecuteListQueryMissingTenant(t *testing.T) {
	ctx := context.Background()
	cfg := ListQueryConfig[struct{}]{
		Table:         "users",
		SelectColumns: "id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name, username, name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at",
		TenantScoped:  true,
		TenantColumn:  "tenant_id",
		ScanRows:      func(pgx.Rows) ([]struct{}, error) { return nil, nil },
	}
	_, _, err := ExecuteListQuery(ctx, &fakeListDB{}, ListParams{}, cfg)
	if !errors.Is(err, ErrMissingTenant) {
		t.Fatalf("期望 ErrMissingTenant，实际: %v", err)
	}
}

// ===== ListQueryBuilder =====

func TestListQueryBuilderBasic(t *testing.T) {
	qb := NewListQueryBuilder()
	qb.AddCondition("tenant_id = " + qb.NextArg("t1"))
	qb.AddCondition("status = " + qb.NextArg("active"))

	where := qb.WhereClause()
	if where != "tenant_id = $1 AND status = $2" {
		t.Fatalf("where 不匹配: %s", where)
	}
	args := qb.Args()
	if len(args) != 2 || args[0] != "t1" || args[1] != "active" {
		t.Fatalf("args 不匹配: %v", args)
	}
}

func TestListQueryBuilderEmpty(t *testing.T) {
	qb := NewListQueryBuilder()
	if qb.WhereClause() != "1=1" {
		t.Fatalf("空条件应返回 1=1: %s", qb.WhereClause())
	}
	if len(qb.Args()) != 0 {
		t.Fatal("空条件不应有参数")
	}
}

func TestListQueryBuilderMultiArg(t *testing.T) {
	qb := NewListQueryBuilder()
	ph := qb.NextArg("a", "b")
	if ph != "$1, $2" {
		t.Fatalf("多参占位符不匹配: %s", ph)
	}
	if len(qb.Args()) != 2 {
		t.Fatal("多参未累积")
	}
}

// ===== 白名单完整性（防止 handler 迁移后配置缺项导致线上 500）=====

// fakeListDB 实现 ListQueryDB（仅用于到达白名单校验路径）。
type fakeListDB struct{}

func (f *fakeListDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func (f *fakeListDB) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

// TestWhitelistCoversHandlerConfigs 校验各 handler List 配置的关键串已入白名单。
// 该测试守护 P2 迁移期多次出现的"白名单缺项→500"回归。
func TestWhitelistCoversHandlerConfigs(t *testing.T) {
	// 关键表串（JOIN 形式）必须全部在 allowedListQueryTables
	criticalTables := []string{
		"users",
		"organizations",
		"tenants",
		"courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id LEFT JOIN users cr_u ON cr_u.id = c.creator_id",
		"scenarios s LEFT JOIN LATERAL (SELECT COALESCE(array_agg(i.name), '{}') AS names FROM industries i WHERE i.id::text = ANY(s.industry_ids)) ind ON true LEFT JOIN LATERAL (SELECT COALESCE(array_agg(m2.name), '{}') AS names FROM majors m2 WHERE m2.id = ANY(s.profession_ids)) prof ON true LEFT JOIN view_counters vc ON vc.target_type = 'scenario' AND vc.target_id = s.id LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM scenario_tasks t WHERE t.scenario_id = s.id) tcnt ON true LEFT JOIN users cr_u ON cr_u.id = s.creator_id",
		"schedule_entries se LEFT JOIN organizations o ON o.id = se.class_node_id LEFT JOIN users u ON u.id = se.teacher_id LEFT JOIN venues v ON v.id = se.venue_id LEFT JOIN scenarios sc ON sc.id = se.scenario_id",
		"question_banks qb LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM questions q WHERE q.bank_id = qb.id) qcnt ON true LEFT JOIN users cr_u ON cr_u.id = qb.creator_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') AS ids FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) kparr ON true",
		"exams e",
		"exam_results er LEFT JOIN majors m ON m.id = er.major_id",
		"training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id",
		"teaching_plans p LEFT JOIN training_programs tp ON tp.id = p.program_id LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN majors m ON m.id = p.major_id LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN affairs_batches ab ON ab.id = p.batch_id",
		"banner_configs",
		"terms",
		"workflows",
		"position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		"ability_points",
		"ability_domains",
		"random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		"student_ability_portraits",
		"scene_evaluation_results",
		"appeal_records",
		"evaluation_methods",
		"hybrid_node_modules",
		"resource_codes",
	}
	for _, table := range criticalTables {
		t.Run("table_"+table, func(t *testing.T) {
			if _, err := SanitizeIdentifier(table, allowedListQueryTables); err != nil {
				t.Fatalf("表串未入白名单: %v", err)
			}
		})
	}

	// 关键 OrderBy 串
	criticalOrderBys := []string{
		"created_at DESC",
		"updated_at DESC",
		"c.created_at DESC",
		"e.created_at DESC",
		"se.day_of_week ASC, se.start_week ASC",
		"er.score DESC, er.submit_time ASC",
		"qb.is_draft_pool DESC, qb.created_at DESC",
		"tp.entry_year DESC, tp.created_at DESC",
		"pr.sort_order ASC, pr.created_at DESC",
		"start_date DESC",
		"p.generated_at DESC",
	}
	for _, ob := range criticalOrderBys {
		t.Run("orderby_"+ob, func(t *testing.T) {
			if _, err := SanitizeIdentifier(ob, allowedListQueryOrderBy); err != nil {
				t.Fatalf("OrderBy 未入白名单: %v", err)
			}
		})
	}

	// 关键 SearchColumn
	criticalSearch := []string{
		"name", "code", "content", "title", "username", "email",
		"c.name", "c.code", "cp.name", "qb.name", "qb.description",
		"s.name", "s.code", "m.name", "e.name", "e.description",
		"tp.name", "tp.code", "rdq.name", "rdq.description",
	}
	for _, col := range criticalSearch {
		t.Run("search_"+col, func(t *testing.T) {
			if _, err := SanitizeIdentifier(col, allowedListQuerySearchColumns); err != nil {
				t.Fatalf("SearchColumn 未入白名单: %v", err)
			}
		})
	}

	// 关键 TenantColumn
	criticalTenants := []string{
		"", "tenant_id", "id",
		"c.tenant_id", "e.tenant_id", "er.tenant_id", "qb.tenant_id",
		"pr.tenant_id", "se.tenant_id", "tp.tenant_id", "p.tenant_id",
	}
	for _, col := range criticalTenants {
		t.Run("tenant_"+col, func(t *testing.T) {
			if _, err := SanitizeIdentifier(col, allowedListQueryTenantColumns); err != nil {
				t.Fatalf("TenantColumn 未入白名单: %v", err)
			}
		})
	}
}

// TestSelectColumnsWhitelistNotEmpty SelectColumns 白名单非空且含关键实体。
func TestSelectColumnsWhitelistNotEmpty(t *testing.T) {
	if len(allowedListQuerySelectColumns) < 10 {
		t.Fatal("SelectColumns 白名单过小，疑似缺项")
	}
	hasUsers := false
	for _, col := range allowedListQuerySelectColumns {
		if strings.HasPrefix(col, "id, tenant_id, institution_id") {
			hasUsers = true
		}
	}
	if !hasUsers {
		t.Fatal("SelectColumns 白名单缺少 users 查询串")
	}
}
