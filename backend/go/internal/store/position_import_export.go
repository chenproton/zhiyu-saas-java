package store

import (
	"context"
	"log/slog"
)

// ===== 岗位导入/导出 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====
// 全部方法接收 Queryer（*pgxpool.Pool / pgx.Tx / 事务内 Store），与 handler 的
// h.Store.Q() 配合使用；参数化、租户条件与错误语义与原 handler 内联 SQL 完全一致。

// ---- 导出 ----

// PositionExportInfo 岗位导出基本行。
type PositionExportInfo struct {
	Name         string
	ShortName    string
	PositionType string
	Description  string
	CareerPath   string
	SalaryMin    *int
	SalaryMax    *int
	IndustryID   *string
	BatchID      *string
	Requirements []string
}

// GetPositionExportInfo 按租户+ID 查询岗位导出基本行。
func GetPositionExportInfo(ctx context.Context, q Queryer, tenantID, positionID string) (PositionExportInfo, error) {
	var info PositionExportInfo
	err := q.QueryRow(ctx, `
		SELECT name, COALESCE(short_name,''), position_type, COALESCE(description,''),
			COALESCE(career_path,''), salary_min, salary_max, industry_id, requirements, batch_id
		FROM career_positions WHERE id=$1 AND tenant_id=$2
	`, positionID, tenantID).Scan(&info.Name, &info.ShortName, &info.PositionType, &info.Description,
		&info.CareerPath, &info.SalaryMin, &info.SalaryMax, &info.IndustryID, &info.Requirements, &info.BatchID)
	return info, err
}

// FindIndustryNameByID 按租户+ID 查询行业名称（导出用）。
func FindIndustryNameByID(ctx context.Context, q Queryer, tenantID, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM industries WHERE id=$1 AND tenant_id=$2`, id, tenantID).Scan(&name)
	return name, err
}

// ListPositionMajorNames 导出用：岗位关联专业名称列表。
// 查询失败返回 error；单行扫描失败跳过该行（与原 handler 行为一致）。
func ListPositionMajorNames(ctx context.Context, q Queryer, tenantID, positionID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT m.name FROM majors m JOIN career_position_majors cpm ON cpm.major_id=m.id JOIN career_positions cp ON cp.id=cpm.career_position_id WHERE cpm.career_position_id=$1 AND cp.tenant_id=$2`, positionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var mn string
		if err := rows.Scan(&mn); err != nil {
			slog.Warn("导出岗位专业行扫描失败", "positionId", positionID, "error", err)
			continue
		}
		names = append(names, mn)
	}
	return names, nil
}

// ListPositionCertNames 导出用：岗位关联证书名称列表。
// 查询失败返回 error；单行扫描失败跳过该行（与原 handler 行为一致）。
func ListPositionCertNames(ctx context.Context, q Queryer, tenantID, positionID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT cl.name FROM certificate_library cl JOIN position_certificates pc ON pc.certificate_library_id=cl.id WHERE pc.career_position_id=$1 AND pc.tenant_id=$2`, positionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var cn string
		if err := rows.Scan(&cn); err != nil {
			slog.Warn("导出岗位证书行扫描失败", "positionId", positionID, "error", err)
			continue
		}
		names = append(names, cn)
	}
	return names, nil
}

// FindBatchNameByID 按租户+ID 查询批次名称（导出用）。
func FindBatchNameByID(ctx context.Context, q Queryer, tenantID, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM batches WHERE id=$1 AND tenant_id=$2`, id, tenantID).Scan(&name)
	return name, err
}

// FindPositionNameByID 按租户+ID 查询岗位名称（导出绑定 Sheet 用）。
func FindPositionNameByID(ctx context.Context, q Queryer, tenantID, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1 AND tenant_id=$2`, id, tenantID).Scan(&name)
	return name, err
}

// PositionAbilityBindingExport 岗位工作职责与能力点绑定导出行。
type PositionAbilityBindingExport struct {
	ResponsibilityName string
	AbilityName        string
	AbilityAttributes  []string
	BindingAttributes  []string
	Domain             string
	RequiredLevel      string
	RubricDescription  string
}

// ListPositionAbilityBindings 导出用：岗位工作职责与能力点绑定列表（按职责排序）。
// 查询失败返回 error；单行扫描失败跳过该行（与原 handler 行为一致）。
func ListPositionAbilityBindings(ctx context.Context, q Queryer, tenantID, positionID string) ([]PositionAbilityBindingExport, error) {
	rows, err := q.Query(ctx, `
		SELECT pr.name, ap.name, ap.attributes, pab.attributes, pab.domain, pab.required_level, COALESCE(pab.rubric_description,'')
		FROM position_ability_bindings pab
		JOIN position_responsibilities pr ON pr.id = pab.responsibility_id
		JOIN ability_points ap ON ap.id = pab.ability_point_id
		WHERE pab.career_position_id=$1 AND pab.tenant_id=$2
		ORDER BY pr.sort_order
	`, positionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PositionAbilityBindingExport
	for rows.Next() {
		var b PositionAbilityBindingExport
		if err := rows.Scan(&b.ResponsibilityName, &b.AbilityName, &b.AbilityAttributes, &b.BindingAttributes,
			&b.Domain, &b.RequiredLevel, &b.RubricDescription); err != nil {
			slog.Warn("导出岗位能力绑定行扫描失败", "positionId", positionID, "error", err)
			continue
		}
		items = append(items, b)
	}
	return items, nil
}

// ---- 导入 ----

// PositionImportDuplicate 按租户+名称查重返回的既有岗位信息。
type PositionImportDuplicate struct {
	ID            string
	CreatedBy     string
	Collaborators []string
}

// FindPositionByTenantAndName 按租户+名称查询岗位（导入查重用）。
func FindPositionByTenantAndName(ctx context.Context, q Queryer, tenantID, name string) (PositionImportDuplicate, error) {
	var d PositionImportDuplicate
	err := q.QueryRow(ctx, `SELECT id, created_by, collaborators FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&d.ID, &d.CreatedBy, &d.Collaborators)
	return d, err
}

// FindPositionIDByTenantAndName 按租户+名称查询岗位 ID（重名后缀探测用）。
func FindPositionIDByTenantAndName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// PositionImportUpdateParams 覆盖导入岗位更新参数。
type PositionImportUpdateParams struct {
	ID           string
	TenantID     string
	Name         string
	ShortName    string
	IndustryID   *string
	PositionType string
	SalaryMin    *int
	SalaryMax    *int
	Description  *string
	Requirements []string
	CareerPath   *string
	BatchID      *string
}

// UpdatePositionImportFields 覆盖导入时更新岗位字段。
func UpdatePositionImportFields(ctx context.Context, q Queryer, p PositionImportUpdateParams) error {
	_, err := q.Exec(ctx, `
		UPDATE career_positions
		SET name=$3, short_name=$4, industry_id=$5, position_type=$6,
		    salary_min=$7, salary_max=$8, description=$9, requirements=$10,
		    career_path=$11, batch_id=$12
		WHERE id=$1 AND tenant_id=$2
	`, p.ID, p.TenantID, p.Name, p.ShortName, p.IndustryID, p.PositionType,
		p.SalaryMin, p.SalaryMax, p.Description, p.Requirements, p.CareerPath, p.BatchID)
	return err
}

// ClearPositionImportRelations 覆盖导入时清空岗位关联数据（4 张关联表）。
// 全部语句均尝试执行，返回首个错误（与原 handler 一致：任一失败视为清理失败）。
func ClearPositionImportRelations(ctx context.Context, q Queryer, positionID string) error {
	var firstErr error
	for _, delSQL := range []string{
		`DELETE FROM career_position_majors WHERE career_position_id=$1`,
		`DELETE FROM position_certificates WHERE career_position_id=$1`,
		`DELETE FROM position_responsibilities WHERE career_position_id=$1`,
		`DELETE FROM position_ability_bindings WHERE career_position_id=$1`,
		`DELETE FROM ability_domains WHERE career_position_id=$1`,
	} {
		if _, err := q.Exec(ctx, delSQL, positionID); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// InsertPositionMajor 写入岗位专业绑定（ON CONFLICT DO NOTHING）。
func InsertPositionMajor(ctx context.Context, q Queryer, id, positionID, majorID string) error {
	_, err := q.Exec(ctx, `INSERT INTO career_position_majors (id, career_position_id, major_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, positionID, majorID)
	return err
}

// InsertPositionCertificate 写入岗位证书绑定（ON CONFLICT DO NOTHING）。
func InsertPositionCertificate(ctx context.Context, q Queryer, id, tenantID, positionID, certificateLibraryID string) error {
	_, err := q.Exec(ctx, `INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, id, tenantID, positionID, certificateLibraryID)
	return err
}

// PositionImportInsertParams 导入岗位创建参数。
type PositionImportInsertParams struct {
	ID           string
	TenantID     string
	Code         string
	Name         string
	ShortName    string
	IndustryID   *string
	PositionType string
	SalaryMin    *int
	SalaryMax    *int
	Description  *string
	Requirements []string
	CareerPath   *string
	CreatedBy    string
}

// InsertImportPosition 导入创建岗位（version='V1.0', status='draft', collaborators='{}'）。
func InsertImportPosition(ctx context.Context, q Queryer, p PositionImportInsertParams) error {
	_, err := q.Exec(ctx, `
		INSERT INTO career_positions (id, tenant_id, code, name, short_name, industry_id, position_type,
			salary_min, salary_max, description, requirements, career_path, version, status, created_by, collaborators)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'V1.0','draft',$13,'{}')
	`, p.ID, p.TenantID, p.Code, p.Name, p.ShortName, p.IndustryID, p.PositionType,
		p.SalaryMin, p.SalaryMax, p.Description, p.Requirements, p.CareerPath, p.CreatedBy)
	return err
}

// UpdatePositionBatchID 导入创建后补充岗位批次。
func UpdatePositionBatchID(ctx context.Context, q Queryer, batchID, positionID string) error {
	_, err := q.Exec(ctx, `UPDATE career_positions SET batch_id=$1 WHERE id=$2`, batchID, positionID)
	return err
}

// InsertPositionResponsibility 写入岗位职责（ON CONFLICT DO NOTHING）。
func InsertPositionResponsibility(ctx context.Context, q Queryer, id, tenantID, positionID, name string, sortOrder int) error {
	_, err := q.Exec(ctx, `INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, id, tenantID, positionID, name, sortOrder)
	return err
}

// FindResponsibilityIDByPositionAndName 按岗位+名称查询职责 ID。
func FindResponsibilityIDByPositionAndName(ctx context.Context, q Queryer, positionID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM position_responsibilities WHERE career_position_id=$1 AND name=$2`, positionID, name).Scan(&id)
	return id, err
}

// PositionAbilityBindingInsertParams 导入能力绑定插入参数。
type PositionAbilityBindingInsertParams struct {
	ID                string
	TenantID          string
	PositionID        string
	ResponsibilityID  string
	AbilityPointID    string
	Domain            *string
	RequiredLevel     string
	RubricDescription *string
	Attributes        []string
}

// InsertPositionAbilityBinding 写入岗位能力绑定（source='custom', weight=0）。
func InsertPositionAbilityBinding(ctx context.Context, q Queryer, p PositionAbilityBindingInsertParams) error {
	_, err := q.Exec(ctx, `
		INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, weight, attributes)
		VALUES ($1,$2,$3,$4,$5,'custom',$6,$7,$8,0,$9)
	`, p.ID, p.TenantID, p.PositionID, p.ResponsibilityID, p.AbilityPointID,
		p.Domain, p.RequiredLevel, p.RubricDescription, p.Attributes)
	return err
}

// FindIndustryIDByTenantAndName 按租户+名称查询行业 ID（导入用）。
func FindIndustryIDByTenantAndName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// FindCertificateLibraryID 按租户+名称查询证书库 ID。
func FindCertificateLibraryID(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM certificate_library WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// InsertCertificateLibrary 写入证书库条目（ON CONFLICT DO NOTHING）。
func InsertCertificateLibrary(ctx context.Context, q Queryer, id, tenantID, name string) error {
	_, err := q.Exec(ctx, `INSERT INTO certificate_library (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
	return err
}

// FindAbilityPointID 按租户+名称查询能力点 ID。
func FindAbilityPointID(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// UpdateAbilityPointAttributesIfEmpty 能力点已存在且未设置属性时补充导入属性。
func UpdateAbilityPointAttributesIfEmpty(ctx context.Context, q Queryer, id string, attributes []string) error {
	_, err := q.Exec(ctx, `UPDATE ability_points SET attributes=$1 WHERE id=$2 AND (attributes IS NULL OR attributes = '{}')`, attributes, id)
	return err
}

// InsertAbilityPoint 写入能力点（is_public=true，ON CONFLICT DO NOTHING）。
func InsertAbilityPoint(ctx context.Context, q Queryer, id, tenantID, name string, attributes []string, code string) error {
	_, err := q.Exec(ctx, `INSERT INTO ability_points (id, tenant_id, name, is_public, attributes, code) VALUES ($1,$2,$3,true,$4,$5) ON CONFLICT DO NOTHING`, id, tenantID, name, attributes, code)
	return err
}

// FindAbilityDomainID 按租户+岗位+名称查询能力域 ID。
func FindAbilityDomainID(ctx context.Context, q Queryer, tenantID, positionID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM ability_domains WHERE tenant_id=$1 AND career_position_id=$2 AND name=$3 LIMIT 1`, tenantID, positionID, name).Scan(&id)
	return id, err
}

// AppendAbilityDomainBinding 能力域追加绑定 ID（去重）。
func AppendAbilityDomainBinding(ctx context.Context, q Queryer, domainID, bindingID string) error {
	_, err := q.Exec(ctx, `UPDATE ability_domains SET binding_ids = array_append(binding_ids, $1) WHERE id=$2 AND NOT ($1 = ANY(binding_ids))`, bindingID, domainID)
	return err
}

// InsertAbilityDomain 写入能力域（ON CONFLICT DO NOTHING）。
func InsertAbilityDomain(ctx context.Context, q Queryer, id, tenantID, positionID, name, bindingID string) error {
	_, err := q.Exec(ctx, `INSERT INTO ability_domains (id, tenant_id, career_position_id, name, binding_ids) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, id, tenantID, positionID, name, []string{bindingID})
	return err
}
