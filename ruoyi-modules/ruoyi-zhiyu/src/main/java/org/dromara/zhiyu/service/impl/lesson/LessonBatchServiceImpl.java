package org.dromara.zhiyu.service.impl.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchUpdateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.LessonBatchDto;
import org.dromara.zhiyu.domain.portal.PortalLessonBatch;
import org.dromara.zhiyu.mapper.portal.PortalLessonBatchMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.lesson.ILessonBatchService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 课程批次服务实现（对齐 Go batch_handler.go + store/batch_configs.go NewCourseBatchTableConfig 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonBatchServiceImpl implements ILessonBatchService {

    private final SystemGuard systemGuard;
    private final PortalLessonBatchMapper batchMapper;

    @Override
    public ListResponse<LessonBatchDto> list(String orgNodeId, String status, String majorId, String search,
                                             long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 20);
        long safeOffset = Math.max(offset, 0);
        long total = batchMapper.countBatchPage(tenantId, orgNodeId, status, majorId, toLikePattern(search));
        List<PortalLessonBatch> rows = batchMapper.selectBatchPage(tenantId, orgNodeId, status, majorId,
            toLikePattern(search), (int) safeLimit, (int) safeOffset);
        return ListResponse.of(rows.stream().map(this::toDto).toList(), total);
    }

    @Override
    public LessonBatchDto get(String id) {
        systemGuard.requireUser();
        return toDto(fetchOwned(id));
    }

    @Override
    public LessonBatchDto create(BatchCreateRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String status = req.getStatus();
        if (status != null && !status.isEmpty() && !"open".equals(status) && !"closed".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        if (status == null || status.isEmpty()) {
            status = "open";
        }
        String id = UUID.randomUUID().toString();
        batchMapper.insertBatch(id, tenantId, req.getName(), req.getCode(), req.getOrgNodeId(), req.getMajorId(),
            req.getWorkflowId(), status);
        return toDto(fetchOwned(id));
    }

    @Override
    public LessonBatchDto update(String id, BatchUpdateRequest req) {
        systemGuard.requireUser();
        PortalLessonBatch existing = fetchOwned(id);
        String tenantId = existing.getTenantId();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String status = req.getStatus();
        if (status != null && !status.isEmpty() && !"open".equals(status) && !"closed".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batchMapper.updateBatch(id, tenantId, req.getName(), req.getCode(), req.getOrgNodeId(), req.getMajorId(),
            req.getWorkflowId(), status);
        return toDto(fetchOwned(id));
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        PortalLessonBatch existing = fetchOwned(id);
        batchMapper.deleteBatch(id, existing.getTenantId());
        return id;
    }

    @Override
    public LessonBatchDto updateStatus(String id, BatchStatusRequest req) {
        systemGuard.requireUser();
        PortalLessonBatch existing = fetchOwned(id);
        if (req.getStatus() == null || (!"open".equals(req.getStatus()) && !"closed".equals(req.getStatus()))) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batchMapper.updateStatus(id, existing.getTenantId(), req.getStatus());
        return toDto(fetchOwned(id));
    }

    private LessonBatchDto toDto(PortalLessonBatch b) {
        LessonBatchDto dto = new LessonBatchDto();
        dto.setId(b.getId());
        dto.setTenantId(b.getTenantId());
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        dto.setOrgNodeId(b.getOrgNodeId());
        dto.setMajorId(b.getMajorId());
        dto.setMajorName(b.getMajorName());
        dto.setWorkflowId(b.getWorkflowId());
        dto.setStatus(b.getStatus());
        dto.setCourseCount(b.getCourseCount());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
    }

    private PortalLessonBatch fetchOwned(String id) {
        PortalLessonBatch batch = batchMapper.selectById(id);
        if (batch == null) {
            throw new ApiException(404, "not_found", "batch不存在");
        }
        verifyTenantOwnership(batch.getTenantId());
        return batch;
    }

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

}
