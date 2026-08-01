package service

import (
	"context"
	"fmt"

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
// 跨 store 的组合操作必须经由 WithTx，保证原子性。
func (s *Service) WithTx(ctx context.Context, fn func(txStore *store.Store) error) error {
	tx, err := s.store.Begin(ctx)
	if err != nil {
		return fmt.Errorf("service: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	txStore := store.NewWithTx(tx)
	if err := fn(txStore); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Store 暴露底层 store，供无事务需求的直读场景使用。
func (s *Service) Store() *store.Store {
	return s.store
}
