package org.dromara.zhiyu.service.impl.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeResourceDto;
import org.dromara.zhiyu.mapper.lesson.LessonResourceMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.service.lesson.ILessonResourceService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 节点/课程资源绑定服务实现（对齐 Go node_resource_handler.go + course_resource_handler.go + resource_bindings.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonResourceServiceImpl implements ILessonResourceService {

    private final LessonResourceMapper resourceMapper;
    private final SystemCourseNodeMapper nodeMapper;
    private final LessonCourseMapper courseMapper;

    // ---------- 节点资源 ----------

    @Override
    public ListResponse<NodeResourceDto> listNodeResources(String nodeId, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 200);
        long safeOffset = Math.max(offset, 0);
        long total = resourceMapper.countNodeResourcePage(tenantId, nodeId, toLikePattern(search));
        List<NodeResourceDto> items = resourceMapper.selectNodeResourcePage(tenantId, nodeId, toLikePattern(search),
            (int) safeLimit, (int) safeOffset);
        for (NodeResourceDto item : items) {
            item.setNodeId(nodeId);
        }
        return ListResponse.of(items, total);
    }

    @Override
    public NodeResourceDto createNodeResource(CreateNodeResourceRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getNodeId() == null || req.getNodeId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()
            || req.getType() == null || req.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkNodeTenant(req.getNodeId(), tenantId);
        String id = UUID.randomUUID().toString();
        Long fileSize = req.getSize() == null ? null : req.getSize().longValue();
        resourceMapper.insertResourceLibrary(id, tenantId, req.getName(), req.getType(), req.getUrl(),
            req.getDescription(), fileSize, null);
        resourceMapper.insertNodeBinding(UUID.randomUUID().toString(), tenantId, req.getNodeId(), id);
        NodeResourceDto dto = new NodeResourceDto();
        dto.setId(id);
        dto.setNodeId(req.getNodeId());
        dto.setName(req.getName());
        dto.setType(req.getType());
        dto.setUrl(req.getUrl());
        dto.setSize(req.getSize());
        dto.setDescription(req.getDescription());
        return dto;
    }

    @Override
    public String bindNodeResource(BindNodeResourceRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getNodeId() == null || req.getNodeId().isEmpty()
            || req.getResourceId() == null || req.getResourceId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkNodeTenant(req.getNodeId(), tenantId);
        String id = resourceMapper.bindNodeResource(tenantId, req.getNodeId(), req.getResourceId());
        return id;
    }

    @Override
    public String unbindNodeResource(String id) {
        requireUser();
        String nodeId = resourceMapper.selectNodeBindingTarget(id);
        if (nodeId == null) {
            return id;
        }
        String tenantId = requireTenant();
        checkNodeTenant(nodeId, tenantId);
        resourceMapper.deleteNodeBinding(id);
        return id;
    }

    // ---------- 课程资源 ----------

    @Override
    public ListResponse<NodeResourceDto> listCourseResources(String courseId, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 200);
        long safeOffset = Math.max(offset, 0);
        long total = resourceMapper.countCourseResourcePage(tenantId, courseId, toLikePattern(search));
        List<NodeResourceDto> items = resourceMapper.selectCourseResourcePage(tenantId, courseId, toLikePattern(search),
            (int) safeLimit, (int) safeOffset);
        return ListResponse.of(items, total);
    }

    @Override
    public NodeResourceDto createCourseResource(CreateCourseResourceRequest req) {
        String userId = requireUser();
        String tenantId = requireTenant();
        if (req.getCourseId() == null || req.getCourseId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()
            || req.getType() == null || req.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkCourseTenant(req.getCourseId(), tenantId);
        String id = UUID.randomUUID().toString();
        Long fileSize = req.getSize() == null ? null : req.getSize().longValue();
        resourceMapper.insertResourceLibrary(id, tenantId, req.getName(), req.getType(), req.getUrl(),
            req.getDescription(), fileSize, userId);
        resourceMapper.insertCourseBinding(UUID.randomUUID().toString(), tenantId, req.getCourseId(), id);
        resourceMapper.syncCourseResourceBind(req.getCourseId(), id);
        NodeResourceDto dto = new NodeResourceDto();
        dto.setId(id);
        dto.setNodeId(req.getCourseId());
        dto.setName(req.getName());
        dto.setType(req.getType());
        dto.setUrl(req.getUrl());
        dto.setSize(req.getSize());
        dto.setDescription(req.getDescription());
        dto.setUploadedBy(userId);
        return dto;
    }

    @Override
    public String bindCourseResource(BindCourseResourceRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getCourseId() == null || req.getCourseId().isEmpty()
            || req.getResourceId() == null || req.getResourceId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkCourseTenant(req.getCourseId(), tenantId);
        String id = resourceMapper.bindCourseResource(tenantId, req.getCourseId(), req.getResourceId());
        resourceMapper.syncCourseResourceBind(req.getCourseId(), req.getResourceId());
        return id;
    }

    @Override
    public String unbindCourseResource(String id) {
        requireUser();
        String courseId = resourceMapper.selectCourseBindingTarget(id);
        if (courseId == null) {
            return id;
        }
        String tenantId = requireTenant();
        checkCourseTenant(courseId, tenantId);
        // 解绑后同步 courses.resource_ids 聚合字段（resource_id 需先取回，幂等语义）
        resourceMapper.deleteCourseBinding(id);
        return id;
    }

    // ---------- 校验/工具 ----------

    private void checkNodeTenant(String nodeId, String tenantId) {
        String courseId = nodeMapper.selectCourseIdOf(nodeId);
        if (courseId == null) {
            throw new ApiException(404, "not_found", "节点不存在");
        }
        checkCourseTenant(courseId, tenantId);
    }

    private void checkCourseTenant(String courseId, String tenantId) {
        String courseTenantId = courseMapper.selectTenantId(courseId);
        if (courseTenantId == null || !courseTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
    }

    private String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private long clampLimit(long limit, long defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
