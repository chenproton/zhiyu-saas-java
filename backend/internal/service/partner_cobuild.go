package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ErrCoBuildLinkInactive 目标学校与本企业无生效中（active）的合作关系。
var ErrCoBuildLinkInactive = errors.New("no active alliance link with the school")

// ErrCoBuildNotEditable 资源当前状态不允许编辑/删除（仅 draft/pending/rejected 可写）。
var ErrCoBuildNotEditable = errors.New("resource status is not editable")

// PartnerCoBuildService 企业端资源共建业务编排：企业人员对已确认合作的学校
// 创建/编辑岗位与场景（数据落在学校租户，打 enterprise 来源标记）。
type PartnerCoBuildService struct {
	*Service
	st        *store.Store
	positions *PositionService
	scenarios *ScenarioService
	taskEval  *TaskEvaluationService
}

// NewPartnerCoBuildService 创建企业共建服务。
func NewPartnerCoBuildService(s *Service) *PartnerCoBuildService {
	return &PartnerCoBuildService{
		Service:   s,
		st:        s.Store(),
		positions: NewPositionService(s),
		scenarios: NewScenarioService(s),
		taskEval:  NewTaskEvaluationService(s),
	}
}

// resolveEnterprise 企业租户 → 全局企业主体（仿 ownEnterpriseID 模式）。
func (s *PartnerCoBuildService) resolveEnterprise(ctx context.Context, partnerTenantID string) (*domain.AllianceEnterprise, error) {
	return s.st.Alliance().GetEnterpriseByTenant(ctx, partnerTenantID)
}

// requireActiveLink 共建写操作前置校验：目标学校与本企业存在 active 合作 link。
// link 不存在按无有效合作处理（403 语义），其他 DB 错误透传。
func (s *PartnerCoBuildService) requireActiveLink(ctx context.Context, enterpriseID, schoolTenantID string) error {
	link, err := s.st.AllianceEnterpriseLinks().GetLinkByEnterprise(ctx, enterpriseID, schoolTenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			return ErrCoBuildLinkInactive
		}
		return err
	}
	if link.Status != "active" {
		return ErrCoBuildLinkInactive
	}
	return nil
}

// requireCoBuildEditable 仅 draft/pending/rejected 状态允许编辑/删除。
func requireCoBuildEditable(status domain.ContentStatus) error {
	switch status {
	case domain.StatusDraft, domain.StatusPending, domain.StatusRejected:
		return nil
	}
	return ErrCoBuildNotEditable
}

// ownedPosition 按 id 查岗位并校验归属本企业（source_enterprise_id 不符按不存在处理）。
// 用于写操作（编辑/删除/提交），仅限本企业共建的 draft 资源。
func (s *PartnerCoBuildService) ownedPosition(ctx context.Context, enterpriseID, id string) (*domain.CareerPosition, error) {
	pos, err := s.st.Positions().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if pos.SourceEnterpriseID == nil || *pos.SourceEnterpriseID != enterpriseID {
		return nil, store.ErrNotFound
	}
	return pos, nil
}

// accessiblePosition 读操作可见性：本企业共建的，或学校授权（grant）给本企业的资源。
func (s *PartnerCoBuildService) accessiblePosition(ctx context.Context, enterpriseID, id string) (*domain.CareerPosition, error) {
	pos, err := s.st.Positions().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if pos.SourceEnterpriseID != nil && *pos.SourceEnterpriseID == enterpriseID {
		return pos, nil
	}
	granted, err := s.st.AllianceGrants().IsGranted(ctx, enterpriseID, "position", id)
	if err != nil {
		return nil, err
	}
	if !granted {
		return nil, store.ErrNotFound
	}
	return pos, nil
}

// ownedScenario 按 id 查场景并校验归属本企业。
// 用于写操作（编辑/删除/提交），仅限本企业共建的 draft 资源。
func (s *PartnerCoBuildService) ownedScenario(ctx context.Context, enterpriseID, id string) (*domain.Scenario, error) {
	sc, err := s.st.Scenarios().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if sc.TenantID == nil || sc.SourceEnterpriseID == nil || *sc.SourceEnterpriseID != enterpriseID {
		return nil, store.ErrNotFound
	}
	return sc, nil
}

// accessibleScenario 读操作可见性：本企业共建的，或学校授权（grant）给本企业的资源。
func (s *PartnerCoBuildService) accessibleScenario(ctx context.Context, enterpriseID, id string) (*domain.Scenario, error) {
	sc, err := s.st.Scenarios().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if sc.TenantID != nil && sc.SourceEnterpriseID != nil && *sc.SourceEnterpriseID == enterpriseID {
		return sc, nil
	}
	granted, err := s.st.AllianceGrants().IsGranted(ctx, enterpriseID, "scene", id)
	if err != nil {
		return nil, err
	}
	if !granted {
		return nil, store.ErrNotFound
	}
	return sc, nil
}

// scenarioSchoolTenant 场景归属学校租户（ownedScenario 已保证非空）。
func scenarioSchoolTenant(sc *domain.Scenario) string {
	return *sc.TenantID
}

// ===== 岗位 =====

// ListPositions 本企业共建岗位列表（可选按学校过滤）。
func (s *PartnerCoBuildService) ListPositions(ctx context.Context, partnerTenantID string, schoolTenantID *string) ([]domain.PartnerCoBuildPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	return s.st.Positions().ListBySourceEnterprise(ctx, ent.ID, schoolTenantID)
}

// GetPosition 共建岗位详情（本企业共建或学校授权资源可见）。
func (s *PartnerCoBuildService) GetPosition(ctx context.Context, partnerTenantID, id string) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	return s.accessiblePosition(ctx, ent.ID, id)
}

// EditSourcePosition 学校授权编辑：把学校自建岗位复制为 draft 副本（幂等：
// 已有未完结编辑稿时直接返回），专家在副本上编辑，提交后学校审批覆盖原资源。
func (s *PartnerCoBuildService) EditSourcePosition(ctx context.Context, partnerTenantID, userID, id string) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	src, err := s.st.Positions().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	// 本企业共建资源可直接编辑，无需复制（走现有 draft 编辑流程）
	if src.SourceEnterpriseID != nil && *src.SourceEnterpriseID == ent.ID {
		return nil, ErrCoBuildNotEditable
	}
	granted, err := s.st.AllianceGrants().IsGranted(ctx, ent.ID, "position", id)
	if err != nil {
		return nil, err
	}
	if !granted {
		return nil, store.ErrNotFound
	}
	if err := s.requireActiveLink(ctx, ent.ID, src.TenantID); err != nil {
		return nil, err
	}
	// 幂等：已有未完结编辑稿直接返回
	if existing, err := s.st.Positions().FindDraftBySource(ctx, ent.ID, id); err == nil {
		return existing, nil
	}
	var draftID string
	err = s.st.WithTx(ctx, func(txStore *store.Store) error {
		newID, err := txStore.Positions().CopyPositionAsDraft(ctx, txStore.Q(), id, src.TenantID, ent.ID, userID)
		draftID = newID
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.st.Positions().Get(ctx, draftID)
}

// CreatePosition 在合作学校租户创建共建岗位（draft + enterprise 来源标记），
// 同事务自动关联授权给当前企业：岗位数据落学校 /job/positions，
// 授权记录与学校手动授权资源统一处理（学校权限管理页可见、可管理）。
func (s *PartnerCoBuildService) CreatePosition(ctx context.Context, partnerTenantID, userID, schoolTenantID string, p *store.PositionCreateParams) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, schoolTenantID); err != nil {
		return nil, err
	}
	p.Status = domain.CareerPositionStatusDraft
	p.CreatedBy = userID
	p.SourceType = "enterprise"
	p.SourceEnterpriseID = &ent.ID
	// 与 PositionService.Create 的编码/创建步骤保持一致（事务内追加授权记录，
	// 保证"岗位可见 + 自动授权"原子生效）
	var pos *domain.CareerPosition
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		code, err := store.GenerateUniqueEntityCode(ctx, txStore.Q(), "GW", "career_positions", schoolTenantID)
		if err != nil {
			return err
		}
		p.Code = code
		pos, err = txStore.Positions().Create(ctx, txStore.Q(), schoolTenantID, p)
		if err != nil {
			return err
		}
		return txStore.AllianceGrants().AddResourceID(ctx, schoolTenantID, ent.ID, "position", pos.ID, userID)
	})
	if err != nil {
		return nil, err
	}
	return pos, nil
}

// checkPositionWritable 共建岗位写操作公共校验：归属本企业 + 状态可写 + 学校 link 仍 active。
func (s *PartnerCoBuildService) checkPositionWritable(ctx context.Context, enterpriseID, id string) (*domain.CareerPosition, error) {
	pos, err := s.ownedPosition(ctx, enterpriseID, id)
	if err != nil {
		return nil, err
	}
	if err := requireCoBuildEditable(pos.Status); err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, enterpriseID, pos.TenantID); err != nil {
		return nil, err
	}
	return pos, nil
}

// UpdatePosition 更新共建岗位。
func (s *PartnerCoBuildService) UpdatePosition(ctx context.Context, partnerTenantID, id string, p *store.PositionUpdateParams) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	if _, err := s.checkPositionWritable(ctx, ent.ID, id); err != nil {
		return nil, err
	}
	return s.positions.Update(ctx, id, p)
}

// DeletePosition 删除共建岗位。
func (s *PartnerCoBuildService) DeletePosition(ctx context.Context, partnerTenantID, id string) error {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return err
	}
	if _, err := s.checkPositionWritable(ctx, ent.ID, id); err != nil {
		return err
	}
	return s.positions.Delete(ctx, id)
}

// SaveFullPosition 完整保存共建岗位（复用 PositionService.SaveFull）。
// 授权即可编辑：本企业共建或学校授权（grant）的资源均可保存，不再要求合作 link 为 active；
// 保存后状态回写草稿，发布由学校端进行。
func (s *PartnerCoBuildService) SaveFullPosition(ctx context.Context, partnerTenantID, id string, p *store.FullPositionSaveParams) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	pos, err := s.accessiblePosition(ctx, ent.ID, id)
	if err != nil {
		return nil, err
	}
	if err := s.positions.SaveFull(ctx, pos.TenantID, id, p); err != nil {
		return nil, err
	}
	if err := s.resetCoBuildToDraft(ctx, "career_positions", id, "career_position"); err != nil {
		return nil, err
	}
	return s.st.Positions().Get(ctx, id)
}

// resetCoBuildToDraft 保存后回写草稿：已是 draft 跳过（状态机不允许 draft→draft），
// 其余状态（rejected/pending/approved/published/archived）均可回到 draft。
func (s *PartnerCoBuildService) resetCoBuildToDraft(ctx context.Context, table, id, targetType string) error {
	status, err := s.st.ContentActions().GetStatus(ctx, table, id)
	if err != nil {
		return err
	}
	if status == domain.StatusDraft {
		return nil
	}
	return s.st.ContentActions().Transition(ctx, table, id, domain.StatusDraft, targetType, nil)
}

// SubmitPosition 提交共建岗位审核：draft→pending（ContentActionStore），
// 同事务创建学校租户审批记录（学校审批中心 /job/approvals 自动可见）。
func (s *PartnerCoBuildService) SubmitPosition(ctx context.Context, partnerTenantID, userID, id string) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	pos, err := s.ownedPosition(ctx, ent.ID, id)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, pos.TenantID); err != nil {
		return nil, err
	}
	schoolTenantID := pos.TenantID
	err = s.st.ContentActions().Transition(ctx, "career_positions", id, domain.StatusPending, "career_position",
		func(txStore *store.Store, targetID string) error {
			_, err := txStore.Approvals().Create(ctx, &schoolTenantID, &store.ApprovalCreateParams{
				TargetType:  "career_position",
				TargetID:    targetID,
				Status:      string(domain.ApprovalStatusPending),
				SubmitterID: userID,
				History:     domain.JSONSlice{},
			})
			return err
		})
	if err != nil {
		return nil, err
	}
	return s.st.Positions().Get(ctx, id)
}

// WithdrawPosition 撤回共建岗位审核：pending→draft（Transition 自动清理待审批记录）。
func (s *PartnerCoBuildService) WithdrawPosition(ctx context.Context, partnerTenantID, id string) (*domain.CareerPosition, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	pos, err := s.ownedPosition(ctx, ent.ID, id)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, pos.TenantID); err != nil {
		return nil, err
	}
	if err := s.st.ContentActions().Transition(ctx, "career_positions", id, domain.StatusDraft, "career_position", nil); err != nil {
		return nil, err
	}
	return s.st.Positions().Get(ctx, id)
}

// ===== 岗位编辑子资源只读（编辑器数据源，复用 portal 同一 store 查询） =====

// ownedPositionTenant 只读可见性校验：本企业共建或学校授权（grant）资源，返回学校租户。
// 与 GetPosition/ListPositions 的 accessiblePosition 可见性一致，保证列表可见的岗位
// （含学校授权资源）其子资源只读接口同样可访问。
func (s *PartnerCoBuildService) ownedPositionTenant(ctx context.Context, partnerTenantID, positionID string) (string, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return "", err
	}
	pos, err := s.accessiblePosition(ctx, ent.ID, positionID)
	if err != nil {
		return "", err
	}
	return pos.TenantID, nil
}

// ListPositionResponsibilities 共建岗位职责列表（形状与 portal positionResponsibilityApi.list 一致）。
func (s *PartnerCoBuildService) ListPositionResponsibilities(ctx context.Context, partnerTenantID, positionID string) ([]domain.PositionResponsibility, int, error) {
	schoolTenantID, err := s.ownedPositionTenant(ctx, partnerTenantID, positionID)
	if err != nil {
		return nil, 0, err
	}
	return s.st.PositionResponsibilities().List(ctx, store.ListParams{
		TenantID: schoolTenantID,
		Limit:    200,
		Values:   map[string]string{"careerPositionId": positionID},
	}, s.st.PositionResponsibilities().ListConfig())
}

// ListPositionCertificates 共建岗位证书列表（join 证书库，形状与 portal positionCertificateApi.list 一致）。
func (s *PartnerCoBuildService) ListPositionCertificates(ctx context.Context, partnerTenantID, positionID string, limit, offset int) ([]domain.PositionCertificate, int, error) {
	schoolTenantID, err := s.ownedPositionTenant(ctx, partnerTenantID, positionID)
	if err != nil {
		return nil, 0, err
	}
	return s.st.PositionCertificates().List(ctx, schoolTenantID, positionID, limit, offset)
}

// ListPositionAbilityBindings 共建岗位能力绑定列表（LEFT JOIN 能力点出名称，与 portal listBindings 一致）。
func (s *PartnerCoBuildService) ListPositionAbilityBindings(ctx context.Context, partnerTenantID, positionID string) ([]domain.PositionAbilityBinding, int, error) {
	schoolTenantID, err := s.ownedPositionTenant(ctx, partnerTenantID, positionID)
	if err != nil {
		return nil, 0, err
	}
	return s.st.PositionAbilities().List(ctx, store.ListParams{
		TenantID: schoolTenantID,
		Limit:    200,
		Values:   map[string]string{"careerPositionId": positionID},
	}, s.st.PositionAbilities().ListConfig())
}

// ListPositionAbilityDomains 共建岗位能力域列表（与 portal abilityApi.listDomains 一致）。
func (s *PartnerCoBuildService) ListPositionAbilityDomains(ctx context.Context, partnerTenantID, positionID string) ([]domain.AbilityDomain, int, error) {
	schoolTenantID, err := s.ownedPositionTenant(ctx, partnerTenantID, positionID)
	if err != nil {
		return nil, 0, err
	}
	return s.st.AbilityDomains().List(ctx, store.ListParams{
		TenantID: schoolTenantID,
		Limit:    200,
		Values:   map[string]string{"careerPositionId": positionID},
	}, s.st.AbilityDomains().ListConfig())
}

// ===== 场景 =====

// ListScenarios 本企业共建场景列表（可选按学校过滤）。
func (s *PartnerCoBuildService) ListScenarios(ctx context.Context, partnerTenantID string, schoolTenantID *string) ([]domain.PartnerCoBuildScenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	return s.st.Scenarios().ListBySourceEnterprise(ctx, ent.ID, schoolTenantID)
}

// GetScenario 共建场景详情（本企业共建或学校授权资源可见）。
func (s *PartnerCoBuildService) GetScenario(ctx context.Context, partnerTenantID, id string) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	return s.accessibleScenario(ctx, ent.ID, id)
}

// EditSourceScenario 学校授权编辑：把学校自建场景复制为 draft 副本（幂等），
// 专家在副本上编辑，提交后学校审批覆盖原资源。
func (s *PartnerCoBuildService) EditSourceScenario(ctx context.Context, partnerTenantID, userID, id string) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	src, err := s.st.Scenarios().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if src.TenantID == nil {
		return nil, store.ErrNotFound
	}
	// 本企业共建资源可直接编辑，无需复制
	if src.SourceEnterpriseID != nil && *src.SourceEnterpriseID == ent.ID {
		return nil, ErrCoBuildNotEditable
	}
	granted, err := s.st.AllianceGrants().IsGranted(ctx, ent.ID, "scene", id)
	if err != nil {
		return nil, err
	}
	if !granted {
		return nil, store.ErrNotFound
	}
	if err := s.requireActiveLink(ctx, ent.ID, *src.TenantID); err != nil {
		return nil, err
	}
	if existing, err := s.st.Scenarios().FindDraftBySource(ctx, ent.ID, id); err == nil {
		return existing, nil
	}
	var draftID string
	err = s.st.WithTx(ctx, func(txStore *store.Store) error {
		newID, err := txStore.Scenarios().CopyScenarioAsDraft(ctx, txStore.Q(), id, *src.TenantID, ent.ID, userID)
		draftID = newID
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.st.Scenarios().Get(ctx, draftID)
}

// CreateScenario 在合作学校租户创建共建场景（draft + enterprise 来源标记），
// 同事务自动关联授权给当前企业（与岗位共建一致，学校权限管理页可见、可管理）。
func (s *PartnerCoBuildService) CreateScenario(ctx context.Context, partnerTenantID, userID, schoolTenantID string, p *store.ScenarioCreateParams) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, schoolTenantID); err != nil {
		return nil, err
	}
	p.CreatorID = userID
	p.SourceType = "enterprise"
	p.SourceEnterpriseID = &ent.ID
	var sc *domain.Scenario
	err = s.WithTx(ctx, func(txStore *store.Store) error {
		code, err := store.GenerateUniqueEntityCode(ctx, txStore.Q(), "CJ", "scenarios", schoolTenantID)
		if err != nil {
			return err
		}
		p.Code = code
		sc, err = txStore.Scenarios().Create(ctx, schoolTenantID, p)
		if err != nil {
			return err
		}
		return txStore.AllianceGrants().AddResourceID(ctx, schoolTenantID, ent.ID, "scene", sc.ID, userID)
	})
	if err != nil {
		return nil, err
	}
	return sc, nil
}

// checkScenarioWritable 共建场景写操作公共校验：归属本企业 + 状态可写 + 学校 link 仍 active。
func (s *PartnerCoBuildService) checkScenarioWritable(ctx context.Context, enterpriseID, id string) (*domain.Scenario, error) {
	sc, err := s.ownedScenario(ctx, enterpriseID, id)
	if err != nil {
		return nil, err
	}
	if err := requireCoBuildEditable(sc.Status); err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, enterpriseID, scenarioSchoolTenant(sc)); err != nil {
		return nil, err
	}
	return sc, nil
}

// UpdateScenario 更新共建场景（场景编辑页保存走此接口）。
// 授权即可编辑：本企业共建或学校授权（grant）的场景均可保存，不再要求合作 link 为 active；
// 保存后状态回写草稿，发布由学校端进行。
func (s *PartnerCoBuildService) UpdateScenario(ctx context.Context, partnerTenantID, id string, p *store.ScenarioUpdateParams) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	if _, err := s.accessibleScenario(ctx, ent.ID, id); err != nil {
		return nil, err
	}
	if _, err := s.scenarios.Update(ctx, id, p); err != nil {
		return nil, err
	}
	if err := s.resetCoBuildToDraft(ctx, "scenarios", id, "scenario"); err != nil {
		return nil, err
	}
	return s.st.Scenarios().Get(ctx, id)
}

// DeleteScenario 删除共建场景。
func (s *PartnerCoBuildService) DeleteScenario(ctx context.Context, partnerTenantID, id string) error {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return err
	}
	if _, err := s.checkScenarioWritable(ctx, ent.ID, id); err != nil {
		return err
	}
	return s.scenarios.Delete(ctx, id)
}

// SubmitScenario 提交共建场景审核：draft→pending + 同事务创建学校租户审批记录。
func (s *PartnerCoBuildService) SubmitScenario(ctx context.Context, partnerTenantID, userID, id string) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	sc, err := s.ownedScenario(ctx, ent.ID, id)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, scenarioSchoolTenant(sc)); err != nil {
		return nil, err
	}
	schoolTenantID := scenarioSchoolTenant(sc)
	err = s.st.ContentActions().Transition(ctx, "scenarios", id, domain.StatusPending, "scenario",
		func(txStore *store.Store, targetID string) error {
			_, err := txStore.Approvals().Create(ctx, &schoolTenantID, &store.ApprovalCreateParams{
				TargetType:  "scenario",
				TargetID:    targetID,
				Status:      string(domain.ApprovalStatusPending),
				SubmitterID: userID,
				History:     domain.JSONSlice{},
			})
			return err
		})
	if err != nil {
		return nil, err
	}
	return s.st.Scenarios().Get(ctx, id)
}

// WithdrawScenario 撤回共建场景审核：pending→draft（Transition 自动清理待审批记录）。
func (s *PartnerCoBuildService) WithdrawScenario(ctx context.Context, partnerTenantID, id string) (*domain.Scenario, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	sc, err := s.ownedScenario(ctx, ent.ID, id)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, scenarioSchoolTenant(sc)); err != nil {
		return nil, err
	}
	if err := s.st.ContentActions().Transition(ctx, "scenarios", id, domain.StatusDraft, "scenario", nil); err != nil {
		return nil, err
	}
	return s.st.Scenarios().Get(ctx, id)
}

// ===== 场景任务 =====

// ListTasks 共建场景任务列表（可见性经场景反查校验：本企业共建或学校授权）。
func (s *PartnerCoBuildService) ListTasks(ctx context.Context, partnerTenantID, scenarioID string) ([]domain.ScenarioTask, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	sc, err := s.accessibleScenario(ctx, ent.ID, scenarioID)
	if err != nil {
		return nil, err
	}
	items, _, err := s.scenarios.ListTasks(ctx, store.ListParams{
		TenantID: scenarioSchoolTenant(sc),
		Limit:    200,
		Values:   map[string]string{"scenarioId": scenarioID},
	}, s.st.ScenarioTasks().ListConfig())
	return items, err
}

// CreateTask 在共建场景下创建任务（tenant 取所属场景学校）。
func (s *PartnerCoBuildService) CreateTask(ctx context.Context, partnerTenantID, scenarioID string, p *store.ScenarioTaskParams) (*domain.ScenarioTask, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	sc, err := s.checkScenarioWritable(ctx, ent.ID, scenarioID)
	if err != nil {
		return nil, err
	}
	p.ScenarioID = scenarioID
	p.TenantID = sc.TenantID
	return s.scenarios.CreateTask(ctx, p)
}

// ownedTaskScenario 按任务反查场景并校验归属本企业。
func (s *PartnerCoBuildService) ownedTaskScenario(ctx context.Context, enterpriseID, taskID string) (*domain.ScenarioTask, *domain.Scenario, error) {
	task, err := s.st.ScenarioTasks().Get(ctx, taskID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, store.ErrNotFound
		}
		return nil, nil, err
	}
	sc, err := s.ownedScenario(ctx, enterpriseID, task.ScenarioID)
	if err != nil {
		return nil, nil, err
	}
	return task, sc, nil
}

// UpdateTask 更新共建场景任务（不允许跨场景迁移）。
func (s *PartnerCoBuildService) UpdateTask(ctx context.Context, partnerTenantID, taskID string, p *store.ScenarioTaskParams) (*domain.ScenarioTask, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	task, sc, err := s.ownedTaskScenario(ctx, ent.ID, taskID)
	if err != nil {
		return nil, err
	}
	if err := requireCoBuildEditable(sc.Status); err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, scenarioSchoolTenant(sc)); err != nil {
		return nil, err
	}
	p.ScenarioID = task.ScenarioID
	p.TenantID = sc.TenantID
	return s.scenarios.UpdateTask(ctx, taskID, scenarioSchoolTenant(sc), p)
}

// DeleteTask 删除共建场景任务。
func (s *PartnerCoBuildService) DeleteTask(ctx context.Context, partnerTenantID, taskID string) error {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return err
	}
	_, sc, err := s.ownedTaskScenario(ctx, ent.ID, taskID)
	if err != nil {
		return err
	}
	if err := requireCoBuildEditable(sc.Status); err != nil {
		return err
	}
	if err := s.requireActiveLink(ctx, ent.ID, scenarioSchoolTenant(sc)); err != nil {
		return err
	}
	return s.scenarios.DeleteTask(ctx, taskID, scenarioSchoolTenant(sc))
}

// ReorderTasks 批量重排共建场景任务。
func (s *PartnerCoBuildService) ReorderTasks(ctx context.Context, partnerTenantID, scenarioID string, taskIDs []string) error {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return err
	}
	if _, err := s.checkScenarioWritable(ctx, ent.ID, scenarioID); err != nil {
		return err
	}
	return s.scenarios.ReorderTasks(ctx, scenarioID, taskIDs)
}

// ===== 任务测评方式 =====

// GetTaskEvaluationMethods 查看共建任务测评方式（tenant 取学校；本企业共建或学校授权可见）。
func (s *PartnerCoBuildService) GetTaskEvaluationMethods(ctx context.Context, partnerTenantID, taskID string) ([]domain.TaskEvaluationMethod, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	task, err := s.st.ScenarioTasks().Get(ctx, taskID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, store.ErrNotFound
		}
		return nil, err
	}
	sc, err := s.accessibleScenario(ctx, ent.ID, task.ScenarioID)
	if err != nil {
		return nil, err
	}
	return s.taskEval.ListMethods(ctx, taskID, scenarioSchoolTenant(sc))
}

// SaveTaskEvaluationMethods 保存共建任务测评方式（复用 TaskEvaluationService，
// 含版本乐观锁与临时考试联动，creatorID 为企业用户）。
func (s *PartnerCoBuildService) SaveTaskEvaluationMethods(ctx context.Context, partnerTenantID, userID, taskID string, version int, inputs []*MethodSaveInput) ([]domain.TaskEvaluationMethod, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	_, sc, err := s.ownedTaskScenario(ctx, ent.ID, taskID)
	if err != nil {
		return nil, err
	}
	if err := requireCoBuildEditable(sc.Status); err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, scenarioSchoolTenant(sc)); err != nil {
		return nil, err
	}
	return s.taskEval.SaveMethods(ctx, scenarioSchoolTenant(sc), taskID, userID, version, inputs)
}

// ===== 学校数据只读列表（编辑器数据源） =====

// ListSchoolAbilities 合作学校能力点只读列表（岗位/任务编辑器数据源）。
func (s *PartnerCoBuildService) ListSchoolAbilities(ctx context.Context, partnerTenantID, schoolTenantID string, p store.ListParams) ([]domain.AbilityPoint, int, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, 0, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, schoolTenantID); err != nil {
		return nil, 0, err
	}
	p.TenantID = schoolTenantID
	return s.st.Abilities().List(ctx, p, s.st.Abilities().ListConfig())
}

// ListSchoolEvaluationMethods 合作学校评分模板（测评方法）只读列表（测评规则编辑器数据源）。
func (s *PartnerCoBuildService) ListSchoolEvaluationMethods(ctx context.Context, partnerTenantID, schoolTenantID string, p store.ListParams) ([]domain.RubricTemplate, int, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, 0, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, schoolTenantID); err != nil {
		return nil, 0, err
	}
	p.TenantID = schoolTenantID
	return s.st.TaskEval().ListRubricTemplates(ctx, p, s.st.TaskEval().ListConfig())
}

// ListSchoolCoBuilders 合作学校共建人候选（岗位编辑页共建人选择器数据源）：
// 学校教师 + 企业专家，需企业与学校存在 active 合作 link。
func (s *PartnerCoBuildService) ListSchoolCoBuilders(ctx context.Context, partnerTenantID, schoolTenantID string) ([]domain.CoBuildUserOption, error) {
	ent, err := s.resolveEnterprise(ctx, partnerTenantID)
	if err != nil {
		return nil, err
	}
	if err := s.requireActiveLink(ctx, ent.ID, schoolTenantID); err != nil {
		return nil, err
	}
	return s.st.Partner().ListSchoolCoBuilders(ctx, schoolTenantID)
}
