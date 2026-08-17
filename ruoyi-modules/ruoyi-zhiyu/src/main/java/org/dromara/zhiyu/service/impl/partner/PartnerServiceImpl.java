package org.dromara.zhiyu.service.impl.partner;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ChangePasswordRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAchievementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAgreement;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAgreementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAchievement;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationProject;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationProjectDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationSchool;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.Dashboard;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MentorTask;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.Milestone;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MonthCount;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.NewMonthCount;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ProfileUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.School;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SchoolStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.domain.partner.PartnerExpert;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.partner.PartnerCooperationMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseLinkMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseMapper;
import org.dromara.zhiyu.mapper.partner.PartnerExpertMapper;
import org.dromara.zhiyu.service.partner.IPartnerService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 企业平台服务实现（对齐 Go partner_handler.go + service/partner.go + store/partner_store.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class PartnerServiceImpl implements IPartnerService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };

    private static final Map<String, Map<String, Boolean>> PARTNER_LINK_TRANSITIONS = Map.of(
        "negotiating", Map.of("active", true, "terminated", true),
        "active", Map.of("paused", true, "terminated", true),
        "paused", Map.of("active", true, "terminated", true),
        "terminated", Map.of()
    );

    private final PartnerEnterpriseMapper enterpriseMapper;
    private final PartnerExpertMapper expertMapper;
    private final PartnerEnterpriseLinkMapper linkMapper;
    private final PartnerCooperationMapper cooperationMapper;
    private final ZhiyuUserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ===== 企业主体 =====

    @Override
    public PartnerEnterprise getProfile() {
        return resolveEnterprise(requireTenant());
    }

    @Override
    public PartnerEnterprise updateProfile(ProfileUpdateRequest req) {
        String tenantId = requireTenant();
        PartnerEnterprise existing = resolveEnterprise(tenantId);

        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String industry = req.getIndustry() != null ? req.getIndustry() : existing.getIndustry();
        String region = req.getRegion() != null ? req.getRegion() : existing.getRegion();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String logoUrl = req.getLogoUrl() != null ? req.getLogoUrl() : existing.getLogoUrl();
        String coverImage = req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage();
        List<String> cooperationTypes = req.getCooperationTypes() != null ? req.getCooperationTypes() : existing.getCooperationTypes();
        String contactPerson = req.getContactPerson() != null ? req.getContactPerson() : existing.getContactPerson();
        String contactPhone = req.getContactPhone() != null ? req.getContactPhone() : existing.getContactPhone();
        String contactEmail = req.getContactEmail() != null ? req.getContactEmail() : existing.getContactEmail();
        String address = req.getAddress() != null ? req.getAddress() : existing.getAddress();
        String creditCode = req.getUnifiedSocialCreditCode() != null ? req.getUnifiedSocialCreditCode() : existing.getUnifiedSocialCreditCode();
        Integer establishedYear = req.getEstablishedYear() != null ? req.getEstablishedYear() : existing.getEstablishedYear();
        Integer employeeCount = req.getEmployeeCount() != null ? req.getEmployeeCount() : existing.getEmployeeCount();
        List<String> businessLicense = req.getBusinessLicensePhotos() != null ? req.getBusinessLicensePhotos() : existing.getBusinessLicensePhotos();
        List<String> qualification = req.getQualificationPhotos() != null ? req.getQualificationPhotos() : existing.getQualificationPhotos();
        List<String> ipPhotos = req.getIntellectualPropertyPhotos() != null ? req.getIntellectualPropertyPhotos() : existing.getIntellectualPropertyPhotos();
        List<String> coverPhotos = req.getCoverPhotos() != null ? req.getCoverPhotos() : existing.getCoverPhotos();
        boolean enablePublic = req.getEnablePublic() != null ? req.getEnablePublic() : Boolean.TRUE.equals(existing.getEnablePublic());

        enterpriseMapper.updateProfile(existing.getId(), tenantId, name, industry, region, description, logoUrl,
            coverImage, cooperationTypes, contactPerson, contactPhone, contactEmail, address, creditCode,
            establishedYear, employeeCount, businessLicense, qualification, ipPhotos, coverPhotos, enablePublic);
        enterpriseMapper.syncTenantFields(tenantId, name, contactPerson, contactPhone, creditCode);
        return resolveEnterprise(tenantId);
    }

    // ===== 专家 =====

    @Override
    public ListResponse<PartnerExpert> listExperts(String search, long limit, long offset) {
        String tenantId = requireTenant();
        LambdaQueryBuilder<PartnerExpert> wrapper = QueryBuilder.lambda(PartnerExpert.class)
            .eq(PartnerExpert::getTenantId, tenantId);
        if (search != null && !search.isEmpty()) {
            wrapper.like(PartnerExpert::getName, search);
        }
        long total = expertMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(PartnerExpert::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(expertMapper.selectList(wrapper.build()), total);
    }

    @Override
    public PartnerExpert getExpert(String id) {
        return fetchExpert(id, requireTenant());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExpertCreateResponse createExpert(ExpertCreateRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "专家姓名不能为空");
        }
        if (req.getUsername() == null || req.getUsername().isEmpty()) {
            throw new ApiException(400, "bad_request", "登录用户名不能为空");
        }
        validatePassword(req.getPassword());
        PartnerEnterprise enterprise = resolveEnterprise(tenantId);

        // 创建绑定账号（enterprise_member）
        String accountUserId = createUserAccount(tenantId, "enterprise_member", req.getUsername(), req.getPassword(),
            req.getName(), "enterprise");

        PartnerExpert expert = new PartnerExpert();
        expert.setId(UUID.randomUUID().toString());
        expert.setTenantId(tenantId);
        expert.setName(req.getName());
        expert.setGender(req.getGender());
        expert.setAge(req.getAge());
        expert.setTitle(req.getTitle());
        expert.setPosition(req.getPosition());
        expert.setExpertType(req.getExpertType());
        expert.setIndustry(req.getIndustry());
        expert.setProfessionalFields(req.getProfessionalFields());
        expert.setSpecialties(req.getSpecialties());
        expert.setExperienceYears(req.getExperienceYears());
        expert.setEducation(req.getEducation());
        expert.setIntroduction(req.getIntroduction());
        expert.setWorkExperience(req.getWorkExperience());
        expert.setCity(req.getCity());
        expert.setAvatarUrl(req.getAvatarUrl());
        expert.setCoverImage(req.getCoverImage());
        expert.setPhotos(req.getPhotos());
        expert.setAttachments(req.getAttachments());
        expert.setEnterpriseId(enterprise.getId());
        expert.setOrganization(req.getOrganization());
        expert.setRating(req.getRating());
        expert.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? "active" : req.getStatus());
        expert.setPartnerSource(req.getPartnerSource());
        expert.setPositionDirection(req.getPositionDirection());
        expert.setSecondaryColleges(req.getSecondaryColleges());
        expert.setIsPublic(req.getIsPublic());
        expert.setUserId(accountUserId);
        expert.setCreatedBy(userId);

        expertMapper.insertExpert(expert.getId(), expert.getTenantId(), expert.getName(), expert.getGender(),
            expert.getAge(), expert.getTitle(), expert.getPosition(), expert.getExpertType(), expert.getIndustry(),
            expert.getProfessionalFields(), expert.getSpecialties(), expert.getExperienceYears(), expert.getEducation(),
            expert.getIntroduction(), expert.getWorkExperience(), expert.getCity(), expert.getAvatarUrl(),
            expert.getCoverImage(), expert.getPhotos(), expert.getAttachments(), expert.getEnterpriseId(),
            expert.getOrganization(), expert.getRating(), expert.getStatus(), expert.getPartnerSource(),
            expert.getPositionDirection(), expert.getSecondaryColleges(), expert.getIsPublic(), expert.getUserId(),
            expert.getCreatedBy());

        ExpertCreateResponse resp = new ExpertCreateResponse();
        resp.setExpert(fetchExpert(expert.getId(), tenantId));
        resp.setUsername(req.getUsername());
        resp.setInitialPassword(req.getPassword());
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PartnerExpert updateExpert(String id, ExpertUpdateRequest req) {
        String tenantId = requireTenant();
        PartnerExpert existing = fetchExpert(id, tenantId);
        PartnerExpert merged = mergeExpertPartial(existing, req);

        // 绑定账号校验
        if (merged.getUserId() != null) {
            ZhiyuUser u = userMapper.selectById(merged.getUserId());
            if (u == null || u.getTenantId() == null || !u.getTenantId().equals(tenantId)) {
                throw new ApiException(400, "bad_request", "绑定账号不属于本租户");
            }
        }
        if (req.getPassword() != null && !req.getPassword().isEmpty()) {
            validatePassword(req.getPassword());
        }

        updateExpertRow(id, tenantId, merged);

        if (req.getPassword() != null && !req.getPassword().isEmpty() && existing.getUserId() != null) {
            resetPassword(tenantId, existing.getUserId(), req.getPassword());
        }
        return fetchExpert(id, tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteExpert(String id) {
        String tenantId = requireTenant();
        PartnerExpert expert = fetchExpert(id, tenantId);
        if (expert.getUserId() != null) {
            expertMapper.removeExpertFromReviewSteps(expert.getUserId());
            expertMapper.deleteUserRoles(expert.getUserId());
            expertMapper.deleteUser(expert.getUserId());
        }
        expertMapper.deleteExpert(id, tenantId);
        return id;
    }

    @Override
    public PartnerExpert getMyExpert() {
        String tenantId = requireTenant();
        String userId = requireUser();
        List<PartnerExpert> rows = expertMapper.selectList(QueryBuilder.lambda(PartnerExpert.class)
            .eq(PartnerExpert::getTenantId, tenantId)
            .eq(PartnerExpert::getUserId, userId)
            .build());
        if (rows.isEmpty()) {
            throw new ApiException(404, "not_found", "未找到我的专家档案");
        }
        return rows.get(0);
    }

    @Override
    public PartnerExpert updateMyExpert(ExpertUpdateRequest req) {
        String tenantId = requireTenant();
        PartnerExpert existing = getMyExpert();
        PartnerExpert merged = mergeExpertPartial(existing, req);
        merged.setTenantId(tenantId);
        merged.setCreatedBy(existing.getCreatedBy());
        updateExpertRow(existing.getId(), tenantId, merged);
        return fetchExpert(existing.getId(), tenantId);
    }

    // ===== 工作台 =====

    @Override
    public Dashboard dashboard() {
        String tenantId = requireTenant();
        Dashboard d = new Dashboard();
        d.setExpertCount((int) cooperationMapper.countExperts(tenantId));
        d.setSchoolCount((int) linkMapper.countByEnterpriseTenant(tenantId));
        d.setMemberCount((int) cooperationMapper.countMembers(tenantId));
        d.setPublicExpertCount((int) cooperationMapper.countPublicExperts(tenantId));

        List<PartnerEnterpriseLinkMapper.MonthCountRow> schoolMonths = linkMapper.countMonthlyLinks(tenantId, 6);
        d.setMonthlySchoolCounts(schoolMonths.stream().map(r -> {
            MonthCount m = new MonthCount();
            m.setMonth(r.getMonth());
            m.setCount((int) r.getCount());
            return m;
        }).toList());

        PartnerEnterprise enterprise = tryResolveEnterprise(tenantId);
        if (enterprise != null) {
            d.setCoBuildPositionCount((int) cooperationMapper.countCoBuildPositions(enterprise.getId()));
            d.setCoBuildScenarioCount((int) cooperationMapper.countCoBuildScenarios(enterprise.getId()));
            d.setMonthlyNewCounts(cooperationMapper.countMonthlyNew(tenantId, enterprise.getId(), 6).stream().map(r -> {
                NewMonthCount m = new NewMonthCount();
                m.setMonth(r.getMonth());
                m.setExperts(r.getExperts());
                m.setPositions(r.getPositions());
                m.setScenarios(r.getScenarios());
                return m;
            }).toList());
            d.setContentMonthlyCounts(cooperationMapper.countMonthlyContent(enterprise.getId(), 6).stream().map(r -> {
                org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ContentMonthCount m =
                    new org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ContentMonthCount();
                m.setMonth(r.getMonth());
                m.setProjects(r.getProjects());
                m.setAgreements(r.getAgreements());
                m.setAchievements(r.getAchievements());
                return m;
            }).toList());
        } else {
            d.setMonthlyNewCounts(List.of());
            d.setContentMonthlyCounts(List.of());
        }
        return d;
    }

    // ===== 合作学校 =====

    @Override
    public ListResponse<School> listSchools() {
        List<School> schools = linkMapper.listSchools(requireTenant());
        return ListResponse.of(schools, schools.size());
    }

    @Override
    public School updateSchoolStatus(String schoolTenantId, SchoolStatusRequest req) {
        String tenantId = requireTenant();
        String status = req.getStatus();
        if (!"active".equals(status) && !"paused".equals(status) && !"terminated".equals(status)) {
            throw new ApiException(400, "bad_request", "无效合作状态（仅支持 active/paused/terminated）");
        }
        School view = linkMapper.getSchool(tenantId, schoolTenantId);
        if (view == null) {
            throw new ApiException(404, "not_found", "合作关系不存在");
        }
        Map<String, Boolean> allowed = PARTNER_LINK_TRANSITIONS.getOrDefault(view.getStatus(), Map.of());
        if (!allowed.getOrDefault(status, false)) {
            throw new ApiException(400, "bad_request",
                "非法合作状态流转：不允许从 " + view.getStatus() + " 变更为 " + status);
        }
        linkMapper.updateSchoolStatus(tenantId, schoolTenantId, status);
        return linkMapper.getSchool(tenantId, schoolTenantId);
    }

    // ===== 合作内容 =====

    @Override
    public List<CooperationSchool> listCooperation() {
        String enterpriseId = resolveEnterprise(requireTenant()).getId();
        List<CooperationSchool> schools = cooperationMapper.listCooperationSchools(enterpriseId);
        if (schools.isEmpty()) {
            return schools;
        }
        Map<String, CooperationSchool> byTenant = new LinkedHashMap<>();
        for (CooperationSchool s : schools) {
            s.setProjects(new ArrayList<>());
            s.setAchievements(new ArrayList<>());
            s.setAgreements(new ArrayList<>());
            byTenant.put(s.getTenantId(), s);
        }
        for (PartnerCooperationMapper.ProjectRow r : cooperationMapper.listCooperationProjects(enterpriseId)) {
            CooperationSchool s = byTenant.get(r.getTenantId());
            if (s != null) {
                CooperationProject p = new CooperationProject();
                p.setId(r.getId());
                p.setName(r.getName());
                p.setPhase(r.getPhase());
                p.setIsPublic(r.getIsPublic());
                p.setUpdatedAt(r.getUpdatedAt());
                s.getProjects().add(p);
            }
        }
        for (PartnerCooperationMapper.AchievementRow r : cooperationMapper.listCooperationAchievements(enterpriseId)) {
            CooperationSchool s = byTenant.get(r.getTenantId());
            if (s != null) {
                CooperationAchievement a = new CooperationAchievement();
                a.setId(r.getId());
                a.setTitle(r.getTitle());
                a.setType(r.getType());
                a.setIsPublic(r.getIsPublic());
                a.setUpdatedAt(r.getUpdatedAt());
                s.getAchievements().add(a);
            }
        }
        for (PartnerCooperationMapper.AgreementRow r : cooperationMapper.listCooperationAgreements(enterpriseId)) {
            CooperationSchool s = byTenant.get(r.getTenantId());
            if (s != null) {
                CooperationAgreement a = new CooperationAgreement();
                a.setId(r.getId());
                a.setName(r.getName());
                a.setType(r.getType());
                a.setStatus(r.getStatus());
                a.setIsPublic(r.getIsPublic());
                a.setUpdatedAt(r.getUpdatedAt());
                s.getAgreements().add(a);
            }
        }
        List<CooperationSchool> filtered = new ArrayList<>();
        for (CooperationSchool s : schools) {
            if (!s.getProjects().isEmpty() || !s.getAchievements().isEmpty() || !s.getAgreements().isEmpty()) {
                filtered.add(s);
            }
        }
        return filtered;
    }

    @Override
    public CooperationProjectDetail getCooperationProject(String id) {
        String enterpriseId = resolveEnterprise(requireTenant()).getId();
        PartnerCooperationMapper.ProjectDetailRow r = cooperationMapper.getCooperationProject(enterpriseId, id);
        if (r == null) {
            throw new ApiException(404, "not_found", "项目不存在或无权查看");
        }
        CooperationProjectDetail d = new CooperationProjectDetail();
        d.setId(r.getId());
        d.setName(r.getName());
        d.setType(r.getType());
        d.setDescription(r.getDescription());
        d.setPhase(r.getPhase());
        d.setPublishStatus(r.getPublishStatus());
        d.setStartDate(r.getStartDate());
        d.setEndDate(r.getEndDate());
        d.setBudget(r.getBudget());
        d.setSecondaryColleges(parseStringList(r.getSecondaryColleges()));
        d.setIsPublic(r.getIsPublic());
        d.setCreatedAt(r.getCreatedAt());
        d.setUpdatedAt(r.getUpdatedAt());
        List<Milestone> milestones = new ArrayList<>();
        for (PartnerCooperationMapper.MilestoneRow m : cooperationMapper.listMilestones(id)) {
            Milestone mm = new Milestone();
            mm.setId(m.getId());
            mm.setName(m.getName());
            mm.setDescription(m.getDescription());
            mm.setDueDate(m.getDueDate());
            mm.setCompletedDate(m.getCompletedDate());
            mm.setIsCompleted(m.getIsCompleted());
            milestones.add(mm);
        }
        d.setMilestones(milestones);
        return d;
    }

    @Override
    public CooperationAchievementDetail getCooperationAchievement(String id) {
        String enterpriseId = resolveEnterprise(requireTenant()).getId();
        PartnerCooperationMapper.AchievementDetailRow r = cooperationMapper.getCooperationAchievement(enterpriseId, id);
        if (r == null) {
            throw new ApiException(404, "not_found", "成果不存在或无权查看");
        }
        CooperationAchievementDetail d = new CooperationAchievementDetail();
        d.setId(r.getId());
        d.setTitle(r.getTitle());
        d.setType(r.getType());
        d.setDescription(r.getDescription());
        d.setAchievementDate(r.getAchievementDate());
        d.setCitationReason(r.getCitationReason());
        d.setOwnerPersons(parseStringList(r.getOwnerPersons()));
        d.setCoBuilders(parseStringList(r.getCoBuilders()));
        d.setSecondaryColleges(parseStringList(r.getSecondaryColleges()));
        d.setStatus(r.getStatus());
        d.setViewCount(r.getViewCount());
        d.setIsPublic(r.getIsPublic());
        d.setCreatedAt(r.getCreatedAt());
        d.setUpdatedAt(r.getUpdatedAt());
        return d;
    }

    @Override
    public CooperationAgreementDetail getCooperationAgreement(String id) {
        String enterpriseId = resolveEnterprise(requireTenant()).getId();
        PartnerCooperationMapper.AgreementDetailRow r = cooperationMapper.getCooperationAgreement(enterpriseId, id);
        if (r == null) {
            throw new ApiException(404, "not_found", "协议不存在或无权查看");
        }
        CooperationAgreementDetail d = new CooperationAgreementDetail();
        d.setId(r.getId());
        d.setName(r.getName());
        d.setType(r.getType());
        d.setContent(r.getContent());
        d.setStartDate(r.getStartDate());
        d.setEndDate(r.getEndDate());
        d.setStatus(r.getStatus());
        d.setIsPublic(r.getIsPublic());
        d.setCreatedAt(r.getCreatedAt());
        d.setUpdatedAt(r.getUpdatedAt());
        return d;
    }

    @Override
    public List<MentorTask> listMentorTasks() {
        String enterpriseId = resolveEnterprise(requireTenant()).getId();
        return cooperationMapper.listMentorTasks(enterpriseId);
    }

    // ===== 密码 =====

    @Override
    public String changeMyPassword(ChangePasswordRequest req) {
        String userId = requireUser();
        String tenantId = requireTenant();
        if (req.getOldPassword() == null || req.getOldPassword().isEmpty()) {
            throw new ApiException(400, "bad_request", "旧密码不能为空");
        }
        validatePassword(req.getNewPassword());
        ZhiyuUser user = userMapper.selectById(userId);
        if (user == null || !passwordEncoder.matches(req.getOldPassword(), user.getPasswordHash())) {
            throw new ApiException(400, "bad_request", "旧密码不正确");
        }
        resetPassword(tenantId, userId, req.getNewPassword());
        return userId;
    }

    // ===== 工具 =====

    private PartnerEnterprise resolveEnterprise(String tenantId) {
        PartnerEnterprise e = tryResolveEnterprise(tenantId);
        if (e == null) {
            throw new ApiException(404, "not_found", "企业主体不存在");
        }
        return e;
    }

    private PartnerEnterprise tryResolveEnterprise(String tenantId) {
        List<PartnerEnterprise> rows = enterpriseMapper.selectList(
            QueryBuilder.lambda(PartnerEnterprise.class).eq(PartnerEnterprise::getTenantId, tenantId).build());
        return rows.isEmpty() ? null : rows.get(0);
    }

    private PartnerExpert fetchExpert(String id, String tenantId) {
        List<PartnerExpert> rows = expertMapper.selectList(QueryBuilder.lambda(PartnerExpert.class)
            .eq(PartnerExpert::getId, id).eq(PartnerExpert::getTenantId, tenantId).build());
        if (rows.isEmpty()) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        return rows.get(0);
    }

    private void updateExpertRow(String id, String tenantId, PartnerExpert e) {
        expertMapper.updateExpert(id, tenantId, e.getName(), e.getGender(), e.getAge(), e.getTitle(), e.getPosition(),
            e.getExpertType(), e.getIndustry(), e.getProfessionalFields(), e.getSpecialties(), e.getExperienceYears(),
            e.getEducation(), e.getIntroduction(), e.getWorkExperience(), e.getCity(), e.getAvatarUrl(),
            e.getCoverImage(), e.getPhotos(), e.getAttachments(), e.getEnterpriseId(), e.getOrganization(),
            e.getRating(), e.getStatus(), e.getPartnerSource(), e.getPositionDirection(), e.getSecondaryColleges(),
            e.getIsPublic(), e.getUserId());
    }

    /** 部分更新兜底（对齐 Go applyExpertPartialUpdate）。 */
    private PartnerExpert mergeExpertPartial(PartnerExpert existing, ExpertUpdateRequest req) {
        PartnerExpert e = new PartnerExpert();
        e.setName(req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName());
        e.setGender(req.getGender() != null ? req.getGender() : existing.getGender());
        e.setAge(req.getAge() != null ? req.getAge() : existing.getAge());
        e.setTitle(req.getTitle() != null ? req.getTitle() : existing.getTitle());
        e.setPosition(req.getPosition() != null ? req.getPosition() : existing.getPosition());
        e.setExpertType(req.getExpertType() != null ? req.getExpertType() : existing.getExpertType());
        e.setIndustry(req.getIndustry() != null ? req.getIndustry() : existing.getIndustry());
        e.setProfessionalFields(nonEmpty(req.getProfessionalFields()) ? req.getProfessionalFields() : existing.getProfessionalFields());
        e.setSpecialties(nonEmpty(req.getSpecialties()) ? req.getSpecialties() : existing.getSpecialties());
        e.setExperienceYears(req.getExperienceYears() != null ? req.getExperienceYears() : existing.getExperienceYears());
        e.setEducation(req.getEducation() != null ? req.getEducation() : existing.getEducation());
        e.setIntroduction(req.getIntroduction() != null ? req.getIntroduction() : existing.getIntroduction());
        e.setWorkExperience(req.getWorkExperience() != null ? req.getWorkExperience() : existing.getWorkExperience());
        e.setCity(req.getCity() != null ? req.getCity() : existing.getCity());
        e.setAvatarUrl(req.getAvatarUrl() != null ? req.getAvatarUrl() : existing.getAvatarUrl());
        e.setCoverImage(req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage());
        e.setPhotos(nonEmpty(req.getPhotos()) ? req.getPhotos() : existing.getPhotos());
        e.setAttachments(nonEmpty(req.getAttachments()) ? req.getAttachments() : existing.getAttachments());
        e.setOrganization(req.getOrganization() != null ? req.getOrganization() : existing.getOrganization());
        e.setRating(req.getRating() != null ? req.getRating() : existing.getRating());
        e.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? existing.getStatus() : req.getStatus());
        e.setPartnerSource(req.getPartnerSource() != null ? req.getPartnerSource() : existing.getPartnerSource());
        e.setPositionDirection(req.getPositionDirection() != null ? req.getPositionDirection() : existing.getPositionDirection());
        e.setSecondaryColleges(nonEmpty(req.getSecondaryColleges()) ? req.getSecondaryColleges() : existing.getSecondaryColleges());
        e.setIsPublic(req.getIsPublic() != null ? req.getIsPublic() : existing.getIsPublic());
        e.setUserId(req.getUserId() != null ? req.getUserId() : existing.getUserId());
        e.setEnterpriseId(existing.getEnterpriseId());
        e.setTenantId(existing.getTenantId());
        e.setCreatedBy(existing.getCreatedBy());
        return e;
    }

    /** 创建企业成员账号（返回 user id；对齐 Go Users().Create）。 */
    private String createUserAccount(String tenantId, String roleCode, String username, String password, String name,
                                     String role) {
        String roleId = expertMapper.selectRoleIdByCode(tenantId, roleCode);
        if (roleId == null) {
            throw new ApiException(500, "internal_error", "角色不存在");
        }
        ZhiyuUser user = new ZhiyuUser();
        user.setId(UUID.randomUUID().toString());
        user.setTenantId(tenantId);
        user.setRole(role);
        user.setPlatform("partner");
        user.setLoginName(tenantId + "_" + username);
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setName(name);
        user.setStatus("active");
        user.setPasswordChangedAt(OffsetDateTime.now());
        userMapper.insert(user);
        expertMapper.insertUserRole(UUID.randomUUID().toString(), user.getId(), roleId);
        expertMapper.incrementRoleUserCount(roleId);
        return user.getId();
    }

    private void resetPassword(String tenantId, String userId, String newPassword) {
        ZhiyuUser patch = new ZhiyuUser();
        patch.setPasswordHash(passwordEncoder.encode(newPassword));
        patch.setPasswordChangedAt(OffsetDateTime.now());
        userMapper.update(patch, QueryBuilder.lambda(ZhiyuUser.class)
            .eq(ZhiyuUser::getId, userId).eq(ZhiyuUser::getTenantId, tenantId).build());
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }
        if (!hasLetter || !hasDigit) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private boolean nonEmpty(List<String> list) {
        return list != null && !list.isEmpty();
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 20;
        }
        return Math.min(limit, 200);
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
