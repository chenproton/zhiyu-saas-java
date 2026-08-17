package org.dromara.zhiyu.controller.partner;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.JobStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentApplication;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentJob;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentProject;
import org.dromara.zhiyu.service.partner.IPartnerEmploymentService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 企业端就业服务控制器（对齐 Go routes_partner.go 就业路由，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/partner")
public class PartnerEmploymentController {

    private final IPartnerEmploymentService employmentService;

    @GetMapping("/employment-projects")
    public ListResponse<PartnerEmploymentProject> listProjects(
        @RequestParam(value = "schoolTenantId", required = false) String schoolTenantId) {
        return employmentService.listProjects(schoolTenantId);
    }

    @GetMapping("/employment-projects/{id}")
    public PartnerEmploymentProject getProject(@PathVariable String id) {
        return employmentService.getProject(id);
    }

    @GetMapping("/employment-jobs")
    public ListResponse<PartnerEmploymentJob> listJobs(
        @RequestParam(value = "projectId", required = false) String projectId,
        @RequestParam(value = "status", required = false) String status) {
        return employmentService.listJobs(projectId, status);
    }

    @GetMapping("/employment-jobs/{id}")
    public PartnerEmploymentJob getJob(@PathVariable String id) {
        return employmentService.getJob(id);
    }

    @PostMapping("/employment-jobs")
    @ResponseStatus(HttpStatus.CREATED)
    public PartnerEmploymentJob createJob(@RequestBody JobRequest req) {
        return employmentService.createJob(req);
    }

    @PutMapping("/employment-jobs/{id}")
    public PartnerEmploymentJob updateJob(@PathVariable String id, @RequestBody JobRequest req) {
        return employmentService.updateJob(id, req);
    }

    @DeleteMapping("/employment-jobs/{id}")
    public Map<String, String> deleteJob(@PathVariable String id) {
        return Map.of("id", employmentService.deleteJob(id));
    }

    @PostMapping("/employment-jobs/{id}/status")
    public Map<String, String> setJobStatus(@PathVariable String id, @RequestBody JobStatusRequest req) {
        return employmentService.setJobStatus(id, req);
    }

    @GetMapping("/employment-jobs/{jobId}/applications")
    public ListResponse<PartnerEmploymentApplication> listApplications(@PathVariable String jobId) {
        return employmentService.listApplications(jobId);
    }

    @GetMapping("/employment-applications/{id}")
    public PartnerEmploymentApplication getApplication(@PathVariable String id) {
        return employmentService.getApplication(id);
    }
}
