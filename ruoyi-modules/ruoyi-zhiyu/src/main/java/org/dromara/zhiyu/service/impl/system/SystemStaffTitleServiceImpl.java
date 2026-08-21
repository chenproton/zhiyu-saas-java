package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemStaffTitle;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.StaffTitleRequest;
import org.dromara.zhiyu.mapper.system.SystemStaffTitleMapper;
import org.dromara.zhiyu.service.system.ISystemStaffTitleService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 职称服务实现（对齐 Go staff_title_handler.go + store/staff_titles.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemStaffTitleServiceImpl implements ISystemStaffTitleService {

    private final SystemStaffTitleMapper titleMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemStaffTitle> list(String search, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = guard.clampLimit(limit, 50);
        LambdaQueryBuilder<SystemStaffTitle> wrapper = QueryBuilder.lambda(SystemStaffTitle.class)
            .eq(SystemStaffTitle::getTenantId, tenantId);
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(SystemStaffTitle::getName, search).or().like(SystemStaffTitle::getCode, search));
        }
        long total = titleMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemStaffTitle::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemStaffTitle> items = titleMapper.selectList(wrapper.build());
        if (!items.isEmpty()) {
            List<String> ids = items.stream().map(SystemStaffTitle::getId).toList();
            Map<String, Integer> counts = titleMapper.batchCountUsersByTitle(tenantId, ids).stream()
                .collect(java.util.stream.Collectors.toMap(
                    m -> String.valueOf(m.get("title_id")),
                    m -> ((Number) m.get("count")).intValue()));
            items.forEach(t -> t.setUserCount(counts.getOrDefault(t.getId(), 0)));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public SystemStaffTitle get(String id) {
        SystemStaffTitle title = titleMapper.selectById(id);
        if (title == null) {
            throw new ApiException(404, "not_found", "职称不存在");
        }
        guard.verifyTenantOwnership(title.getTenantId());
        title.setUserCount(titleMapper.countUserRefs(title.getTenantId(), title.getId()));
        return title;
    }

    @Override
    public SystemStaffTitle create(StaffTitleRequest req) {
        guard.requireManageUsers();
        if (isBlank(req.getTenantId()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        if (isBlank(req.getStatus())) {
            req.setStatus("active");
        }
        if (!"active".equals(req.getStatus()) && !"inactive".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        String code = isBlank(req.getCode()) ? codeFromName(req.getName()) : req.getCode();
        String id = UUID.randomUUID().toString();
        titleMapper.insertTitle(id, req.getTenantId(), code, req.getName(), req.getDescription(), req.getStatus());
        return titleMapper.selectById(id);
    }

    @Override
    public SystemStaffTitle update(String id, StaffTitleRequest req) {
        guard.requireManageUsers();
        SystemStaffTitle existing = requireOwned(id);
        if (isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (!isBlank(req.getStatus()) && !"active".equals(req.getStatus()) && !"inactive".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        titleMapper.updateTitle(id, req.getName(), req.getDescription(), req.getStatus());
        SystemStaffTitle updated = titleMapper.selectById(id);
        updated.setUserCount(titleMapper.countUserRefs(existing.getTenantId(), id));
        return updated;
    }

    @Override
    public String delete(String id) {
        guard.requireManageUsers();
        SystemStaffTitle existing = requireOwned(id);
        int refs = titleMapper.countUserRefs(existing.getTenantId(), id);
        if (refs > 0) {
            throw new ApiException(409, "conflict", "该职位仍有用户关联，不可删除");
        }
        titleMapper.deleteTitle(id);
        return id;
    }

    @Override
    public SystemStaffTitle toggleStatus(String id, String status) {
        guard.requireManageUsers();
        SystemStaffTitle existing = requireOwned(id);
        if (!"active".equals(status) && !"inactive".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        titleMapper.updateStatus(id, existing.getTenantId(), status);
        SystemStaffTitle updated = titleMapper.selectById(id);
        updated.setUserCount(titleMapper.countUserRefs(existing.getTenantId(), id));
        return updated;
    }

    private SystemStaffTitle requireOwned(String id) {
        SystemStaffTitle title = titleMapper.selectById(id);
        if (title == null) {
            throw new ApiException(404, "not_found", "职称不存在");
        }
        guard.verifyTenantOwnership(title.getTenantId());
        return title;
    }

    private String codeFromName(String name) {
        StringBuilder sb = new StringBuilder();
        for (char c : name.toCharArray()) {
            if (Character.isLetterOrDigit(c)) {
                sb.append(Character.toLowerCase(c));
            } else if (!sb.isEmpty() && sb.charAt(sb.length() - 1) != '_') {
                sb.append('_');
            }
        }
        String code = sb.toString().replaceAll("^_+|_+$", "");
        return code.isEmpty() ? "title" : code;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
