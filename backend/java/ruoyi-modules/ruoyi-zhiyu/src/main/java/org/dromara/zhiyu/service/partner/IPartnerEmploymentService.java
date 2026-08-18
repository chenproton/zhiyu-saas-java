package org.dromara.zhiyu.service.partner;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentApplication;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentJob;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentProject;

import java.util.Map;

/**
 * 企业端就业服务（被分配项目/岗位 CRUD/投递只读）。
 *
 * @author zhiyu
 */
public interface IPartnerEmploymentService {

    ListResponse<PartnerEmploymentProject> listProjects(String schoolTenantId);

    PartnerEmploymentProject getProject(String id);

    ListResponse<PartnerEmploymentJob> listJobs(String projectId, String status);

    PartnerEmploymentJob getJob(String id);

    PartnerEmploymentJob createJob(JobRequest req);

    PartnerEmploymentJob updateJob(String id, JobRequest req);

    String deleteJob(String id);

    Map<String, String> setJobStatus(String id, JobStatusRequest req);

    ListResponse<PartnerEmploymentApplication> listApplications(String jobId);

    PartnerEmploymentApplication getApplication(String id);
}
