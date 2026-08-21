package org.dromara.zhiyu.service.impl.portal;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorItem;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorUpsertRequest;
import org.dromara.zhiyu.domain.portal.PortalRole;
import org.dromara.zhiyu.domain.portal.PortalStudentHonor;
import org.dromara.zhiyu.domain.portal.PortalUserRole;
import org.dromara.zhiyu.mapper.portal.PortalRoleMapper;
import org.dromara.zhiyu.mapper.portal.PortalStudentHonorMapper;
import org.dromara.zhiyu.mapper.portal.PortalUserRoleMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.portal.IHonorService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 学生荣誉服务实现（对齐 Go student_honor_handler.go：学生本人限定 + 租户 SQL 级隔离）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class HonorServiceImpl implements IHonorService {

    private final SystemGuard systemGuard;
    private final PortalStudentHonorMapper honorMapper;
    private final PortalRoleMapper roleMapper;
    private final PortalUserRoleMapper userRoleMapper;

    @Override
    public ListResponse<HonorItem> list(String userId) {
        String currentUserId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        String targetUserId = userId;
        if (hasRole(currentUserId, tenantId, "student")) {
            targetUserId = currentUserId;
        }
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        List<PortalStudentHonor> rows = honorMapper.selectList(
            QueryBuilder.lambda(PortalStudentHonor.class)
                .eq(PortalStudentHonor::getTenantId, tenantId)
                .eq(PortalStudentHonor::getUserId, targetUserId)
                .orderByDesc(PortalStudentHonor::getCreatedAt)
                .orderByDesc(PortalStudentHonor::getId)
                .build());
        List<HonorItem> items = new ArrayList<>();
        for (PortalStudentHonor h : rows) {
            items.add(toItem(h));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public String create(HonorUpsertRequest req) {
        String currentUserId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        requireStudent(currentUserId, tenantId);
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "荣誉名称不能为空");
        }
        PortalStudentHonor honor = new PortalStudentHonor();
        honor.setTenantId(tenantId);
        honor.setUserId(currentUserId);
        honor.setName(req.getName());
        honor.setIssuer(nz(req.getIssuer()));
        honor.setHonorDate(nz(req.getHonorDate()));
        honor.setFileName(nz(req.getFileName()));
        honor.setFileUrl(nz(req.getFileUrl()));
        honorMapper.insert(honor);
        return honor.getId();
    }

    @Override
    public String update(String id, HonorUpsertRequest req) {
        String currentUserId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        requireStudent(currentUserId, tenantId);
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "荣誉名称不能为空");
        }
        PortalStudentHonor honor = new PortalStudentHonor();
        honor.setName(req.getName());
        honor.setIssuer(nz(req.getIssuer()));
        honor.setHonorDate(nz(req.getHonorDate()));
        honor.setFileName(nz(req.getFileName()));
        honor.setFileUrl(nz(req.getFileUrl()));
        // 租户 + 本人限定（对齐 Go UPDATE ... WHERE id AND tenant_id AND user_id）
        honorMapper.update(honor,
            QueryBuilder.lambda(PortalStudentHonor.class)
                .eq(PortalStudentHonor::getId, id)
                .eq(PortalStudentHonor::getTenantId, tenantId)
                .eq(PortalStudentHonor::getUserId, currentUserId)
                .build());
        return id;
    }

    @Override
    public String delete(String id) {
        String currentUserId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        requireStudent(currentUserId, tenantId);
        honorMapper.delete(
            QueryBuilder.lambda(PortalStudentHonor.class)
                .eq(PortalStudentHonor::getId, id)
                .eq(PortalStudentHonor::getTenantId, tenantId)
                .eq(PortalStudentHonor::getUserId, currentUserId)
                .build());
        return id;
    }

    private HonorItem toItem(PortalStudentHonor h) {
        HonorItem item = new HonorItem();
        item.setId(h.getId());
        item.setName(h.getName());
        item.setIssuer(h.getIssuer());
        item.setHonorDate(h.getHonorDate());
        item.setFileName(h.getFileName());
        item.setFileUrl(h.getFileUrl());
        return item;
    }

    private void requireStudent(String userId, String tenantId) {
        if (!hasRole(userId, tenantId, "student")) {
            throw new ApiException(403, "forbidden", "仅学生可配置荣誉");
        }
    }

    /** 当前用户是否绑定指定角色码（对齐 Go middleware.HasRole） */
    private boolean hasRole(String userId, String tenantId, String code) {
        List<PortalUserRole> userRoles = userRoleMapper.selectList(
            QueryBuilder.lambda(PortalUserRole.class).eq(PortalUserRole::getUserId, userId).build());
        if (userRoles.isEmpty()) {
            return false;
        }
        List<String> roleIds = userRoles.stream().map(PortalUserRole::getRoleId).distinct().toList();
        return roleMapper.selectList(
                QueryBuilder.lambda(PortalRole.class)
                    .in(PortalRole::getId, roleIds)
                    .eq(PortalRole::getTenantId, tenantId)
                    .build())
            .stream()
            .anyMatch(r -> code.equals(r.getCode()));
    }

    private String nz(String s) {
        return s == null ? "" : s;
    }
}
