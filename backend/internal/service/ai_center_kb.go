// AI 智能服务中心：知识库业务编排（docs/spec/ai-service-center.md §3/§5.1）。
// 分层：本文件不出现 SQL；可见性/角色判定集中在 resolveKBRole，是检索与写操作的权限锚点。
package service

import (
	"context"
	"errors"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ErrAIInvalidTransition 状态机非法流转（handler 映射 409）。
var ErrAIInvalidTransition = errors.New("ai-center: invalid status transition")

// 协作者输入校验哨兵（handler 映射 400）。
var (
	ErrAIOwnerAsCollaborator = errors.New("所有者无需添加为协作者")
	ErrAIInvalidCollabRole   = errors.New("协作角色仅支持 editor/viewer")
)

// AICenterService AI 智能服务中心统一 service。
type AICenterService struct {
	s         *Service
	ai        *AIService
	uploadDir string
}

// NewAICenterService 创建 service（uploadDir 复用 FileHandler 的上传根目录）。
func NewAICenterService(s *Service, aiSvc *AIService, uploadDir string) *AICenterService {
	return &AICenterService{s: s, ai: aiSvc, uploadDir: uploadDir}
}

// KB 可见角色：owner / editor / viewer / member（已发布全员）；不可见返回 ErrNotFound（隐藏存在性）。
func (svc *AICenterService) resolveKBRole(ctx context.Context, kb *domain.AIKnowledgeBase, userID string) (string, error) {
	if kb.OwnerID == userID {
		return "owner", nil
	}
	role, err := svc.s.Store().AICenter().GetCollaboratorRole(ctx, kb.TenantID, kb.ID, userID)
	if err == nil {
		return role, nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return "", err
	}
	if kb.Status == domain.AIContentStatusPublished {
		return "member", nil
	}
	return "", store.ErrNotFound
}

// getKBWithRole 取知识库并判定请求者角色；不可见/不存在返回 (nil, "", ErrNotFound)。
func (svc *AICenterService) getKBWithRole(ctx context.Context, tenantID, kbID, userID string) (*domain.AIKnowledgeBase, string, error) {
	kb, err := svc.s.Store().AICenter().GetKB(ctx, tenantID, kbID)
	if err != nil {
		return nil, "", err
	}
	role, err := svc.resolveKBRole(ctx, kb, userID)
	if err != nil {
		return nil, "", err
	}
	return kb, role, nil
}

// ==================== 知识库 CRUD 与状态机 ====================

// CreateKBInput 创建知识库输入。
type CreateKBInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

// CreateKB 创建知识库（任何登录用户；创建即私有）。
func (svc *AICenterService) CreateKB(ctx context.Context, tenantID, ownerID string, in CreateKBInput) (*domain.AIKnowledgeBase, error) {
	kb := &domain.AIKnowledgeBase{
		TenantID:    tenantID,
		OwnerID:     ownerID,
		Name:        strings.TrimSpace(in.Name),
		Description: strings.TrimSpace(in.Description),
		Tags:        normalizeTags(in.Tags),
	}
	if err := svc.s.Store().AICenter().CreateKB(ctx, kb); err != nil {
		return nil, err
	}
	kb.MyRole = "owner"
	return kb, nil
}

// normalizeTags 去空白/去重/限量（≤10 个，单个 ≤30 字符）。
func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" || len([]rune(t)) > 30 || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
		if len(out) >= 10 {
			break
		}
	}
	return out
}

// ListMyKBs 我的知识库（owned/collaborating/all）。
func (svc *AICenterService) ListMyKBs(ctx context.Context, tenantID, userID, scope, q string, page, pageSize int) ([]domain.AIKnowledgeBase, int, error) {
	items, total, err := svc.s.Store().AICenter().ListMyKBs(ctx, tenantID, userID, scope, q, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	// 填充 MyRole：owner 直接判定；协作者批量取真实角色（editor/viewer）
	var kbIDs []string
	for i := range items {
		if items[i].OwnerID == userID {
			items[i].MyRole = "owner"
		} else {
			kbIDs = append(kbIDs, items[i].ID)
		}
	}
	if len(kbIDs) > 0 {
		roles, err := svc.s.Store().AICenter().GetCollaboratorRoles(ctx, tenantID, userID, kbIDs)
		if err != nil {
			return nil, 0, err
		}
		for i := range items {
			if items[i].MyRole == "" {
				items[i].MyRole = roles[items[i].ID]
			}
		}
	}
	return items, total, nil
}

// GetKB 知识库详情（可见者；附我的角色）。
func (svc *AICenterService) GetKB(ctx context.Context, tenantID, kbID, userID string) (*domain.AIKnowledgeBase, error) {
	kb, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return nil, err
	}
	kb.MyRole = role
	return kb, nil
}

// UpdateKB 编辑基础信息（仅 owner）。
func (svc *AICenterService) UpdateKB(ctx context.Context, tenantID, kbID, userID string, in CreateKBInput) error {
	kb, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return err
	}
	// owner/editor 可编辑（spec KB-2：协作者共建）；published 编辑不改变状态
	if role != "owner" && role != domain.AICollaboratorEditor {
		return store.ErrForbidden
	}
	kb.Name = strings.TrimSpace(in.Name)
	kb.Description = strings.TrimSpace(in.Description)
	kb.Tags = normalizeTags(in.Tags)
	return svc.s.Store().AICenter().UpdateKB(ctx, kb)
}

// DeleteKB 删除知识库（仅 owner，且仅 private/rejected；文件清理由 handler/service 协调：先取文档路径）。
func (svc *AICenterService) DeleteKB(ctx context.Context, tenantID, kbID, userID string) ([]string, error) {
	kb, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return nil, err
	}
	if role != "owner" {
		return nil, store.ErrForbidden
	}
	if kb.Status != domain.AIContentStatusPrivate && kb.Status != domain.AIContentStatusRejected {
		return nil, ErrAIInvalidTransition
	}
	docs, err := svc.s.Store().AICenter().ListDocuments(ctx, tenantID, kbID)
	if err != nil {
		return nil, err
	}
	if err := svc.s.Store().AICenter().DeleteKB(ctx, tenantID, kbID); err != nil {
		return nil, err
	}
	paths := make([]string, 0, len(docs))
	for _, d := range docs {
		paths = append(paths, d.FilePath)
	}
	return paths, nil
}

// SubmitKB 提交上架审核：private/rejected → pending。
func (svc *AICenterService) SubmitKB(ctx context.Context, tenantID, kbID, userID string) error {
	return svc.transitionKB(ctx, tenantID, kbID, userID, domain.AIContentStatusPending, domain.AIReviewActionSubmit, "",
		domain.AIContentStatusPrivate, domain.AIContentStatusRejected)
}

// UnpublishKB 下架：published → private（owner 主动）。
func (svc *AICenterService) UnpublishKB(ctx context.Context, tenantID, kbID, userID string) error {
	return svc.transitionKB(ctx, tenantID, kbID, userID, domain.AIContentStatusPrivate, domain.AIReviewActionUnpublish, "",
		domain.AIContentStatusPublished)
}

func (svc *AICenterService) transitionKB(ctx context.Context, tenantID, kbID, userID, to, action, comment string, from ...string) error {
	_, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return err
	}
	if role != "owner" {
		return store.ErrForbidden
	}
	if err := svc.s.Store().AICenter().SetKBStatus(ctx, tenantID, kbID, to, comment, "", from...); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return ErrAIInvalidTransition
		}
		return err
	}
	return svc.s.Store().AICenter().InsertReviewLog(ctx, &domain.AIReviewLog{
		TenantID: tenantID, TargetType: "kb", TargetID: kbID, Action: action, ActorID: userID, Comment: comment,
	})
}

// ==================== 协作者 ====================

// ListCollaborators 协作者列表（可见者可看）。
func (svc *AICenterService) ListCollaborators(ctx context.Context, tenantID, kbID, userID string) ([]domain.AIKBCollaborator, error) {
	if _, _, err := svc.getKBWithRole(ctx, tenantID, kbID, userID); err != nil {
		return nil, err
	}
	return svc.s.Store().AICenter().ListCollaborators(ctx, tenantID, kbID)
}

// AddCollaborator 邀请协作者（仅 owner；被邀请人须同租户且非 owner）。
func (svc *AICenterService) AddCollaborator(ctx context.Context, tenantID, kbID, ownerID, targetUserID, role string) error {
	kb, myRole, err := svc.getKBWithRole(ctx, tenantID, kbID, ownerID)
	if err != nil {
		return err
	}
	if myRole != "owner" {
		return store.ErrForbidden
	}
	if targetUserID == kb.OwnerID {
		return ErrAIOwnerAsCollaborator
	}
	if role != domain.AICollaboratorEditor && role != domain.AICollaboratorViewer {
		return ErrAIInvalidCollabRole
	}
	// 同租户校验：UserStore.Get 带 tenant 过滤，跨租户返回 ErrNotFound
	if _, err := svc.s.Store().Users().Get(ctx, tenantID, targetUserID); err != nil {
		return err
	}
	return svc.s.Store().AICenter().AddCollaborator(ctx, &domain.AIKBCollaborator{
		TenantID: tenantID, KbID: kbID, UserID: targetUserID, Role: role,
	})
}

// RemoveCollaborator 移除协作者（仅 owner）。
func (svc *AICenterService) RemoveCollaborator(ctx context.Context, tenantID, kbID, ownerID, targetUserID string) error {
	_, myRole, err := svc.getKBWithRole(ctx, tenantID, kbID, ownerID)
	if err != nil {
		return err
	}
	if myRole != "owner" {
		return store.ErrForbidden
	}
	return svc.s.Store().AICenter().RemoveCollaborator(ctx, tenantID, kbID, targetUserID)
}

// ==================== 广场 ====================

// ListSquareKBs 广场知识库列表（仅 published）。
func (svc *AICenterService) ListSquareKBs(ctx context.Context, tenantID, q, tag, sort string, page, pageSize int) ([]domain.AIKnowledgeBase, int, error) {
	return svc.s.Store().AICenter().ListSquareKBs(ctx, tenantID, q, tag, sort, page, pageSize)
}

// ListDocuments 文档列表（可见者）。
func (svc *AICenterService) ListDocuments(ctx context.Context, tenantID, kbID, userID string) ([]domain.AIKBDocument, error) {
	if _, _, err := svc.getKBWithRole(ctx, tenantID, kbID, userID); err != nil {
		return nil, err
	}
	return svc.s.Store().AICenter().ListDocuments(ctx, tenantID, kbID)
}
