package org.dromara.zhiyu.service.impl.job;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalRecordDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalReviewRequest;
import org.dromara.zhiyu.domain.job.JobApprovalRecord;
import org.dromara.zhiyu.domain.job.JobWorkflow;
import org.dromara.zhiyu.mapper.job.JobApprovalMapper;
import org.dromara.zhiyu.mapper.job.JobWorkflowMapper;
import org.dromara.zhiyu.mapper.partner.PartnerSourceMergeMapper;
import org.dromara.zhiyu.service.job.IJobApprovalService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 审批记录服务实现（对齐 Go approval_handler.go + service/approval.go + store/approvals.go 语义）。
 *
 * <p>评审流程（演示环境按 Go 语义简化引擎、数据状态一致）：</p>
 * <ul>
 *   <li>创建：目标类型白名单校验 + 同一目标仅一条 pending（唯一索引兜底），冲突 409；</li>
 *   <li>评审：校验记录租户归属 → pending 状态 → 评审人权限（工作流步骤 approverIds，
 *       无工作流视为单步任意审批）→ 追加历史（同评审人同步骤去重）→ 决策：
 *       rejected 直接终态；approved 按 approvalMode（any/all）判断步骤完成，
 *       最后一步通过 → approved，否则推进 current_step_idx+1；</li>
 *   <li>终态（通过/驳回）同步实体状态（目标类型 → 实体表白名单，SQL 层补租户条件）。</li>
 * </ul>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobApprovalServiceImpl implements IJobApprovalService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };

    /** 审批目标类型 → 实体表白名单（对齐 Go approvalTargetTypeToTable）。 */
    private static final Map<String, String> TARGET_TABLE = Map.of(
        "career_position", "career_positions",
        "scenario", "scenarios",
        "course", "courses",
        "question_bank", "question_banks",
        "exam", "exams",
        "training_program", "training_programs",
        "teaching_plan", "teaching_plans"
    );

    private final JobApprovalMapper approvalMapper;
    private final JobWorkflowMapper workflowMapper;
    private final PartnerSourceMergeMapper sourceMergeMapper;

    @Override
    public ListResponse<ApprovalRecordDto> list(String status, String targetType, String submitterId,
                                                long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobApprovalRecord> wrapper = QueryBuilder.lambda(JobApprovalRecord.class)
            .eq(JobApprovalRecord::getTenantId, tenantId)
            .eqIfText(JobApprovalRecord::getStatus, status)
            .eqIfText(JobApprovalRecord::getTargetType, targetType)
            .eqIfText(JobApprovalRecord::getSubmitterId, submitterId);
        long total = approvalMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobApprovalRecord::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobApprovalRecord> rows = approvalMapper.selectList(wrapper.build());
        List<ApprovalRecordDto> items = new ArrayList<>(rows.size());
        for (JobApprovalRecord r : rows) {
            items.add(toDto(r));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public ApprovalRecordDto get(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobApprovalRecord record = approvalMapper.selectApprovalByIdTenant(id, tenantId);
        if (record == null) {
            throw new ApiException(404, "not_found", "审批记录不存在");
        }
        // 无租户审批记录不向租户用户暴露（fail-closed）
        if (record.getTenantId() == null) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return toDto(record);
    }

    @Override
    public ApprovalRecordDto create(ApprovalCreateRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getTargetType() == null || req.getTargetType().isEmpty()
            || req.getTargetId() == null || req.getTargetId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (!TARGET_TABLE.containsKey(req.getTargetType())) {
            throw new ApiException(400, "bad_request", "无效的审批对象类型");
        }
        if (approvalMapper.existsPending(req.getTargetType(), req.getTargetId())) {
            throw new ApiException(409, "conflict", "该内容已有待审批记录");
        }
        JobApprovalRecord record = new JobApprovalRecord();
        record.setTenantId(tenantId);
        record.setTargetType(req.getTargetType());
        record.setTargetId(req.getTargetId());
        record.setWorkflowId(emptyToNull(req.getWorkflowId()));
        record.setCurrentStepIdx(0);
        record.setStatus("pending");
        record.setSubmitterId(TenantContext.getUserId());
        record.setHistory("[]");
        approvalMapper.insert(record);
        return toDto(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApprovalRecordDto review(String id, ApprovalReviewRequest req) {
        String userId = requireUser();
        String tenantId = requireTenant();
        JobApprovalRecord record = approvalMapper.selectApprovalByIdTenant(id, tenantId);
        if (record == null) {
            throw new ApiException(404, "not_found", "审批记录不存在");
        }
        if (record.getTenantId() == null) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (!"pending".equals(record.getStatus())) {
            throw new ApiException(400, "bad_request", "审批记录不在待处理状态");
        }
        if (req.getAction() == null
            || (!"approved".equals(req.getAction()) && !"rejected".equals(req.getAction()))) {
            throw new ApiException(400, "bad_request", "无效操作");
        }
        if (!isUserApproverForStep(record, userId)) {
            throw new ApiException(403, "forbidden", "无权评审此步骤");
        }

        // 有工作流但加载失败：直接报错而非静默只记历史（对齐 Go fail-closed）
        JobWorkflow workflow = null;
        if (record.getWorkflowId() != null && !record.getWorkflowId().isEmpty()) {
            workflow = workflowMapper.selectWorkflowById(record.getWorkflowId(), tenantId);
            if (workflow == null) {
                throw new ApiException(500, "internal_error", "审批流程加载失败");
            }
        }

        // 本次评审记录（对齐 Go entry：action/remark/stepIdx/reviewerId/reviewerName/createdAt）
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("action", req.getAction());
        entry.put("remark", req.getRemark());
        entry.put("stepIdx", record.getCurrentStepIdx());
        entry.put("reviewerId", userId);
        entry.put("reviewerName", TenantContext.getUsername());
        entry.put("createdAt", OffsetDateTime.now().toInstant().toString());

        List<Object> history = appendHistoryEntry(parseList(record.getHistory()), entry);
        String historyJson = toJson(history);

        // 决策（对齐 Go decide 回调）：驳回直接终态；通过按步骤完成度推进
        boolean rejected = "rejected".equals(req.getAction());
        boolean complete;
        String newStatus;
        int newStepIdx;
        if (rejected) {
            complete = true;
            newStatus = "rejected";
            newStepIdx = record.getCurrentStepIdx();
        } else if (isStepComplete(workflow, record, history)) {
            newStatus = isLastStep(workflow, record.getCurrentStepIdx()) ? "approved" : "pending";
            newStepIdx = record.getCurrentStepIdx() + 1;
            complete = true;
        } else {
            complete = false;
            newStatus = "";
            newStepIdx = 0;
        }

        // 事务 + CAS 更新（对齐 Go LockApproval + SetHistory/AdvanceRecord）
        if (!complete) {
            int rows = approvalMapper.updateHistory(id, historyJson);
            if (rows == 0) {
                throw new ApiException(400, "bad_request", "审批记录不在待处理状态");
            }
        } else {
            int rows = approvalMapper.advanceRecord(id, newStatus, newStepIdx,
                record.getCurrentStepIdx(), historyJson);
            if (rows == 0) {
                throw new ApiException(400, "bad_request", "审批记录不在待处理状态");
            }
            // 终态（通过/驳回）才同步实体状态；非终态推进只改步骤
            if (!"pending".equals(newStatus)) {
                // 学校自建资源编辑稿审批通过 → 合并覆盖原资源（仅通过时合并，合并后不再同步实体状态）
                if ("approved".equals(newStatus)
                    && mergeSourceEditDraft(record.getTargetType(), record.getTargetId(), tenantId)) {
                    return get(id);
                }
                syncEntityStatus(record.getTargetType(), newStatus, record.getTargetId(), tenantId);
            }
        }
        return get(id);
    }

    // ---------- 步骤引擎 ----------

    /** 当前用户是否为当前步骤审批人（无工作流视为单步任意审批，fail-open 于工作流缺失场景）。 */
    private boolean isUserApproverForStep(JobApprovalRecord record, String userId) {
        if (record.getWorkflowId() == null || record.getWorkflowId().isEmpty()) {
            return true;
        }
        JobWorkflow wf = workflowMapper.selectWorkflowById(record.getWorkflowId(), record.getTenantId());
        List<Object> steps = parseList(wf == null ? null : wf.getSteps());
        int stepIdx = record.getCurrentStepIdx() == null ? 0 : record.getCurrentStepIdx();
        if (wf == null || steps.isEmpty() || stepIdx >= steps.size()) {
            // fail-closed：工作流加载失败/步骤缺失时拒绝审批，避免绕过审批链
            return false;
        }
        Object step = steps.get(stepIdx);
        if (!(step instanceof Map<?, ?> stepMap)) {
            return false;
        }
        Object approverIds = stepMap.get("approverIds");
        if (approverIds instanceof List<?> list) {
            for (Object a : list) {
                if (a != null && a.toString().equals(userId)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 步骤完成判定（any：任一审批人通过即完成；all：全部审批人通过；对齐 Go isStepComplete）。 */
    private boolean isStepComplete(JobWorkflow workflow, JobApprovalRecord record, List<Object> history) {
        if (record.getWorkflowId() == null || record.getWorkflowId().isEmpty()) {
            // 无工作流配置视为单步审批，审核人通过即完成
            return true;
        }
        List<Object> steps = parseList(workflow == null ? null : workflow.getSteps());
        int stepIdx = record.getCurrentStepIdx() == null ? 0 : record.getCurrentStepIdx();
        if (workflow == null || steps.isEmpty() || stepIdx >= steps.size()) {
            // fail-closed：流程加载失败/步骤缺失时不视为完成，避免一步直达通过并发布
            return false;
        }
        Object step = steps.get(stepIdx);
        if (!(step instanceof Map<?, ?> stepMap)) {
            return true;
        }
        String mode = stepMap.get("approvalMode") == null ? "any" : String.valueOf(stepMap.get("approvalMode"));
        if ("any".equals(mode)) {
            return true;
        }
        Object approverIds = stepMap.get("approverIds");
        if (!(approverIds instanceof List<?> list)) {
            return false;
        }
        List<String> approvedSet = new ArrayList<>();
        for (Object h : history) {
            if (!(h instanceof Map<?, ?> m)) {
                continue;
            }
            Object action = m.get("action");
            if (!"approved".equals(String.valueOf(action))) {
                continue;
            }
            Object stepRaw = m.get("stepIdx");
            int hStep = toInt(stepRaw);
            if (hStep != stepIdx) {
                continue;
            }
            Object rid = m.get("reviewerId");
            if (rid != null) {
                approvedSet.add(rid.toString());
            }
        }
        for (Object a : list) {
            if (a != null && !approvedSet.contains(a.toString())) {
                return false;
            }
        }
        return true;
    }

    /** 是否最后一步（无工作流视为最后一步；有工作流但加载失败由 isStepComplete 拦截）。 */
    private boolean isLastStep(JobWorkflow workflow, int stepIdx) {
        List<Object> steps = parseList(workflow == null ? null : workflow.getSteps());
        if (workflow == null || steps.isEmpty()) {
            return true;
        }
        return stepIdx >= steps.size() - 1;
    }

    /** 追加评审记录；同一评审人同一步骤的重复提交不重复追加（对齐 Go appendHistoryEntry）。 */
    private List<Object> appendHistoryEntry(List<Object> history, Map<String, Object> entry) {
        String rid = String.valueOf(entry.get("reviewerId"));
        int stepIdx = toInt(entry.get("stepIdx"));
        for (Object h : history) {
            if (!(h instanceof Map<?, ?> m)) {
                continue;
            }
            Object reviewer = m.get("reviewerId");
            if (reviewer == null || !reviewer.toString().equals(rid)) {
                continue;
            }
            if (toInt(m.get("stepIdx")) == stepIdx) {
                return history;
            }
        }
        List<Object> out = new ArrayList<>(history);
        out.add(entry);
        return out;
    }

    /** 同步实体状态（目标类型白名单 → 实体表；SQL 层补租户条件作纵深防御）。 */
    private void syncEntityStatus(String targetType, String status, String targetId, String tenantId) {
        String table = TARGET_TABLE.get(targetType);
        if (table == null) {
            throw new ApiException(500, "internal_error", "无效的审批对象类型");
        }
        approvalMapper.syncEntityStatus(table, status, targetId, tenantId);
    }

    /**
     * 学校自建资源编辑稿审批通过 → 合并覆盖原资源（对齐 Go MergeSourceEditDraft）。
     * 返回 true 表示已合并（draft 已删除，无需再走 syncEntityStatus）。
     */
    private boolean mergeSourceEditDraft(String targetType, String targetId, String tenantId) {
        if ("career_position".equals(targetType)) {
            Map<String, Object> d = sourceMergeMapper.selectPositionDraft(targetId, tenantId);
            if (d == null) {
                return false;
            }
            String srcId = str(d.get("source_resource_id"));
            if (srcId.isEmpty()) {
                return false;
            }
            mergePositionDraftToSource(targetId, tenantId, str(d.get("name")));
            return true;
        }
        if ("scenario".equals(targetType)) {
            Map<String, Object> d = sourceMergeMapper.selectScenarioDraft(targetId, tenantId);
            if (d == null) {
                return false;
            }
            String srcId = str(d.get("source_resource_id"));
            if (srcId.isEmpty()) {
                return false;
            }
            mergeScenarioDraftToSource(targetId, tenantId, str(d.get("name")));
            return true;
        }
        return false;
    }

    private void mergePositionDraftToSource(String draftId, String tenantId, String draftName) {
        String finalName = draftName == null ? "" : draftName.replaceAll("（编辑稿）$", "");
        sourceMergeMapper.renamePositionDraft(draftId);
        int rows = sourceMergeMapper.overwritePositionFromDraft(draftId, tenantId, finalName);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "覆盖原岗位失败：目标资源不存在");
        }
        sourceMergeMapper.deleteSourcePositionMajors(draftId);
        sourceMergeMapper.movePositionMajorsToSource(draftId);
        sourceMergeMapper.deleteSourcePositionAbilityBindings(draftId);
        sourceMergeMapper.movePositionAbilityBindingsToSource(draftId);
        sourceMergeMapper.deleteSourcePositionCertificates(draftId);
        sourceMergeMapper.movePositionCertificatesToSource(draftId);
        sourceMergeMapper.deleteSourcePositionResponsibilities(draftId);
        sourceMergeMapper.movePositionResponsibilitiesToSource(draftId);
        sourceMergeMapper.deletePositionDraft(draftId, tenantId);
    }

    private void mergeScenarioDraftToSource(String draftId, String tenantId, String draftName) {
        String finalName = draftName == null ? "" : draftName.replaceAll("（编辑稿）$", "");
        sourceMergeMapper.renameScenarioDraft(draftId, tenantId);
        sourceMergeMapper.deleteSourceTaskEvaluationMethods(draftId);
        sourceMergeMapper.deleteSourceTaskKnowledgeBindings(draftId);
        sourceMergeMapper.deleteSourceTaskResourceBindings(draftId);
        sourceMergeMapper.deleteSourceScenarioWeightConfigs(draftId);
        sourceMergeMapper.deleteSourceScenarioTasks(draftId);
        int rows = sourceMergeMapper.overwriteScenarioFromDraft(draftId, tenantId, finalName);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "覆盖原场景失败：目标场景不存在");
        }
        sourceMergeMapper.moveScenarioTasksToSource(draftId);
        sourceMergeMapper.deleteScenarioDraft(draftId, tenantId);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    // ---------- 工具 ----------

    private ApprovalRecordDto toDto(JobApprovalRecord r) {
        ApprovalRecordDto dto = new ApprovalRecordDto();
        dto.setId(r.getId());
        dto.setTenantId(r.getTenantId());
        dto.setTargetType(r.getTargetType());
        dto.setTargetId(r.getTargetId());
        dto.setWorkflowId(r.getWorkflowId());
        dto.setCurrentStepIdx(r.getCurrentStepIdx());
        dto.setStatus(r.getStatus());
        dto.setSubmitterId(r.getSubmitterId());
        dto.setHistory(parseList(r.getHistory()));
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
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

    private String toJson(List<Object> list) {
        try {
            return MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private int toInt(Object v) {
        if (v instanceof Number n) {
            return n.intValue();
        }
        if (v != null) {
            try {
                return Integer.parseInt(v.toString());
            } catch (NumberFormatException ignored) {
                // 无法解析按 0 处理
            }
        }
        return 0;
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
}
