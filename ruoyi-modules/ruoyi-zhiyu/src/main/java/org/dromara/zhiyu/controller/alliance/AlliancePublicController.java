package org.dromara.zhiyu.controller.alliance;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;
import org.dromara.zhiyu.service.alliance.IAlliancePublicService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 联盟门户前台公开控制器（对齐 Go registerAlliancePublicRoutes）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/alliance/public")
public class AlliancePublicController {

    private final IAlliancePublicService publicService;

    @GetMapping("/school-info")
    public SchoolInfoDto getPublicSchoolInfo(@RequestParam(required = false) String tenantId) {
        return publicService.getPublicSchoolInfo(tenantId);
    }

    @GetMapping("/enterprises")
    public ListResponse<EnterpriseDto> listPublicEnterprises(@RequestParam(required = false) String tenantId,
                                                             @RequestParam(defaultValue = "100") long limit,
                                                             @RequestParam(defaultValue = "0") long offset) {
        return publicService.listPublicEnterprises(tenantId, limit, offset);
    }

    @GetMapping("/enterprises/{id}")
    public EnterpriseDto getPublicEnterprise(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return publicService.getPublicEnterprise(id, tenantId);
    }

    @GetMapping("/projects")
    public ListResponse<ProjectDto> listPublicProjects(@RequestParam(required = false) String tenantId,
                                                       @RequestParam(defaultValue = "100") long limit,
                                                       @RequestParam(defaultValue = "0") long offset) {
        return publicService.listPublicProjects(tenantId, limit, offset);
    }

    @GetMapping("/projects/{id}")
    public ProjectDto getPublicProject(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return publicService.getPublicProject(id, tenantId);
    }

    @GetMapping("/projects/{projectId}/milestones")
    public ListResponse<MilestoneDto> listPublicMilestones(@PathVariable String projectId,
                                                           @RequestParam(required = false) String tenantId) {
        return publicService.listPublicMilestones(projectId, tenantId);
    }

    @GetMapping("/achievements")
    public ListResponse<AchievementDto> listPublicAchievements(@RequestParam(required = false) String tenantId,
                                                               @RequestParam(required = false) String sort,
                                                               @RequestParam(defaultValue = "100") long limit,
                                                               @RequestParam(defaultValue = "0") long offset) {
        return publicService.listPublicAchievements(tenantId, limit, offset);
    }

    @GetMapping("/achievements/{id}")
    public AchievementDto getPublicAchievement(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return publicService.getPublicAchievement(id, tenantId);
    }

    @GetMapping("/agreements")
    public ListResponse<PublicAgreementDto> listPublicAgreements(@RequestParam(required = false) String tenantId,
                                                                 @RequestParam(defaultValue = "100") long limit,
                                                                 @RequestParam(defaultValue = "0") long offset) {
        return publicService.listPublicAgreements(tenantId, limit, offset);
    }

    @GetMapping("/experts")
    public ListResponse<ExpertDto> listPublicExperts(@RequestParam(required = false) String tenantId,
                                                     @RequestParam(defaultValue = "100") long limit,
                                                     @RequestParam(defaultValue = "0") long offset,
                                                     @RequestParam(defaultValue = "false") boolean includeNonPublic) {
        return publicService.listPublicExperts(tenantId, limit, offset, includeNonPublic);
    }

    @GetMapping("/experts/{id}")
    public ExpertDto getPublicExpert(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return publicService.getPublicExpert(id, tenantId);
    }

    @GetMapping("/brands")
    public ListResponse<PublicBrandDto> listPublicBrands(@RequestParam(required = false) String tenantId,
                                                         @RequestParam(required = false) String brandType) {
        return publicService.listPublicBrands(tenantId, brandType);
    }

    @GetMapping("/brands/{id}")
    public PublicBrandDto getPublicBrand(@PathVariable String id, @RequestParam(required = false) String tenantId) {
        return publicService.getPublicBrand(id, tenantId);
    }

    @GetMapping("/brands/talent-ranking")
    public Map<String, Object> listPublicTalentRanking(@RequestParam(required = false) String tenantId,
                                                       @RequestParam(required = false) String search) {
        return publicService.listPublicTalentRanking(tenantId, search);
    }

    @GetMapping("/stats")
    public PublicStatsDto getPublicStats(@RequestParam(required = false) String tenantId) {
        return publicService.getPublicStats(tenantId);
    }
}
