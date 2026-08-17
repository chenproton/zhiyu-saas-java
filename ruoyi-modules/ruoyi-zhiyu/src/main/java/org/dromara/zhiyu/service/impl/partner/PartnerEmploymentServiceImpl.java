package org.dromara.zhiyu.service.impl.partner;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentApplication;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentJob;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentProject;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.mapper.partner.PartnerEmploymentMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseLinkMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseMapper;
import org.dromara.zhiyu.service.partner.IPartnerEmploymentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 企业端就业服务实现（对齐 Go partner_employment_handler.go + alliance_employment_store.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class PartnerEmploymentServiceImpl implements IPartnerEmploymentService {

    private final PartnerEmploymentMapper employmentMapper;
    private final PartnerEnterpriseMapper enterpriseMapper;
    private final PartnerEnterpriseLinkMapper linkMapper;

    // ===== 就业项目（只读） =====

    @Override
    public ListResponse<PartnerEmploymentProject> listProjects(String schoolTenantId) {
        String enterpriseId = resolveEnterpriseId();
        List<PartnerEmploymentProject> items = employmentMapper.listProjects(enterpriseId, schoolTenantId);
        return ListResponse.of(items, items.size());
    }

    @Override
    public PartnerEmploymentProject getProject(String id) {
        String enterpriseId = resolveEnterpriseId();
        PartnerEmploymentProject item = employmentMapper.getProject(id, enterpriseId);
        if (item == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        return item;
    }

    // ===== 就业岗位 =====

    @Override
    public ListResponse<PartnerEmploymentJob> listJobs(String projectId, String status) {
        String enterpriseId = resolveEnterpriseId();
        LambdaQueryBuilder<PartnerEmploymentJob> wrapper = QueryBuilder.lambda(PartnerEmploymentJob.class)
            .eq(PartnerEmploymentJob::getEnterpriseId, enterpriseId);
        wrapper.eqIfText(PartnerEmploymentJob::getProjectId, projectId);
        wrapper.eqIfText(PartnerEmploymentJob::getStatus, status);
        long total = employmentMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(PartnerEmploymentJob::getCreatedAt).last("LIMIT 200");
        List<PartnerEmploymentJob> rows = employmentMapper.selectList(wrapper.build());
        assembleJobs(rows);
        return ListResponse.of(rows, total);
    }

    @Override
    public PartnerEmploymentJob getJob(String id) {
        String enterpriseId = resolveEnterpriseId();
        PartnerEmploymentJob job = employmentMapper.selectList(QueryBuilder.lambda(PartnerEmploymentJob.class)
            .eq(PartnerEmploymentJob::getId, id).eq(PartnerEmploymentJob::getEnterpriseId, enterpriseId).build())
            .stream().findFirst().orElse(null);
        if (job == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        assembleJobs(List.of(job));
        return job;
    }

    @Override
    public PartnerEmploymentJob createJob(JobRequest req) {
        String enterpriseId = resolveEnterpriseId();
        String userId = requireUser();
        if (req.getTitle() == null || req.getTitle().isEmpty()) {
            throw new ApiException(400, "bad_request", "岗位名称不能为空");
        }
        if (req.getSchoolTenantId() == null || req.getSchoolTenantId().isEmpty()) {
            throw new ApiException(400, "bad_request", "请选择合作学校");
        }
        requireActiveLink(enterpriseId, req.getSchoolTenantId());

        String projectId = null;
        if (req.getProjectId() != null && !req.getProjectId().isEmpty()) {
            PartnerEmploymentProject project = employmentMapper.getProject(req.getProjectId(), enterpriseId);
            if (project == null) {
                throw new ApiException(400, "bad_request", "就业项目不存在或未分配给本企业");
            }
            if (!req.getSchoolTenantId().equals(project.getTenantId())) {
                throw new ApiException(400, "bad_request", "就业项目不属于所选合作学校");
            }
            projectId = req.getProjectId();
        }

        String id = UUID.randomUUID().toString();
        employmentMapper.insertJob(id, req.getSchoolTenantId(), enterpriseId, projectId, req.getTitle(),
            req.getJobType() == null || req.getJobType().isEmpty() ? "full-time" : req.getJobType(),
            req.getLocation(), req.getSalaryMin(), req.getSalaryMax(), req.getHeadcount(), req.getEducation(),
            req.getSuitableMajors() == null ? List.of() : req.getSuitableMajors(), req.getDescription(),
            req.getResponsibilities(), req.getRequirements(), req.getContactPerson(), req.getContactPhone(),
            req.getDeadline(), "draft", userId);
        return getJob(id);
    }

    @Override
    public PartnerEmploymentJob updateJob(String id, JobRequest req) {
        String enterpriseId = resolveEnterpriseId();
        PartnerEmploymentJob existing = getJob(id);
        String title = req.getTitle() == null || req.getTitle().isEmpty() ? existing.getTitle() : req.getTitle();
        String jobType = req.getJobType() == null || req.getJobType().isEmpty() ? existing.getJobType() : req.getJobType();
        employmentMapper.updateJob(id, enterpriseId, title, jobType, req.getLocation(), req.getSalaryMin(),
            req.getSalaryMax(), req.getHeadcount(), req.getEducation(),
            req.getSuitableMajors() == null ? List.of() : req.getSuitableMajors(), req.getDescription(),
            req.getResponsibilities(), req.getRequirements(), req.getContactPerson(), req.getContactPhone(),
            req.getDeadline());
        return getJob(id);
    }

    @Override
    public String deleteJob(String id) {
        String enterpriseId = resolveEnterpriseId();
        PartnerEmploymentJob existing = getJob(id);
        if (!"draft".equals(existing.getStatus())) {
            throw new ApiException(409, "conflict", "仅草稿岗位可删除，已发布岗位请先关闭");
        }
        employmentMapper.deleteJob(id, enterpriseId);
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> setJobStatus(String id, JobStatusRequest req) {
        String enterpriseId = resolveEnterpriseId();
        String status;
        if ("publish".equals(req.getAction())) {
            status = "published";
        } else if ("close".equals(req.getAction())) {
            status = "closed";
        } else {
            throw new ApiException(400, "bad_request", "不支持的操作");
        }
        if ("close".equals(req.getAction()) && req.getProjectId() != null && !req.getProjectId().isEmpty()) {
            throw new ApiException(400, "bad_request", "关闭岗位不能同时绑定项目");
        }
        int rows;
        if (req.getProjectId() != null && !req.getProjectId().isEmpty()) {
            rows = employmentMapper.setJobStatusWithProject(id, enterpriseId, status, req.getProjectId());
        } else {
            rows = employmentMapper.setJobStatus(id, enterpriseId, status);
        }
        if (rows == 0) {
            throw new ApiException(404, "not_found", "岗位不存在，或就业项目未分配给本企业");
        }
        return Map.of("id", id, "status", status);
    }

    // ===== 投递（只读） =====

    @Override
    public ListResponse<PartnerEmploymentApplication> listApplications(String jobId) {
        String enterpriseId = resolveEnterpriseId();
        List<PartnerEmploymentApplication> items = employmentMapper.listApplications(jobId, enterpriseId);
        return ListResponse.of(items, items.size());
    }

    @Override
    public PartnerEmploymentApplication getApplication(String id) {
        String enterpriseId = resolveEnterpriseId();
        PartnerEmploymentApplication item = employmentMapper.getApplication(id, enterpriseId);
        if (item == null) {
            throw new ApiException(404, "not_found", "投递记录不存在");
        }
        return item;
    }

    // ===== 工具 =====

    private String resolveEnterpriseId() {
        String tenantId = requireTenant();
        PartnerEnterprise enterprise = enterpriseMapper.selectList(
            QueryBuilder.lambda(PartnerEnterprise.class).eq(PartnerEnterprise::getTenantId, tenantId).build())
            .stream().findFirst().orElse(null);
        if (enterprise == null) {
            throw new ApiException(404, "not_found", "企业不存在");
        }
        return enterprise.getId();
    }

    private void requireActiveLink(String enterpriseId, String schoolTenantId) {
        String status = linkMapper.selectStatusByEnterprise(enterpriseId, schoolTenantId);
        if (!"active".equals(status)) {
            throw new ApiException(403, "forbidden", "与该学校无生效中的合作关系");
        }
    }

    /** 批量组装岗位关联字段（企业名/项目名/投递数，防 N+1）。 */
    private void assembleJobs(List<PartnerEmploymentJob> rows) {
        if (rows.isEmpty()) {
            return;
        }
        Set<String> enterpriseIds = new LinkedHashSet<>();
        Set<String> projectIds = new LinkedHashSet<>();
        for (PartnerEmploymentJob j : rows) {
            if (j.getEnterpriseId() != null) {
                enterpriseIds.add(j.getEnterpriseId());
            }
            if (j.getProjectId() != null) {
                projectIds.add(j.getProjectId());
            }
        }
        Map<String, String> enterpriseNames = idNameMap(employmentMapper.selectEnterpriseNames(new ArrayList<>(enterpriseIds)));
        Map<String, String> projectNames = idNameMap(employmentMapper.selectProjectNames(new ArrayList<>(projectIds)));
        Map<String, Long> appCounts = employmentMapper.selectApplicationCounts(rows.stream().map(PartnerEmploymentJob::getId).toList())
            .stream().collect(Collectors.toMap(PartnerEmploymentMapper.JobCountRow::getJobId,
                PartnerEmploymentMapper.JobCountRow::getCnt));
        for (PartnerEmploymentJob j : rows) {
            j.setEnterpriseName(j.getEnterpriseId() == null ? "" : enterpriseNames.getOrDefault(j.getEnterpriseId(), ""));
            j.setProjectName(j.getProjectId() == null ? "" : projectNames.getOrDefault(j.getProjectId(), ""));
            j.setApplicationCount(appCounts.getOrDefault(j.getId(), 0L).intValue());
        }
    }

    private Map<String, String> idNameMap(List<PartnerEmploymentMapper.IdNameRow> rows) {
        return rows.stream().collect(Collectors.toMap(PartnerEmploymentMapper.IdNameRow::getId,
            PartnerEmploymentMapper.IdNameRow::getName, (a, b) -> a));
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }
}
