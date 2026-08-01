package handler

import (
	"net/http"
	"sort"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type OrgHandler struct {
	Service *service.OrgService
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
	cfg := store.ListQueryConfig[domain.Organization]{
		Table:         "organizations",
		SelectColumns: "id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at ASC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if typeID := p.Values["typeId"]; typeID != "" {
				qb.AddCondition("type_id = " + qb.NextArg(typeID))
			}
			if parentID := p.Values["parentId"]; parentID != "" {
				qb.AddCondition("parent_id = " + qb.NextArg(parentID))
			} else if p.Values["rootOnly"] == "true" {
				qb.AddCondition("parent_id IS NULL")
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询组织失败")
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

	items, err := h.Service.Tree(r.Context(), effectiveTenantID)
	if err != nil {
		respondServerError(w, r, err, "查询组织失败")
		return
	}

	counts, err := h.Service.MemberCounts(r.Context(), effectiveTenantID)
	if err != nil {
		respondServerError(w, r, err, "统计组织成员失败")
		return
	}
	for i := range items {
		items[i].MemberCount = counts[items[i].ID]
	}

	tree := buildOrgTree(items)
	respondJSON(w, http.StatusOK, OrgTreeResponse{Items: tree})
}

func (h *OrgHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	org, err := h.Service.Get(r.Context(), id)
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
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TenantID == "" || req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}
	if err := h.Service.ValidateOrgRefs(r.Context(), req.TenantID, req.TypeID, req.ParentID); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	org, err := h.Service.Create(r.Context(), req.TenantID, &store.OrgCreateParams{
		Name:      req.Name,
		TypeID:    req.TypeID,
		ParentID:  req.ParentID,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		respondServerError(w, r, err, "创建组织失败")
		return
	}
	respondJSON(w, http.StatusCreated, org)
}

func (h *OrgHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织不存在")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	var req UpdateOrgRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.TypeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Service.Update(r.Context(), id, &store.OrgUpdateParams{
		Name:      req.Name,
		TypeID:    req.TypeID,
		ParentID:  req.ParentID,
		SortOrder: req.SortOrder,
	}); err != nil {
		if err == service.ErrOrgSelfParent || err == service.ErrOrgDescendantParent {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err == service.ErrOrgTypeInvalid {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "更新组织失败")
		return
	}

	updated, _ := h.Service.Get(r.Context(), id)
	respondJSON(w, http.StatusOK, updated)
}

func (h *OrgHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	org, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织不存在")
		return
	}
	if !verifyTenantOwnership(w, r, org.TenantID) {
		return
	}

	if err := h.Service.Delete(r.Context(), id, org.TenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除组织失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func buildOrgTree(orgs []domain.Organization) []OrgTreeNode {
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
