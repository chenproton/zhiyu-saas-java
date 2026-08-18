package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemOrganization;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateOrgRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTreeNode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateOrgRequest;
import org.dromara.zhiyu.mapper.system.SystemOrganizationMapper;
import org.dromara.zhiyu.service.system.ISystemOrganizationService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 组织服务实现（对齐 Go org_handler.go + store/organizations.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemOrganizationServiceImpl implements ISystemOrganizationService {

    private final SystemOrganizationMapper orgMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemOrganization> list(String typeId, String parentId, String rootOnly, String search,
                                                 long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        LambdaQueryBuilder<SystemOrganization> wrapper = QueryBuilder.lambda(SystemOrganization.class)
            .eq(SystemOrganization::getTenantId, tenantId);
        if (typeId != null && !typeId.isBlank()) {
            wrapper.eq(SystemOrganization::getTypeId, typeId);
        }
        if (parentId != null && !parentId.isBlank()) {
            wrapper.eq(SystemOrganization::getParentId, parentId);
        } else if ("true".equals(rootOnly)) {
            wrapper.isNull(SystemOrganization::getParentId);
        }
        if (search != null && !search.isBlank()) {
            wrapper.like(SystemOrganization::getName, search);
        }
        long total = orgMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(SystemOrganization::getSortOrder).orderByAsc(SystemOrganization::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemOrganization> items = orgMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public List<OrgTreeNode> tree() {
        String tenantId = guard.requireTenant();
        List<SystemOrganization> orgs = orgMapper.selectList(QueryBuilder.lambda(SystemOrganization.class)
            .eq(SystemOrganization::getTenantId, tenantId)
            .orderByAsc(SystemOrganization::getSortOrder)
            .orderByAsc(SystemOrganization::getCreatedAt).build());
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Map<String, Object> row : orgMapper.memberCounts(tenantId)) {
            counts.put(String.valueOf(row.get("org_node_id")), ((Number) row.get("count")).intValue());
        }
        Map<String, OrgTreeNode> nodeMap = new LinkedHashMap<>();
        for (SystemOrganization org : orgs) {
            OrgTreeNode node = toNode(org);
            node.setMemberCount(counts.getOrDefault(org.getId(), 0));
            node.setChildren(new ArrayList<>());
            nodeMap.put(org.getId(), node);
        }
        List<OrgTreeNode> roots = new ArrayList<>();
        for (SystemOrganization org : orgs) {
            OrgTreeNode node = nodeMap.get(org.getId());
            if (org.getParentId() == null || org.getParentId().isBlank() || !nodeMap.containsKey(org.getParentId())) {
                roots.add(node);
            } else {
                nodeMap.get(org.getParentId()).getChildren().add(node);
            }
        }
        roots.sort(Comparator.comparing(OrgTreeNode::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder())));
        for (OrgTreeNode root : roots) {
            computeSubtreeCount(root);
        }
        return roots;
    }

    @Override
    public SystemOrganization get(String id) {
        SystemOrganization org = orgMapper.selectById(id);
        if (org == null) {
            throw new ApiException(404, "not_found", "组织不存在");
        }
        guard.verifyTenantOwnership(org.getTenantId());
        return org;
    }

    @Override
    public SystemOrganization create(CreateOrgRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getName()) || isBlank(req.getTypeId())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        validateOrgRefs(req.getTenantId(), req.getTypeId(), req.getParentId());
        String id = UUID.randomUUID().toString();
        orgMapper.insertOrg(id, req.getTenantId(), req.getName(), req.getTypeId(), req.getParentId(),
            req.getSortOrder() == null ? 0 : req.getSortOrder());
        return orgMapper.selectById(id);
    }

    @Override
    public SystemOrganization update(String id, UpdateOrgRequest req) {
        guard.requireManagePortal();
        SystemOrganization existing = requireOwned(id);
        if (isBlank(req.getName()) || isBlank(req.getTypeId())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        validateOrgRefs(existing.getTenantId(), req.getTypeId(), req.getParentId());
        if (req.getParentId() != null && req.getParentId().equals(id)) {
            throw new ApiException(400, "bad_request", "不能将父节点设置为自己");
        }
        if (req.getParentId() != null && !req.getParentId().isBlank()
            && orgMapper.isDescendant(id, req.getParentId())) {
            throw new ApiException(400, "bad_request", "不能将子节点设置为父节点");
        }
        orgMapper.updateOrg(id, req.getName(), req.getTypeId(), req.getParentId(),
            req.getSortOrder() == null ? 0 : req.getSortOrder());
        return orgMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        guard.requireManagePortal();
        SystemOrganization existing = requireOwned(id);
        List<String> subtree = orgMapper.subtreeIds(id, existing.getTenantId());
        List<String> all = new ArrayList<>();
        all.add(id);
        all.addAll(subtree);
        orgMapper.unbindUsers(all, existing.getTenantId());
        orgMapper.deleteSubtree(all, existing.getTenantId());
        return id;
    }

    private void validateOrgRefs(String tenantId, String typeId, String parentId) {
        if (!orgMapper.orgTypeExists(typeId, tenantId)) {
            throw new ApiException(400, "bad_request", "组织类型 ID 无效");
        }
        if (parentId != null && !parentId.isBlank()) {
            SystemOrganization parent = orgMapper.selectById(parentId);
            if (parent == null || !tenantId.equals(parent.getTenantId())) {
                throw new ApiException(400, "bad_request", "上级组织 ID 无效");
            }
        }
    }

    private SystemOrganization requireOwned(String id) {
        SystemOrganization org = orgMapper.selectById(id);
        if (org == null) {
            throw new ApiException(404, "not_found", "组织不存在");
        }
        guard.verifyTenantOwnership(org.getTenantId());
        return org;
    }

    private OrgTreeNode toNode(SystemOrganization org) {
        OrgTreeNode node = new OrgTreeNode();
        node.setId(org.getId());
        node.setTenantId(org.getTenantId());
        node.setName(org.getName());
        node.setTypeId(org.getTypeId());
        node.setParentId(org.getParentId());
        node.setSortOrder(org.getSortOrder());
        node.setMemberCount(org.getMemberCount());
        node.setCreatedAt(org.getCreatedAt());
        node.setUpdatedAt(org.getUpdatedAt());
        return node;
    }

    private int computeSubtreeCount(OrgTreeNode node) {
        int sum = node.getMemberCount() == null ? 0 : node.getMemberCount();
        if (node.getChildren() != null) {
            for (OrgTreeNode child : node.getChildren()) {
                sum += computeSubtreeCount(child);
            }
        }
        node.setMemberCount(sum);
        return sum;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
