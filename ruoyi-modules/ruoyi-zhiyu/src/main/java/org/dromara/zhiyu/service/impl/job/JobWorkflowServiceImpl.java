package org.dromara.zhiyu.service.impl.job;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.util.ZhiyuStringUtils;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowRequest;
import org.dromara.zhiyu.domain.job.JobWorkflow;
import org.dromara.zhiyu.mapper.job.JobWorkflowMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.job.IJobWorkflowService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 审批流程服务实现（对齐 Go workflow_handler.go + store/workflows.go 语义）。
 *
 * <p>流程必须绑定学校（无租户直接拒绝）；steps/majorIds 为 jsonb 列（实体存原始 JSON 文本，
 * Service 层转换 List 语义）；删除前检查待审批单；更新部分字段回退现有值。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobWorkflowServiceImpl implements IJobWorkflowService {

    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };

    private final SystemGuard systemGuard;
    private final JobWorkflowMapper workflowMapper;

    @Override
    public ListResponse<WorkflowDto> list(String ids, String search, long limit, long offset) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobWorkflow> wrapper = QueryBuilder.lambda(JobWorkflow.class)
            .eq(JobWorkflow::getTenantId, tenantId);
        if (ids != null && !ids.isEmpty()) {
            // 前端以逗号拼接多个 id（use-approvals）
            List<String> parts = Arrays.stream(ids.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (!parts.isEmpty()) {
                wrapper.in(JobWorkflow::getId, parts);
            }
        }
        if (search != null && !search.isEmpty()) {
            wrapper.like(JobWorkflow::getName, search);
        }
        long total = workflowMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobWorkflow::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobWorkflow> rows = workflowMapper.selectList(wrapper.build());
        List<WorkflowDto> items = new ArrayList<>(rows.size());
        for (JobWorkflow w : rows) {
            items.add(toDto(w));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public WorkflowDto get(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobWorkflow wf = workflowMapper.selectWorkflowById(id, tenantId);
        if (wf == null) {
            throw new ApiException(404, "not_found", "审批流程不存在");
        }
        return toDto(wf);
    }

    @Override
    public WorkflowDto create(WorkflowRequest req) {
        // 审批流程必须绑定学校（方案 B：不支持全局流程）；无租户直接拒绝
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        JobWorkflow wf = new JobWorkflow();
        wf.setTenantId(tenantId);
        wf.setName(req.getName());
        wf.setScene(ZhiyuStringUtils.blankToNull(req.getScene()));
        wf.setDescription(ZhiyuStringUtils.blankToNull(req.getDescription()));
        wf.setSteps(ZhiyuJsonUtils.toJson(req.getSteps(), "[]"));
        wf.setMajorIds(toJsonStrings(req.getMajorIds()));
        wf.setUsageCount(0);
        wf.setStatus("active");
        workflowMapper.insert(wf);
        JobWorkflow saved = workflowMapper.selectWorkflowById(wf.getId(), tenantId);
        return toDto(saved);
    }

    @Override
    public WorkflowDto update(String id, WorkflowRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobWorkflow existing = workflowMapper.selectWorkflowById(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "审批流程不存在");
        }
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String status = req.getStatus() == null || req.getStatus().isEmpty() ? existing.getStatus() : req.getStatus();
        if (!"active".equals(status) && !"inactive".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        // 部分更新兜底：未携带的列表字段回退现有值，防止清空已配置步骤/适用专业
        String steps = req.getSteps() != null ? ZhiyuJsonUtils.toJson(req.getSteps(), "[]") : existing.getSteps();
        String majorIds = req.getMajorIds() != null ? toJsonStrings(req.getMajorIds()) : existing.getMajorIds();
        String name = req.getName();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String scene = req.getScene() != null ? req.getScene() : existing.getScene();
        workflowMapper.updateWorkflow(id, tenantId, name, ZhiyuStringUtils.blankToNull(scene), ZhiyuStringUtils.blankToNull(description),
            steps, majorIds, status);
        JobWorkflow saved = workflowMapper.selectWorkflowById(id, tenantId);
        return toDto(saved);
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobWorkflow existing = workflowMapper.selectWorkflowById(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "审批流程不存在");
        }
        if (workflowMapper.existsPendingApprovals(id)) {
            throw new ApiException(409, "conflict", "该审批流程仍有待处理的审批单，无法删除");
        }
        workflowMapper.deleteWorkflow(id, tenantId);
        return id;
    }

    // ---------- 工具 ----------

    private WorkflowDto toDto(JobWorkflow w) {
        WorkflowDto dto = new WorkflowDto();
        dto.setId(w.getId());
        dto.setTenantId(w.getTenantId());
        dto.setName(w.getName());
        dto.setScene(w.getScene());
        dto.setDescription(w.getDescription());
        dto.setSteps(parseList(w.getSteps()));
        dto.setMajorIds(parseStrings(w.getMajorIds()));
        dto.setUsageCount(w.getUsageCount());
        dto.setStatus(w.getStatus());
        dto.setCreatedAt(w.getCreatedAt());
        return dto;
    }

    private String toJsonStrings(List<String> ids) {
        if (ids == null) {
            return "[]";
        }
        try {
            return ZhiyuJsonUtils.MAPPER.writeValueAsString(ids);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<Object> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            Object v = ZhiyuJsonUtils.MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : (List<Object>) v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<String> parseStrings(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = ZhiyuJsonUtils.MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

}
