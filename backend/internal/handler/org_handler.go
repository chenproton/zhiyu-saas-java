package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

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
	tenantID := r.URL.Query().Get("tenantId")
	typeID := r.URL.Query().Get("typeId")
	parentID := r.URL.Query().Get("parentId")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if tenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	if typeID != "" {
		where = append(where, "type_id = $"+itoa(argIdx))
		args = append(args, typeID)
		argIdx++
	}
	if parentID != "" {
		where = append(where, "parent_id = $"+itoa(argIdx))
		args = append(args, parentID)
		argIdx++
	} else if r.URL.Query().Get("rootOnly") == "true" {
		where = append(where, "parent_id IS NULL")
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM organizations WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC, created_at ASC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list organizations")
		return
	}
	defer rows.Close()

	items, err := h.scanOrgRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan organizations")
		return
	}

	respondJSON(w, http.StatusOK, OrgListResponse{Items: items, Total: total})
}

func (h *OrgHandler) Tree(w http.ResponseWriter, r *http.Request) {
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
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
		respondError(w, http.StatusInternalServerError, "failed to list organizations")
		return
	}
	defer rows.Close()

	items, err := h.scanOrgRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan organizations")
		return
	}

	counts, err := h.fetchOrgMemberCounts(r.Context(), effectiveTenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to count organization members")
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
		respondError(w, http.StatusNotFound, "organization not found")
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
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.TenantID == "" || req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}
	if err := h.validateOrgRefs(r.Context(), req.TenantID, req.TypeID, req.ParentID); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)
		VALUES ($1, $2, $3, $4, $5, $6, 0)
	`, id, req.TenantID, req.Name, req.TypeID, req.ParentID, req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create organization")
		return
	}

	org, _ := h.fetchOrg(r.Context(), id)
	respondJSON(w, http.StatusCreated, org)
}

func (h *OrgHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.fetchOrg(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "organization not found")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	var req UpdateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.ParentID != nil && *req.ParentID != "" {
		if *req.ParentID == id {
			respondError(w, http.StatusBadRequest, "cannot set parent to itself")
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
			respondError(w, http.StatusInternalServerError, "failed to check parent")
			return
		}
		if descendantOfSelf {
			respondError(w, http.StatusBadRequest, "cannot set a descendant node as parent")
			return
		}
	}

	if err := h.validateOrgRefs(r.Context(), org.TenantID, req.TypeID, req.ParentID); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE organizations SET name = $1, type_id = $2, parent_id = $3, sort_order = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.TypeID, req.ParentID, req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update organization")
		return
	}

	org, _ = h.fetchOrg(r.Context(), id)
	respondJSON(w, http.StatusOK, org)
}

func (h *OrgHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.fetchOrg(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "organization not found")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	var childCount int
	if err := h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM organizations WHERE parent_id = $1`, id,
	).Scan(&childCount); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check child organizations")
		return
	}
	if childCount > 0 {
		respondError(w, http.StatusConflict, "该组织下仍有子节点，请先删除子节点")
		return
	}

	var userCount int
	if err := h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM users WHERE org_node_id = $1`, id,
	).Scan(&userCount); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check organization members")
		return
	}
	if userCount > 0 {
		respondError(w, http.StatusConflict, "该组织下仍有用户，请先移除用户")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM organizations WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete organization")
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
		return fmt.Errorf("invalid typeId")
	}
	if parentID != nil && *parentID != "" {
		var parentExists bool
		if err := h.DB.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND tenant_id = $2)`,
			*parentID, tenantID,
		).Scan(&parentExists); err != nil || !parentExists {
			return fmt.Errorf("invalid parentId")
		}
	}
	return nil
}
