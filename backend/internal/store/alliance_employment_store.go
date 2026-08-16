package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 就业服务管理（人才与岗位供需服务大厅） =====
// 表链：alliance_employment_projects ← alliance_employment_jobs.project_id
//       alliance_employment_applications.job_id → alliance_employment_jobs
// 见 docs/spec/04-database-schema.md §2。

// ---------- 扫描器 ----------

// employmentProjectColumns 就业项目基础列（ScanEmploymentProjectRows 顺序一致；
// 单行字面量与 query.go allowedListQuerySelectColumns 白名单完全一致）。
const employmentProjectColumns = "id, tenant_id, name, type, organizer, description, cover_image, start_date, end_date, publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at"

func scanEmploymentProject(row interface{ Scan(...any) error }, p *domain.EmploymentProject) error {
	var organizer, description, coverImage, createdBy *string
	var startDate, endDate *time.Time
	var enterpriseIDs, targetGroups json.RawMessage
	if err := row.Scan(&p.ID, &p.TenantID, &p.Name, &p.Type, &organizer, &description, &coverImage,
		&startDate, &endDate, &p.PublishStatus, &enterpriseIDs, &targetGroups, &createdBy,
		&p.CreatedAt, &p.UpdatedAt); err != nil {
		return err
	}
	p.Organizer = organizer
	p.Description = description
	p.CoverImage = coverImage
	p.StartDate = formatDate(startDate)
	p.EndDate = formatDate(endDate)
	p.EnterpriseIDs = enterpriseIDs
	p.TargetGroups = targetGroups
	p.CreatedBy = createdBy
	return nil
}

func (s *AllianceStore) ScanEmploymentProjectRows(rows pgx.Rows) ([]domain.EmploymentProject, error) {
	items := make([]domain.EmploymentProject, 0)
	for rows.Next() {
		var p domain.EmploymentProject
		if err := scanEmploymentProject(rows, &p); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// employmentJobFrom 岗位查询统一 FROM：企业名/项目名/投递数关联
// （单行字面量与 query.go allowedListQueryTables 白名单完全一致）。
const employmentJobFrom = "alliance_employment_jobs j LEFT JOIN partner_enterprises pe ON pe.id = j.enterprise_id LEFT JOIN alliance_employment_projects p ON p.id = j.project_id LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM alliance_employment_applications a WHERE a.job_id = j.id) ac ON true"

// employmentJobColumns 与 ScanEmploymentJobRows 顺序一致（同白名单）。
const employmentJobColumns = "j.id, j.tenant_id, j.enterprise_id, j.project_id, j.title, j.job_type, j.location, j.salary_min, j.salary_max, j.headcount, j.education, j.suitable_majors, j.description, j.responsibilities, j.requirements, j.contact_person, j.contact_phone, j.deadline, j.status, j.created_by, j.created_at, j.updated_at, COALESCE(pe.name, '') AS enterprise_name, COALESCE(p.name, '') AS project_name, COALESCE(ac.cnt, 0) AS application_count"

func (s *AllianceStore) ScanEmploymentJobRows(rows pgx.Rows) ([]domain.EmploymentJob, error) {
	items := make([]domain.EmploymentJob, 0)
	for rows.Next() {
		var j domain.EmploymentJob
		var location, education, description, responsibilities, requirements *string
		var contactPerson, contactPhone, createdBy *string
		var salaryMin, salaryMax *float64
		var headcount *int
		var deadline *time.Time
		var suitableMajors json.RawMessage
		if err := rows.Scan(&j.ID, &j.TenantID, &j.EnterpriseID, &j.ProjectID, &j.Title, &j.JobType,
			&location, &salaryMin, &salaryMax, &headcount, &education, &suitableMajors,
			&description, &responsibilities, &requirements, &contactPerson, &contactPhone,
			&deadline, &j.Status, &createdBy, &j.CreatedAt, &j.UpdatedAt,
			&j.EnterpriseName, &j.ProjectName, &j.ApplicationCount); err != nil {
			return nil, err
		}
		j.Location = location
		j.SalaryMin = salaryMin
		j.SalaryMax = salaryMax
		j.Headcount = headcount
		j.Education = education
		j.SuitableMajors = suitableMajors
		j.Description = description
		j.Responsibilities = responsibilities
		j.Requirements = requirements
		j.ContactPerson = contactPerson
		j.ContactPhone = contactPhone
		j.Deadline = formatDate(deadline)
		j.CreatedBy = createdBy
		items = append(items, j)
	}
	return items, rows.Err()
}

// employmentApplicationFrom 投递查询统一 FROM：岗位标题/企业名/项目名关联（同白名单）。
const employmentApplicationFrom = "alliance_employment_applications a LEFT JOIN alliance_employment_jobs j ON j.id = a.job_id LEFT JOIN partner_enterprises pe ON pe.id = a.enterprise_id LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"

// employmentApplicationColumns 与 ScanEmploymentApplicationRows 顺序一致（同白名单）。
const employmentApplicationColumns = "a.id, a.tenant_id, a.job_id, a.enterprise_id, a.student_id, a.student_name, a.student_no, a.major_name, a.class_name, a.phone, a.email, a.cover_letter, a.status, a.created_at, a.updated_at, COALESCE(j.title, '') AS job_title, COALESCE(pe.name, '') AS enterprise_name, COALESCE(p.name, '') AS project_name"

func (s *AllianceStore) ScanEmploymentApplicationRows(rows pgx.Rows) ([]domain.EmploymentApplication, error) {
	items := make([]domain.EmploymentApplication, 0)
	for rows.Next() {
		var a domain.EmploymentApplication
		if err := rows.Scan(&a.ID, &a.TenantID, &a.JobID, &a.EnterpriseID, &a.StudentID,
			&a.StudentName, &a.StudentNo, &a.MajorName, &a.ClassName, &a.Phone, &a.Email,
			&a.CoverLetter, &a.Status, &a.CreatedAt, &a.UpdatedAt,
			&a.JobTitle, &a.EnterpriseName, &a.ProjectName); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

// ---------- 学生可见性 ----------

// EmploymentStudentScope 学生画像（用于就业项目 target_groups 可见性匹配）。
type EmploymentStudentScope struct {
	// OrgPathIDs 学生班级节点及其全部祖先节点 id（organizations 树自底向上闭包），
	// 预计算后 target_groups 的 orgNodeId 条件转为数组成员判断，避免查询内递归 CTE。
	OrgPathIDs   []string
	MajorID      *string
	GraduateYear *int
}

// GetEmploymentStudentScope 读取学生的组织祖先链/专业/毕业年份画像。
func (s *AllianceStore) GetEmploymentStudentScope(ctx context.Context, userID string) (*EmploymentStudentScope, error) {
	var scope EmploymentStudentScope
	var orgNodeID *string
	err := s.q.QueryRow(ctx, `
		SELECT org_node_id, major_id, graduate_year FROM users WHERE id = $1
	`, userID).Scan(&orgNodeID, &scope.MajorID, &scope.GraduateYear)
	if err != nil {
		return nil, err
	}
	scope.OrgPathIDs = []string{}
	if orgNodeID != nil {
		if err := s.q.QueryRow(ctx, `
			WITH RECURSIVE up_tree AS (
				SELECT id, parent_id FROM organizations WHERE id = $1
				UNION ALL
				SELECT o.id, o.parent_id FROM organizations o JOIN up_tree t ON o.id = t.parent_id
			) SELECT COALESCE(array_agg(id::text), '{}') FROM up_tree
		`, *orgNodeID).Scan(&scope.OrgPathIDs); err != nil {
			return nil, err
		}
	}
	return &scope, nil
}

// employmentTargetGroupsCondition 生成 target_groups 可见性匹配 SQL 片段。
// 组内 AND（非空字段全部匹配）、组间 OR；空数组 = 面向全校（恒真）。
// orgPathArg 为学生组织祖先链 text[] 占位符，majorArg/yearArg 为专业/毕业年份占位符。
func employmentTargetGroupsCondition(alias, orgPathArg, majorArg, yearArg string) string {
	return fmt.Sprintf(`(
		%[1]s.target_groups = '[]'::jsonb
		OR EXISTS (
			SELECT 1 FROM jsonb_array_elements(%[1]s.target_groups) g
			WHERE (g->>'orgNodeId' IS NULL OR g->>'orgNodeId' = ANY(%[2]s))
			  AND (g->>'majorId' IS NULL OR %[3]s::text = g->>'majorId')
			  AND (g->>'graduateYear' IS NULL OR %[4]s = (g->>'graduateYear')::int)
		)
	)`, alias, orgPathArg, majorArg, yearArg)
}

// ---------- 管理端：就业项目 CRUD ----------

// ListEmploymentProjectsConfig 管理端就业项目列表查询配置。
func (s *AllianceStore) ListEmploymentProjectsConfig() ListQueryConfig[domain.EmploymentProject] {
	return ListQueryConfig[domain.EmploymentProject]{
		Table:         "alliance_employment_projects",
		SelectColumns: employmentProjectColumns,
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if v := p.Values["publishStatus"]; v != "" {
				qb.AddCondition("publish_status = " + qb.NextArg(v))
			}
			if v := p.Values["type"]; v != "" {
				qb.AddCondition("type = " + qb.NextArg(v))
			}
		},
		ScanRows: s.ScanEmploymentProjectRows,
	}
}

func (s *AllianceStore) GetEmploymentProjectByID(ctx context.Context, id, tenantID string) (*domain.EmploymentProject, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentProjectRows, `
		SELECT `+employmentProjectColumns+`
		FROM alliance_employment_projects WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
}

// GetEmploymentProjectCounts 项目聚合：岗位数 / 投递数（详情页展示用，现算不落计数器）。
func (s *AllianceStore) GetEmploymentProjectCounts(ctx context.Context, id, tenantID string) (jobCount, applicationCount int, err error) {
	err = s.q.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM alliance_employment_jobs j WHERE j.project_id = p.id),
			(SELECT COUNT(*) FROM alliance_employment_applications a
				JOIN alliance_employment_jobs j2 ON j2.id = a.job_id WHERE j2.project_id = p.id)
		FROM alliance_employment_projects p WHERE p.id = $1 AND p.tenant_id = $2
	`, id, tenantID).Scan(&jobCount, &applicationCount)
	return jobCount, applicationCount, err
}

func (s *AllianceStore) CreateEmploymentProject(ctx context.Context, p *domain.EmploymentProject) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_employment_projects (id, tenant_id, name, type, organizer, description, cover_image,
			start_date, end_date, publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
	`, id, p.TenantID, p.Name, p.Type, p.Organizer, p.Description, p.CoverImage,
		p.StartDate, p.EndDate, p.PublishStatus,
		emptyJSON(p.EnterpriseIDs), emptyJSON(p.TargetGroups), p.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateEmploymentProject(ctx context.Context, id, tenantID string, p *domain.EmploymentProject) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_employment_projects SET
			name = $1, type = $2, organizer = $3, description = $4, cover_image = $5,
			start_date = $6, end_date = $7, publish_status = $8,
			enterprise_ids = $9, target_groups = $10, updated_at = NOW()
		WHERE id = $11 AND tenant_id = $12
	`, p.Name, p.Type, p.Organizer, p.Description, p.CoverImage,
		p.StartDate, p.EndDate, p.PublishStatus,
		emptyJSON(p.EnterpriseIDs), emptyJSON(p.TargetGroups), id, tenantID)
	return err
}

func (s *AllianceStore) DeleteEmploymentProject(ctx context.Context, id, tenantID string) error {
	// 项目删除后其下岗位变为独立岗位（project_id SET NULL，由 FK 保证），投递随岗位保留。
	_, err := s.q.Exec(ctx, `
		DELETE FROM alliance_employment_projects WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	return err
}

// ---------- 管理端：岗位与投递总览 ----------

// ListEmploymentJobsConfig 管理端岗位总览（含企业名/项目名/投递数）。
func (s *AllianceStore) ListEmploymentJobsConfig() ListQueryConfig[domain.EmploymentJob] {
	return ListQueryConfig[domain.EmploymentJob]{
		Table:         employmentJobFrom,
		SelectColumns: employmentJobColumns,
		TenantScoped:  true,
		TenantColumn:  "j.tenant_id",
		SearchColumns: []string{"j.title"},
		OrderBy:       "j.created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if v := p.Values["projectId"]; v != "" {
				qb.AddCondition("j.project_id = " + qb.NextArg(v))
			}
			if v := p.Values["enterpriseId"]; v != "" {
				qb.AddCondition("j.enterprise_id = " + qb.NextArg(v))
			}
			if v := p.Values["status"]; v != "" {
				qb.AddCondition("j.status = " + qb.NextArg(v))
			}
		},
		ScanRows: s.ScanEmploymentJobRows,
	}
}

// AdminSetEmploymentJobStatus 学校端下架/恢复岗位（违规治理），SQL 层带租户条件。
func (s *AllianceStore) AdminSetEmploymentJobStatus(ctx context.Context, id, tenantID, status string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_employment_jobs SET status = $1, updated_at = NOW()
		WHERE id = $2 AND tenant_id = $3
	`, status, id, tenantID)
	return err
}

// ListEmploymentApplicationsConfig 管理端投递总览。
func (s *AllianceStore) ListEmploymentApplicationsConfig() ListQueryConfig[domain.EmploymentApplication] {
	return ListQueryConfig[domain.EmploymentApplication]{
		Table:         employmentApplicationFrom,
		SelectColumns: employmentApplicationColumns,
		TenantScoped:  true,
		TenantColumn:  "a.tenant_id",
		SearchColumns: []string{"a.student_name"},
		OrderBy:       "a.created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if v := p.Values["projectId"]; v != "" {
				qb.AddCondition("j.project_id = " + qb.NextArg(v))
			}
			if v := p.Values["jobId"]; v != "" {
				qb.AddCondition("a.job_id = " + qb.NextArg(v))
			}
			if v := p.Values["enterpriseId"]; v != "" {
				qb.AddCondition("a.enterprise_id = " + qb.NextArg(v))
			}
		},
		ScanRows: s.ScanEmploymentApplicationRows,
	}
}

// ---------- 前台大厅（登录公开，浏览全量可见；target_groups 仅控制投递资格） ----------

// ListPublicEmploymentProjects 大厅项目列表：仅已发布，登录用户全量可见（不分角色）。
// target_groups 语义为「投递资格」而非「可见性」，投递时在 CreateEmploymentApplication 校验。
func (s *AllianceStore) ListPublicEmploymentProjects(ctx context.Context, tenantID string, limit, offset int) ([]domain.EmploymentProject, error) {
	if limit <= 0 {
		limit = 100
	}
	args := []any{tenantID, limit, offset}
	// 附带在招岗位数（published 岗位计数，landing 卡片/统计行用）
	cols := employmentProjectColumns + ", (SELECT COUNT(*) FROM alliance_employment_jobs j WHERE j.project_id = p.id AND j.status = 'published') AS job_count"
	rows, err := s.q.Query(ctx, fmt.Sprintf(`
		SELECT %s FROM alliance_employment_projects p
		WHERE p.publish_status = 'published' AND p.tenant_id = $1
		ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d
	`, cols, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.EmploymentProject, 0)
	for rows.Next() {
		var p domain.EmploymentProject
		var jobCount int
		if err := scanEmploymentProjectWithExtra(rows, &p, &jobCount); err != nil {
			return nil, err
		}
		p.JobCount = jobCount
		items = append(items, p)
	}
	return items, rows.Err()
}

// scanEmploymentProjectWithExtra 扫描项目基础列 + 尾部一个 int 聚合列（如 job_count）。
func scanEmploymentProjectWithExtra(row interface{ Scan(...any) error }, p *domain.EmploymentProject, extra *int) error {
	var organizer, description, coverImage, createdBy *string
	var startDate, endDate *time.Time
	var enterpriseIDs, targetGroups json.RawMessage
	if err := row.Scan(&p.ID, &p.TenantID, &p.Name, &p.Type, &organizer, &description, &coverImage,
		&startDate, &endDate, &p.PublishStatus, &enterpriseIDs, &targetGroups, &createdBy,
		&p.CreatedAt, &p.UpdatedAt, extra); err != nil {
		return err
	}
	p.Organizer = organizer
	p.Description = description
	p.CoverImage = coverImage
	p.StartDate = formatDate(startDate)
	p.EndDate = formatDate(endDate)
	p.EnterpriseIDs = enterpriseIDs
	p.TargetGroups = targetGroups
	p.CreatedBy = createdBy
	return nil
}

// GetPublicEmploymentProjectByID 大厅项目详情：已发布即可读（不校验 target_groups）。
func (s *AllianceStore) GetPublicEmploymentProjectByID(ctx context.Context, id, tenantID string) (*domain.EmploymentProject, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentProjectRows, `
		SELECT `+employmentProjectColumns+` FROM alliance_employment_projects p
		WHERE p.id = $1 AND p.tenant_id = $2 AND p.publish_status = 'published'
	`, id, tenantID)
}

// ListPublicEmploymentJobsByProject 大厅项目下岗位列表：仅已发布岗位。
func (s *AllianceStore) ListPublicEmploymentJobsByProject(ctx context.Context, projectID, tenantID string) ([]domain.EmploymentJob, error) {
	return queryList(ctx, s.q, s.ScanEmploymentJobRows, `
		SELECT `+employmentJobColumns+`
		FROM `+employmentJobFrom+`
		WHERE j.project_id = $1 AND j.tenant_id = $2 AND j.status = 'published'
		ORDER BY j.created_at DESC LIMIT 200
	`, projectID, tenantID)
}

// GetPublicEmploymentJobByID 大厅岗位详情：已发布 + 所属项目已发布即可读（不校验 target_groups）。
func (s *AllianceStore) GetPublicEmploymentJobByID(ctx context.Context, id, tenantID string) (*domain.EmploymentJob, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentJobRows, `
		SELECT `+employmentJobColumns+`
		FROM `+employmentJobFrom+`
		WHERE j.id = $1 AND j.tenant_id = $2 AND j.status = 'published'
		  AND p.publish_status = 'published'
	`, id, tenantID)
}

// ErrEmploymentNotEligible 学生不在岗位面向的目标群体（target_groups）内，无投递资格。
var ErrEmploymentNotEligible = errors.New("不在岗位面向的学生群体内")

// IsEmploymentNotEligible 判定投递资格拒绝错误。
func IsEmploymentNotEligible(err error) bool { return errors.Is(err, ErrEmploymentNotEligible) }

// CreateEmploymentApplication 学生投递：档案快照随 INSERT 从 users/majors/organizations 带出；
// 仅允许投递「已发布岗位 + 所属项目已发布 + 学生具备投递资格（target_groups 匹配）」的岗位；
// 重复投递由 (job_id, student_id) 唯一约束兜底。
// 返回新投递 id；岗位不存在/未开放返回 ("", nil)；资格不符返回 ErrEmploymentNotEligible。
func (s *AllianceStore) CreateEmploymentApplication(ctx context.Context, jobID string, scope *EmploymentStudentScope, studentID, coverLetter string) (string, error) {
	id := uuid.NewString()
	args := []any{id, jobID, studentID, coverLetter}
	visibility := ""
	if scope != nil {
		args = append(args, scope.OrgPathIDs, scope.MajorID, scope.GraduateYear)
		visibility = " AND " + employmentTargetGroupsCondition("p", "$5", "$6", "$7")
	}
	var inserted string
	err := s.q.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO alliance_employment_applications (id, tenant_id, job_id, enterprise_id, student_id,
			student_name, student_no, major_name, class_name, phone, email, cover_letter, status, created_at, updated_at)
		SELECT $1, j.tenant_id, j.id, j.enterprise_id, u.id,
			u.name, u.student_no, m.name, o.name, u.phone, u.email, $4, 'pending', NOW(), NOW()
		FROM alliance_employment_jobs j
		JOIN alliance_employment_projects p ON p.id = j.project_id AND p.publish_status = 'published'
		JOIN users u ON u.id = $3 AND u.tenant_id = j.tenant_id
		LEFT JOIN majors m ON m.id = u.major_id
		LEFT JOIN organizations o ON o.id = u.org_node_id
		WHERE j.id = $2 AND j.status = 'published'%s
		RETURNING id
	`, visibility), args...).Scan(&inserted)
	if err == pgx.ErrNoRows {
		// 区分「无投递资格」与「岗位不存在/未开放」：岗位存在且已发布（项目已发布）但插入 0 行 → 资格不符
		var eligible bool
		chk := s.q.QueryRow(ctx, `
			SELECT TRUE FROM alliance_employment_jobs j
			LEFT JOIN alliance_employment_projects p ON p.id = j.project_id
			WHERE j.id = $1 AND j.status = 'published'
			  AND (j.project_id IS NULL OR p.publish_status = 'published')
		`, jobID).Scan(&eligible)
		if chk == nil {
			return "", ErrEmploymentNotEligible
		}
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return inserted, nil
}

// ListMyEmploymentApplications 学生「我的投递」列表。
func (s *AllianceStore) ListMyEmploymentApplications(ctx context.Context, tenantID, studentID string) ([]domain.EmploymentApplication, error) {
	return queryList(ctx, s.q, s.ScanEmploymentApplicationRows, `
		SELECT `+employmentApplicationColumns+`
		FROM `+employmentApplicationFrom+`
		WHERE a.tenant_id = $1 AND a.student_id = $2
		ORDER BY a.created_at DESC LIMIT 200
	`, tenantID, studentID)
}

// ---------- 企业端（partner） ----------

// ListPartnerEmploymentProjects 企业被分配的就业项目（enterprise_ids 含本企业）；schoolTenantID 非空时按学校过滤。
func (s *AllianceStore) ListPartnerEmploymentProjects(ctx context.Context, enterpriseID, schoolTenantID string) ([]domain.EmploymentProject, error) {
	args := []any{enterpriseID}
	where := "p.enterprise_ids ? $1"
	if schoolTenantID != "" {
		args = append(args, schoolTenantID)
		where += fmt.Sprintf(" AND p.tenant_id = $%d", len(args))
	}
	return queryList(ctx, s.q, s.ScanEmploymentProjectRows, fmt.Sprintf(`
		SELECT %s FROM alliance_employment_projects p
		WHERE %s
		ORDER BY p.created_at DESC LIMIT 200
	`, employmentProjectColumns, where), args...)
}

// GetPartnerEmploymentProjectByID 企业端项目详情（须被分配给企业）。
func (s *AllianceStore) GetPartnerEmploymentProjectByID(ctx context.Context, id, enterpriseID string) (*domain.EmploymentProject, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentProjectRows, `
		SELECT `+employmentProjectColumns+`
		FROM alliance_employment_projects p
		WHERE p.id = $1 AND p.enterprise_ids ? $2
	`, id, enterpriseID)
}

// ListPartnerEmploymentJobs 企业端岗位列表（本企业全部岗位，含独立岗位）。
func (s *AllianceStore) ListPartnerEmploymentJobs(ctx context.Context, enterpriseID, projectID, status string) ([]domain.EmploymentJob, error) {
	args := []any{enterpriseID}
	where := "j.enterprise_id = $1"
	if projectID != "" {
		args = append(args, projectID)
		where += fmt.Sprintf(" AND j.project_id = $%d", len(args))
	}
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(" AND j.status = $%d", len(args))
	}
	return queryList(ctx, s.q, s.ScanEmploymentJobRows, fmt.Sprintf(`
		SELECT %s FROM %s
		WHERE %s
		ORDER BY j.created_at DESC LIMIT 200
	`, employmentJobColumns, employmentJobFrom, where), args...)
}

// GetPartnerEmploymentJobByID 企业端岗位详情（限本企业）。
func (s *AllianceStore) GetPartnerEmploymentJobByID(ctx context.Context, id, enterpriseID string) (*domain.EmploymentJob, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentJobRows, `
		SELECT `+employmentJobColumns+`
		FROM `+employmentJobFrom+`
		WHERE j.id = $1 AND j.enterprise_id = $2
	`, id, enterpriseID)
}

func (s *AllianceStore) CreateEmploymentJob(ctx context.Context, j *domain.EmploymentJob) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_employment_jobs (id, tenant_id, enterprise_id, project_id, title, job_type,
			location, salary_min, salary_max, headcount, education, suitable_majors,
			description, responsibilities, requirements, contact_person, contact_phone,
			deadline, status, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
	`, id, j.TenantID, j.EnterpriseID, j.ProjectID, j.Title, j.JobType,
		j.Location, j.SalaryMin, j.SalaryMax, j.Headcount, j.Education, emptyJSON(j.SuitableMajors),
		j.Description, j.Responsibilities, j.Requirements, j.ContactPerson, j.ContactPhone,
		j.Deadline, j.Status, j.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

// UpdateEmploymentJob 企业端更新岗位（限本企业，SQL 层 enterprise_id 归属条件）。
func (s *AllianceStore) UpdateEmploymentJob(ctx context.Context, id, enterpriseID string, j *domain.EmploymentJob) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_employment_jobs SET
			title = $1, job_type = $2, location = $3, salary_min = $4, salary_max = $5,
			headcount = $6, education = $7, suitable_majors = $8,
			description = $9, responsibilities = $10, requirements = $11,
			contact_person = $12, contact_phone = $13, deadline = $14, updated_at = NOW()
		WHERE id = $15 AND enterprise_id = $16
	`, j.Title, j.JobType, j.Location, j.SalaryMin, j.SalaryMax,
		j.Headcount, j.Education, emptyJSON(j.SuitableMajors),
		j.Description, j.Responsibilities, j.Requirements,
		j.ContactPerson, j.ContactPhone, j.Deadline, id, enterpriseID)
	return err
}

// DeleteEmploymentJob 企业端删除岗位（限本企业；投递随 FK CASCADE 清理）。
func (s *AllianceStore) DeleteEmploymentJob(ctx context.Context, id, enterpriseID string) error {
	_, err := s.q.Exec(ctx, `
		DELETE FROM alliance_employment_jobs WHERE id = $1 AND enterprise_id = $2
	`, id, enterpriseID)
	return err
}

// SetPartnerEmploymentJobStatus 企业端岗位状态流转（发布时可绑定就业项目）。
// projectID 非空时要求项目存在且企业已被分配（enterprise_ids 包含本企业），否则 0 行命中返回 false。
func (s *AllianceStore) SetPartnerEmploymentJobStatus(ctx context.Context, id, enterpriseID, status, projectID string) (bool, error) {
	if projectID != "" {
		// 注意：$4 同时与 uuid 列比较（j.enterprise_id），服务端会把参数推断为 uuid，
		// 而 jsonb `?` 操作符需要 text 操作数，必须显式 ::text（否则 SQLSTATE 42883）
		tag, err := s.q.Exec(ctx, `
			UPDATE alliance_employment_jobs j SET status = $1, project_id = $2, updated_at = NOW()
			FROM alliance_employment_projects p
			WHERE j.id = $3 AND j.enterprise_id = $4
			  AND p.id = $2 AND p.enterprise_ids ? $4::text
			  AND p.tenant_id = j.tenant_id
		`, status, projectID, id, enterpriseID)
		if err != nil {
			return false, err
		}
		return tag.RowsAffected() > 0, nil
	}
	tag, err := s.q.Exec(ctx, `
		UPDATE alliance_employment_jobs SET status = $1, updated_at = NOW()
		WHERE id = $2 AND enterprise_id = $3
	`, status, id, enterpriseID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ListPartnerEmploymentApplications 企业端查看本企业岗位投递（只读）。
func (s *AllianceStore) ListPartnerEmploymentApplications(ctx context.Context, jobID, enterpriseID string) ([]domain.EmploymentApplication, error) {
	return queryList(ctx, s.q, s.ScanEmploymentApplicationRows, `
		SELECT `+employmentApplicationColumns+`
		FROM `+employmentApplicationFrom+`
		WHERE a.job_id = $1 AND a.enterprise_id = $2
		ORDER BY a.created_at DESC LIMIT 200
	`, jobID, enterpriseID)
}

// GetPartnerEmploymentApplicationByID 企业端投递详情（限本企业）。
func (s *AllianceStore) GetPartnerEmploymentApplicationByID(ctx context.Context, id, enterpriseID string) (*domain.EmploymentApplication, error) {
	return queryOne(ctx, s.q, s.ScanEmploymentApplicationRows, `
		SELECT `+employmentApplicationColumns+`
		FROM `+employmentApplicationFrom+`
		WHERE a.id = $1 AND a.enterprise_id = $2
	`, id, enterpriseID)
}
