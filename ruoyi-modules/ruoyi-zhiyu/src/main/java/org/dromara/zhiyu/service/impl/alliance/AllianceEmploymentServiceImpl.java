package org.dromara.zhiyu.service.impl.alliance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.alliance.AllianceEnterprise;
import org.dromara.zhiyu.domain.alliance.EmploymentApplication;
import org.dromara.zhiyu.domain.alliance.EmploymentJob;
import org.dromara.zhiyu.domain.alliance.EmploymentProject;
import org.dromara.zhiyu.domain.dto.alliance.EmploymentDtos.*;
import org.dromara.zhiyu.mapper.alliance.AllianceEnterpriseMapper;
import org.dromara.zhiyu.mapper.alliance.EmploymentApplicationMapper;
import org.dromara.zhiyu.mapper.alliance.EmploymentJobMapper;
import org.dromara.zhiyu.mapper.alliance.EmploymentProjectMapper;
import org.dromara.zhiyu.service.alliance.IAllianceEmploymentService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 联盟就业服务实现（对齐 Go alliance_employment_handler.go + store/alliance_employment_store.go）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AllianceEmploymentServiceImpl implements IAllianceEmploymentService {

    private final EmploymentProjectMapper projectMapper;
    private final EmploymentJobMapper jobMapper;
    private final EmploymentApplicationMapper applicationMapper;
    private final AllianceEnterpriseMapper enterpriseMapper;

    // ===== 管理端 =====

    @Override
    public ListResponse<EmploymentProjectDto> listEmploymentProjects(String search, String publishStatus, String type,
                                                                     long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        List<EmploymentProject> rows = projectMapper.selectList(
            org.dromara.common.mybatis.core.query.QueryBuilder.lambda(EmploymentProject.class)
                .eq(EmploymentProject::getTenantId, tenantId)
                .eqIfText(EmploymentProject::getPublishStatus, publishStatus)
                .eqIfText(EmploymentProject::getType, type)
                .likeIfText(EmploymentProject::getName, search)
                .orderByDesc(EmploymentProject::getCreatedAt)
                .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset))
                .build());
        long total = projectMapper.selectCount(
            org.dromara.common.mybatis.core.query.QueryBuilder.lambda(EmploymentProject.class)
                .eq(EmploymentProject::getTenantId, tenantId)
                .eqIfText(EmploymentProject::getPublishStatus, publishStatus)
                .eqIfText(EmploymentProject::getType, type)
                .likeIfText(EmploymentProject::getName, search)
                .build());
        List<EmploymentProjectDto> items = new ArrayList<>(rows.size());
        for (EmploymentProject p : rows) {
            items.add(toProjectDto(p));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public EmploymentProjectDto getEmploymentProject(String id) {
        EmploymentProject p = projectMapper.selectById(id);
        if (p == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        AllianceSupport.verifyTenantOwnership(p.getTenantId());
        EmploymentProjectMapper.CountRow counts = projectMapper.selectCounts(id, p.getTenantId());
        EmploymentProjectDto dto = toProjectDto(p);
        if (counts != null) {
            dto.setJobCount(counts.getJobCount());
            dto.setApplicationCount(counts.getApplicationCount());
        }
        return dto;
    }

    @Override
    public EmploymentProjectDto createEmploymentProject(EmploymentProjectDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "项目名称不能为空");
        }
        if (req.getType() == null || req.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "项目类型不能为空");
        }
        EmploymentProject p = new EmploymentProject();
        p.setId(UUID.randomUUID().toString());
        p.setTenantId(tenantId);
        p.setName(req.getName());
        p.setType(req.getType());
        p.setOrganizer(req.getOrganizer());
        p.setDescription(req.getDescription());
        p.setCoverImage(req.getCoverImage());
        p.setStartDate(req.getStartDate());
        p.setEndDate(req.getEndDate());
        p.setPublishStatus(ZhiyuStatusConstants.PUBLISHED.equals(req.getPublishStatus()) ? ZhiyuStatusConstants.PUBLISHED : ZhiyuStatusConstants.DRAFT);
        p.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        p.setTargetGroups(AllianceSupport.jsonObjectOrDefault(req.getTargetGroups(), "[]"));
        p.setCreatedBy(AllianceSupport.currentUserOrNull());
        projectMapper.insertProject(p);
        return getEmploymentProject(p.getId());
    }

    @Override
    public EmploymentProjectDto updateEmploymentProject(String id, EmploymentProjectDto req) {
        EmploymentProject existing = projectMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        AllianceSupport.verifyTenantOwnership(existing.getTenantId());
        if (req.getName() != null && !req.getName().isEmpty()) {
            existing.setName(req.getName());
        }
        if (req.getType() != null && !req.getType().isEmpty()) {
            existing.setType(req.getType());
        }
        if (req.getOrganizer() != null) {
            existing.setOrganizer(req.getOrganizer());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getCoverImage() != null) {
            existing.setCoverImage(req.getCoverImage());
        }
        if (req.getStartDate() != null) {
            existing.setStartDate(req.getStartDate());
        }
        if (req.getEndDate() != null) {
            existing.setEndDate(req.getEndDate());
        }
        if (req.getPublishStatus() != null && !req.getPublishStatus().isEmpty()) {
            existing.setPublishStatus(req.getPublishStatus());
        }
        if (req.getEnterpriseIds() != null) {
            existing.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        }
        if (req.getTargetGroups() != null) {
            existing.setTargetGroups(AllianceSupport.jsonObjectOrDefault(req.getTargetGroups(), "[]"));
        }
        projectMapper.updateProject(existing);
        return getEmploymentProject(id);
    }

    @Override
    public Map<String, String> deleteEmploymentProject(String id) {
        String tenantId = AllianceSupport.requireTenant();
        projectMapper.deleteProject(id, tenantId);
        return Map.of("id", id);
    }

    @Override
    public ListResponse<EmploymentJobDto> listEmploymentJobs(String projectId, String enterpriseId, String status,
                                                             String search, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        List<EmploymentJob> rows = jobMapper.listJobs(tenantId, projectId, enterpriseId, status, search,
            (int) AllianceSupport.clampLimit(limit, 20), (int) AllianceSupport.clampOffset(offset));
        long total = jobMapper.countJobs(tenantId, projectId, enterpriseId, status, search);
        List<EmploymentJobDto> items = new ArrayList<>(rows.size());
        for (EmploymentJob j : rows) {
            items.add(toJobDto(j));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public Map<String, String> adminSetJobStatus(String id, String status) {
        String tenantId = AllianceSupport.requireTenant();
        if (!"closed".equals(status) && !ZhiyuStatusConstants.PUBLISHED.equals(status)) {
            throw new ApiException(400, "bad_request", "仅支持下架(closed)/恢复(published)");
        }
        jobMapper.adminSetStatus(id, tenantId, status);
        Map<String, String> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("status", status);
        return out;
    }

    @Override
    public ListResponse<EmploymentApplicationDto> listEmploymentApplications(String projectId, String jobId,
                                                                             String enterpriseId, String search,
                                                                             long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        List<EmploymentApplication> rows = applicationMapper.listApplications(tenantId, projectId, jobId, enterpriseId,
            search, (int) AllianceSupport.clampLimit(limit, 20), (int) AllianceSupport.clampOffset(offset));
        long total = applicationMapper.countApplications(tenantId, projectId, jobId, enterpriseId, search);
        List<EmploymentApplicationDto> items = new ArrayList<>(rows.size());
        for (EmploymentApplication a : rows) {
            items.add(toApplicationDto(a));
        }
        return ListResponse.of(items, total);
    }

    // ===== 前台大厅 =====

    @Override
    public ListResponse<EmploymentProjectDto> listPublicEmploymentProjects(String tenantId, long limit, long offset) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<EmploymentProjectMapper.PublicProjectRow> rows = projectMapper.listPublicProjects(tenantId, (int) safeLimit, (int) safeOffset);
        List<EmploymentProjectDto> items = new ArrayList<>(rows.size());
        for (EmploymentProjectMapper.PublicProjectRow row : rows) {
            EmploymentProjectDto dto = new EmploymentProjectDto();
            dto.setId(row.getId());
            dto.setTenantId(row.getTenantId());
            dto.setName(row.getName());
            dto.setType(row.getType());
            dto.setOrganizer(row.getOrganizer());
            dto.setDescription(row.getDescription());
            dto.setCoverImage(row.getCoverImage());
            dto.setStartDate(row.getStartDate());
            dto.setEndDate(row.getEndDate());
            dto.setPublishStatus(row.getPublishStatus());
            dto.setEnterpriseIds(AllianceSupport.strList(row.getEnterpriseIds()));
            dto.setTargetGroups(AllianceSupport.targetGroups(row.getTargetGroups()));
            dto.setCreatedBy(row.getCreatedBy());
            dto.setCreatedAt(row.getCreatedAt());
            dto.setUpdatedAt(row.getUpdatedAt());
            dto.setJobCount(row.getJobCount());
            items.add(dto);
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EmploymentProjectDto getPublicEmploymentProject(String id, String tenantId) {
        EmploymentProject p = projectMapper.selectPublicProject(id, tenantId);
        if (p == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        return toProjectDto(p);
    }

    @Override
    public ListResponse<EmploymentJobDto> listPublicJobsByProject(String projectId, String tenantId) {
        if (projectMapper.selectPublicProject(projectId, tenantId) == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        List<EmploymentJob> rows = jobMapper.listPublicJobsByProject(projectId, tenantId);
        List<EmploymentJobDto> items = new ArrayList<>(rows.size());
        for (EmploymentJob j : rows) {
            items.add(toJobDto(j));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EmploymentJobDto getPublicJob(String id, String tenantId) {
        EmploymentJob j = jobMapper.selectPublicJob(id, tenantId);
        if (j == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        return toJobDto(j);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> applyPublicJob(String jobId, ApplyRequest req) {
        String userId = AllianceSupport.requireUser();
        if (!applicationMapper.isStudent(userId)) {
            throw new ApiException(403, "forbidden", "仅学生可投递");
        }
        String coverLetter = req.getCoverLetter() == null ? "" : req.getCoverLetter();
        if (coverLetter.length() > 2000) {
            throw new ApiException(400, "bad_request", "求职信最长 2000 字");
        }
        EmploymentApplicationMapper.StudentScopeRow scope = applicationMapper.selectStudentScope(userId);
        String orgPathIds = null;
        String majorId = null;
        Integer graduateYear = null;
        if (scope != null) {
            majorId = scope.getMajorId();
            graduateYear = scope.getGraduateYear();
            if (scope.getOrgNodeId() != null) {
                orgPathIds = applicationMapper.selectOrgPathIds(scope.getOrgNodeId());
            }
        }
        String id = UUID.randomUUID().toString();
        int rows;
        try {
            rows = applicationMapper.insertApplication(id, jobId, userId, coverLetter, orgPathIds, majorId, graduateYear);
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "conflict", "已投递过该岗位");
        }
        if (rows == 0) {
            Boolean open = applicationMapper.selectJobOpen(jobId);
            if (Boolean.TRUE.equals(open)) {
                throw new ApiException(403, "forbidden", "你不在该岗位面向的学生群体内，暂不可投递");
            }
            throw new ApiException(404, "not_found", "岗位不存在或未开放投递");
        }
        return Map.of("id", id);
    }

    @Override
    public ListResponse<EmploymentApplicationDto> listMyApplications() {
        String tenantId = AllianceSupport.requireTenant();
        String userId = AllianceSupport.requireUser();
        if (!applicationMapper.isStudent(userId)) {
            throw new ApiException(403, "forbidden", "仅学生可查看投递记录");
        }
        List<EmploymentApplication> rows = applicationMapper.listMyApplications(tenantId, userId);
        List<EmploymentApplicationDto> items = new ArrayList<>(rows.size());
        for (EmploymentApplication a : rows) {
            items.add(toApplicationDto(a));
        }
        return ListResponse.of(items, items.size());
    }

    // ===== 企业端（partner） =====

    private String requireEnterpriseId() {
        String tenantId = AllianceSupport.requireTenant();
        AllianceEnterprise e = enterpriseMapper.selectByTenant(tenantId);
        if (e == null) {
            throw new ApiException(403, "forbidden", "缺少企业信息");
        }
        return e.getId();
    }

    @Override
    public ListResponse<EmploymentProjectDto> listPartnerProjects(String schoolTenantId) {
        String enterpriseId = requireEnterpriseId();
        List<EmploymentProject> rows = projectMapper.listPartnerProjects(enterpriseId, schoolTenantId);
        List<EmploymentProjectDto> items = new ArrayList<>(rows.size());
        for (EmploymentProject p : rows) {
            items.add(toProjectDto(p));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EmploymentProjectDto getPartnerProject(String id) {
        String enterpriseId = requireEnterpriseId();
        EmploymentProject p = projectMapper.selectPartnerProject(id, enterpriseId);
        if (p == null) {
            throw new ApiException(404, "not_found", "就业项目不存在");
        }
        return toProjectDto(p);
    }

    @Override
    public ListResponse<EmploymentJobDto> listPartnerJobs(String projectId, String status) {
        String enterpriseId = requireEnterpriseId();
        List<EmploymentJob> rows = jobMapper.listPartnerJobs(enterpriseId, projectId, status);
        List<EmploymentJobDto> items = new ArrayList<>(rows.size());
        for (EmploymentJob j : rows) {
            items.add(toJobDto(j));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EmploymentJobDto getPartnerJob(String id) {
        String enterpriseId = requireEnterpriseId();
        EmploymentJob j = jobMapper.selectPartnerJob(id, enterpriseId);
        if (j == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        return toJobDto(j);
    }

    @Override
    public EmploymentJobDto createPartnerJob(EmploymentJobDto req) {
        String enterpriseId = requireEnterpriseId();
        String schoolTenantId = req.getSchoolTenantId() != null ? req.getSchoolTenantId() : req.getTenantId();
        if (schoolTenantId == null || schoolTenantId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少学校租户");
        }
        EmploymentJob j = new EmploymentJob();
        j.setId(UUID.randomUUID().toString());
        j.setTenantId(schoolTenantId);
        j.setEnterpriseId(enterpriseId);
        j.setProjectId(req.getProjectId());
        j.setTitle(req.getTitle());
        j.setJobType(req.getJobType() == null || req.getJobType().isEmpty() ? "full-time" : req.getJobType());
        j.setLocation(req.getLocation());
        j.setSalaryMin(req.getSalaryMin());
        j.setSalaryMax(req.getSalaryMax());
        j.setHeadcount(req.getHeadcount());
        j.setEducation(req.getEducation());
        j.setSuitableMajors(AllianceSupport.jsonList(req.getSuitableMajors()));
        j.setDescription(req.getDescription());
        j.setResponsibilities(req.getResponsibilities());
        j.setRequirements(req.getRequirements());
        j.setContactPerson(req.getContactPerson());
        j.setContactPhone(req.getContactPhone());
        j.setDeadline(req.getDeadline());
        j.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getStatus());
        j.setCreatedBy(AllianceSupport.currentUserOrNull());
        jobMapper.insertJob(j);
        return getPartnerJob(j.getId());
    }

    @Override
    public EmploymentJobDto updatePartnerJob(String id, EmploymentJobDto req) {
        String enterpriseId = requireEnterpriseId();
        EmploymentJob j = jobMapper.selectPartnerJob(id, enterpriseId);
        if (j == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        if (req.getTitle() != null && !req.getTitle().isEmpty()) {
            j.setTitle(req.getTitle());
        }
        if (req.getJobType() != null && !req.getJobType().isEmpty()) {
            j.setJobType(req.getJobType());
        }
        if (req.getLocation() != null) {
            j.setLocation(req.getLocation());
        }
        if (req.getSalaryMin() != null) {
            j.setSalaryMin(req.getSalaryMin());
        }
        if (req.getSalaryMax() != null) {
            j.setSalaryMax(req.getSalaryMax());
        }
        if (req.getHeadcount() != null) {
            j.setHeadcount(req.getHeadcount());
        }
        if (req.getEducation() != null) {
            j.setEducation(req.getEducation());
        }
        if (req.getSuitableMajors() != null) {
            j.setSuitableMajors(AllianceSupport.jsonList(req.getSuitableMajors()));
        }
        if (req.getDescription() != null) {
            j.setDescription(req.getDescription());
        }
        if (req.getResponsibilities() != null) {
            j.setResponsibilities(req.getResponsibilities());
        }
        if (req.getRequirements() != null) {
            j.setRequirements(req.getRequirements());
        }
        if (req.getContactPerson() != null) {
            j.setContactPerson(req.getContactPerson());
        }
        if (req.getContactPhone() != null) {
            j.setContactPhone(req.getContactPhone());
        }
        if (req.getDeadline() != null) {
            j.setDeadline(req.getDeadline());
        }
        jobMapper.updateJob(j);
        return getPartnerJob(id);
    }

    @Override
    public Map<String, String> deletePartnerJob(String id) {
        String enterpriseId = requireEnterpriseId();
        jobMapper.deleteJob(id, enterpriseId);
        return Map.of("id", id);
    }

    @Override
    public Map<String, String> setPartnerJobStatus(String id, PartnerJobStatusRequest req) {
        String enterpriseId = requireEnterpriseId();
        String action = req.getAction();
        String status;
        if ("publish".equals(action)) {
            status = ZhiyuStatusConstants.PUBLISHED;
        } else if ("close".equals(action)) {
            status = "closed";
        } else {
            throw new ApiException(400, "bad_request", "无效的状态操作");
        }
        boolean ok;
        if (req.getProjectId() != null && !req.getProjectId().isEmpty()) {
            ok = jobMapper.setPartnerStatusWithProject(id, enterpriseId, status, req.getProjectId()) > 0;
        } else {
            ok = jobMapper.setPartnerStatus(id, enterpriseId, status) > 0;
        }
        if (!ok) {
            throw new ApiException(404, "not_found", "岗位不存在或项目未分配");
        }
        Map<String, String> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("status", status);
        return out;
    }

    @Override
    public ListResponse<EmploymentApplicationDto> listPartnerApplications(String jobId) {
        String enterpriseId = requireEnterpriseId();
        List<EmploymentApplication> rows = applicationMapper.listPartnerApplications(jobId, enterpriseId);
        List<EmploymentApplicationDto> items = new ArrayList<>(rows.size());
        for (EmploymentApplication a : rows) {
            items.add(toApplicationDto(a));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EmploymentApplicationDto getPartnerApplication(String id) {
        String enterpriseId = requireEnterpriseId();
        EmploymentApplication a = applicationMapper.selectPartnerApplication(id, enterpriseId);
        if (a == null) {
            throw new ApiException(404, "not_found", "投递不存在");
        }
        return toApplicationDto(a);
    }

    // ===== 转换 =====

    private EmploymentProjectDto toProjectDto(EmploymentProject p) {
        EmploymentProjectDto dto = new EmploymentProjectDto();
        dto.setId(p.getId());
        dto.setTenantId(p.getTenantId());
        dto.setName(p.getName());
        dto.setType(p.getType());
        dto.setOrganizer(p.getOrganizer());
        dto.setDescription(p.getDescription());
        dto.setCoverImage(p.getCoverImage());
        dto.setStartDate(p.getStartDate());
        dto.setEndDate(p.getEndDate());
        dto.setPublishStatus(p.getPublishStatus());
        dto.setEnterpriseIds(AllianceSupport.strList(p.getEnterpriseIds()));
        dto.setTargetGroups(AllianceSupport.targetGroups(p.getTargetGroups()));
        dto.setCreatedBy(p.getCreatedBy());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        dto.setJobCount(p.getJobCount());
        dto.setApplicationCount(p.getApplicationCount());
        return dto;
    }

    private EmploymentJobDto toJobDto(EmploymentJob j) {
        EmploymentJobDto dto = new EmploymentJobDto();
        dto.setId(j.getId());
        dto.setTenantId(j.getTenantId());
        dto.setEnterpriseId(j.getEnterpriseId());
        dto.setProjectId(j.getProjectId());
        dto.setTitle(j.getTitle());
        dto.setJobType(j.getJobType());
        dto.setLocation(j.getLocation());
        dto.setSalaryMin(j.getSalaryMin());
        dto.setSalaryMax(j.getSalaryMax());
        dto.setHeadcount(j.getHeadcount());
        dto.setEducation(j.getEducation());
        dto.setSuitableMajors(AllianceSupport.strList(j.getSuitableMajors()));
        dto.setDescription(j.getDescription());
        dto.setResponsibilities(j.getResponsibilities());
        dto.setRequirements(j.getRequirements());
        dto.setContactPerson(j.getContactPerson());
        dto.setContactPhone(j.getContactPhone());
        dto.setDeadline(j.getDeadline());
        dto.setStatus(j.getStatus());
        dto.setCreatedBy(j.getCreatedBy());
        dto.setCreatedAt(j.getCreatedAt());
        dto.setUpdatedAt(j.getUpdatedAt());
        dto.setEnterpriseName(j.getEnterpriseName());
        dto.setProjectName(j.getProjectName());
        dto.setApplicationCount(j.getApplicationCount());
        return dto;
    }

    private EmploymentApplicationDto toApplicationDto(EmploymentApplication a) {
        EmploymentApplicationDto dto = new EmploymentApplicationDto();
        dto.setId(a.getId());
        dto.setTenantId(a.getTenantId());
        dto.setJobId(a.getJobId());
        dto.setEnterpriseId(a.getEnterpriseId());
        dto.setStudentId(a.getStudentId());
        dto.setStudentName(a.getStudentName());
        dto.setStudentNo(a.getStudentNo());
        dto.setMajorName(a.getMajorName());
        dto.setClassName(a.getClassName());
        dto.setPhone(a.getPhone());
        dto.setEmail(a.getEmail());
        dto.setCoverLetter(a.getCoverLetter());
        dto.setStatus(a.getStatus());
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        dto.setJobTitle(a.getJobTitle());
        dto.setEnterpriseName(a.getEnterpriseName());
        dto.setProjectName(a.getProjectName());
        return dto;
    }
}
