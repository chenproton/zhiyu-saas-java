package org.dromara.zhiyu.controller.alliance;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.EmploymentDtos.*;
import org.dromara.zhiyu.service.alliance.IAllianceEmploymentService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 联盟就业管理端控制器（对齐 Go 管理端 alliance-employment 路由）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/alliance")
public class AllianceEmploymentController {

    private final IAllianceEmploymentService employmentService;

    @GetMapping("/employment-projects")
    public ListResponse<EmploymentProjectDto> listEmploymentProjects(@RequestParam(required = false) String search,
                                                                     @RequestParam(required = false) String publishStatus,
                                                                     @RequestParam(required = false) String type,
                                                                     @RequestParam(defaultValue = "20") long limit,
                                                                     @RequestParam(defaultValue = "0") long offset) {
        return employmentService.listEmploymentProjects(search, publishStatus, type, limit, offset);
    }

    @GetMapping("/employment-projects/{id}")
    public EmploymentProjectDto getEmploymentProject(@PathVariable String id) {
        return employmentService.getEmploymentProject(id);
    }

    @PostMapping("/employment-projects")
    public EmploymentProjectDto createEmploymentProject(@RequestBody EmploymentProjectDto req) {
        return employmentService.createEmploymentProject(req);
    }

    @PutMapping("/employment-projects/{id}")
    public EmploymentProjectDto updateEmploymentProject(@PathVariable String id, @RequestBody EmploymentProjectDto req) {
        return employmentService.updateEmploymentProject(id, req);
    }

    @DeleteMapping("/employment-projects/{id}")
    public Map<String, String> deleteEmploymentProject(@PathVariable String id) {
        return employmentService.deleteEmploymentProject(id);
    }

    @GetMapping("/employment-jobs")
    public ListResponse<EmploymentJobDto> listEmploymentJobs(@RequestParam(required = false) String projectId,
                                                             @RequestParam(required = false) String enterpriseId,
                                                             @RequestParam(required = false) String status,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(defaultValue = "20") long limit,
                                                             @RequestParam(defaultValue = "0") long offset) {
        return employmentService.listEmploymentJobs(projectId, enterpriseId, status, search, limit, offset);
    }

    @PutMapping("/employment-jobs/{id}/status")
    public Map<String, String> adminSetJobStatus(@PathVariable String id, @RequestBody JobStatusRequest req) {
        return employmentService.adminSetJobStatus(id, req.getStatus());
    }

    @GetMapping("/employment-applications")
    public ListResponse<EmploymentApplicationDto> listEmploymentApplications(@RequestParam(required = false) String projectId,
                                                                             @RequestParam(required = false) String jobId,
                                                                             @RequestParam(required = false) String enterpriseId,
                                                                             @RequestParam(required = false) String search,
                                                                             @RequestParam(defaultValue = "20") long limit,
                                                                             @RequestParam(defaultValue = "0") long offset) {
        return employmentService.listEmploymentApplications(projectId, jobId, enterpriseId, search, limit, offset);
    }
}
