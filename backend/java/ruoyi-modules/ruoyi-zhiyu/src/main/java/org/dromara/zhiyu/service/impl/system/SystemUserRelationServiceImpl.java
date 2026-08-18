package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRelationRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserRelationItem;
import org.dromara.zhiyu.mapper.system.SystemUserRelationMapper;
import org.dromara.zhiyu.service.system.ISystemUserRelationService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户关系服务实现（对齐 Go user_relation_handler.go + store/user_relations.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemUserRelationServiceImpl implements ISystemUserRelationService {

    private final SystemUserRelationMapper relationMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<UserRelationItem> list(String search, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        String kw = search == null ? "" : search;
        List<Map<String, Object>> rows = relationMapper.selectPage(tenantId, kw, safeLimit, safeOffset);
        long total = relationMapper.count(tenantId, kw);
        List<UserRelationItem> items = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            UserRelationItem item = new UserRelationItem();
            item.setId(str(row.get("id")));
            item.setInitiatorId(str(row.get("initiator_id")));
            item.setInitiatorName(str(row.get("initiator_name")));
            item.setInitiatorDept(str(row.get("initiator_dept")));
            item.setTargetId(str(row.get("target_id")));
            item.setTargetName(str(row.get("target_name")));
            item.setTargetDept(str(row.get("target_dept")));
            item.setRelationType(str(row.get("relation_type")));
            Object createdAt = row.get("created_at");
            if (createdAt instanceof OffsetDateTime odt) {
                item.setCreatedAt(odt);
            }
            items.add(item);
        }
        return ListResponse.of(items, total);
    }

    @Override
    public String create(CreateUserRelationRequest req) {
        String tenantId = guard.requireTenant();
        String userId = guard.requireUser();
        if (isBlank(req.getInitiatorId()) || isBlank(req.getTargetId()) || isBlank(req.getRelationType())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (req.getInitiatorId().equals(req.getTargetId())) {
            throw new ApiException(400, "bad_request", "发起者和目标不能是同一用户");
        }
        if (!req.getInitiatorId().equals(userId)) {
            throw new ApiException(403, "forbidden", "仅可发起与本人的用户关系");
        }
        int valid = relationMapper.countUsersInTenant(tenantId, List.of(req.getInitiatorId(), req.getTargetId()));
        if (valid != 2) {
            throw new ApiException(400, "bad_request", "发起者或目标不在租户中");
        }
        String id = UUID.randomUUID().toString();
        relationMapper.insertRelation(id, tenantId, req.getInitiatorId(), req.getTargetId(), req.getRelationType(),
            req.getDescription());
        return id;
    }

    @Override
    public String delete(String id) {
        String tenantId = guard.requireTenant();
        String userId = guard.requireUser();
        Map<String, Object> ids = relationMapper.selectIds(id, tenantId);
        if (ids == null || ids.isEmpty()) {
            throw new ApiException(404, "not_found", "用户关系不存在");
        }
        String initiatorId = str(ids.get("initiator_id"));
        String targetId = str(ids.get("target_id"));
        if (!userId.equals(initiatorId) && !userId.equals(targetId)) {
            throw new ApiException(403, "forbidden", "仅关系双方可删除该关系");
        }
        int deleted = relationMapper.deleteRelation(id, tenantId);
        if (deleted == 0) {
            throw new ApiException(404, "not_found", "用户关系不存在");
        }
        return id;
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
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
