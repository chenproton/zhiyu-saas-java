package org.dromara.zhiyu.service.impl.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.EvaluationBatchDto;
import org.dromara.zhiyu.domain.evaluation.EvaluationBatch;
import org.dromara.zhiyu.mapper.evaluation.EvaluationBatchMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationBatchService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 评价批次服务实现（对齐 Go BatchHandler + store.NewEvaluationBatchTableConfig 语义：
 * evaluation_batches 表，状态 open/closed）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class EvaluationBatchServiceImpl implements IEvaluationBatchService {

    private final EvaluationBatchMapper batchMapper;

    @Override
    public ListResponse<EvaluationBatchDto> list(String orgNodeId, String status, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationBatch> wrapper = QueryBuilder.lambda(EvaluationBatch.class)
            .eq(EvaluationBatch::getTenantId, tenantId);
        if (orgNodeId != null && !orgNodeId.isBlank()) {
            wrapper.eq(EvaluationBatch::getOrgNodeId, orgNodeId);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(EvaluationBatch::getStatus, status);
        }
        if (search != null && !search.isBlank()) {
            wrapper.apply("name LIKE {0} ESCAPE '\\'", toLikePattern(search));
        }
        long total = batchMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationBatch::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationBatch> rows = batchMapper.selectList(wrapper.build());
        return ListResponse.of(assemble(rows), total);
    }

    @Override
    public EvaluationBatchDto get(String id) {
        requireUser();
        EvaluationBatch batch = fetchBatch(id);
        Map<String, String> majorNames = majorNameMap(batch.getMajorId() == null ? List.of() : List.of(batch.getMajorId()));
        EvaluationBatchDto dto = toDto(batch);
        dto.setMajorName(batch.getMajorId() == null ? null : majorNames.get(batch.getMajorId()));
        return dto;
    }

    @Override
    public EvaluationBatchDto create(BatchRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty() && !"open".equals(req.getStatus())
            && !"closed".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        String id = UUID.randomUUID().toString();
        String status = req.getStatus() == null || req.getStatus().isEmpty() ? "open" : req.getStatus();
        batchMapper.insertBatch(id, tenantId, req.getName(), emptyToNull(req.getCode()),
            emptyToNull(req.getOrgNodeId()), emptyToNull(req.getMajorId()), emptyToNull(req.getWorkflowId()), status);
        EvaluationBatch batch = fetchBatch(id);
        EvaluationBatchDto dto = toDto(batch);
        Map<String, String> majorNames = majorNameMap(batch.getMajorId() == null ? List.of() : List.of(batch.getMajorId()));
        dto.setMajorName(batch.getMajorId() == null ? null : majorNames.get(batch.getMajorId()));
        return dto;
    }

    @Override
    public EvaluationBatchDto update(String id, BatchRequest req) {
        requireUser();
        EvaluationBatch existing = fetchBatch(id);
        String tenantId = requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty() && !"open".equals(req.getStatus())
            && !"closed".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batchMapper.updateBatch(id, tenantId, req.getName(), emptyToNull(req.getCode()),
            emptyToNull(req.getOrgNodeId()), emptyToNull(req.getMajorId()), emptyToNull(req.getWorkflowId()));
        if (req.getStatus() != null && !req.getStatus().isEmpty()) {
            batchMapper.updateStatus(id, tenantId, req.getStatus());
        }
        EvaluationBatch batch = fetchBatch(id);
        EvaluationBatchDto dto = toDto(batch);
        Map<String, String> majorNames = majorNameMap(batch.getMajorId() == null ? List.of() : List.of(batch.getMajorId()));
        dto.setMajorName(batch.getMajorId() == null ? null : majorNames.get(batch.getMajorId()));
        return dto;
    }

    @Override
    public String delete(String id) {
        requireUser();
        fetchBatch(id);
        String tenantId = requireTenant();
        batchMapper.delete(QueryBuilder.lambda(EvaluationBatch.class)
            .eq(EvaluationBatch::getId, id).eq(EvaluationBatch::getTenantId, tenantId).build());
        return id;
    }

    @Override
    public EvaluationBatchDto updateStatus(String id, String status) {
        requireUser();
        fetchBatch(id);
        String tenantId = requireTenant();
        if (!"open".equals(status) && !"closed".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batchMapper.updateStatus(id, tenantId, status);
        EvaluationBatch batch = fetchBatch(id);
        EvaluationBatchDto dto = toDto(batch);
        Map<String, String> majorNames = majorNameMap(batch.getMajorId() == null ? List.of() : List.of(batch.getMajorId()));
        dto.setMajorName(batch.getMajorId() == null ? null : majorNames.get(batch.getMajorId()));
        return dto;
    }

    // ==================== 组装 ====================

    private List<EvaluationBatchDto> assemble(List<EvaluationBatch> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> majorIds = new LinkedHashSet<>();
        for (EvaluationBatch b : rows) {
            if (b.getMajorId() != null) {
                majorIds.add(b.getMajorId());
            }
        }
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of()
            : majorNameMap(new ArrayList<>(majorIds));
        List<EvaluationBatchDto> items = new ArrayList<>(rows.size());
        for (EvaluationBatch b : rows) {
            EvaluationBatchDto dto = toDto(b);
            dto.setMajorName(b.getMajorId() == null ? null : majorNames.get(b.getMajorId()));
            items.add(dto);
        }
        return items;
    }

    private Map<String, String> majorNameMap(List<String> ids) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Map<String, Object> row : batchMapper.selectMajorNames(ids)) {
            Object v = row.get("name");
            map.put(String.valueOf(row.get("id")), v == null ? "" : String.valueOf(v));
        }
        return map;
    }

    private EvaluationBatchDto toDto(EvaluationBatch b) {
        EvaluationBatchDto dto = new EvaluationBatchDto();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        dto.setOrgNodeId(b.getOrgNodeId());
        dto.setMajorId(b.getMajorId());
        dto.setWorkflowId(b.getWorkflowId());
        dto.setStatus(b.getStatus());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
    }

    private EvaluationBatch fetchBatch(String id) {
        String tenantId = requireTenant();
        EvaluationBatch batch = batchMapper.selectOne(QueryBuilder.lambda(EvaluationBatch.class)
            .eq(EvaluationBatch::getId, id).eq(EvaluationBatch::getTenantId, tenantId).build());
        if (batch == null) {
            throw new ApiException(404, "not_found", "评价批次不存在");
        }
        return batch;
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

    private String toLikePattern(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
