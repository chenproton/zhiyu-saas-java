package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/store"
)

// Service 是业务编排层入口：事务边界、跨 store 组合、领域规则。
// handler 持有 Service，service 持有 store 集合，均不直接持有连接池。
type Service struct {
	store *store.Store
}

func New(st *store.Store) *Service {
	return &Service{store: st}
}

// WithTx 开启事务并在事务内执行 fn；fn 返回 error 时自动回滚。
// 事务模板统一由 store.Store.WithTx 提供，此处仅做委托，
// 保证"跨 store 组合必须经由同一事务"的唯一入口语义。
func (s *Service) WithTx(ctx context.Context, fn func(txStore *store.Store) error) error {
	return s.store.WithTx(ctx, fn)
}

// Store 暴露底层 store，供无事务需求的直读场景使用。
func (s *Service) Store() *store.Store {
	return s.store
}
