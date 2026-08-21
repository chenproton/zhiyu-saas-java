package org.dromara.zhiyu.service.impl.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.affairs.AffairsBatch;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchPayload;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.mapper.affairs.AffairsBatchMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.affairs.IAffairsBatchService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 教务批次服务实现（对齐 Go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class AffairsBatchServiceImpl implements IAffairsBatchService {

    private final SystemGuard systemGuard;
    private final AffairsBatchMapper batchMapper;
    private final PortalMajorMapper majorMapper;

    @Override
    public ListResponse<AffairsBatchDto> list(String search, String orgNodeId, String status, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = clampLimit(limit);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<AffairsBatch> wrapper = QueryBuilder.lambda(AffairsBatch.class)
            .eq(AffairsBatch::getTenantId, tenantId)
            .likeIfText(AffairsBatch::getName, search)
            .eqIfText(AffairsBatch::getOrgNodeId, orgNodeId)
            .eqIfText(AffairsBatch::getStatus, status);
        long total = batchMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AffairsBatch::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<AffairsBatch> rows = batchMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows), total);
    }

    @Override
    public AffairsBatchDto get(String id) {
        return toDto(fetchOwnedAction(id));
    }

    @Override
    public AffairsBatchDto create(AffairsBatchPayload p) {
        String tenantId = systemGuard.requireTenant();
        if (p.getName() == null || p.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (p.getStatus() != null && !p.getStatus().isEmpty()
            && !"open".equals(p.getStatus()) && !"closed".equals(p.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        AffairsBatch batch = new AffairsBatch();
        batch.setTenantId(tenantId);
        batch.setName(p.getName());
        batch.setCode(emptyToNull(p.getCode()));
        batch.setOrgNodeId(emptyToNull(p.getOrgNodeId()));
        batch.setMajorId(emptyToNull(p.getMajorId()));
        batch.setWorkflowId(emptyToNull(p.getWorkflowId()));
        batch.setStatus("open");
        batchMapper.insert(batch);
        return toDto(fetchOwnedAction(batch.getId()));
    }

    @Override
    public AffairsBatchDto update(String id, AffairsBatchPayload p) {
        systemGuard.requireTenant();
        AffairsBatch batch = fetchOwnedAction(id);
        if (p.getName() == null || p.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (p.getStatus() != null && !p.getStatus().isEmpty()
            && !"open".equals(p.getStatus()) && !"closed".equals(p.getStatus())) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        batch.setName(p.getName());
        batch.setCode(emptyToNull(p.getCode()));
        batch.setOrgNodeId(emptyToNull(p.getOrgNodeId()));
        batch.setMajorId(emptyToNull(p.getMajorId()));
        batch.setWorkflowId(emptyToNull(p.getWorkflowId()));
        batchMapper.updateById(batch);
        return toDto(fetchOwnedAction(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        systemGuard.requireTenant();
        fetchOwnedAction(id);
        batchMapper.deleteById(id);
        return id;
    }

    @Override
    public AffairsBatchDto updateStatus(String id, String status) {
        systemGuard.requireTenant();
        fetchOwnedAction(id);
        if (!"open".equals(status) && !"closed".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        AffairsBatch batch = fetchOwnedAction(id);
        batch.setStatus(status);
        batchMapper.updateById(batch);
        return toDto(fetchOwnedAction(id));
    }

    // ---------- 组装 ----------

    private List<AffairsBatchDto> assembleList(List<AffairsBatch> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> majorIds = new LinkedHashSet<>();
        for (AffairsBatch b : rows) {
            if (b.getMajorId() != null) {
                majorIds.add(b.getMajorId());
            }
        }
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of() : majorMapper.selectList(
                QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(majorIds)).build())
            .stream().filter(m -> m.getName() != null)
            .collect(java.util.stream.Collectors.toMap(PortalMajor::getId, PortalMajor::getName, (a, b) -> a));
        List<AffairsBatchDto> items = new ArrayList<>(rows.size());
        for (AffairsBatch b : rows) {
            AffairsBatchDto dto = toDto(b);
            dto.setMajorName(b.getMajorId() == null ? null : majorNames.getOrDefault(b.getMajorId(), ""));
            items.add(dto);
        }
        return items;
    }

    private AffairsBatchDto toDto(AffairsBatch b) {
        AffairsBatchDto dto = new AffairsBatchDto();
        dto.setId(b.getId());
        dto.setTenantId(b.getTenantId());
        dto.setName(b.getName());
        dto.setCode(b.getCode());
        dto.setOrgNodeId(b.getOrgNodeId());
        dto.setMajorId(b.getMajorId());
        dto.setMajorName(b.getMajorName());
        dto.setWorkflowId(b.getWorkflowId());
        dto.setStatus(b.getStatus());
        dto.setProgramCount(b.getProgramCount());
        dto.setPublishedCount(b.getPublishedCount());
        dto.setPendingCount(b.getPendingCount());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
    }

    // ---------- 工具 ----------

    private AffairsBatch fetchOwnedAction(String id) {
        AffairsBatch batch = batchMapper.selectById(id);
        if (batch == null) {
            throw new ApiException(404, "not_found", "affairs batch不存在");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (batch.getTenantId() != null && !batch.getTenantId().equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
        return batch;
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 50;
        }
        return Math.min(limit, 200);
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

}
