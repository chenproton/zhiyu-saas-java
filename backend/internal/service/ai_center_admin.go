// AI 智能服务中心：管理端业务（审核上架 + 第三方挂接，spec §5.4）。
// 本组端点全部要求 school_admin（路由层 RequireRole），这里只做业务校验与租户过滤。
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 管理端输入校验哨兵（handler 映射 400）。
var (
	ErrAIReviewBadType         = errors.New("type 仅支持 kb/agent")
	ErrAIReviewBadAction       = errors.New("不支持的审核动作")
	ErrAIRejectCommentRequired = errors.New("驳回必须填写理由")
	ErrAIIntegrationInvalid    = errors.New("挂接配置不合法")
)

// ReviewListResult 审核列表项（复用 KB/Agent 视图，附提交人姓名在 OwnerName）。
type ReviewListResult struct {
	Items any `json:"items"`
	Total int `json:"total"`
}

// ListReviews 审核列表：type=kb|agent，status 空=全部审核相关状态。
func (svc *AICenterService) ListReviews(ctx context.Context, tenantID, targetType, status string, page, pageSize int) (*ReviewListResult, error) {
	switch targetType {
	case "kb":
		items, total, err := svc.s.Store().AICenter().ListReviewKBs(ctx, tenantID, status, page, pageSize)
		if err != nil {
			return nil, err
		}
		return &ReviewListResult{Items: items, Total: total}, nil
	case "agent":
		items, total, err := svc.s.Store().AICenter().ListReviewAgents(ctx, tenantID, status, page, pageSize)
		if err != nil {
			return nil, err
		}
		return &ReviewListResult{Items: items, Total: total}, nil
	}
	return nil, ErrAIReviewBadType
}

// ReviewAction 审核动作：approve（pending→published）/ reject（pending→rejected，comment 必填）/ takedown（published→private）。
func (svc *AICenterService) ReviewAction(ctx context.Context, tenantID, adminID, targetType, targetID, action, comment string) error {
	var to, from string
	switch action {
	case domain.AIReviewActionApprove:
		to, from = domain.AIContentStatusPublished, domain.AIContentStatusPending
	case domain.AIReviewActionReject:
		if strings.TrimSpace(comment) == "" {
			return ErrAIRejectCommentRequired
		}
		to, from = domain.AIContentStatusRejected, domain.AIContentStatusPending
	case domain.AIReviewActionTakedown:
		to, from = domain.AIContentStatusPrivate, domain.AIContentStatusPublished
	default:
		return ErrAIReviewBadAction
	}

	var setErr error
	switch targetType {
	case "kb":
		setErr = svc.s.Store().AICenter().SetKBStatus(ctx, tenantID, targetID, to, comment, adminID, from)
	case "agent":
		setErr = svc.s.Store().AICenter().SetAgentStatus(ctx, tenantID, targetID, to, comment, adminID, from)
	default:
		return ErrAIReviewBadType
	}
	if setErr != nil {
		if errors.Is(setErr, store.ErrNotFound) {
			return ErrAIInvalidTransition // 目标不存在或状态已变化（并发审核）
		}
		return setErr
	}
	return svc.s.Store().AICenter().InsertReviewLog(ctx, &domain.AIReviewLog{
		TenantID: tenantID, TargetType: targetType, TargetID: targetID, Action: action, ActorID: adminID, Comment: comment,
	})
}

// AdminOverview 管理端简统计。
func (svc *AICenterService) AdminOverview(ctx context.Context, tenantID string) (map[string]int64, error) {
	return svc.s.Store().AICenter().AdminOverview(ctx, tenantID)
}

// ==================== 第三方挂接 ====================

// IntegrationInput 挂接创建/编辑输入。
type IntegrationInput struct {
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Icon        string `json:"icon"`
	Category    string `json:"category"`
	Sort        int    `json:"sort"`
}

// validateIntegration 输入校验：URL 仅 http/https（XSS 防线，spec §4.8）。
func validateIntegration(in *IntegrationInput) error {
	if in.Kind != domain.AIIntegrationKindAgent && in.Kind != domain.AIIntegrationKindApp {
		return fmt.Errorf("%w：kind 仅支持 agent/app", ErrAIIntegrationInvalid)
	}
	in.Name = strings.TrimSpace(in.Name)
	in.URL = strings.TrimSpace(in.URL)
	if in.Name == "" || len([]rune(in.Name)) > 200 {
		return fmt.Errorf("%w：名称必填且不超过 200 字", ErrAIIntegrationInvalid)
	}
	if !strings.HasPrefix(in.URL, "https://") && !strings.HasPrefix(in.URL, "http://") {
		return fmt.Errorf("%w：链接仅支持 http/https", ErrAIIntegrationInvalid)
	}
	if len(in.URL) > 500 {
		return fmt.Errorf("%w：链接过长", ErrAIIntegrationInvalid)
	}
	return nil
}

// ListIntegrations 挂接列表（onlyActive=true 供广场）。
func (svc *AICenterService) ListIntegrations(ctx context.Context, tenantID, kind string, onlyActive bool) ([]domain.AIIntegration, error) {
	return svc.s.Store().AICenter().ListIntegrations(ctx, tenantID, kind, onlyActive)
}

// CreateIntegration 新建挂接。
func (svc *AICenterService) CreateIntegration(ctx context.Context, tenantID, adminID string, in IntegrationInput) (*domain.AIIntegration, error) {
	if err := validateIntegration(&in); err != nil {
		return nil, err
	}
	it := &domain.AIIntegration{
		TenantID: tenantID, Kind: in.Kind, Name: in.Name, Description: strings.TrimSpace(in.Description),
		URL: in.URL, Icon: strings.TrimSpace(in.Icon), Category: strings.TrimSpace(in.Category),
		Sort: in.Sort, CreatedBy: adminID,
	}
	if err := svc.s.Store().AICenter().CreateIntegration(ctx, it); err != nil {
		return nil, err
	}
	return it, nil
}

// UpdateIntegration 编辑挂接。
func (svc *AICenterService) UpdateIntegration(ctx context.Context, tenantID, id string, in IntegrationInput) error {
	if err := validateIntegration(&in); err != nil {
		return err
	}
	it := &domain.AIIntegration{
		TenantID: tenantID, ID: id, Kind: in.Kind, Name: in.Name, Description: strings.TrimSpace(in.Description),
		URL: in.URL, Icon: strings.TrimSpace(in.Icon), Category: strings.TrimSpace(in.Category), Sort: in.Sort,
	}
	return svc.s.Store().AICenter().UpdateIntegration(ctx, it)
}

// ToggleIntegration 上下架切换。
func (svc *AICenterService) ToggleIntegration(ctx context.Context, tenantID, id, status string) error {
	if status != domain.AIIntegrationActive && status != domain.AIIntegrationInactive {
		return fmt.Errorf("%w：status 仅支持 active/inactive", ErrAIIntegrationInvalid)
	}
	return svc.s.Store().AICenter().SetIntegrationStatus(ctx, tenantID, id, status)
}

// DeleteIntegration 删除挂接。
func (svc *AICenterService) DeleteIntegration(ctx context.Context, tenantID, id string) error {
	return svc.s.Store().AICenter().DeleteIntegration(ctx, tenantID, id)
}
