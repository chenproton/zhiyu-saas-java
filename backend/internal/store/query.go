package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ErrMissingTenant is returned by ExecuteListQuery when a tenant-scoped query
// is executed without a tenant. Handlers should check for this error with
// errors.Is and respond 403.
var ErrMissingTenant = errors.New("missing tenant")

// SanitizeIdentifier validates that identifier is one of the allowed values.
// It returns the identifier unchanged if valid, otherwise an error.
func SanitizeIdentifier(identifier string, allowed []string) (string, error) {
	for _, a := range allowed {
		if identifier == a {
			return identifier, nil
		}
	}
	return "", fmt.Errorf("invalid identifier: %s", identifier)
}

// ListParams carries explicit, handler-extracted list query parameters.
// The store layer never reads HTTP request state; handlers extract query
// parameters into Values before calling ExecuteListQuery.
type ListParams struct {
	Search   string            // search keyword for SearchColumns
	TenantID string            // explicit tenant filter for tenant-scoped queries
	Limit    int               // 0 = use config DefaultLimit
	Offset   int               // default 0
	Values   map[string]string // additional filter values, consumed by ExtraFilter
}

// NewListQueryBuilder returns an empty list query builder.
func NewListQueryBuilder() *ListQueryBuilder {
	return &ListQueryBuilder{idx: 1}
}

// ListQueryBuilder accumulates WHERE conditions and positional arguments for
// the generic list query helper. Use NextArg to reserve the next placeholder(s)
// and AddCondition to append a condition using those placeholders.
type ListQueryBuilder struct {
	where []string
	args  []any
	idx   int
}

// Args returns the accumulated positional arguments.
func (qb *ListQueryBuilder) Args() []any {
	return qb.args
}

func (qb *ListQueryBuilder) NextArg(args ...any) string {
	out := make([]string, len(args))
	for i, a := range args {
		out[i] = "$" + Itoa(qb.idx)
		qb.args = append(qb.args, a)
		qb.idx++
	}
	if len(out) == 1 {
		return out[0]
	}
	return strings.Join(out, ", ")
}

func (qb *ListQueryBuilder) AddCondition(cond string) {
	qb.where = append(qb.where, cond)
}

func (qb *ListQueryBuilder) WhereClause() string {
	if len(qb.where) == 0 {
		return "1=1"
	}
	return strings.Join(qb.where, " AND ")
}

// ListQueryFilter adds extra WHERE conditions to a list query. Callers should
// use qb.NextArg to obtain the correct placeholder and AddCondition to append.
type ListQueryFilter func(p ListParams, qb *ListQueryBuilder)

// ListQueryConfig configures ExecuteListQuery for a specific entity type.
type ListQueryConfig[T any] struct {
	Table         string
	CountTable    string // 轻量 COUNT 用 FROM（无 LATERAL/JOIN 聚合），空则用 Table
	SelectColumns string
	TenantScoped  bool
	TenantColumn  string
	SearchColumns []string
	SearchParam   string // query parameter name for search; defaults to "search"
	OrderBy       string
	NoPagination  bool // when true, no LIMIT/OFFSET is appended (full list)
	DefaultLimit  int  // fallback page size when limit param is missing; defaults to 50
	ExtraFilter   ListQueryFilter
	ScanRows      func(pgx.Rows) ([]T, error)
}

type ListQueryDB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// Allowed identifiers for ExecuteListQuery configuration. These are hardcoded by
// callers; the whitelist prevents accidental SQL identifier injection if any
// value becomes dynamic in the future.
var (
	allowedListQueryTables = []string{
		"ability_domains",
		"ability_points",
		"affairs_batches ab LEFT JOIN majors m ON m.id = ab.major_id",
		"alliance_achievements",
		"alliance_agreements",
		"alliance_brands",
		"alliance_experts",
		"alliance_permissions",
		"alliance_projects",
		"appeal_records",
		"approval_records",
		"banner_configs",
		"batches",
		"batches b LEFT JOIN majors m ON m.id = b.major_id",
		"career_positions cp",
		"career_positions cp LEFT JOIN LATERAL (SELECT COALESCE(array_agg(cpm.major_id), '{}') AS major_ids, COALESCE(array_agg(m.name), '{}') AS major_names FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id) maj ON true LEFT JOIN users cr_u ON cr_u.id = cp.created_by LEFT JOIN view_counters vc ON vc.target_type = 'career_position' AND vc.target_id = cp.id LEFT JOIN favorite_counters fc ON fc.target_type = 'career_position' AND fc.target_id = cp.id",
		"certificate_library",
		"certification_rules",
		"courses c LEFT JOIN majors m ON m.id = c.major_id LEFT JOIN industries i ON i.id = c.industry_id LEFT JOIN lesson_batches lb ON lb.id = c.batch_id LEFT JOIN view_counters vc ON vc.target_type = 'course' AND vc.target_id = c.id LEFT JOIN users cr_u ON cr_u.id = c.creator_id",
		"evaluation_batches",
		"evaluation_batches eb LEFT JOIN majors m ON m.id = eb.major_id",
		"exam_results er LEFT JOIN majors m ON m.id = er.major_id",
		"exam_usages",
		"exams e",
		"hybrid_node_modules",
		"industries",
		"knowledge_points",
		"learn_roads",
		"lesson_batches",
		"lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id",
		"login_logs",
		"majors",
		"node_evaluation_results",
		"node_quizzes",
		"on_site_question_library",
		"org_types",
		"organizations",
		"operation_logs",
		"period_slots",
		"position_ability_bindings",
		"position_ability_bindings b LEFT JOIN ability_points ap ON ap.id = b.ability_point_id",
		"position_favorites pf JOIN career_positions cp ON cp.id = pf.career_position_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(cpm.major_id), '{}') AS major_ids, COALESCE(array_agg(m.name), '{}') AS major_names FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id) maj ON true LEFT JOIN users cr_u ON cr_u.id = cp.created_by LEFT JOIN view_counters vc ON vc.target_type = 'career_position' AND vc.target_id = cp.id LEFT JOIN favorite_counters fc ON fc.target_type = 'career_position' AND fc.target_id = cp.id",
		"position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		"question_banks qb",
		"question_banks qb LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM questions q WHERE q.bank_id = qb.id) qcnt ON true LEFT JOIN users cr_u ON cr_u.id = qb.creator_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') AS ids FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) kparr ON true",
		"position_responsibilities",
		"questions",
		"random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		"resource_codes",
		"roles",
		"rubric_templates",
		"scenario_grade_mappings",
		"scenario_tasks",
		"scenario_weight_configs",
		"schedule_entries se LEFT JOIN organizations o ON o.id = se.class_node_id LEFT JOIN users u ON u.id = se.teacher_id LEFT JOIN venues v ON v.id = se.venue_id LEFT JOIN scenarios sc ON sc.id = se.scenario_id",
		"scene_batches",
		"scene_batches sb LEFT JOIN majors m ON m.id = sb.major_id",
		"scenarios s",
		"scenarios s LEFT JOIN LATERAL (SELECT COALESCE(array_agg(i.name), '{}') AS names FROM industries i WHERE i.id::text = ANY(s.industry_ids)) ind ON true LEFT JOIN LATERAL (SELECT COALESCE(array_agg(m2.name), '{}') AS names FROM majors m2 WHERE m2.id = ANY(s.profession_ids)) prof ON true LEFT JOIN view_counters vc ON vc.target_type = 'scenario' AND vc.target_id = s.id LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM scenario_tasks t WHERE t.scenario_id = s.id) tcnt ON true LEFT JOIN users cr_u ON cr_u.id = s.creator_id",
		"scene_evaluation_results",
		"staff_titles",
		"student_ability_archives",
		"student_ability_portraits",
		"system_course_nodes n",
		"teaching_plans p LEFT JOIN training_programs tp ON tp.id = p.program_id LEFT JOIN terms t ON t.id = p.term_id LEFT JOIN majors m ON m.id = p.major_id LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN affairs_batches ab ON ab.id = p.batch_id",
		"tenants",
		"terms",
		"training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id",
		"users",
		"venues",
		"workflows",
	}

	allowedListQuerySelectColumns = []string{
		"id, tenant_id, title, type, description, achievement_date, cover_image, attachments, citation_reason, images, owner_persons, co_builders, enterprise_ids, project_ids, related_positions, related_scenes, related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at",
		"id, tenant_id, name, type, content, start_date, end_date, status, enterprise_ids, project_ids, attachments, is_public, created_by, created_at, updated_at",
		"qb.id, qb.code, qb.name, qb.description, qb.cover_image, qb.status, COALESCE(qcnt.cnt, 0) AS question_count, qb.creator_id, COALESCE(cr_u.name, qb.creator_id::text, '') AS creator_name, qb.collaborator_ids, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool, COALESCE(kparr.ids, '{}') AS knowledge_point_ids, qb.created_at, qb.updated_at",
		"id, tenant_id, brand_type, name, status, is_public, is_featured, cover_image, cover_video, description, data, student_id, enterprise_id, position_id, major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at",
		"id, tenant_id, name, gender, age, title, position, expert_type, industry, professional_fields, specialties, experience_years, education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, user_id, created_by, created_at, updated_at",
		"id, tenant_id, account_name, account_type, enterprise_id, expert_id, is_enabled, resource_permissions, platform_permissions, created_at, updated_at",
		"id, tenant_id, name, type, description, phase, publish_status, start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at",
		"id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by, version",
		"b.id, b.name, b.code, b.org_node_id, b.major_id, COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count, b.published_count, b.pending_count, b.created_at, b.updated_at", "eb.id, eb.name, eb.code, eb.org_node_id, eb.major_id, COALESCE(m.name, '') AS major_name, eb.workflow_id, eb.status, eb.created_at, eb.updated_at",
		"er.id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id, COALESCE(m.name, '') AS major_name, er.score, er.total_score, er.is_pass, er.answers, er.grading_status, er.grading_scores, er.grading_comment, er.grader_id, er.graded_at, er.submit_time, er.created_at, er.version",
		"id, tenant_id, career_position_id, name, description, binding_ids, sort_order",
		"id, career_position_id, name, description, sort_order",
		"id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight",
		"b.id, b.career_position_id, b.responsibility_id, b.ability_point_id, ap.name AS ability_name, b.source, b.domain, b.required_level, b.rubric_description, b.attributes, b.weight",
		"id, career_position_id, status, rule_source, level_mapping, created_at, updated_at",
		"id, category_id, name, enabled, sub_category_name, description, doc_link",
		"id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at",
		"id, tenant_id, name, career_position_id, college, source, status, capacity, applied_count, advisor_id, enterprise_mentor_id, start_date, end_date, description, created_at",
		"id, name, code, description, attributes, is_public, creator_id, created_at",
		"id, name, code, description, linked, granular_lesson_ids::text[] AS granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at",
		"id, name, code, type, logo_url, domain, enterprise_code, contact, phone, address, description, short_name, school_type, province, city, website, contact_phone, scale_data, secondary_colleges, education_level, education_nature, valid_from::text, valid_until::text, admin_ids, status, created_at, updated_at",
		"id, name, description, position_ids, steps, created_at, updated_at",
		"id, tenant_id, code, name, description, user_count, status, created_at",
		"id, node_id, module_key, mode, data",
		"id, node_id, title, requirement, need_attachment, deadline",
		"id, node_id, title, type, time_limit",
		"id, platform, url, enabled",
		"id, scenario_id, task_id, level, min_score, max_score, description, color",
		"id, scenario_id, task_id, weight",
		"id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by, version",
		"id, template_id, user_id, cert_number, issue_date, expire_date, status, revoked_at, revoke_reason",
		"id, tenant_id, code, name, alias, enabled, created_at, updated_at",
		"id, tenant_id, code, name, description, permissions, user_count, status, created_at",
		"id, tenant_id, code, name, description, type, created_at",
		"id, tenant_id, code, name, description, user_count, status, created_at",
		"id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at",
		"id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, activation_mode, exam_version, creator_id, created_at, updated_at",
		"id, tenant_id, name, category, description, is_default, created_at",
		"id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at",
		"id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at",
		"id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at",
		"id, tenant_id, name, url, description, image_url, creator_id, created_at",
		"id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id, created_at, updated_at",
		"id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id, history, created_at, updated_at",
		"id, tenant_id, user_id, user_name, ip, location, device, status, created_at",
		"id, tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status, created_at",
		"id, topic_id, user_id, phase, doc_status, doc_count, last_updated, has_rectification",
		"id, topic_id, user_id, advisor_score, enterprise_score, defense_score, comprehensive_grade, is_excellent, status, evaluated_at",
		"id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at",
		"id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at",
		"id, user_id, type, reason, status, created_at",
		"id, user_id, career_position_id, overall_grade, domain_scores, class_rank, class_total, major_rank, major_total, recommend_positions, updated_at, completed_courses, completed_scenes, total_credits, archive_count, course_records, graduation_qualified, attendance_rate, diploma_badge, dual_badge",
		"id, user_id, material_type, material_name, issuing_org, obtain_date, level, audit_status, audit_remark, converted_credit, direction, is_enabled, created_at",
		"id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name, username, name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at",
		"lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name, lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at",
		"n.id, n.course_id, n.parent_id, n.name, n.code, n.sort_order, n.ref_type, n.source_id, n.source_name, n.teaching_goals, n.detailed_description, n.description_pdf, n.background, n.estimated_hours, n.duration, n.difficulty, n.knowledge_point_ids::text[], n.resource_ids::text[], n.eval_data, n.status",
		"pr.id, pr.major_id, COALESCE(m.name, '') AS major_name, pr.career_position_id, pr.position_type, pr.reason, pr.sort_order, pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at",
		"rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at",
		"ab.id, ab.name, ab.code, ab.org_node_id, ab.major_id, COALESCE(m.name, '') AS major_name, ab.workflow_id, ab.status, ab.program_count, ab.published_count, ab.pending_count, ab.created_at, ab.updated_at",
		"sb.id, sb.name, sb.code, sb.org_node_id, sb.major_id, COALESCE(m.name, '') AS major_name, sb.workflow_id, sb.status, sb.scenario_count, sb.created_at, sb.updated_at",
		"c.id, c.code, c.name, c.type, c.category, c.major_id, m.name AS major_name, c.teacher_id, c.industry_id, i.name AS industry_name, c.version, c.online_hours, c.offline_hours, c.online_weight, c.offline_weight, c.semester, c.class_name, c.status, c.cover_color, c.cover_image, c.course_tag, c.difficulty, c.description, c.knowledge_point_ids::text[] AS knowledge_point_ids, c.ability_point_ids::text[] AS ability_point_ids, c.resource_ids::text[] AS resource_ids, c.eval_data, COALESCE(c.creator_id::text, '') AS creator_id, COALESCE(cr_u.name, c.creator_id::text, '') AS creator_name, c.co_creator_ids, c.batch_id, lb.name AS batch_name, COALESCE((SELECT COUNT(*) FROM system_course_nodes scn WHERE scn.course_id = c.id), 0) AS node_count, COALESCE(array_length(c.resource_ids, 1), 0) AS resource_count, COALESCE(vc.cnt, 0) AS view_count, c.study_count, c.created_at, c.updated_at",
		"cp.id, cp.batch_id, cp.code, cp.name, cp.short_name, cp.industry_id, COALESCE(maj.major_ids, '{}') AS major_ids, COALESCE(maj.major_names, '{}') AS major_names, cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description, cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by, COALESCE(cr_u.name, cp.created_by::text) AS created_by_name, cp.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(cp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, COALESCE(fc.cnt, 0) AS favorite_count, COALESCE(vc.cnt, 0) AS view_count, (SELECT COUNT(*) FROM position_ability_bindings pab WHERE pab.career_position_id = cp.id) AS ability_count, cp.created_at, cp.updated_at, cp.tenant_id, cp.source_type, cp.source_enterprise_id, cp.source_resource_id",
		"s.id, s.name, s.code, s.cover_image, s.career_position_id, s.industry_ids, COALESCE(ind.names, '{}') AS industry_names, s.profession_ids, COALESCE(prof.names, '{}') AS profession_names, s.batch_id, s.difficulty, s.version, s.status, s.background, s.delivery_goal, COALESCE(s.creator_id::text, '') AS creator_id, COALESCE(cr_u.name, s.creator_id::text, '') AS creator_name, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time, COALESCE(vc.cnt, 0) AS view_count, COALESCE(tcnt.cnt, 0) AS task_count, s.source_type, s.source_enterprise_id, s.source_resource_id",
		"e.id, e.code, e.name, e.description, e.status, e.total_score, e.duration, e.cover_image, e.is_temp, e.collaborator_ids, COALESCE((SELECT u.name FROM users u WHERE u.id = e.creator_id), e.creator_id::text, '') AS creator_name, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(e.collaborator_ids) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, e.collaborator_dept_ids, e.batch_id, COALESCE(e.version, 'V1.0') AS version, e.owner_type, e.creator_id, e.created_at, e.updated_at, (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count",
		`id, scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`,
		"id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, weeks_count, is_current, created_at",
		"id, name, type, capacity, created_at",
		"id, name, slot_type, sort_order, start_time, end_time",
		"tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, '') AS major_name, tp.entry_year, tp.level, tp.duration, tp.total_credits, tp.status, tp.description, (SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id) AS course_count, tp.created_by, COALESCE(cu.name, '') AS created_by_name, tp.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, tp.batch_id, COALESCE(lb.name, '') AS batch_name, tp.created_at, tp.updated_at",
		"p.id, p.program_id, COALESCE(tp.name, '') AS program_name, p.term_id, COALESCE(t.name, '') AS term_name, p.major_id, COALESCE(m.name, '') AS major_name, p.entry_year, p.status, (SELECT COUNT(*) FROM teaching_plan_entries e WHERE e.plan_id = p.id) AS entry_count, p.generated_at, p.confirmed_at, p.created_by, COALESCE(cu.name, '') AS created_by_name, p.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(p.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, p.batch_id, COALESCE(ab.name, '') AS batch_name, p.updated_at",
		"se.id, se.term_id, se.plan_entry_id, se.course_name, se.course_code, se.course_id, se.type, se.class_node_id, COALESCE(o.name, '') AS class_name, se.teacher_id, COALESCE(u.name, '') AS teacher_name, se.day_of_week, se.periods, se.start_week, se.end_week, se.week_pattern, se.venue_id, COALESCE(v.name, '') AS venue_name, se.scenario_id, COALESCE(sc.name, '') AS scenario_name, se.source, se.status, se.version, se.resource_version, se.created_at, se.updated_at, COALESCE(se.class_node_ids, '{}') AS class_node_ids, COALESCE((SELECT array_agg(o2.name ORDER BY cid) FROM unnest(se.class_node_ids) WITH ORDINALITY AS c(cid, ord) JOIN organizations o2 ON o2.id = c.cid), '{}') AS class_names",
	}

	allowedListQueryOrderBy = []string{
		"b.id DESC",
		"c.created_at DESC",
		"cp.created_at DESC",
		"e.created_at DESC",
		"er.score DESC, er.submit_time ASC",
		"evaluated_at DESC",
		"id DESC",
		"issue_date DESC",
		"last_updated DESC",
		"qb.is_draft_pool DESC, qb.created_at DESC",
		"tp.entry_year DESC, tp.created_at DESC",
		"min_score ASC",
		"module_key ASC",
		"n.sort_order ASC, n.id ASC",
		"name",
		"p.generated_at DESC",
		"pf.created_at DESC",
		"platform ASC",
		"pr.sort_order ASC, pr.created_at DESC",
		"s.created_at DESC",
		"se.day_of_week ASC, se.start_week ASC",
		"sort_order",
		"sort_order ASC",
		"sort_order ASC, created_at ASC",
		"sort_order ASC, created_at DESC",
		"created_at DESC",
		"sort_order ASC, id ASC",
		"start_date DESC",
		"tp.created_at DESC",
		"updated_at DESC",
	}

	allowedListQueryTenantColumns = []string{
		"",
		"tenant_id",
		"ab.tenant_id",
		"b.tenant_id",
		"c.tenant_id",
		"cp.tenant_id",
		"e.tenant_id",
		"qb.tenant_id",
		"eb.tenant_id",
		"er.tenant_id",
		"id",
		"lb.tenant_id",
		"p.tenant_id",
		"pr.tenant_id",
		"rdq.tenant_id",
		"s.tenant_id",
		"sb.tenant_id",
		"se.tenant_id",
		"tp.tenant_id",
	}

	allowedListQuerySearchColumns = []string{
		"ab.name",
		"account_name",
		"b.name",
		"eb.name",
		"c.code",
		"c.name",
		"code",
		"content",
		"cp.name",
		"qb.name",
		"qb.description",
		"description",
		"e.description",
		"e.name",
		"eb.code",
		"email",
		"answer",
		"industry",
		"lb.code",
		"lb.name",
		"m.name",
		"name",
		"question_text",
		"rdq.description",
		"rdq.name",
		"s.code",
		"s.name",
		"sb.name",
		"theme",
		"title",
		"tp.name",
		"tp.code",
		"username",
	}
)

// ValidateIdentifiers 校验配置中的表/列/排序字段均在白名单内（防 SQL 注入）。
// ExecuteListQuery 与单元测试共用，保证 store 新增/修改查询时白名单同步。
func (cfg ListQueryConfig[T]) ValidateIdentifiers() error {
	if _, err := SanitizeIdentifier(cfg.Table, allowedListQueryTables); err != nil {
		return err
	}
	if _, err := SanitizeIdentifier(cfg.SelectColumns, allowedListQuerySelectColumns); err != nil {
		return err
	}
	if cfg.OrderBy != "" {
		if _, err := SanitizeIdentifier(cfg.OrderBy, allowedListQueryOrderBy); err != nil {
			return err
		}
	}
	if _, err := SanitizeIdentifier(cfg.TenantColumn, allowedListQueryTenantColumns); err != nil {
		return err
	}
	for _, col := range cfg.SearchColumns {
		if _, err := SanitizeIdentifier(col, allowedListQuerySearchColumns); err != nil {
			return err
		}
	}
	return nil
}

func ExecuteListQuery[T any](ctx context.Context, db ListQueryDB, p ListParams, cfg ListQueryConfig[T], scanRows ...func(pgx.Rows) ([]T, error)) ([]T, int, error) {
	scanner := cfg.ScanRows
	if len(scanRows) > 0 {
		scanner = scanRows[0]
	}
	if scanner == nil {
		return nil, 0, errors.New("scanRows not configured")
	}

	if err := cfg.ValidateIdentifiers(); err != nil {
		return nil, 0, err
	}

	qb := &ListQueryBuilder{idx: 1}

	if cfg.TenantScoped {
		if p.TenantID == "" {
			return nil, 0, ErrMissingTenant
		}
		col := cfg.TenantColumn
		if col == "" {
			col = "tenant_id"
		}
		qb.AddCondition(col + " = " + qb.NextArg(p.TenantID))
	}

	search := p.Search
	if search != "" && len(cfg.SearchColumns) > 0 {
		ph := qb.NextArg("%" + search + "%")
		conds := make([]string, len(cfg.SearchColumns))
		for i, col := range cfg.SearchColumns {
			conds[i] = col + " ILIKE " + ph
		}
		qb.AddCondition("(" + strings.Join(conds, " OR ") + ")")
	}

	if cfg.ExtraFilter != nil {
		cfg.ExtraFilter(p, qb)
	}

	where := qb.WhereClause()
	countFrom := cfg.CountTable
	if countFrom == "" {
		countFrom = cfg.Table
	} else if _, err := SanitizeIdentifier(countFrom, allowedListQueryTables); err != nil {
		return nil, 0, err
	}
	countQuery := "SELECT COUNT(*) FROM " + countFrom + " WHERE " + where
	var total int
	if err := db.QueryRow(ctx, countQuery, qb.args...).Scan(&total); err != nil {
		slog.Error("count query failed", "query", countQuery, "error", err)
		return nil, 0, fmt.Errorf("count query failed: %w", err)
	}

	defaultLimit := cfg.DefaultLimit
	if defaultLimit <= 0 {
		defaultLimit = 50
	}
	limit := defaultLimit
	if p.Limit > 0 {
		limit = p.Limit
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	offset := p.Offset
	if offset < 0 {
		offset = 0
	}

	orderBy := cfg.OrderBy
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	query := "SELECT " + cfg.SelectColumns + " FROM " + cfg.Table + " WHERE " + where + " ORDER BY " + orderBy
	if !cfg.NoPagination {
		limPh := qb.NextArg(limit)
		offPh := qb.NextArg(offset)
		query += " LIMIT " + limPh + " OFFSET " + offPh
	}

	rows, err := db.Query(ctx, query, qb.args...)
	if err != nil {
		slog.Error("list query failed", "query", query, "error", err)
		return nil, total, err
	}
	defer rows.Close()

	items, err := scanner(rows)
	if err != nil {
		slog.Error("scan rows failed", "query", query, "error", err)
		return nil, total, err
	}
	if err := rows.Err(); err != nil {
		slog.Error("list query rows iteration failed", "query", query, "error", err)
		return nil, total, err
	}
	return items, total, nil
}

const maxPageSize = 200

// ClampLimitOffset 将 limit/offset 钳制到合法范围（limit<=0 用 defaultLimit，上限 maxPageSize，offset<0 归零）。
func ClampLimitOffset(limit, offset, defaultLimit int) (int, int) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// ParseInt 解析整数，空串返回默认值。
func ParseInt(s string, defaultVal int) (int, error) {
	if s == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal, err
	}
	return v, nil
}

// ParsePageLimit 解析分页大小并钳制到 [1, maxPageSize]。
func ParsePageLimit(s string, defaultVal int) (int, error) {
	v, err := ParseInt(s, defaultVal)
	if err != nil {
		return defaultVal, err
	}
	if v > maxPageSize {
		v = maxPageSize
	}
	if v < 1 {
		v = defaultVal
	}
	return v, nil
}

// Itoa 整数转字符串。
func Itoa(i int) string {
	return strconv.Itoa(i)
}

// StrPtrIfNonEmpty 空串转 nil，避免将空字符串写入 UUID 等列导致数据库错误。
func StrPtrIfNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// JSONSliceToStrings 将 JSONSlice 转为字符串数组（过滤空串）。
func JSONSliceToStrings(s domain.JSONSlice) []string {
	out := make([]string, 0, len(s))
	for _, v := range s {
		if str, ok := v.(string); ok && str != "" {
			out = append(out, str)
		}
	}
	return out
}

// FormatDateTime 统一的"2006-01-02 15:04"时间格式化出口。
func FormatDateTime(t time.Time) string {
	return t.Format("2006-01-02 15:04")
}

// lookupByNameTables 通用名称查重白名单（import 类功能使用）。
var lookupByNameTables = []string{
	"ability_points", "ability_domains", "alliance_agreements",
	"alliance_experts", "alliance_projects", "batches", "career_positions", "certificate_library",
	"courses", "evaluation_batches", "exams", "industries", "institutions",
	"knowledge_points", "lesson_batches", "majors", "organizations", "partner_enterprises", "question_banks", "questions",
	"resource_library", "roles", "scene_batches", "scenarios", "staff_titles", "subscription_packages", "terms", "users",
}

// LookupByTableAndName 按表名+租户+名称查询记录 ID，不存在时返回空字符串。
// partner_enterprises 为全局企业主体表（名称全局唯一，tenant_id 归属企业自身租户），
// 学校侧仅经 alliance_enterprise_links 关联，按全局名称匹配、不按学校租户过滤。
// 表名经白名单校验（与 SanitizeIdentifier 一致），仅限白名单内的字典/实体表。
func LookupByTableAndName(ctx context.Context, q Queryer, tableName, tenantID, name string) (string, error) {
	table, err := SanitizeIdentifier(tableName, lookupByNameTables)
	if err != nil {
		return "", fmt.Errorf("不支持的表名: %s", tableName)
	}
	var id string
	if table == "partner_enterprises" {
		err = q.QueryRow(ctx,
			fmt.Sprintf("SELECT id FROM %s WHERE name=$1 LIMIT 1", table),
			name,
		).Scan(&id)
	} else {
		err = q.QueryRow(ctx,
			fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND name=$2 LIMIT 1", table),
			tenantID, name,
		).Scan(&id)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return id, nil
}

// LookupIDsByNames 批量按名称查 ID，未命中的返回空字符串。
func LookupIDsByNames(ctx context.Context, q Queryer, table, tenantID, names string) []string {
	var ids []string
	for _, n := range splitCommaNames(names) {
		id, err := LookupByTableAndName(ctx, q, table, tenantID, n)
		if err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// LookupSingleIDByName 取第一个名称的 ID；不存在返回 nil。
func LookupSingleIDByName(ctx context.Context, q Queryer, table, tenantID, names string) *string {
	for _, n := range splitCommaNames(names) {
		id, err := LookupByTableAndName(ctx, q, table, tenantID, n)
		if err == nil && id != "" {
			return &id
		}
	}
	return nil
}

// LockByKey 以拼接键粒度的 advisory 事务锁串行化互斥操作，锁随事务提交/回滚自动释放。
// keyParts 按 "|" 拼接（如租户+资源粒度）。须在事务内调用。
func LockByKey(ctx context.Context, q Queryer, keyParts ...string) error {
	_, err := q.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, strings.Join(keyParts, "|"))
	return err
}

// splitCommaNames 按中文/英文分号拆分为列表，空项忽略。
func splitCommaNames(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == ';' || r == '；' || r == ',' || r == '，' })
	var out []string
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// MarshalJSONBytes 将任意值序列化为 JSON 字节，序列化失败返回 fallback。
func MarshalJSONBytes(v any, fallback string) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte(fallback)
	}
	return b
}

// IsUniqueViolation 判断是否为唯一键冲突（pg error code 23505）。
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
