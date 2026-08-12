package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 企业平台（Partner）专用查询 =====

type PartnerStore struct {
	q Queryer
}

func NewPartnerStore(q Queryer) *PartnerStore {
	return &PartnerStore{q: q}
}

// GetRoleIDByCode 按租户+角色 code 查询角色 ID（企业租户种子角色绑定用）。
func (s *PartnerStore) GetRoleIDByCode(ctx context.Context, tenantID, code string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx,
		`SELECT id FROM roles WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
		tenantID, code).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return id, nil
}

// CountExpertsByTenant 企业租户专家数量（服务台统计）。
func (s *PartnerStore) CountExpertsByTenant(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM alliance_experts WHERE tenant_id = $1`, tenantID).Scan(&n)
	return n, err
}

// ExpertStatusCount 专家账号状态计数。
type ExpertStatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// CountExpertStatusByTenant 企业租户专家账号状态分布（服务台图表）。
func (s *PartnerStore) CountExpertStatusByTenant(ctx context.Context, tenantID string) ([]ExpertStatusCount, error) {
	rows, err := s.q.Query(ctx,
		`SELECT status, COUNT(*) FROM alliance_experts WHERE tenant_id = $1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ExpertStatusCount
	for rows.Next() {
		var c ExpertStatusCount
		if err := rows.Scan(&c.Status, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CountPublicExpertsByTenant 企业租户公开专家数量（服务台统计）。
func (s *PartnerStore) CountPublicExpertsByTenant(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM alliance_experts WHERE tenant_id = $1 AND is_public = true AND status = 'active'`,
		tenantID).Scan(&n)
	return n, err
}

// CountMembersByTenant 企业租户成员账号数量（服务台统计）。
func (s *PartnerStore) CountMembersByTenant(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND platform = $2`,
		tenantID, domain.UserPlatformPartner).Scan(&n)
	return n, err
}

// ===== 合作学校状态确认（PUT /partner/schools/{tenantId}/status） =====

// scanPartnerSchoolRow 扫描企业侧合作学校单行视图（与 ListByEnterpriseTenant 同构）。
func scanPartnerSchoolRow(row pgx.Row) (*domain.AlliancePartnerSchool, error) {
	var v domain.AlliancePartnerSchool
	if err := row.Scan(&v.LinkID, &v.TenantID, &v.SchoolName, &v.RelationType, &v.Status,
		&v.Rating, &v.EnterpriseType, &v.IsPublic, &v.CreatedAt); err != nil {
		return nil, err
	}
	return &v, nil
}

// GetPartnerSchool 查询本企业与指定学校租户的合作关联视图；无关联返回 pgx.ErrNoRows。
func (s *PartnerStore) GetPartnerSchool(ctx context.Context, enterpriseTenantID, schoolTenantID string) (*domain.AlliancePartnerSchool, error) {
	return scanPartnerSchoolRow(s.q.QueryRow(ctx, `
		SELECT l.id, l.tenant_id, t.name, l.relation_type, l.status, l.rating,
			l.enterprise_type, l.is_public, l.created_at
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		JOIN tenants t ON t.id = l.tenant_id
		WHERE e.tenant_id = $1 AND l.tenant_id = $2
	`, enterpriseTenantID, schoolTenantID))
}

// UpdatePartnerSchoolStatus 更新本企业与指定学校合作关联的 status（流转校验在 service 层）。
func (s *PartnerStore) UpdatePartnerSchoolStatus(ctx context.Context, enterpriseTenantID, schoolTenantID, status string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_enterprise_links SET status = $1, updated_at = NOW()
		WHERE tenant_id = $2 AND enterprise_id = (SELECT id FROM partner_enterprises WHERE tenant_id = $3)
	`, status, schoolTenantID, enterpriseTenantID)
	return err
}

// ===== 合作内容只读视图（GET /partner/cooperation） =====

// ListCooperation 聚合本企业被各合作学校关联的项目/成果/协议：
// 内容表 tenant_id 与本企业存在未终止 link，且 enterprise_ids（jsonb 文本数组）包含本企业 id。
// 每类按学校分组 updated_at DESC 限 50 条；只返回三类合计 ≥1 条的学校，学校按名称排序。
func (s *PartnerStore) ListCooperation(ctx context.Context, enterpriseID string) ([]domain.AlliancePartnerCooperationSchool, error) {
	rows, err := s.q.Query(ctx, `
		SELECT l.tenant_id, t.name
		FROM alliance_enterprise_links l
		JOIN tenants t ON t.id = l.tenant_id
		WHERE l.enterprise_id = $1 AND l.status <> 'terminated'
		ORDER BY t.name
	`, enterpriseID)
	if err != nil {
		return nil, err
	}
	schools := make([]domain.AlliancePartnerCooperationSchool, 0)
	idx := make(map[string]int)
	for rows.Next() {
		var v domain.AlliancePartnerCooperationSchool
		if err := rows.Scan(&v.TenantID, &v.SchoolName); err != nil {
			rows.Close()
			return nil, err
		}
		v.Projects = make([]domain.AlliancePartnerCooperationProject, 0)
		v.Achievements = make([]domain.AlliancePartnerCooperationAchievement, 0)
		v.Agreements = make([]domain.AlliancePartnerCooperationAgreement, 0)
		idx[v.TenantID] = len(schools)
		schools = append(schools, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(schools) == 0 {
		return schools, nil
	}

	// 三类内容：link 未终止 + enterprise_ids 包含本企业，按学校分组各取最新 50 条
	if err := s.collectCooperationProjects(ctx, enterpriseID, schools, idx); err != nil {
		return nil, err
	}
	if err := s.collectCooperationAchievements(ctx, enterpriseID, schools, idx); err != nil {
		return nil, err
	}
	if err := s.collectCooperationAgreements(ctx, enterpriseID, schools, idx); err != nil {
		return nil, err
	}

	// 只保留三类合计 ≥1 条的学校
	filtered := schools[:0]
	for _, sc := range schools {
		if len(sc.Projects)+len(sc.Achievements)+len(sc.Agreements) > 0 {
			filtered = append(filtered, sc)
		}
	}
	return filtered, nil
}

// cooperationContentQuery 三类内容共用的过滤骨架：$1 = 企业 id，返回 (tenant_id, 各内容列)。
// jsonb_array_elements_text 元素为文本，需 $1::text 比较。
const cooperationLinkFilter = `
	WHERE EXISTS (
		SELECT 1 FROM alliance_enterprise_links l
		WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = $1 AND l.status <> 'terminated'
	) AND EXISTS (
		SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = $1::text
	)`

func (s *PartnerStore) collectCooperationProjects(ctx context.Context, enterpriseID string, schools []domain.AlliancePartnerCooperationSchool, idx map[string]int) error {
	rows, err := s.q.Query(ctx, `
		SELECT tenant_id, id, name, phase, is_public, updated_at FROM (
			SELECT x.tenant_id, x.id, x.name, x.phase, x.is_public, x.updated_at,
				ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn
			FROM alliance_projects x`+cooperationLinkFilter+`
		) ranked WHERE rn <= 50
		ORDER BY updated_at DESC
	`, enterpriseID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var tenantID string
		var v domain.AlliancePartnerCooperationProject
		if err := rows.Scan(&tenantID, &v.ID, &v.Name, &v.Phase, &v.IsPublic, &v.UpdatedAt); err != nil {
			return err
		}
		if i, ok := idx[tenantID]; ok {
			schools[i].Projects = append(schools[i].Projects, v)
		}
	}
	return rows.Err()
}

func (s *PartnerStore) collectCooperationAchievements(ctx context.Context, enterpriseID string, schools []domain.AlliancePartnerCooperationSchool, idx map[string]int) error {
	rows, err := s.q.Query(ctx, `
		SELECT tenant_id, id, title, type, is_public, updated_at FROM (
			SELECT x.tenant_id, x.id, x.title, x.type, x.is_public, x.updated_at,
				ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn
			FROM alliance_achievements x`+cooperationLinkFilter+`
		) ranked WHERE rn <= 50
		ORDER BY updated_at DESC
	`, enterpriseID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var tenantID string
		var v domain.AlliancePartnerCooperationAchievement
		if err := rows.Scan(&tenantID, &v.ID, &v.Title, &v.Type, &v.IsPublic, &v.UpdatedAt); err != nil {
			return err
		}
		if i, ok := idx[tenantID]; ok {
			schools[i].Achievements = append(schools[i].Achievements, v)
		}
	}
	return rows.Err()
}

func (s *PartnerStore) collectCooperationAgreements(ctx context.Context, enterpriseID string, schools []domain.AlliancePartnerCooperationSchool, idx map[string]int) error {
	rows, err := s.q.Query(ctx, `
		SELECT tenant_id, id, name, type, status, is_public, updated_at FROM (
			SELECT x.tenant_id, x.id, x.name, x.type, x.status, x.is_public, x.updated_at,
				ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn
			FROM alliance_agreements x`+cooperationLinkFilter+`
		) ranked WHERE rn <= 50
		ORDER BY updated_at DESC
	`, enterpriseID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var tenantID string
		var v domain.AlliancePartnerCooperationAgreement
		if err := rows.Scan(&tenantID, &v.ID, &v.Name, &v.Type, &v.Status, &v.IsPublic, &v.UpdatedAt); err != nil {
			return err
		}
		if i, ok := idx[tenantID]; ok {
			schools[i].Agreements = append(schools[i].Agreements, v)
		}
	}
	return rows.Err()
}

// ===== 专家测评任务只读列表（GET /partner/mentor-tasks） =====

// ListMentorTasks 本企业专家被学校指派为评审人的测评任务
// （学校给专家创建的影子账号 ml.user_id 被评审步骤 assigned_user_ids 指派）。
// assignedCount/gradedCount：该任务+该校下影子账号被指派的评分记录数 / 其中已评（status='evaluated'）数。
func (s *PartnerStore) ListMentorTasks(ctx context.Context, enterpriseID string) ([]domain.AlliancePartnerMentorTask, error) {
	rows, err := s.q.Query(ctx, `
		SELECT st.id, st.name, rs.label, t.name, x.name, rs.updated_at,
			COALESCE(prog.assigned_count, 0), COALESCE(prog.graded_count, 0)
		FROM alliance_expert_mentor_links ml
		JOIN alliance_experts x ON x.id = ml.expert_id
		JOIN tenants t ON t.id = ml.tenant_id
		JOIN task_review_steps rs ON rs.tenant_id = ml.tenant_id
			AND ml.user_id = ANY(rs.assigned_user_ids) AND rs.enabled = true
		JOIN task_evaluation_methods em ON em.id = rs.config_id AND em.is_enabled = true
		JOIN scenario_tasks st ON st.id = em.task_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS assigned_count,
				COUNT(*) FILTER (WHERE er.status = 'evaluated') AS graded_count
			FROM scene_evaluation_results er
			WHERE er.task_id = st.id AND er.tenant_id = ml.tenant_id AND er.evaluator_id = ml.user_id
		) prog ON true
		WHERE x.enterprise_id = $1 AND ml.enabled = true
		ORDER BY rs.updated_at DESC LIMIT 200
	`, enterpriseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AlliancePartnerMentorTask, 0)
	for rows.Next() {
		var v domain.AlliancePartnerMentorTask
		if err := rows.Scan(&v.TaskID, &v.TaskName, &v.StepLabel, &v.SchoolName, &v.ExpertName, &v.UpdatedAt, &v.AssignedCount, &v.GradedCount); err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}
