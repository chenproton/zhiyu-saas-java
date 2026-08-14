package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"

	"github.com/zhiyu-saas/backend/internal/store"
)

// ResourceBindingService 资源绑定业务编排（节点/任务/课程三类绑定）。
type ResourceBindingService struct {
	*Service
	st *store.Store
}

// NewResourceBindingService 创建资源绑定服务。
func NewResourceBindingService(s *Service) *ResourceBindingService {
	return &ResourceBindingService{Service: s, st: s.Store()}
}

// List 查询资源库列表（可按绑定过滤）。
func (s *ResourceBindingService) List(ctx context.Context, tenantID, search string, bind *store.BindingTable, bindID string, limit, offset int) ([]store.ResourceRow, int, error) {
	return s.st.ResourceBindings().List(ctx, tenantID, search, bind, bindID, limit, offset)
}

// Create 创建资源并绑定到目标。
func (s *ResourceBindingService) Create(ctx context.Context, tenantID, bindTable, bindCol, bindID string, p *store.ResourceCreateSimpleParams, afterBind func(ctx context.Context, q store.Queryer, bindID, resourceID string) error) (*store.ResourceRow, error) {
	return s.st.ResourceBindings().CreateResource(ctx, tenantID, bindTable, bindCol, bindID, p, afterBind)
}

// Bind 绑定已有资源。
func (s *ResourceBindingService) Bind(ctx context.Context, tenantID, bindTable, bindCol, bindID, resourceID string, afterBind func(ctx context.Context, q store.Queryer, bindID, resourceID string) error) (string, error) {
	return s.st.ResourceBindings().Bind(ctx, tenantID, bindTable, bindCol, bindID, resourceID, afterBind)
}

// Unbind 解绑。
func (s *ResourceBindingService) Unbind(ctx context.Context, bindTable, id string, afterUnbind func(ctx context.Context, q store.Queryer, bindID, resourceID string) error) error {
	return s.st.ResourceBindings().Unbind(ctx, bindTable, id, afterUnbind)
}

// BindTargetID 查询绑定行关联的主实体 ID（租户归属校验用）。
func (s *ResourceBindingService) BindTargetID(ctx context.Context, bindTable, id string) (string, error) {
	return s.st.ResourceBindings().BindTargetID(ctx, bindTable, id)
}

// CourseTenantID 查询课程所属租户（租户归属校验用）。
func (s *ResourceBindingService) CourseTenantID(ctx context.Context, courseID string) (string, error) {
	return s.st.ContentActions().GetTenantID(ctx, "courses", courseID)
}

// NodeCourseID 查询节点所属课程（租户归属校验用）。
func (s *ResourceBindingService) NodeCourseID(ctx context.Context, nodeID string) (string, error) {
	return s.st.CourseNodes().CourseIDOf(ctx, nodeID)
}

// TaskScenarioID 查询任务所属场景（租户归属校验用）。
func (s *ResourceBindingService) TaskScenarioID(ctx context.Context, taskID string) (string, error) {
	return s.st.ScenarioTasks().TaskScenarioID(ctx, taskID)
}

// ScenarioTenantID 查询场景所属租户（租户归属校验用）。
func (s *ResourceBindingService) ScenarioTenantID(ctx context.Context, scenarioID string) (*string, error) {
	return s.st.ScenarioTasks().ScenarioTenantID(ctx, scenarioID)
}

// ListCourseResources 课程资源列表（专属列）。
func (s *ResourceBindingService) ListCourseResources(ctx context.Context, tenantID, courseID, search string, limit, offset int) ([]domain.NodeResource, int, error) {
	return s.st.ResourceBindings().ListCourseResources(ctx, tenantID, courseID, search, limit, offset)
}

// CourseSyncBind 课程绑定后同步聚合字段。
func (s *ResourceBindingService) CourseSyncBind(ctx context.Context, courseID, resourceID string) error {
	return store.CourseSyncBind(ctx, s.st.Q(), courseID, resourceID)
}


// SyncCourseResourceBindingWithQ 通用 Create 回调使用的课程资源绑定同步钩子：
// 接受调用方事务 Queryer（同步须与绑定在同一事务内），handler 经 service 层注册，不直调 store。
func SyncCourseResourceBindingWithQ(ctx context.Context, q store.Queryer, courseID, resourceID string) error {
	return store.CourseSyncBind(ctx, q, courseID, resourceID)
}

// CourseSyncUnbind 课程解绑后同步聚合字段。
func (s *ResourceBindingService) CourseSyncUnbind(ctx context.Context, courseID, resourceID string) error {
	return store.CourseSyncUnbind(ctx, s.st.Q(), courseID, resourceID)
}
