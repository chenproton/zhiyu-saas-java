package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"fmt"
	"net/http"
	"sort"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type OrgHandler struct {
	DB *pgxpool.Pool
}

type OrgListResponse struct {
	Items []domain.Organization `json:"items"`
	Total int                   `json:"total"`
}

type OrgTreeResponse struct {
	Items []OrgTreeNode `json:"items"`
}

type OrgTreeNode struct {
	domain.Organization
	Children []*OrgTreeNode `json:"children"`
}

type CreateOrgRequest struct {
	TenantID  string  `json:"tenantId"`
	Name      string  `json:"name"`
	TypeID    string  `json:"typeId"`
	ParentID  *string `json:"parentId"`
	SortOrder int     `json:"sortOrder"`
}

type UpdateOrgRequest struct {
	Name      string  `json:"name"`
	TypeID    string  `json:"typeId"`
	ParentID  *string `json:"parentId"`
	SortOrder int     `json:"sortOrder"`
}

func (h *OrgHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := listQueryConfig[domain.Organization]{
		Table:         "organizations",
		SelectColumns: "id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at ASC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if tenantID := r.URL.Query().Get("tenantId"); tenantID != "" {
				qb.addCondition("tenant_id = " + qb.nextArg(tenantID))
			}
			if typeID := r.URL.Query().Get("typeId"); typeID != "" {
				qb.addCondition("type_id = " + qb.nextArg(typeID))
			}
			if parentID := r.URL.Query().Get("parentId"); parentID != "" {
				qb.addCondition("parent_id = " + qb.nextArg(parentID))
			} else if r.URL.Query().Get("rootOnly") == "true" {
				qb.addCondition("parent_id IS NULL")
			}
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.scanOrgRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
		} else {
			respondError(w, http.StatusInternalServerError, "查询组织失败")
		}
		return
	}

	respondJSON(w, http.StatusOK, OrgListResponse{Items: items, Total: total})
}

func (h *OrgHandler) Tree(w http.ResponseWriter, r *http.Request) {
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	where := "1=1"
	args := []interface{}{}
	argIdx := 1
	if effectiveTenantID != "" {
		where = "tenant_id = $" + itoa(argIdx)
		args = append(args, effectiveTenantID)
		argIdx++
	}

	query := `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations
		WHERE ` + where + `
		ORDER BY sort_order ASC, created_at ASC
	`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询组织失败")
		return
	}
	defer rows.Close()

	items, err := h.scanOrgRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取组织失败")
		return
	}

	counts, err := h.fetchOrgMemberCounts(r.Context(), effectiveTenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "统计组织成员失败")
		return
	}
	for i := range items {
		items[i].MemberCount = counts[items[i].ID]
	}

	tree := h.buildOrgTree(items)
	respondJSON(w, http.StatusOK, OrgTreeResponse{Items: tree})
}

func (h *OrgHandler) fetchOrgMemberCounts(ctx context.Context, tenantID string) (map[string]int, error) {
	query := `SELECT org_node_id, COUNT(*) FROM users WHERE org_node_id IS NOT NULL`
	args := []interface{}{}
	if tenantID != "" {
		query += ` AND tenant_id = $1`
		args = append(args, tenantID)
	}
	query += ` GROUP BY org_node_id`

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var orgID string
		var count int
		if err := rows.Scan(&orgID, &count); err != nil {
			return nil, err
		}
		counts[orgID] = count
	}
	return counts, rows.Err()
}

func (h *OrgHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	org, err := h.fetchOrg(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织不存在")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, org)
}

func (h *OrgHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.TenantID == "" || req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}
	if err := h.validateOrgRefs(r.Context(), req.TenantID, req.TypeID, req.ParentID); err != nil {
		slog.Error("组织校验失败", "error", err)
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
		VALUES ($1, $2, $3, $4, $5, $6, 0)
	`, id, req.TenantID, req.Name, req.TypeID, req.ParentID, req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建组织失败")
		return
	}

	org, _ := h.fetchOrg(r.Context(), id)
	respondJSON(w, http.StatusCreated, org)
}

func (h *OrgHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.fetchOrg(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织不存在")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	var req UpdateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.ParentID != nil && *req.ParentID != "" {
		if *req.ParentID == id {
			respondError(w, http.StatusBadRequest, "不能将父节点设置为自己")
			return
		}
		var descendantOfSelf bool
		if err := h.DB.QueryRow(r.Context(),
			`SELECT EXISTS(
				WITH RECURSIVE subtree AS (
					SELECT id, parent_id FROM organizations WHERE id = $1
					UNION ALL
					SELECT o.id, o.parent_id FROM organizations o JOIN subtree s ON o.id = s.parent_id
				)
				SELECT 1 FROM subtree WHERE id = $2
			)`, id, *req.ParentID).Scan(&descendantOfSelf); err != nil {
			respondError(w, http.StatusInternalServerError, "检查父节点失败")
			return
		}
		if descendantOfSelf {
			respondError(w, http.StatusBadRequest, "不能将子节点设置为父节点")
			return
		}
	}

	if err := h.validateOrgRefs(r.Context(), org.TenantID, req.TypeID, req.ParentID); err != nil {
		slog.Error("组织校验失败", "error", err)
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE organizations SET name = $1, type_id = $2, parent_id = $3, sort_order = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.TypeID, req.ParentID, req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新组织失败")
		return
	}

	org, _ = h.fetchOrg(r.Context(), id)
	respondJSON(w, http.StatusOK, org)
}

func (h *OrgHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.fetchOrg(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织不存在")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	// 收集目标节点及其所有后代节点 ID（限定同一租户）
	subtreeIDs := []string{id}
	rows, err := h.DB.Query(r.Context(), `
		WITH RECURSIVE subtree AS (
			SELECT id, parent_id FROM organizations WHERE id = $1 AND tenant_id = $2
			UNION ALL
			SELECT o.id, o.parent_id FROM organizations o
			JOIN subtree s ON o.parent_id = s.id
			WHERE o.tenant_id = $2
		)
		SELECT id FROM subtree
	`, id, org.TenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "收集子组织失败")
		return
	}
	for rows.Next() {
		var subID string
		if err := rows.Scan(&subID); err != nil {
			respondError(w, http.StatusInternalServerError, "读取子组织失败")
			return
		}
		subtreeIDs = append(subtreeIDs, subID)
	}
	rows.Close()

	uuidIDs := make([]uuid.UUID, 0, len(subtreeIDs))
	for _, sid := range subtreeIDs {
		uid, err := uuid.Parse(sid)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "无效的组织ID")
			return
		}
		uuidIDs = append(uuidIDs, uid)
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
		UPDATE users SET org_node_id = NULL, updated_at = NOW()
		WHERE org_node_id = ANY($1::uuid[]) AND tenant_id = $2
	`, uuidIDs, org.TenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "清空用户组织绑定失败")
		return
	}

	if _, err := tx.Exec(r.Context(), `
		DELETE FROM organizations WHERE id = ANY($1::uuid[]) AND tenant_id = $2
	`, uuidIDs, org.TenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除组织失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *OrgHandler) fetchOrg(ctx context.Context, id string) (domain.Organization, error) {
	var o domain.Organization
	var parentID *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations WHERE id = $1
	`, id).Scan(
		&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return o, err
	}
	o.ParentID = parentID
	return o, nil
}

func (h *OrgHandler) scanOrgRows(rows pgx.Rows) ([]domain.Organization, error) {
	items := make([]domain.Organization, 0)
	for rows.Next() {
		var o domain.Organization
		var parentID *string
		if err := rows.Scan(
			&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, err
		}
		o.ParentID = parentID
		items = append(items, o)
	}
	return items, nil
}

func (h *OrgHandler) buildOrgTree(orgs []domain.Organization) []OrgTreeNode {
	nodeMap := make(map[string]*OrgTreeNode)
	var roots []*OrgTreeNode

	for i := range orgs {
		nodeMap[orgs[i].ID] = &OrgTreeNode{
			Organization: orgs[i],
			Children:     make([]*OrgTreeNode, 0),
		}
	}

	for i := range orgs {
		node := nodeMap[orgs[i].ID]
		if orgs[i].ParentID == nil || *orgs[i].ParentID == "" {
			roots = append(roots, node)
		} else if parent, ok := nodeMap[*orgs[i].ParentID]; ok {
			parent.Children = append(parent.Children, node)
		}
	}

	sort.Slice(roots, func(i, j int) bool {
		return roots[i].SortOrder < roots[j].SortOrder
	})

	for _, r := range roots {
		computeSubtreeMemberCount(r)
	}

	result := make([]OrgTreeNode, len(roots))
	for i, r := range roots {
		result[i] = *r
	}
	return result
}

func computeSubtreeMemberCount(node *OrgTreeNode) int {
	sum := node.MemberCount
	for _, child := range node.Children {
		sum += computeSubtreeMemberCount(child)
	}
	node.MemberCount = sum
	return sum
}

func (h *OrgHandler) validateOrgRefs(ctx context.Context, tenantID, typeID string, parentID *string) error {
	var typeExists bool
	if err := h.DB.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM org_types WHERE id = $1 AND tenant_id = $2)`,
		typeID, tenantID,
	).Scan(&typeExists); err != nil || !typeExists {
		return fmt.Errorf("组织类型 ID 无效")
	}
	if parentID != nil && *parentID != "" {
		var parentExists bool
		if err := h.DB.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND tenant_id = $2)`,
			*parentID, tenantID,
		).Scan(&parentExists); err != nil || !parentExists {
			return fmt.Errorf("上级组织 ID 无效")
		}
	}
	return nil
}
