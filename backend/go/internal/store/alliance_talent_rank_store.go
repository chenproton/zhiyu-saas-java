package store

import (
	"context"
	"encoding/json"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 人才画像排名（学生按专业分组，多岗位四指标平均） =====

const defaultRankLimit = 10

// rankPositionRow 学生岗位评估明细行（含归属学生，扫描后按学生分组）。
type rankPositionRow struct {
	userID string
	domain.TalentRankPosition
}

// listRankPositions 查询租户全部学生的岗位评估明细（按评估时间倒序）。
func (s *AllianceStore) listRankPositions(ctx context.Context, tenantID string) ([]rankPositionRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT jar.user_id, jar.career_position_id, COALESCE(cp.name, ''),
			jar.achievement_rate, jar.position_competency, jar.position_competency_v2,
			jar.ability_cognition_score, jar.total_ability_points, jar.achieved_ability_points,
			jar.grade, jar.evaluated_at, jar.ability_point_details
		FROM job_ability_results jar
		LEFT JOIN career_positions cp ON cp.id = jar.career_position_id
		WHERE jar.tenant_id = $1
		ORDER BY jar.evaluated_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]rankPositionRow, 0)
	for rows.Next() {
		var item rankPositionRow
		var competency, competencyV2, cognitionScore *float64
		var grade *string
		var details json.RawMessage
		if err := rows.Scan(&item.userID, &item.PositionID, &item.PositionName,
			&item.AchievementRate, &competency, &competencyV2, &cognitionScore,
			&item.TotalAbilityPoints, &item.AchievedAbilityPoints,
			&grade, &item.EvaluatedAt, &details); err != nil {
			return nil, err
		}
		item.PositionCompetency = competency
		item.PositionCompetencyV2 = competencyV2
		item.AbilityCognitionScore = cognitionScore
		item.Grade = grade
		item.AbilityPointDetails = details
		items = append(items, item)
	}
	return items, rows.Err()
}

// listRankStudents 查询租户全部学生（含无评估记录者），按专业名 + 平均达成率降序。
// 专业判断：优先 users.major_id（用户显式设置）；为空则沿组织树从班级向上找「专业」类型节点，
// 节点名匹配 majors 字典拿到专业 ID 参与分组，匹配不到以组织节点 ID 兜底分组（专业名用节点名）。
func (s *AllianceStore) listRankStudents(ctx context.Context, tenantID, search string) ([]domain.TalentRankStudent, error) {
	args := []any{tenantID}
	where := "u.tenant_id = $1 AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = u.id AND r2.code = 'student')"
	if search != "" {
		args = append(args, "%"+search+"%")
		where += " AND (u.name ILIKE $" + Itoa(len(args)) + " OR COALESCE(u.student_no, u.username, u.login_name) ILIKE $" + Itoa(len(args)) + ")"
	}
	query := `
		SELECT u.id, COALESCE(u.student_no, u.username, u.login_name), COALESCE(u.name, ''),
			mr.eff_major_id, COALESCE(mr.eff_major_name, ''),
			COALESCE(o.name, '') AS class_name,
			COALESCE(dept.dept_name, ''),
			agg.avg_rate, agg.avg_comp, agg.avg_comp_v2, agg.avg_cog, agg.pos_count, agg.latest_at
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN LATERAL (
			SELECT AVG(jar.achievement_rate) AS avg_rate,
				AVG(jar.position_competency) AS avg_comp,
				AVG(jar.position_competency_v2) AS avg_comp_v2,
				AVG(jar.ability_cognition_score) AS avg_cog,
				COUNT(*) AS pos_count,
				MAX(jar.evaluated_at) AS latest_at
			FROM job_ability_results jar
			WHERE jar.user_id = u.id AND jar.tenant_id = u.tenant_id
		) agg ON true
		LEFT JOIN LATERAL (
			SELECT COALESCE(u.major_id, org_major.matched_id, org_major.org_id) AS eff_major_id,
				COALESCE(mj.name, org_major.major_name, '') AS eff_major_name
			FROM (
				SELECT n.id AS org_id, o.name AS major_name, mm.id AS matched_id
				FROM (
					WITH RECURSIVE org_chain AS (
						SELECT o.id, o.type_id, o.parent_id, 0 AS depth
						FROM organizations o
						WHERE o.id = u.org_node_id
						UNION ALL
						SELECT o.id, o.type_id, o.parent_id, c.depth + 1
						FROM organizations o
						JOIN org_chain c ON o.id = c.parent_id
					)
					SELECT c.id, c.depth
					FROM org_chain c
					JOIN organizations o ON o.id = c.id
					JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
					WHERE t.name = '专业'
					ORDER BY c.depth
					LIMIT 1
				) n
				JOIN organizations o ON o.id = n.id
				LEFT JOIN majors mm ON mm.tenant_id = o.tenant_id AND mm.name = o.name
			) org_major
			LEFT JOIN majors mj ON mj.id = u.major_id
		) mr ON true
		` + departmentNameSQL + `
		WHERE ` + where + `
		ORDER BY mr.eff_major_name, agg.avg_rate DESC NULLS LAST, u.name ASC
		LIMIT 1000`
	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.TalentRankStudent, 0)
	for rows.Next() {
		var st domain.TalentRankStudent
		var majorID *string
		var avgRate, avgComp, avgCompV2, avgCog *float64
		if err := rows.Scan(&st.StudentID, &st.StudentNo, &st.Name,
			&majorID, &st.MajorName, &st.ClassName, &st.DepartmentName,
			&avgRate, &avgComp, &avgCompV2, &avgCog, &st.PositionCount, &st.LatestEvaluatedAt); err != nil {
			return nil, err
		}
		st.MajorID = majorID
		st.AvgAchievementRate = avgRate
		st.AvgPositionCompetency = avgComp
		st.AvgPositionCompetencyV2 = avgCompV2
		st.AvgAbilityCognitionScore = avgCog
		items = append(items, st)
	}
	return items, rows.Err()
}

// ListTalentRanking 返回租户全部学生按专业分组的画像排名。
// 分组内按平均岗位能力达成率降序（无评估学生排后）；未配置专业的默认 enabled=true、rankLimit=10。
// 学生专业取 listRankStudents 推导结果（users.major_id → 组织树「专业」节点 → 节点名兜底）。
func (s *AllianceStore) ListTalentRanking(ctx context.Context, tenantID, search string, excludeUnevaluated bool) ([]domain.TalentRankMajorGroup, error) {
	students, err := s.listRankStudents(ctx, tenantID, search)
	if err != nil {
		return nil, err
	}
	positions, err := s.listRankPositions(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	configs, err := s.ListBrandMajorRankConfigs(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	cfgByMajor := make(map[string]domain.BrandMajorRankConfig, len(configs))
	for _, c := range configs {
		cfgByMajor[c.MajorID] = c
	}

	posByUser := make(map[string][]domain.TalentRankPosition)
	for _, p := range positions {
		posByUser[p.userID] = append(posByUser[p.userID], p.TalentRankPosition)
	}

	groups := make([]domain.TalentRankMajorGroup, 0)
	groupIdx := make(map[string]int)
	for i := range students {
		st := &students[i]
		// 公开榜单剔除无任何评估记录的学生（管理端面板保留全量）
		if excludeUnevaluated && st.PositionCount == 0 && st.AvgAchievementRate == nil &&
			st.AvgPositionCompetency == nil && st.AvgPositionCompetencyV2 == nil &&
			st.AvgAbilityCognitionScore == nil {
			continue
		}
		majorID := ""
		if st.MajorID != nil {
			majorID = *st.MajorID
		}
		st.Positions = posByUser[st.StudentID]
		if majorName := st.MajorName; majorName == "" {
			st.MajorName = "未分配专业"
		}
		if idx, ok := groupIdx[majorID]; ok {
			groups[idx].Students = append(groups[idx].Students, *st)
			continue
		}
		cfg, ok := cfgByMajor[majorID]
		if !ok {
			cfg = domain.BrandMajorRankConfig{MajorID: majorID, Enabled: true, RankLimit: defaultRankLimit}
		}
		groupIdx[majorID] = len(groups)
		groups = append(groups, domain.TalentRankMajorGroup{
			MajorID:   majorID,
			MajorName: st.MajorName,
			Enabled:   cfg.Enabled,
			RankLimit: cfg.RankLimit,
			Students:  []domain.TalentRankStudent{*st},
		})
	}
	for i := range groups {
		groups[i].StudentCount = len(groups[i].Students)
	}
	return groups, nil
}

// ===== 专业排名启用配置（brand_major_rank_configs） =====

// ListBrandMajorRankConfigs 查询租户专业排名启用配置。
func (s *AllianceStore) ListBrandMajorRankConfigs(ctx context.Context, tenantID string) ([]domain.BrandMajorRankConfig, error) {
	rows, err := s.q.Query(ctx, `
		SELECT major_id, enabled, rank_limit
		FROM brand_major_rank_configs WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.BrandMajorRankConfig, 0)
	for rows.Next() {
		var c domain.BrandMajorRankConfig
		if err := rows.Scan(&c.MajorID, &c.Enabled, &c.RankLimit); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

// SaveBrandMajorRankConfigs 批量保存专业排名启用配置（按 tenant_id+major_id upsert）。
func (s *AllianceStore) SaveBrandMajorRankConfigs(ctx context.Context, tenantID string, configs []domain.BrandMajorRankConfig) error {
	for _, c := range configs {
		if c.MajorID == "" || c.RankLimit < 1 || c.RankLimit > 100 {
			continue
		}
		if _, err := s.q.Exec(ctx, `
			INSERT INTO brand_major_rank_configs (id, tenant_id, major_id, enabled, rank_limit, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (tenant_id, major_id) DO UPDATE SET enabled = $3, rank_limit = $4, updated_at = NOW()
		`, tenantID, c.MajorID, c.Enabled, c.RankLimit); err != nil {
			return err
		}
	}
	return nil
}
