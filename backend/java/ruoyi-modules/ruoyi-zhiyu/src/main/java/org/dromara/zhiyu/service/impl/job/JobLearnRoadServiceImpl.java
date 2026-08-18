package org.dromara.zhiyu.service.impl.job;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadRequest;
import org.dromara.zhiyu.domain.job.JobLearnRoad;
import org.dromara.zhiyu.mapper.job.JobLearnRoadMapper;
import org.dromara.zhiyu.service.job.IJobLearnRoadService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 学习路径服务实现（对齐 Go learn_road_handler.go + store/learn_roads.go 语义）。
 *
 * <p>steps 为 jsonb 数组列（步骤对象数组），实体保存原始 JSON 文本，
 * Service 层在请求 List&lt;Object&gt; 与 JSON 文本之间转换（对齐 Go JSONSlice）。
 * 部分更新语义：未携带字段回填现有值，避免清空。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobLearnRoadServiceImpl implements IJobLearnRoadService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };

    private final JobLearnRoadMapper learnRoadMapper;

    @Override
    public ListResponse<LearnRoadDto> list(String name, long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobLearnRoad> wrapper = QueryBuilder.lambda(JobLearnRoad.class)
            .eq(JobLearnRoad::getTenantId, tenantId);
        if (name != null && !name.isEmpty()) {
            wrapper.like(JobLearnRoad::getName, name);
        }
        long total = learnRoadMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobLearnRoad::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobLearnRoad> rows = learnRoadMapper.selectList(wrapper.build());
        List<LearnRoadDto> items = new ArrayList<>(rows.size());
        for (JobLearnRoad r : rows) {
            items.add(toDto(r));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public LearnRoadDto get(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobLearnRoad road = fetchOwned(id, tenantId);
        return toDto(road);
    }

    @Override
    public LearnRoadDto create(LearnRoadRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        JobLearnRoad road = new JobLearnRoad();
        road.setTenantId(tenantId);
        road.setName(req.getName());
        road.setDescription(blankToNull(req.getDescription()));
        road.setPositionIds(coalesce(req.getPositionIds()));
        road.setSteps(toJson(req.getSteps()));
        learnRoadMapper.insert(road);
        return toDto(road);
    }

    @Override
    public LearnRoadDto update(String id, LearnRoadRequest req) {
        requireUser();
        String tenantId = requireTenant();
        JobLearnRoad existing = fetchOwned(id, tenantId);
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 部分更新：未传的字段回填现有值，避免清空
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        List<String> positionIds = req.getPositionIds() != null ? req.getPositionIds() : existing.getPositionIds();
        String steps = req.getSteps() != null ? toJson(req.getSteps()) : existing.getSteps();
        learnRoadMapper.updateLearnRoad(id, tenantId, req.getName(), blankToNull(description), positionIds, steps);
        JobLearnRoad updated = fetchOwned(id, tenantId);
        return toDto(updated);
    }

    @Override
    public String delete(String id) {
        requireUser();
        String tenantId = requireTenant();
        fetchOwned(id, tenantId);
        learnRoadMapper.deleteLearnRoad(id, tenantId);
        return id;
    }

    // ---------- 工具 ----------

    private JobLearnRoad fetchOwned(String id, String tenantId) {
        JobLearnRoad road = learnRoadMapper.selectById(id);
        if (road == null) {
            throw new ApiException(404, "not_found", "学习路径不存在");
        }
        if (road.getTenantId() != null && !road.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "学习路径不存在");
        }
        return road;
    }

    private LearnRoadDto toDto(JobLearnRoad r) {
        LearnRoadDto dto = new LearnRoadDto();
        dto.setId(r.getId());
        dto.setName(r.getName());
        dto.setDescription(r.getDescription());
        dto.setPositionIds(r.getPositionIds());
        dto.setSteps(parseList(r.getSteps()));
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }

    private String toJson(List<Object> steps) {
        if (steps == null) {
            return "[]";
        }
        try {
            return MAPPER.writeValueAsString(steps);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<Object> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            Object v = MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : (List<Object>) v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
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

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }
}
