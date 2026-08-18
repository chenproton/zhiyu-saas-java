package org.dromara.zhiyu.controller.alliance;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.EmploymentDtos.*;
import org.dromara.zhiyu.service.alliance.IAllianceEmploymentService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 联盟就业前台大厅控制器（对齐 Go registerAlliancePublicRoutes 就业部分）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/alliance/public")
public class AlliancePublicEmploymentController {

    private final IAllianceEmploymentService employmentService;

    @GetMapping("/employment-projects")
    public ListResponse<EmploymentProjectDto> listPublicEmploymentProjects(@RequestParam(required = false) String tenantId,
                                                                           @RequestParam(defaultValue = "100") long limit,
                                                                           @RequestParam(defaultValue = "0") long offset) {
        return employmentService.listPublicEmploymentProjects(tenantId, limit, offset);
    }

    @GetMapping("/employment-projects/{id}")
    public EmploymentProjectDto getPublicEmploymentProject(@PathVariable String id,
                                                           @RequestParam(required = false) String tenantId) {
        return employmentService.getPublicEmploymentProject(id, tenantId);
    }

    @GetMapping("/employment-projects/{projectId}/jobs")
    public ListResponse<EmploymentJobDto> listPublicJobsByProject(@PathVariable String projectId,
                                                                  @RequestParam(required = false) String tenantId) {
        return employmentService.listPublicJobsByProject(projectId, tenantId);
    }

    @GetMapping("/employment-jobs/{id}")
    public EmploymentJobDto getPublicJob(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return employmentService.getPublicJob(id, tenantId);
    }

    @PostMapping("/employment-jobs/{jobId}/apply")
    public Map<String, String> applyPublicJob(@PathVariable String jobId, @RequestBody ApplyRequest req) {
        return employmentService.applyPublicJob(jobId, req);
    }

    @GetMapping("/employment-applications/mine")
    public ListResponse<EmploymentApplicationDto> listMyApplications() {
        return employmentService.listMyApplications();
    }
}
