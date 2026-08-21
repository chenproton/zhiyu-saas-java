package org.dromara.zhiyu.controller.partner;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ChangePasswordRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAchievementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAgreementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationProjectDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationSchool;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.Dashboard;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MentorTask;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ProfileUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.School;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SchoolStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.domain.partner.PartnerExpert;
import org.dromara.zhiyu.service.partner.IPartnerService;
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

import java.util.List;
import java.util.Map;

/**
 * 企业平台控制器（对齐 Go routes_partner.go，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/partner")
public class PartnerController {

    private final IPartnerService partnerService;

    // ===== 企业主体 =====

    @GetMapping("/enterprise/profile")
    public PartnerEnterprise getProfile() {
        return partnerService.getProfile();
    }

    @PutMapping("/enterprise/profile")
    public PartnerEnterprise updateProfile(@RequestBody ProfileUpdateRequest req) {
        return partnerService.updateProfile(req);
    }

    // ===== 专家 =====

    @GetMapping("/experts")
    public ListResponse<PartnerExpert> listExperts(@RequestParam(value = "search", required = false) String search,
                                                   @RequestParam(value = "limit", required = false) Long limit,
                                                   @RequestParam(value = "offset", required = false) Long offset) {
        return partnerService.listExperts(search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/experts/me")
    public PartnerExpert getMyExpert() {
        return partnerService.getMyExpert();
    }

    @PutMapping("/experts/me")
    public PartnerExpert updateMyExpert(@RequestBody ExpertUpdateRequest req) {
        return partnerService.updateMyExpert(req);
    }

    @GetMapping("/experts/{id}")
    public PartnerExpert getExpert(@PathVariable String id) {
        return partnerService.getExpert(id);
    }

    @PostMapping("/experts")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpertCreateResponse createExpert(@RequestBody ExpertCreateRequest req) {
        return partnerService.createExpert(req);
    }

    @PutMapping("/experts/{id}")
    public PartnerExpert updateExpert(@PathVariable String id, @RequestBody ExpertUpdateRequest req) {
        return partnerService.updateExpert(id, req);
    }

    @DeleteMapping("/experts/{id}")
    public Map<String, String> deleteExpert(@PathVariable String id) {
        return Map.of("id", partnerService.deleteExpert(id));
    }

    // ===== 工作台 / 学校 / 合作内容 / 密码 =====

    @GetMapping("/workspace/dashboard")
    public Dashboard dashboard() {
        return partnerService.dashboard();
    }

    @GetMapping("/schools")
    public ListResponse<School> listSchools() {
        return partnerService.listSchools();
    }

    @PutMapping("/schools/{tenantId}/status")
    public School updateSchoolStatus(@PathVariable String tenantId, @RequestBody SchoolStatusRequest req) {
        return partnerService.updateSchoolStatus(tenantId, req);
    }

    @GetMapping("/cooperation")
    public Map<String, List<CooperationSchool>> listCooperation() {
        return Map.of("schools", partnerService.listCooperation());
    }

    @GetMapping("/cooperation/projects/{id}")
    public CooperationProjectDetail getCooperationProject(@PathVariable String id) {
        return partnerService.getCooperationProject(id);
    }

    @GetMapping("/cooperation/achievements/{id}")
    public CooperationAchievementDetail getCooperationAchievement(@PathVariable String id) {
        return partnerService.getCooperationAchievement(id);
    }

    @GetMapping("/cooperation/agreements/{id}")
    public CooperationAgreementDetail getCooperationAgreement(@PathVariable String id) {
        return partnerService.getCooperationAgreement(id);
    }

    @GetMapping("/mentor-tasks")
    public Map<String, List<MentorTask>> listMentorTasks() {
        return Map.of("items", partnerService.listMentorTasks());
    }

    @PutMapping("/me/password")
    public Map<String, String> changeMyPassword(@RequestBody ChangePasswordRequest req) {
        return Map.of("id", partnerService.changeMyPassword(req));
    }
}
