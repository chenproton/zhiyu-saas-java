package store

import "context"

// ===== 导入模板参考数据 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====

// TemplateDicts 导入模板所需的参考字典数据（名称查询结果，供 Excel 参考 Sheet 组装）。
type TemplateDicts struct {
	Industries      [][2]string // 行业名称, 行业编码
	Majors          [][2]string // 专业名称, 专业编码
	Certs           [][3]string // 证书名称, 相关网址, 证书介绍
	Positions       [][2]string // 岗位名称, 岗位简称
	KnowledgePoints []string    // 知识点名称
	AbilityPoints   [][2]string // 能力点名称, 能力属性
	Resources       [][2]string // 资源名称, 资源类型
}

// DictQuery 查询导入模板所需的全部参考字典数据（行业/专业/证书/岗位/知识点/能力点/资源）。
// 任一查询失败即停止并返回已收集的部分结果（与原 handler queryDicts 行为一致，扫描错误容忍）。
func (s *Store) DictQuery(ctx context.Context, tenantID string) TemplateDicts {
	var d TemplateDicts

	rows, err := s.q.Query(ctx, `SELECT name, COALESCE(code,'') FROM industries WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, c string
		rows.Scan(&n, &c)
		d.Industries = append(d.Industries, [2]string{n, c})
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name, COALESCE(code,'') FROM majors WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, c string
		rows.Scan(&n, &c)
		d.Majors = append(d.Majors, [2]string{n, c})
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name, COALESCE(url,''), COALESCE(description,'') FROM certificate_library WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, u, desc string
		rows.Scan(&n, &u, &desc)
		d.Certs = append(d.Certs, [3]string{n, u, desc})
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name, COALESCE(short_name,'') FROM career_positions WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, s string
		rows.Scan(&n, &s)
		d.Positions = append(d.Positions, [2]string{n, s})
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name FROM knowledge_points WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n string
		rows.Scan(&n)
		d.KnowledgePoints = append(d.KnowledgePoints, n)
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name, COALESCE(array_to_string(attributes, ','), '') FROM ability_points WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, a string
		rows.Scan(&n, &a)
		d.AbilityPoints = append(d.AbilityPoints, [2]string{n, a})
	}
	rows.Close()

	rows, err = s.q.Query(ctx, `SELECT name, COALESCE(resource_type::text,'') FROM resource_library WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return d
	}
	for rows.Next() {
		var n, t string
		rows.Scan(&n, &t)
		d.Resources = append(d.Resources, [2]string{n, t})
	}
	rows.Close()

	return d
}

// ListBatches 查询导入模板所需的批次参考数据。
// lesson 为课程批次（颗粒课/体系课模板），evaluation 为题库/试卷批次；
// lesson 查询失败返回 nil（参考 Sheet 留空），evaluation 查询失败时 evalErr 非空（调用方据此中止生成）。
func (s *Store) ListBatches(ctx context.Context, tenantID string) (lesson []string, evaluation [][]string, evalErr error) {
	rows, qErr := s.q.Query(ctx, `SELECT name FROM lesson_batches WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if qErr == nil {
		for rows.Next() {
			var n string
			rows.Scan(&n)
			lesson = append(lesson, n)
		}
		rows.Close()
	}

	rows, qErr = s.q.Query(ctx, `SELECT name FROM evaluation_batches WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if qErr != nil {
		return lesson, nil, qErr
	}
	for rows.Next() {
		var n string
		rows.Scan(&n)
		evaluation = append(evaluation, []string{n})
	}
	rows.Close()
	return lesson, evaluation, nil
}

// OrgPaths 返回租户全部组织节点的完整路径（根→叶，路径段以 "-" 连接，按 sort_order,name 排序）。
// 查询失败返回 nil（参考 Sheet 留空）。
func (s *Store) OrgPaths(ctx context.Context, tenantID string) [][]string {
	type org struct {
		id       string
		name     string
		parentID *string
	}
	rows, err := s.q.Query(ctx, `SELECT id, name, parent_id FROM organizations WHERE tenant_id=$1 ORDER BY sort_order, name`, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	nodeMap := make(map[string]*org)
	var nodes []*org
	for rows.Next() {
		var o org
		if err := rows.Scan(&o.id, &o.name, &o.parentID); err != nil {
			continue
		}
		cp := o
		nodeMap[o.id] = &cp
		nodes = append(nodes, &cp)
	}

	var buildPath func(id string) string
	buildPath = func(id string) string {
		node, ok := nodeMap[id]
		if !ok {
			return ""
		}
		if node.parentID == nil || *node.parentID == "" {
			return node.name
		}
		parent := buildPath(*node.parentID)
		if parent == "" {
			return node.name
		}
		return parent + "-" + node.name
	}

	var paths [][]string
	for _, n := range nodes {
		paths = append(paths, []string{buildPath(n.id)})
	}
	return paths
}

// GetQuestionBankName 查询题库名称（题目模板表头提示用；调用方按原语义忽略错误时名称保持空串）。
func (s *Store) GetQuestionBankName(ctx context.Context, tenantID, bankID string) (string, error) {
	var name string
	err := s.q.QueryRow(ctx, `SELECT name FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&name)
	return name, err
}

// ListKnowledgePointNames 查询租户全部知识点名称（题目模板参考 Sheet）。
func (s *Store) ListKnowledgePointNames(ctx context.Context, tenantID string) ([]string, error) {
	return listTemplateNames(ctx, s.q, `SELECT name FROM knowledge_points WHERE tenant_id=$1 ORDER BY name`, tenantID)
}

// ListOrgTypeNames 查询租户全部组织类型名称（组织模板参考 Sheet）。
func (s *Store) ListOrgTypeNames(ctx context.Context, tenantID string) ([]string, error) {
	return listTemplateNames(ctx, s.q, `SELECT name FROM org_types WHERE tenant_id=$1 ORDER BY name`, tenantID)
}

// ListStaffTitleNames 查询租户全部职位名称（教师模板参考 Sheet）。
func (s *Store) ListStaffTitleNames(ctx context.Context, tenantID string) ([]string, error) {
	return listTemplateNames(ctx, s.q, `SELECT name FROM staff_titles WHERE tenant_id=$1 ORDER BY name`, tenantID)
}

// listTemplateNames 单列名列表查询通用实现：仅 Query 错误上抛（调用方据此中止生成），
// 扫描/迭代错误与原 handler 行为一致保持容忍。sql 为包内静态字符串，不接受外部输入。
func listTemplateNames(ctx context.Context, q Queryer, sql, tenantID string) ([]string, error) {
	rows, err := q.Query(ctx, sql, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	return names, nil
}
