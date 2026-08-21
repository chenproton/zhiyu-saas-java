package org.dromara.zhiyu.controller.alliance;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;
import org.dromara.zhiyu.service.alliance.IAllianceService;
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
 * 联盟 school 侧控制器（对齐 Go registerAllianceRoutes）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/alliance")
public class AllianceController {

    private final IAllianceService allianceService;

    // 学校信息
    @GetMapping("/school-info")
    public SchoolInfoDto getSchoolInfo() {
        return allianceService.getSchoolInfo();
    }

    @PutMapping("/school-info")
    public SchoolInfoDto updateSchoolInfo(@RequestBody SchoolInfoDto req) {
        return allianceService.updateSchoolInfo(req);
    }

    // 企业
    @GetMapping("/enterprises")
    public ListResponse<EnterpriseDto> listEnterprises(@RequestParam(required = false) String search,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(defaultValue = "20") long limit,
                                                       @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listEnterprises(search, status, limit, offset);
    }

    @GetMapping("/enterprises/search")
    public ListResponse<EnterpriseDto> searchEnterprises(@RequestParam(required = false) String keyword) {
        return allianceService.searchEnterprises(keyword);
    }

    @GetMapping("/enterprises/{id}")
    public EnterpriseDto getEnterprise(@PathVariable String id) {
        return allianceService.getEnterprise(id);
    }

    @PostMapping("/enterprises/register")
    public EnterpriseDto registerEnterprise(@RequestBody EnterpriseRegisterRequest req) {
        return allianceService.registerEnterprise(req);
    }

    @PostMapping("/enterprises/{id}/link")
    public EnterpriseDto linkEnterprise(@PathVariable String id, @RequestBody(required = false) EnterpriseLinkRequest req) {
        return allianceService.linkEnterprise(id, req == null ? new EnterpriseLinkRequest() : req);
    }

    @DeleteMapping("/enterprises/{id}/link")
    public Map<String, String> unlinkEnterprise(@PathVariable String id) {
        return allianceService.unlinkEnterprise(id);
    }

    @DeleteMapping("/enterprises/{id}")
    public Map<String, String> unlinkEnterpriseAlt(@PathVariable String id) {
        return allianceService.unlinkEnterprise(id);
    }

    @PutMapping("/enterprises/{id}")
    public EnterpriseDto updateEnterprise(@PathVariable String id, @RequestBody EnterpriseLinkUpdateRequest req) {
        return allianceService.updateEnterprise(id, req);
    }

    // 资源授权
    @GetMapping("/grants")
    public Map<String, Object> listGrants(@RequestParam String enterpriseId) {
        return allianceService.listGrants(enterpriseId);
    }

    @GetMapping("/grants/resource-options")
    public ListResponse<GrantResourceOptionDto> listGrantResourceOptions(@RequestParam String enterpriseId) {
        return allianceService.listGrantResourceOptions(enterpriseId);
    }

    @PutMapping("/grants")
    public Map<String, Object> saveGrants(@RequestBody SaveGrantsRequest req) {
        return allianceService.saveGrants(req);
    }

    // 项目
    @GetMapping("/projects")
    public ListResponse<ProjectDto> listProjects(@RequestParam(required = false) String search,
                                                 @RequestParam(required = false) String phase,
                                                 @RequestParam(defaultValue = "20") long limit,
                                                 @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listProjects(search, phase, limit, offset);
    }

    @GetMapping("/projects/{id}")
    public ProjectDto getProject(@PathVariable String id) {
        return allianceService.getProject(id);
    }

    @PostMapping("/projects")
    public ProjectDto createProject(@RequestBody ProjectDto req) {
        return allianceService.createProject(req);
    }

    @PutMapping("/projects/{id}")
    public ProjectDto updateProject(@PathVariable String id, @RequestBody ProjectDto req) {
        return allianceService.updateProject(id, req);
    }

    @DeleteMapping("/projects/{id}")
    public Map<String, String> deleteProject(@PathVariable String id) {
        return allianceService.deleteProject(id);
    }

    // 里程碑
    @GetMapping("/projects/{projectId}/milestones")
    public ListResponse<MilestoneDto> listMilestones(@PathVariable String projectId) {
        return allianceService.listMilestones(projectId);
    }

    @PostMapping("/projects/{projectId}/milestones")
    public Map<String, String> createMilestone(@PathVariable String projectId, @RequestBody MilestoneDto req) {
        return allianceService.createMilestone(projectId, req);
    }

    @PutMapping("/projects/{projectId}/milestones/{id}")
    public Map<String, String> updateMilestone(@PathVariable String id, @RequestBody MilestoneDto req) {
        return allianceService.updateMilestone(id, req);
    }

    @DeleteMapping("/projects/{projectId}/milestones/{id}")
    public Map<String, String> deleteMilestone(@PathVariable String id) {
        return allianceService.deleteMilestone(id);
    }

    // 成果
    @GetMapping("/achievements")
    public ListResponse<AchievementDto> listAchievements(@RequestParam(required = false) String search,
                                                         @RequestParam(required = false) String type,
                                                         @RequestParam(required = false) String status,
                                                         @RequestParam(defaultValue = "20") long limit,
                                                         @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listAchievements(search, type, status, limit, offset);
    }

    @GetMapping("/achievements/{id}")
    public AchievementDto getAchievement(@PathVariable String id) {
        return allianceService.getAchievement(id);
    }

    @PostMapping("/achievements")
    public AchievementDto createAchievement(@RequestBody AchievementDto req) {
        return allianceService.createAchievement(req);
    }

    @PutMapping("/achievements/{id}")
    public AchievementDto updateAchievement(@PathVariable String id, @RequestBody AchievementDto req) {
        return allianceService.updateAchievement(id, req);
    }

    @DeleteMapping("/achievements/{id}")
    public Map<String, String> deleteAchievement(@PathVariable String id) {
        return allianceService.deleteAchievement(id);
    }

    // 协议
    @GetMapping("/agreements")
    public ListResponse<AgreementDto> listAgreements(@RequestParam(required = false) String search,
                                                     @RequestParam(required = false) String status,
                                                     @RequestParam(defaultValue = "20") long limit,
                                                     @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listAgreements(search, status, limit, offset);
    }

    @GetMapping("/agreements/{id}")
    public AgreementDto getAgreement(@PathVariable String id) {
        return allianceService.getAgreement(id);
    }

    @PostMapping("/agreements")
    public AgreementDto createAgreement(@RequestBody AgreementDto req) {
        return allianceService.createAgreement(req);
    }

    @PutMapping("/agreements/{id}")
    public AgreementDto updateAgreement(@PathVariable String id, @RequestBody AgreementDto req) {
        return allianceService.updateAgreement(id, req);
    }

    @DeleteMapping("/agreements/{id}")
    public Map<String, String> deleteAgreement(@PathVariable String id) {
        return allianceService.deleteAgreement(id);
    }

    // 权限
    @GetMapping("/permissions")
    public ListResponse<PermissionDto> listPermissions(@RequestParam(required = false) String search,
                                                       @RequestParam(defaultValue = "20") long limit,
                                                       @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listPermissions(search, limit, offset);
    }

    @GetMapping("/permissions/{id}")
    public PermissionDto getPermission(@PathVariable String id) {
        return allianceService.getPermission(id);
    }

    @PostMapping("/permissions")
    public Map<String, String> createPermission(@RequestBody PermissionDto req) {
        return allianceService.createPermission(req);
    }

    @PutMapping("/permissions/{id}")
    public Map<String, String> updatePermission(@PathVariable String id, @RequestBody PermissionDto req) {
        return allianceService.updatePermission(id, req);
    }

    @DeleteMapping("/permissions/{id}")
    public Map<String, String> deletePermission(@PathVariable String id) {
        return allianceService.deletePermission(id);
    }

    // 字典
    @GetMapping("/dictionaries/{dictType}")
    public ListResponse<DictionaryDto> listDictionaries(@PathVariable String dictType) {
        return allianceService.listDictionaries(dictType);
    }

    @PostMapping("/dictionaries/{dictType}")
    public Map<String, String> createDictionary(@PathVariable String dictType, @RequestBody DictionaryCreateRequest req) {
        return allianceService.createDictionary(dictType, req);
    }

    @PutMapping("/dictionaries/{dictType}/{id}")
    public Map<String, String> updateDictionary(@PathVariable String dictType, @PathVariable String id,
                                                @RequestBody DictionaryUpdateRequest req) {
        return allianceService.updateDictionary(dictType, id, req);
    }

    @DeleteMapping("/dictionaries/{dictType}/{id}")
    public Map<String, String> deleteDictionary(@PathVariable String dictType, @PathVariable String id) {
        return allianceService.deleteDictionary(dictType, id);
    }

    // 品牌
    @GetMapping("/brands")
    public ListResponse<BrandDto> listBrands(@RequestParam(required = false) String search,
                                             @RequestParam(required = false) String brandType,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "20") long limit,
                                             @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listBrands(search, brandType, status, limit, offset);
    }

    @GetMapping("/brands/talent-ranking")
    public Map<String, Object> listTalentRanking(@RequestParam(required = false) String search) {
        return allianceService.listTalentRanking(search);
    }

    @GetMapping("/brands/rank-configs")
    public Map<String, Object> listBrandMajorRankConfigs() {
        return allianceService.listBrandMajorRankConfigs();
    }

    @PutMapping("/brands/rank-configs")
    public Map<String, Object> saveBrandMajorRankConfigs(@RequestBody RankConfigsSaveRequest req) {
        return allianceService.saveBrandMajorRankConfigs(req);
    }

    @GetMapping("/brands/{id}")
    public BrandDto getBrand(@PathVariable String id) {
        return allianceService.getBrand(id);
    }

    @PostMapping("/brands")
    public BrandDto createBrand(@RequestBody BrandDto req) {
        return allianceService.createBrand(req);
    }

    @PutMapping("/brands/{id}")
    public BrandDto updateBrand(@PathVariable String id, @RequestBody BrandDto req) {
        return allianceService.updateBrand(id, req);
    }

    @DeleteMapping("/brands/{id}")
    public Map<String, String> deleteBrand(@PathVariable String id) {
        return allianceService.deleteBrand(id);
    }

    // 专家
    @GetMapping("/experts")
    public ListResponse<ExpertDto> listExperts(@RequestParam(required = false) String search,
                                               @RequestParam(required = false) String status,
                                               @RequestParam(required = false) String enterpriseId,
                                               @RequestParam(defaultValue = "20") long limit,
                                               @RequestParam(defaultValue = "0") long offset) {
        return allianceService.listExperts(search, status, enterpriseId, limit, offset);
    }

    @GetMapping("/experts/mentor-options")
    public ListResponse<MentorOptionDto> listMentorOptions() {
        return allianceService.listMentorOptions();
    }

    @GetMapping("/experts/{id}")
    public ExpertDto getExpert(@PathVariable String id) {
        return allianceService.getExpert(id);
    }

    @PutMapping("/experts/{id}/display")
    public Map<String, Object> toggleExpertDisplay(@PathVariable String id, @RequestBody DisplayToggleRequest req) {
        return allianceService.toggleExpertDisplay(id, Boolean.TRUE.equals(req.getIsPublic()));
    }

    @PostMapping("/experts")
    public ExpertDto createExpert(@RequestBody ExpertDto req) {
        return allianceService.createExpert(req);
    }

    @PutMapping("/experts/{id}")
    public ExpertDto updateExpert(@PathVariable String id, @RequestBody ExpertDto req) {
        return allianceService.updateExpert(id, req);
    }

    @DeleteMapping("/experts/{id}")
    public Map<String, String> deleteExpert(@PathVariable String id) {
        return allianceService.deleteExpert(id);
    }
}
