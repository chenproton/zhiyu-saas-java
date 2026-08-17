package org.dromara.zhiyu.service.alliance;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.EmploymentDtos.*;

import java.util.Map;

/**
 * 联盟就业服务（管理端 + 前台大厅 + 企业端）。
 *
 * @author zhiyu
 */
public interface IAllianceEmploymentService {

    // 管理端（portalRequest）
    ListResponse<EmploymentProjectDto> listEmploymentProjects(String search, String publishStatus, String type,
                                                              long limit, long offset);

    EmploymentProjectDto getEmploymentProject(String id);

    EmploymentProjectDto createEmploymentProject(EmploymentProjectDto req);

    EmploymentProjectDto updateEmploymentProject(String id, EmploymentProjectDto req);

    Map<String, String> deleteEmploymentProject(String id);

    ListResponse<EmploymentJobDto> listEmploymentJobs(String projectId, String enterpriseId, String status,
                                                      String search, long limit, long offset);

    Map<String, String> adminSetJobStatus(String id, String status);

    ListResponse<EmploymentApplicationDto> listEmploymentApplications(String projectId, String jobId,
                                                                      String enterpriseId, String search,
                                                                      long limit, long offset);

    // 前台大厅（登录公开，按 tenantId 过滤）
    ListResponse<EmploymentProjectDto> listPublicEmploymentProjects(String tenantId, long limit, long offset);

    EmploymentProjectDto getPublicEmploymentProject(String id, String tenantId);

    ListResponse<EmploymentJobDto> listPublicJobsByProject(String projectId, String tenantId);

    EmploymentJobDto getPublicJob(String id, String tenantId);

    Map<String, String> applyPublicJob(String jobId, ApplyRequest req);

    ListResponse<EmploymentApplicationDto> listMyApplications();

    // 企业端（partnerRequest）
    ListResponse<EmploymentProjectDto> listPartnerProjects(String schoolTenantId);

    EmploymentProjectDto getPartnerProject(String id);

    ListResponse<EmploymentJobDto> listPartnerJobs(String projectId, String status);

    EmploymentJobDto getPartnerJob(String id);

    EmploymentJobDto createPartnerJob(EmploymentJobDto req);

    EmploymentJobDto updatePartnerJob(String id, EmploymentJobDto req);

    Map<String, String> deletePartnerJob(String id);

    Map<String, String> setPartnerJobStatus(String id, PartnerJobStatusRequest req);

    ListResponse<EmploymentApplicationDto> listPartnerApplications(String jobId);

    EmploymentApplicationDto getPartnerApplication(String id);
}
