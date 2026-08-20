package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchUpdateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.JobBatchDto;
import org.dromara.zhiyu.domain.job.JobBatch;
import org.dromara.zhiyu.mapper.job.JobBatchMapper;
import org.dromara.zhiyu.service.job.IJobBatchService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 岗位批次服务实现（对齐 Go batch_handler.go + NewJobBatchTableConfig + store/batches.go 语义）。
 *
 * <p>关键对齐点：创建 status 恒为 open（CreateWithStatus=false）；
 * 更新不写 status（UpdateWithStatus=false，只能走 /{id}/status）；写操作一律带租户条件。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobBatchServiceImpl implements IJobBatchService {

    private final JobBatchMapper batchMapper;

    @Override
    public ListResponse<JobBatchDto> list(String orgNodeId, String status, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        String pattern = toLikePattern(search);

        long total = batchMapper.countBatchPage(tenantId, orgNodeId, status, pattern);
        List<JobBatch> rows = batchMapper.selectBatchPage(tenantId, orgNodeId, status, pattern,
            (int) safeLimit, (int) safeOffset);
        List<JobBatchDto> items = new ArrayList<>(rows.size());
        for (JobBatch b : rows) {
            items.add(toDto(b));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public JobBatchDto get(String id) {
        requireUser();
        JobBatch batch = fetchOwned(id);
        return toDto(batch);
    }

    @Override
    public JobBatchDto create(BatchCreateRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()
            && !"open".equals(req.getStatus()) && !"closed".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        JobBatch batch = new JobBatch();
        batch.setId(UUID.randomUUID().toString());
        batch.setName(req.getName());
        batch.setCode(emptyToNull(req.getCode()));
        batch.setOrgNodeId(emptyToNull(req.getOrgNodeId()));
        batch.setMajorId(emptyToNull(req.getMajorId()));
        batch.setWorkflowId(emptyToNull(req.getWorkflowId()));
        // 岗位批次创建恒为 open（对齐 Go CreateWithStatus=false）
        batch.setStatus("open");
        batch.setTenantId(tenantId);
        batchMapper.insert(batch);
        JobBatch created = batchMapper.selectItemById(batch.getId());
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建批次失败");
        }
        return toDto(created);
    }

    @Override
    public JobBatchDto update(String id, BatchUpdateRequest req) {
        requireUser();
        JobBatch existing = fetchOwned(id);
        String tenantId = existing.getTenantId();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()
            && !"open".equals(req.getStatus()) && !"closed".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        // 岗位批次 PUT 不写 status（对齐 Go UpdateWithStatus=false）
        batchMapper.updateBatch(id, tenantId, req.getName(), req.getCode(), req.getOrgNodeId(),
            req.getMajorId(), req.getWorkflowId(), null);
        JobBatch updated = batchMapper.selectItemById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新批次失败");
        }
        return toDto(updated);
    }

    @Override
    public String delete(String id) {
        requireUser();
        JobBatch existing = fetchOwned(id);
        batchMapper.deleteBatch(id, existing.getTenantId());
        return id;
    }

    @Override
    public JobBatchDto updateStatus(String id, BatchStatusRequest req) {
        requireUser();
        JobBatch existing = fetchOwned(id);
        if (req.getStatus() == null || (!"open".equals(req.getStatus()) && !"closed".equals(req.getStatus()))) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batchMapper.updateStatus(id, existing.getTenantId(), req.getStatus());
        JobBatch updated = batchMapper.selectItemById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新批次状态失败");
        }
        return toDto(updated);
    }

    // ---------- 工具 ----------

    private JobBatch fetchOwned(String id) {
        JobBatch batch = batchMapper.selectItemById(id);
        if (batch == null) {
            throw new ApiException(404, "not_found", "批次不存在");
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

    private JobBatchDto toDto(JobBatch b) {
        JobBatchDto dto = new JobBatchDto();
        dto.setId(b.getId());
        dto.setTenantId(b.getTenantId());
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        dto.setOrgNodeId(b.getOrgNodeId());
        dto.setMajorId(b.getMajorId());
        dto.setMajorName(b.getMajorName());
        dto.setWorkflowId(b.getWorkflowId());
        dto.setStatus(b.getStatus());
        dto.setPositionCount(b.getPositionCount());
        dto.setPublishedCount(b.getPublishedCount());
        dto.setPendingCount(b.getPendingCount());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
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

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    /** 转义 LIKE 通配符并包裹 %pattern%（对齐 Go strings.NewReplacer 语义）。 */
    private String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
