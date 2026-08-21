package org.dromara.zhiyu.service.impl.alliance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.alliance.AllianceAchievement;
import org.dromara.zhiyu.domain.alliance.AllianceAgreement;
import org.dromara.zhiyu.domain.alliance.AllianceBrand;
import org.dromara.zhiyu.domain.alliance.AllianceDictionary;
import org.dromara.zhiyu.domain.alliance.AllianceEnterprise;
import org.dromara.zhiyu.domain.alliance.AllianceEnterpriseLink;
import org.dromara.zhiyu.domain.alliance.AllianceExpert;
import org.dromara.zhiyu.domain.alliance.AlliancePermission;
import org.dromara.zhiyu.domain.alliance.AllianceProject;
import org.dromara.zhiyu.domain.alliance.AllianceProjectMilestone;
import org.dromara.zhiyu.domain.alliance.AllianceResourceGrant;
import org.dromara.zhiyu.domain.alliance.AllianceSchoolInfo;
import org.dromara.zhiyu.domain.alliance.BrandMajorRankConfig;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;
import org.dromara.zhiyu.mapper.ZhiyuTenantMapper;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceAchievementMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceAgreementMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceBrandMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceDictionaryMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceEnterpriseLinkMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceEnterpriseMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceExpertMapper;
import org.dromara.zhiyu.mapper.alliance.AlliancePermissionMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceProjectMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceProjectMilestoneMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceResourceGrantMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceSchoolInfoMapper;
import org.dromara.zhiyu.mapper.alliance.BrandMajorRankConfigMapper;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.service.alliance.IAllianceService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 联盟 school 侧服务实现（对齐 Go alliance_handler.go + store/alliance_*.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AllianceServiceImpl implements IAllianceService {

    private final AllianceSchoolInfoMapper schoolInfoMapper;
    private final AllianceEnterpriseMapper enterpriseMapper;
    private final AllianceEnterpriseLinkMapper linkMapper;
    private final AllianceResourceGrantMapper grantMapper;
    private final AllianceProjectMapper projectMapper;
    private final AllianceProjectMilestoneMapper milestoneMapper;
    private final AllianceAchievementMapper achievementMapper;
    private final AllianceExpertMapper expertMapper;
    private final AllianceAgreementMapper agreementMapper;
    private final AlliancePermissionMapper permissionMapper;
    private final AllianceDictionaryMapper dictionaryMapper;
    private final AllianceBrandMapper brandMapper;
    private final BrandMajorRankConfigMapper rankConfigMapper;
    private final ZhiyuTenantMapper tenantMapper;
    private final ZhiyuUserMapper userMapper;
    private final SystemRoleMapper roleMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ===== 学校信息 =====

    @Override
    public SchoolInfoDto getSchoolInfo() {
        String tenantId = AllianceSupport.requireTenant();
        AllianceSchoolInfo info = schoolInfoMapper.selectByTenant(tenantId);
        if (info == null) {
            SchoolInfoDto dto = new SchoolInfoDto();
            dto.setTenantId(tenantId);
            dto.setName("");
            return dto;
        }
        return toSchoolInfoDto(info);
    }

    @Override
    public SchoolInfoDto updateSchoolInfo(SchoolInfoDto req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceSchoolInfo info = new AllianceSchoolInfo();
        info.setTenantId(tenantId);
        info.setName(req.getName() == null ? "" : req.getName());
        info.setShortName(req.getShortName());
        info.setSchoolType(req.getSchoolType());
        info.setProvince(req.getProvince());
        info.setCity(req.getCity());
        info.setAddress(req.getAddress());
        info.setWebsite(req.getWebsite());
        info.setContactPhone(req.getContactPhone());
        info.setDescription(req.getDescription());
        info.setLogoUrl(req.getLogoUrl());
        info.setScaleData(AllianceSupport.jsonObjectOrDefault(req.getScaleData(), "{}"));
        info.setSecondaryColleges(AllianceSupport.jsonObjectOrDefault(req.getSecondaryColleges(), "[]"));
        schoolInfoMapper.upsertSchoolInfo(info);
        return getSchoolInfo();
    }

    // ===== 企业 =====

    @Override
    public ListResponse<EnterpriseDto> listEnterprises(String search, String status, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        long safeLimit = AllianceSupport.clampLimit(limit, 200);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceEnterpriseLinkMapper.LinkedEnterpriseRow> rows =
            linkMapper.listBySchoolTenant(tenantId, search, status, (int) safeLimit, (int) safeOffset);
        long total = linkMapper.countBySchoolTenant(tenantId, search, status);
        List<EnterpriseDto> items = new ArrayList<>(rows.size());
        for (AllianceEnterpriseLinkMapper.LinkedEnterpriseRow row : rows) {
            items.add(toEnterpriseDto(row));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public EnterpriseDto getEnterprise(String id) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceEnterpriseLinkMapper.LinkedEnterpriseRow row = linkMapper.selectLinkedByEnterprise(id, tenantId);
        if (row == null) {
            throw new ApiException(404, "not_found", "企业不存在或未引入");
        }
        return toEnterpriseDto(row);
    }

    @Override
    public ListResponse<EnterpriseDto> searchEnterprises(String keyword) {
        String tenantId = AllianceSupport.requireTenant();
        List<AllianceEnterprise> rows = enterpriseMapper.searchEnterprises(tenantId, keyword == null ? "" : keyword, 20);
        List<EnterpriseDto> items = new ArrayList<>(rows.size());
        for (AllianceEnterprise e : rows) {
            items.add(toEnterpriseDto(e));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EnterpriseDto linkEnterprise(String id, EnterpriseLinkRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        String userId = AllianceSupport.currentUserOrNull();
        if (enterpriseMapper.selectByIdGlobal(id) == null) {
            throw new ApiException(404, "not_found", "企业不存在");
        }
        AllianceEnterpriseLink link = new AllianceEnterpriseLink();
        link.setId(UUID.randomUUID().toString());
        link.setTenantId(tenantId);
        link.setEnterpriseId(id);
        link.setRelationType(req.getRelationType() == null || req.getRelationType().isEmpty() ? "alliance" : req.getRelationType());
        link.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? "negotiating" : req.getStatus());
        link.setEnterpriseType(req.getEnterpriseType() == null || req.getEnterpriseType().isEmpty() ? "cooperation" : req.getEnterpriseType());
        link.setRating(req.getRating());
        link.setIsPublic(false);
        link.setSecondaryColleges("[]");
        link.setCreatedBy(userId);
        try {
            linkMapper.insertLink(link);
        } catch (Exception e) {
            throw new ApiException(409, "conflict", "该企业已引入");
        }
        return getEnterprise(id);
    }

    @Override
    public Map<String, String> unlinkEnterprise(String id) {
        String tenantId = AllianceSupport.requireTenant();
        linkMapper.deleteLink(id, tenantId);
        return Map.of("id", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EnterpriseDto registerEnterprise(EnterpriseRegisterRequest req) {
        String schoolTenantId = AllianceSupport.requireTenant();
        String userId = AllianceSupport.currentUserOrNull();
        if (req.getEnterpriseName() == null || req.getEnterpriseName().isBlank()
            || req.getUsername() == null || req.getUsername().isBlank()) {
            throw new ApiException(400, "bad_request", "企业名称和用户名不能为空");
        }
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            throw new ApiException(400, "bad_request", "密码不能为空");
        }
        // 企业租户
        ZhiyuTenant tenant = new ZhiyuTenant();
        tenant.setName(req.getEnterpriseName());
        tenant.setCode("ent-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setType("enterprise");
        tenant.setStatus("active");
        tenant.setContact(req.getContactPerson());
        tenant.setPhone(req.getContactPhone());
        tenantMapper.insert(tenant);

        // 企业角色种子（enterprise_admin 全权限 / enterprise_member 只读，无成员管理菜单）
        String adminRoleId = seedEnterpriseRoles(tenant.getId());

        // 企业主体
        AllianceEnterprise enterprise = new AllianceEnterprise();
        enterprise.setId(UUID.randomUUID().toString());
        enterprise.setTenantId(tenant.getId());
        enterprise.setName(req.getEnterpriseName());
        enterprise.setUnifiedSocialCreditCode(req.getUnifiedSocialCreditCode());
        enterprise.setContactPerson(req.getContactPerson());
        enterprise.setContactPhone(req.getContactPhone());
        enterprise.setContactEmail(req.getContactEmail());
        enterprise.setEnablePublic(true);
        enterprise.setCooperationTypes("[]");
        enterprise.setBusinessLicensePhotos("[]");
        enterprise.setQualificationPhotos("[]");
        enterprise.setIntellectualPropertyPhotos("[]");
        enterprise.setCoverPhotos("[]");
        try {
            enterpriseMapper.insertEnterprise(enterprise);
        } catch (Exception e) {
            throw new ApiException(409, "conflict", "企业名称已被注册，可在「引入企业」中搜索并引入");
        }

        // 管理员账号（platform=partner, role=enterprise）
        ZhiyuUser user = new ZhiyuUser();
        user.setTenantId(tenant.getId());
        user.setRole("enterprise");
        user.setPlatform("partner");
        user.setUsername(req.getUsername());
        user.setLoginName(req.getUsername());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setName(req.getEnterpriseName() + "管理员");
        user.setStatus("active");
        userMapper.insert(user);

        // 管理员绑定企业管理员角色（user_roles 种子）
        roleMapper.insertUserRole(UUID.randomUUID().toString(), user.getId(), adminRoleId);
        roleMapper.incrementUserCount(adminRoleId, tenant.getId());

        // 建立本校-企业合作关联（合作中）
        AllianceEnterpriseLink link = new AllianceEnterpriseLink();
        link.setId(UUID.randomUUID().toString());
        link.setTenantId(schoolTenantId);
        link.setEnterpriseId(enterprise.getId());
        link.setRelationType("alliance");
        link.setStatus("active");
        link.setEnterpriseType("cooperation");
        link.setIsPublic(false);
        link.setSecondaryColleges("[]");
        link.setCreatedBy(userId);
        linkMapper.insertLink(link);

        return getEnterprise(enterprise.getId());
    }

    /**
     * 种子企业角色（对齐 Go CreateEnterpriseTenant）：enterprise_admin 全菜单权限、
     * enterprise_member 只读（无 /partner/members 成员管理菜单），permissions 存 jsonb。
     *
     * @return 企业管理员角色 ID（用于绑定管理员账号）
     */
    private String seedEnterpriseRoles(String tenantId) {
        Map<String, Object> adminMenus = new LinkedHashMap<>();
        adminMenus.put("/partner/workspace", true);
        adminMenus.put("/partner/enterprise", true);
        adminMenus.put("/partner/experts", true);
        adminMenus.put("/partner/members", true);
        adminMenus.put("/partner/schools", true);
        adminMenus.put("/partner/settings", true);
        Map<String, Object> memberMenus = new LinkedHashMap<>(adminMenus);
        memberMenus.remove("/partner/members");

        Map<String, Object> adminPermissions = new LinkedHashMap<>();
        adminPermissions.put("menus", adminMenus);
        Map<String, Object> memberPermissions = new LinkedHashMap<>();
        memberPermissions.put("menus", memberMenus);

        String adminRoleId = UUID.randomUUID().toString();
        roleMapper.insertRole(adminRoleId, tenantId, "enterprise_admin", "企业管理员", "", adminPermissions);
        roleMapper.insertRole(UUID.randomUUID().toString(), tenantId, "enterprise_member", "企业成员", "", memberPermissions);
        return adminRoleId;
    }

    @Override
    public EnterpriseDto updateEnterprise(String id, EnterpriseLinkUpdateRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceEnterpriseLink existing = linkMapper.selectLinkByEnterprise(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "企业不存在或未引入");
        }
        String status = req.getStatus() == null || req.getStatus().isEmpty() ? existing.getStatus() : req.getStatus();
        if (!List.of("negotiating", "active", "paused", "terminated").contains(status)) {
            throw new ApiException(400, "bad_request", "无效的合作状态");
        }
        String rating = req.getRating() == null ? existing.getRating() : req.getRating();
        String enterpriseType = req.getEnterpriseType() == null || req.getEnterpriseType().isEmpty()
            ? existing.getEnterpriseType() : req.getEnterpriseType();
        boolean isPublic = req.getIsPublic() == null ? Boolean.TRUE.equals(existing.getIsPublic()) : req.getIsPublic();
        List<String> colleges = req.getSecondaryColleges() == null
            ? AllianceSupport.strList(existing.getSecondaryColleges()) : req.getSecondaryColleges();
        linkMapper.updateLink(id, tenantId, status, rating, enterpriseType, isPublic,
            AllianceSupport.jsonList(colleges));
        return getEnterprise(id);
    }

    // ===== 资源授权 =====

    @Override
    public Map<String, Object> listGrants(String enterpriseId) {
        String tenantId = AllianceSupport.requireTenant();
        if (enterpriseId == null || enterpriseId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少企业参数");
        }
        List<AllianceResourceGrant> grants = grantMapper.listBySchool(tenantId, enterpriseId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enterpriseId", enterpriseId);
        out.put("grants", grants.stream().map(this::toGrantDto).toList());
        return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> saveGrants(SaveGrantsRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getEnterpriseId() == null || req.getEnterpriseId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少企业参数");
        }
        if (!"position".equals(req.getResourceType()) && !"scene".equals(req.getResourceType())) {
            throw new ApiException(400, "bad_request", "无效资源类型");
        }
        if (linkMapper.selectLinkByEnterprise(req.getEnterpriseId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "企业未引入或不存在");
        }
        List<String> ids = req.getResourceIds() == null ? new ArrayList<>() : req.getResourceIds();
        if (!ids.isEmpty()) {
            boolean owned;
            if ("position".equals(req.getResourceType())) {
                owned = grantMapper.countPositionsOwned(tenantId, AllianceSupport.toPgArrayLiteral(ids)) == ids.size();
            } else {
                owned = grantMapper.countScenesOwned(tenantId, AllianceSupport.toPgArrayLiteral(ids)) == ids.size();
            }
            if (!owned) {
                throw new ApiException(400, "bad_request", "包含非本校资源，无法授权");
            }
        }
        // 并入该企业共建资源
        List<String> coBuilt = "position".equals(req.getResourceType())
            ? grantMapper.listCoBuiltPositions(req.getEnterpriseId()) : grantMapper.listCoBuiltScenes(req.getEnterpriseId());
        List<String> merged = new ArrayList<>(ids);
        for (String cid : coBuilt) {
            if (!merged.contains(cid)) {
                merged.add(cid);
            }
        }
        if (merged.isEmpty()) {
            grantMapper.clearGrant(tenantId, req.getEnterpriseId(), req.getResourceType());
        } else {
            grantMapper.upsertGrant(tenantId, req.getEnterpriseId(), req.getResourceType(),
                AllianceSupport.toPgArrayLiteral(merged), AllianceSupport.currentUserOrNull());
        }
        return listGrants(req.getEnterpriseId());
    }

    @Override
    public ListResponse<GrantResourceOptionDto> listGrantResourceOptions(String enterpriseId) {
        String tenantId = AllianceSupport.requireTenant();
        if (enterpriseId == null || enterpriseId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少企业参数");
        }
        List<AllianceResourceGrantMapper.GrantResourceOptionRow> rows = grantMapper.listResourceOptions(tenantId);
        List<GrantResourceOptionDto> items = new ArrayList<>(rows.size());
        for (AllianceResourceGrantMapper.GrantResourceOptionRow row : rows) {
            GrantResourceOptionDto dto = new GrantResourceOptionDto();
            dto.setId(row.getId());
            dto.setName(row.getName());
            dto.setType(row.getType());
            dto.setSource(row.getSource());
            dto.setSourceEnterpriseId(row.getSourceEnterpriseId());
            dto.setSourceEnterpriseName(row.getSourceEnterpriseName());
            dto.setStatus(row.getStatus());
            dto.setBatchId(row.getBatchId());
            dto.setBatchName(row.getBatchName());
            items.add(dto);
        }
        return ListResponse.of(items, items.size());
    }

    // ===== 项目 =====

    @Override
    public ListResponse<ProjectDto> listProjects(String search, String phase, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        LambdaQueryBuilder<AllianceProject> wrapper = QueryBuilder.lambda(AllianceProject.class)
            .eq(AllianceProject::getTenantId, tenantId)
            .eqIfText(AllianceProject::getPhase, phase);
        if (search != null && !search.isEmpty()) {
            wrapper.like(AllianceProject::getName, search);
        }
        long total = projectMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AllianceProject::getCreatedAt)
            .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset));
        List<ProjectDto> items = projectMapper.selectList(wrapper.build()).stream().map(this::toProjectDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public ProjectDto getProject(String id) {
        AllianceProject p = fetchOwnedProject(id);
        return toProjectDto(p);
    }

    @Override
    public ProjectDto createProject(ProjectDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "项目名称不能为空");
        }
        AllianceProject p = new AllianceProject();
        p.setId(UUID.randomUUID().toString());
        p.setTenantId(tenantId);
        p.setName(req.getName());
        p.setType(req.getType());
        p.setDescription(req.getDescription());
        p.setPhase(req.getPhase() == null || req.getPhase().isEmpty() ? "initiation" : req.getPhase());
        p.setPublishStatus(req.getPublishStatus() == null || req.getPublishStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getPublishStatus());
        p.setStartDate(req.getStartDate());
        p.setEndDate(req.getEndDate());
        p.setBudget(req.getBudget());
        p.setCoverImage(req.getCoverImage());
        p.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        p.setAgreementIds(AllianceSupport.jsonList(req.getAgreementIds()));
        p.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        p.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        p.setCreatedBy(AllianceSupport.currentUserOrNull());
        projectMapper.insertProject(p);
        return getProject(p.getId());
    }

    @Override
    public ProjectDto updateProject(String id, ProjectDto req) {
        AllianceProject existing = fetchOwnedProject(id);
        existing.setName(req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName());
        if (req.getType() != null) {
            existing.setType(req.getType());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getPhase() != null && !req.getPhase().isEmpty()) {
            existing.setPhase(req.getPhase());
        }
        if (req.getPublishStatus() != null && !req.getPublishStatus().isEmpty()) {
            existing.setPublishStatus(req.getPublishStatus());
        }
        if (req.getStartDate() != null) {
            existing.setStartDate(req.getStartDate());
        }
        if (req.getEndDate() != null) {
            existing.setEndDate(req.getEndDate());
        }
        if (req.getBudget() != null) {
            existing.setBudget(req.getBudget());
        }
        if (req.getCoverImage() != null) {
            existing.setCoverImage(req.getCoverImage());
        }
        if (req.getEnterpriseIds() != null) {
            existing.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        }
        if (req.getAgreementIds() != null) {
            existing.setAgreementIds(AllianceSupport.jsonList(req.getAgreementIds()));
        }
        if (req.getSecondaryColleges() != null) {
            existing.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        }
        if (req.getIsPublic() != null) {
            existing.setIsPublic(req.getIsPublic());
        }
        projectMapper.updateProject(existing);
        return getProject(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> deleteProject(String id) {
        String tenantId = AllianceSupport.requireTenant();
        if (projectMapper.selectById(id) == null) {
            throw new ApiException(404, "not_found", "项目不存在");
        }
        AllianceSupport.verifyTenantOwnership(projectMapper.selectById(id).getTenantId());
        projectMapper.removeProjectRefFromAchievements(id, tenantId);
        projectMapper.removeProjectRefFromAgreements(id, tenantId);
        projectMapper.deleteProject(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 里程碑 =====

    @Override
    public ListResponse<MilestoneDto> listMilestones(String projectId) {
        String tenantId = AllianceSupport.requireTenant();
        if (projectMapper.selectById(projectId) == null) {
            throw new ApiException(404, "not_found", "项目不存在");
        }
        List<MilestoneDto> items = milestoneMapper.selectList(
                QueryBuilder.lambda(AllianceProjectMilestone.class)
                    .eq(AllianceProjectMilestone::getProjectId, projectId)
                    .eq(AllianceProjectMilestone::getTenantId, tenantId)
                    .orderByAsc(AllianceProjectMilestone::getSortOrder).build())
            .stream().map(this::toMilestoneDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public Map<String, String> createMilestone(String projectId, MilestoneDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (projectMapper.selectById(projectId) == null) {
            throw new ApiException(404, "not_found", "项目不存在");
        }
        AllianceProjectMilestone m = new AllianceProjectMilestone();
        m.setId(UUID.randomUUID().toString());
        m.setTenantId(tenantId);
        m.setProjectId(projectId);
        m.setName(req.getName());
        m.setDescription(req.getDescription());
        m.setDueDate(req.getDueDate());
        m.setCompletedDate(req.getCompletedDate());
        m.setIsCompleted(Boolean.TRUE.equals(req.getIsCompleted()));
        m.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        milestoneMapper.insertMilestone(m);
        return Map.of("id", m.getId());
    }

    @Override
    public Map<String, String> updateMilestone(String id, MilestoneDto req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceProjectMilestone existing = milestoneMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "里程碑不存在");
        }
        AllianceSupport.verifyTenantOwnership(existing.getTenantId());
        if (req.getName() != null && !req.getName().isEmpty()) {
            existing.setName(req.getName());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getDueDate() != null) {
            existing.setDueDate(req.getDueDate());
        }
        if (req.getCompletedDate() != null) {
            existing.setCompletedDate(req.getCompletedDate());
        }
        if (req.getIsCompleted() != null) {
            existing.setIsCompleted(req.getIsCompleted());
        }
        if (req.getSortOrder() != null) {
            existing.setSortOrder(req.getSortOrder());
        }
        milestoneMapper.updateMilestone(existing);
        return Map.of("id", id);
    }

    @Override
    public Map<String, String> deleteMilestone(String id) {
        String tenantId = AllianceSupport.requireTenant();
        milestoneMapper.deleteMilestone(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 成果 =====

    @Override
    public ListResponse<AchievementDto> listAchievements(String search, String type, String status, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        LambdaQueryBuilder<AllianceAchievement> wrapper = QueryBuilder.lambda(AllianceAchievement.class)
            .eq(AllianceAchievement::getTenantId, tenantId)
            .eqIfText(AllianceAchievement::getType, type)
            .eqIfText(AllianceAchievement::getStatus, status);
        if (search != null && !search.isEmpty()) {
            wrapper.like(AllianceAchievement::getTitle, search);
        }
        long total = achievementMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AllianceAchievement::getCreatedAt)
            .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset));
        List<AchievementDto> items = achievementMapper.selectList(wrapper.build()).stream().map(this::toAchievementDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public AchievementDto getAchievement(String id) {
        return toAchievementDto(fetchOwnedAchievement(id));
    }

    @Override
    public AchievementDto createAchievement(AchievementDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getTitle() == null || req.getTitle().isEmpty()) {
            throw new ApiException(400, "bad_request", "成果标题不能为空");
        }
        AllianceAchievement a = new AllianceAchievement();
        a.setId(UUID.randomUUID().toString());
        a.setTenantId(tenantId);
        a.setTitle(req.getTitle());
        a.setType(req.getType() == null || req.getType().isEmpty() ? "custom" : req.getType());
        a.setDescription(req.getDescription());
        a.setAchievementDate(req.getAchievementDate());
        a.setCoverImage(req.getCoverImage());
        a.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        a.setCitationReason(req.getCitationReason());
        a.setImages(AllianceSupport.jsonList(req.getImages()));
        a.setOwnerPersons(AllianceSupport.jsonList(req.getOwnerPersons()));
        a.setCoBuilders(AllianceSupport.jsonList(req.getCoBuilders()));
        a.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        a.setProjectIds(AllianceSupport.jsonList(req.getProjectIds()));
        a.setRelatedPositions(AllianceSupport.jsonObjectOrDefault(req.getRelatedPositions(), "[]"));
        a.setRelatedScenes(AllianceSupport.jsonObjectOrDefault(req.getRelatedScenes(), "[]"));
        a.setRelatedCourses(AllianceSupport.jsonObjectOrDefault(req.getRelatedCourses(), "[]"));
        a.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getStatus());
        a.setViewCount(0);
        a.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        a.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        a.setCreatedBy(AllianceSupport.currentUserOrNull());
        achievementMapper.insertAchievement(a);
        return getAchievement(a.getId());
    }

    @Override
    public AchievementDto updateAchievement(String id, AchievementDto req) {
        AllianceAchievement existing = fetchOwnedAchievement(id);
        if (req.getTitle() != null && !req.getTitle().isEmpty()) {
            existing.setTitle(req.getTitle());
        }
        if (req.getType() != null && !req.getType().isEmpty()) {
            existing.setType(req.getType());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getAchievementDate() != null) {
            existing.setAchievementDate(req.getAchievementDate());
        }
        if (req.getCoverImage() != null) {
            existing.setCoverImage(req.getCoverImage());
        }
        if (req.getAttachments() != null) {
            existing.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        }
        if (req.getCitationReason() != null) {
            existing.setCitationReason(req.getCitationReason());
        }
        if (req.getImages() != null) {
            existing.setImages(AllianceSupport.jsonList(req.getImages()));
        }
        if (req.getOwnerPersons() != null) {
            existing.setOwnerPersons(AllianceSupport.jsonList(req.getOwnerPersons()));
        }
        if (req.getCoBuilders() != null) {
            existing.setCoBuilders(AllianceSupport.jsonList(req.getCoBuilders()));
        }
        if (req.getEnterpriseIds() != null) {
            existing.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        }
        if (req.getProjectIds() != null) {
            existing.setProjectIds(AllianceSupport.jsonList(req.getProjectIds()));
        }
        if (req.getRelatedPositions() != null) {
            existing.setRelatedPositions(AllianceSupport.jsonObjectOrDefault(req.getRelatedPositions(), "[]"));
        }
        if (req.getRelatedScenes() != null) {
            existing.setRelatedScenes(AllianceSupport.jsonObjectOrDefault(req.getRelatedScenes(), "[]"));
        }
        if (req.getRelatedCourses() != null) {
            existing.setRelatedCourses(AllianceSupport.jsonObjectOrDefault(req.getRelatedCourses(), "[]"));
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()) {
            existing.setStatus(req.getStatus());
        }
        if (req.getSecondaryColleges() != null) {
            existing.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        }
        if (req.getIsPublic() != null) {
            existing.setIsPublic(req.getIsPublic());
        }
        achievementMapper.updateAchievement(existing);
        return getAchievement(id);
    }

    @Override
    public Map<String, String> deleteAchievement(String id) {
        String tenantId = AllianceSupport.requireTenant();
        achievementMapper.deleteAchievement(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 协议 =====

    @Override
    public ListResponse<AgreementDto> listAgreements(String search, String status, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        LambdaQueryBuilder<AllianceAgreement> wrapper = QueryBuilder.lambda(AllianceAgreement.class)
            .eq(AllianceAgreement::getTenantId, tenantId)
            .eqIfText(AllianceAgreement::getStatus, status);
        if (search != null && !search.isEmpty()) {
            wrapper.like(AllianceAgreement::getName, search);
        }
        long total = agreementMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AllianceAgreement::getCreatedAt)
            .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset));
        List<AgreementDto> items = agreementMapper.selectList(wrapper.build()).stream().map(this::toAgreementDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public AgreementDto getAgreement(String id) {
        return toAgreementDto(fetchOwnedAgreement(id));
    }

    @Override
    public AgreementDto createAgreement(AgreementDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "协议名称不能为空");
        }
        AllianceAgreement a = new AllianceAgreement();
        a.setId(UUID.randomUUID().toString());
        a.setTenantId(tenantId);
        a.setName(req.getName());
        a.setType(req.getType());
        a.setContent(req.getContent());
        a.setStartDate(req.getStartDate());
        a.setEndDate(req.getEndDate());
        a.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getStatus());
        a.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        a.setProjectIds(AllianceSupport.jsonList(req.getProjectIds()));
        a.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        a.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        a.setCreatedBy(AllianceSupport.currentUserOrNull());
        agreementMapper.insertAgreement(a);
        return getAgreement(a.getId());
    }

    @Override
    public AgreementDto updateAgreement(String id, AgreementDto req) {
        AllianceAgreement existing = fetchOwnedAgreement(id);
        if (req.getName() != null && !req.getName().isEmpty()) {
            existing.setName(req.getName());
        }
        if (req.getType() != null) {
            existing.setType(req.getType());
        }
        if (req.getContent() != null) {
            existing.setContent(req.getContent());
        }
        if (req.getStartDate() != null) {
            existing.setStartDate(req.getStartDate());
        }
        if (req.getEndDate() != null) {
            existing.setEndDate(req.getEndDate());
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()) {
            existing.setStatus(req.getStatus());
        }
        if (req.getEnterpriseIds() != null) {
            existing.setEnterpriseIds(AllianceSupport.jsonList(req.getEnterpriseIds()));
        }
        if (req.getProjectIds() != null) {
            existing.setProjectIds(AllianceSupport.jsonList(req.getProjectIds()));
        }
        if (req.getAttachments() != null) {
            existing.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        }
        if (req.getIsPublic() != null) {
            existing.setIsPublic(req.getIsPublic());
        }
        agreementMapper.updateAgreement(existing);
        return getAgreement(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> deleteAgreement(String id) {
        String tenantId = AllianceSupport.requireTenant();
        agreementMapper.removeAgreementRefFromProjects(id, tenantId);
        agreementMapper.deleteAgreement(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 权限 =====

    @Override
    public ListResponse<PermissionDto> listPermissions(String search, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        LambdaQueryBuilder<AlliancePermission> wrapper = QueryBuilder.lambda(AlliancePermission.class)
            .eq(AlliancePermission::getTenantId, tenantId);
        if (search != null && !search.isEmpty()) {
            wrapper.like(AlliancePermission::getAccountName, search);
        }
        long total = permissionMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AlliancePermission::getCreatedAt)
            .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset));
        List<PermissionDto> items = permissionMapper.selectList(wrapper.build()).stream().map(this::toPermissionDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public PermissionDto getPermission(String id) {
        return toPermissionDto(fetchOwnedPermission(id));
    }

    @Override
    public Map<String, String> createPermission(PermissionDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getAccountName() == null || req.getAccountName().isEmpty()) {
            throw new ApiException(400, "bad_request", "账号名称不能为空");
        }
        AlliancePermission p = new AlliancePermission();
        p.setId(UUID.randomUUID().toString());
        p.setTenantId(tenantId);
        p.setAccountName(req.getAccountName());
        p.setAccountType(req.getAccountType() == null || req.getAccountType().isEmpty() ? "enterprise" : req.getAccountType());
        p.setEnterpriseId(req.getEnterpriseId());
        p.setExpertId(req.getExpertId());
        p.setIsEnabled(req.getIsEnabled() == null || req.getIsEnabled());
        p.setResourcePermissions(AllianceSupport.jsonObjectOrDefault(req.getResourcePermissions(), "[]"));
        p.setPlatformPermissions(AllianceSupport.jsonList(req.getPlatformPermissions()));
        permissionMapper.insertPermission(p);
        return Map.of("id", p.getId());
    }

    @Override
    public Map<String, String> updatePermission(String id, PermissionDto req) {
        AlliancePermission existing = fetchOwnedPermission(id);
        if (req.getAccountName() != null && !req.getAccountName().isEmpty()) {
            existing.setAccountName(req.getAccountName());
        }
        if (req.getAccountType() != null && !req.getAccountType().isEmpty()) {
            existing.setAccountType(req.getAccountType());
        }
        if (req.getEnterpriseId() != null) {
            existing.setEnterpriseId(req.getEnterpriseId());
        }
        if (req.getExpertId() != null) {
            existing.setExpertId(req.getExpertId());
        }
        if (req.getIsEnabled() != null) {
            existing.setIsEnabled(req.getIsEnabled());
        }
        if (req.getResourcePermissions() != null) {
            existing.setResourcePermissions(AllianceSupport.jsonObjectOrDefault(req.getResourcePermissions(), "[]"));
        }
        if (req.getPlatformPermissions() != null) {
            existing.setPlatformPermissions(AllianceSupport.jsonList(req.getPlatformPermissions()));
        }
        permissionMapper.updatePermission(existing);
        return Map.of("id", id);
    }

    @Override
    public Map<String, String> deletePermission(String id) {
        String tenantId = AllianceSupport.requireTenant();
        permissionMapper.deletePermission(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 字典 =====

    @Override
    public ListResponse<DictionaryDto> listDictionaries(String dictType) {
        String tenantId = AllianceSupport.requireTenant();
        List<DictionaryDto> items = dictionaryMapper.selectList(
                QueryBuilder.lambda(AllianceDictionary.class)
                    .eq(AllianceDictionary::getDictType, dictType)
                    .eq(AllianceDictionary::getTenantId, tenantId)
                    .orderByAsc(AllianceDictionary::getSortOrder).build())
            .stream().map(this::toDictionaryDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public Map<String, String> createDictionary(String dictType, DictionaryCreateRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getCode() == null || req.getCode().isEmpty() || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "编码和名称不能为空");
        }
        AllianceDictionary d = new AllianceDictionary();
        d.setId(UUID.randomUUID().toString());
        d.setTenantId(tenantId);
        d.setDictType(dictType);
        d.setCode(req.getCode());
        d.setName(req.getName());
        d.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        try {
            dictionaryMapper.insertDictionary(d);
        } catch (Exception e) {
            throw new ApiException(409, "conflict", "字典项编码已存在");
        }
        return Map.of("id", d.getId());
    }

    @Override
    public Map<String, String> updateDictionary(String dictType, String id, DictionaryUpdateRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceDictionary existing = dictionaryMapper.selectById(id);
        if (existing == null || !tenantId.equals(existing.getTenantId())) {
            throw new ApiException(404, "not_found", "字典项不存在");
        }
        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        Integer sortOrder = req.getSortOrder() == null ? existing.getSortOrder() : req.getSortOrder();
        dictionaryMapper.updateDictionary(id, tenantId, name, sortOrder);
        return Map.of("id", id);
    }

    @Override
    public Map<String, String> deleteDictionary(String dictType, String id) {
        String tenantId = AllianceSupport.requireTenant();
        dictionaryMapper.deleteDictionary(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 品牌 =====

    @Override
    public ListResponse<BrandDto> listBrands(String search, String brandType, String status, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        if ("employer".equals(brandType)) {
            List<AllianceBrandMapper.EmployerBrandRow> rows = brandMapper.listEmployerBrands(tenantId,
                search, (int) AllianceSupport.clampLimit(limit, 20), (int) AllianceSupport.clampOffset(offset));
            long total = brandMapper.countEmployerBrands(tenantId, search);
            List<BrandDto> items = new ArrayList<>(rows.size());
            for (AllianceBrandMapper.EmployerBrandRow row : rows) {
                items.add(toEmployerBrandDto(row));
            }
            return ListResponse.of(items, total);
        }
        if ("job".equals(brandType)) {
            List<AllianceBrandMapper.JobBrandRow> rows = brandMapper.listJobBrands(tenantId,
                search, (int) AllianceSupport.clampLimit(limit, 20), (int) AllianceSupport.clampOffset(offset));
            long total = brandMapper.countJobBrands(tenantId, search);
            List<BrandDto> items = new ArrayList<>(rows.size());
            for (AllianceBrandMapper.JobBrandRow row : rows) {
                items.add(toJobBrandDto(row));
            }
            return ListResponse.of(items, total);
        }
        LambdaQueryBuilder<AllianceBrand> wrapper = QueryBuilder.lambda(AllianceBrand.class)
            .eq(AllianceBrand::getTenantId, tenantId)
            .eqIfText(AllianceBrand::getBrandType, brandType)
            .eqIfText(AllianceBrand::getStatus, status);
        if (search != null && !search.isEmpty()) {
            wrapper.like(AllianceBrand::getName, search);
        }
        long total = brandMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(AllianceBrand::getSortOrder).orderByDesc(AllianceBrand::getCreatedAt)
            .last("LIMIT " + AllianceSupport.clampLimit(limit, 20) + " OFFSET " + AllianceSupport.clampOffset(offset));
        List<BrandDto> items = brandMapper.selectList(wrapper.build()).stream().map(this::toBrandDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public BrandDto getBrand(String id) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceBrand b = brandMapper.selectById(id);
        if (b == null || !tenantId.equals(b.getTenantId())) {
            throw new ApiException(404, "not_found", "品牌不存在");
        }
        if ("employer".equals(b.getBrandType())) {
            AllianceBrandMapper.EmployerBrandRow row = brandMapper.selectEmployerBrand(id, tenantId);
            if (row != null) {
                return toEmployerBrandDto(row);
            }
        }
        if ("job".equals(b.getBrandType())) {
            AllianceBrandMapper.JobBrandRow row = brandMapper.selectJobBrand(id, tenantId);
            if (row != null) {
                return toJobBrandDto(row);
            }
        }
        return toBrandDto(b);
    }

    @Override
    public BrandDto createBrand(BrandDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getName() == null || req.getName().isEmpty() || req.getBrandType() == null || req.getBrandType().isEmpty()) {
            throw new ApiException(400, "bad_request", "品牌名称和类型不能为空");
        }
        AllianceBrand b = new AllianceBrand();
        b.setId(UUID.randomUUID().toString());
        b.setTenantId(tenantId);
        b.setBrandType(req.getBrandType());
        b.setName(req.getName());
        b.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getStatus());
        b.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        b.setIsFeatured(Boolean.TRUE.equals(req.getIsFeatured()));
        b.setCoverImage(req.getCoverImage());
        b.setCoverVideo(req.getCoverVideo());
        b.setDescription(req.getDescription());
        b.setData(AllianceSupport.jsonObjectOrDefault(req.getData(), "{}"));
        b.setStudentId(req.getStudentId());
        b.setEnterpriseId(req.getEnterpriseId());
        b.setPositionId(req.getPositionId());
        b.setMajorId(req.getMajorId());
        b.setTeacherId(req.getTeacherId());
        b.setExpertId(req.getExpertId());
        b.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        b.setViewCount(0);
        brandMapper.insertBrand(b);
        return toBrandDto(brandMapper.selectById(b.getId()));
    }

    @Override
    public BrandDto updateBrand(String id, BrandDto req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceBrand existing = brandMapper.selectById(id);
        if (existing == null || !tenantId.equals(existing.getTenantId())) {
            throw new ApiException(404, "not_found", "品牌不存在");
        }
        if (req.getName() != null && !req.getName().isEmpty()) {
            existing.setName(req.getName());
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()) {
            existing.setStatus(req.getStatus());
        }
        if (req.getIsPublic() != null) {
            existing.setIsPublic(req.getIsPublic());
        }
        if (req.getIsFeatured() != null) {
            existing.setIsFeatured(req.getIsFeatured());
        }
        if (req.getSortOrder() != null && req.getSortOrder() != 0) {
            existing.setSortOrder(req.getSortOrder());
        }
        if (req.getData() != null) {
            existing.setData(AllianceSupport.jsonObjectOrDefault(req.getData(), "{}"));
        }
        if (req.getCoverImage() != null) {
            existing.setCoverImage(req.getCoverImage());
        }
        if (req.getCoverVideo() != null) {
            existing.setCoverVideo(req.getCoverVideo());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getStudentId() != null) {
            existing.setStudentId(req.getStudentId());
        }
        if (req.getEnterpriseId() != null) {
            existing.setEnterpriseId(req.getEnterpriseId());
        }
        if (req.getPositionId() != null) {
            existing.setPositionId(req.getPositionId());
        }
        if (req.getMajorId() != null) {
            existing.setMajorId(req.getMajorId());
        }
        if (req.getTeacherId() != null) {
            existing.setTeacherId(req.getTeacherId());
        }
        if (req.getExpertId() != null) {
            existing.setExpertId(req.getExpertId());
        }
        brandMapper.updateBrand(existing);
        return toBrandDto(brandMapper.selectById(id));
    }

    @Override
    public Map<String, String> deleteBrand(String id) {
        String tenantId = AllianceSupport.requireTenant();
        brandMapper.deleteBrand(id, tenantId);
        return Map.of("id", id);
    }

    // ===== 专家 =====

    @Override
    public ListResponse<ExpertDto> listExperts(String search, String status, String enterpriseId, long limit, long offset) {
        String tenantId = AllianceSupport.requireTenant();
        List<String> enterpriseIds = new ArrayList<>(linkMapper.listEnterpriseIdsBySchoolTenant(tenantId));
        if (enterpriseId != null && !enterpriseId.isEmpty()) {
            if (!enterpriseIds.contains(enterpriseId)) {
                throw new ApiException(403, "forbidden", "无权查看：该企业未引入");
            }
            enterpriseIds = new ArrayList<>(List.of(enterpriseId));
        }
        if (enterpriseIds.isEmpty()) {
            return ListResponse.of(new ArrayList<>(), 0);
        }
        String idsLiteral = AllianceSupport.toPgArrayLiteral(enterpriseIds);
        List<AllianceExpert> rows = expertMapper.listByEnterpriseIds(tenantId, idsLiteral,
            search, status, (int) AllianceSupport.clampLimit(limit, 200), (int) AllianceSupport.clampOffset(offset));
        long total = expertMapper.countByEnterpriseIds(tenantId, idsLiteral, search, status);
        List<ExpertDto> items = new ArrayList<>(rows.size());
        for (AllianceExpert e : rows) {
            items.add(toExpertDto(e));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public ExpertDto getExpert(String id) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceExpert expert = expertMapper.selectByIdGlobal(id);
        if (expert == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        if (expert.getEnterpriseId() == null || expert.getEnterpriseId().isEmpty()) {
            if (!tenantId.equals(expert.getTenantId())) {
                throw new ApiException(404, "not_found", "专家不存在");
            }
            return toExpertDto(expert);
        }
        if (linkMapper.selectLinkByEnterprise(expert.getEnterpriseId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        return toExpertDto(expert);
    }

    @Override
    public ExpertDto createExpert(ExpertDto req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getName() == null || req.getName().trim().isEmpty()) {
            throw new ApiException(400, "bad_request", "姓名不能为空");
        }
        if (req.getUserId() != null && !req.getUserId().isEmpty()) {
            AllianceExpert existing = expertMapper.selectByUserId(tenantId, req.getUserId());
            if (existing != null) {
                return toExpertDto(existing);
            }
        }
        AllianceExpert e = new AllianceExpert();
        e.setId(UUID.randomUUID().toString());
        e.setTenantId(tenantId);
        e.setName(req.getName());
        e.setGender(req.getGender());
        e.setAge(req.getAge());
        e.setTitle(req.getTitle());
        e.setPosition(req.getPosition());
        e.setExpertType(req.getExpertType() == null || req.getExpertType().isEmpty() ? "teacher" : req.getExpertType());
        e.setIndustry(req.getIndustry());
        e.setProfessionalFields(AllianceSupport.jsonList(req.getProfessionalFields()));
        e.setSpecialties(AllianceSupport.jsonList(req.getSpecialties()));
        e.setExperienceYears(req.getExperienceYears());
        e.setEducation(req.getEducation());
        e.setIntroduction(req.getIntroduction());
        e.setWorkExperience(req.getWorkExperience());
        e.setCity(req.getCity());
        e.setAvatarUrl(req.getAvatarUrl());
        e.setCoverImage(req.getCoverImage());
        e.setPhotos(AllianceSupport.jsonList(req.getPhotos()));
        e.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        e.setEnterpriseId(null);
        e.setOrganization(req.getOrganization());
        e.setRating(req.getRating());
        e.setStatus(req.getStatus() == null || req.getStatus().isEmpty() ? "active" : req.getStatus());
        e.setPartnerSource(req.getPartnerSource());
        e.setPositionDirection(req.getPositionDirection());
        e.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        e.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        e.setUserId(req.getUserId());
        e.setCreatedBy(AllianceSupport.currentUserOrNull());
        expertMapper.insertExpert(e);
        return toExpertDto(expertMapper.selectByIdGlobal(e.getId()));
    }

    @Override
    public ExpertDto updateExpert(String id, ExpertDto req) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceExpert expert = expertMapper.selectByIdGlobal(id);
        if (expert == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        if ((expert.getEnterpriseId() != null && !expert.getEnterpriseId().isEmpty())
            || !tenantId.equals(expert.getTenantId())) {
            throw new ApiException(403, "forbidden", "仅可编辑本校创建的师资档案");
        }
        if (req.getName() != null && !req.getName().trim().isEmpty()) {
            expert.setName(req.getName());
        }
        applyExpertPartial(expert, req);
        expertMapper.updateExpert(expert);
        return toExpertDto(expertMapper.selectByIdGlobal(id));
    }

    @Override
    public Map<String, String> deleteExpert(String id) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceExpert expert = expertMapper.selectByIdGlobal(id);
        if (expert == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        if ((expert.getEnterpriseId() != null && !expert.getEnterpriseId().isEmpty())
            || !tenantId.equals(expert.getTenantId())) {
            throw new ApiException(403, "forbidden", "仅可删除本校创建的师资档案");
        }
        expertMapper.deleteExpert(id, tenantId);
        return Map.of("id", id);
    }

    @Override
    public Map<String, Object> toggleExpertDisplay(String id, boolean isPublic) {
        String tenantId = AllianceSupport.requireTenant();
        AllianceExpert expert = expertMapper.selectByIdGlobal(id);
        if (expert == null || expert.getEnterpriseId() == null || expert.getEnterpriseId().isEmpty()) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        if (linkMapper.selectLinkByEnterprise(expert.getEnterpriseId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        expertMapper.updateIsPublic(id, tenantId, isPublic);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("isPublic", isPublic);
        return out;
    }

    @Override
    public ListResponse<MentorOptionDto> listMentorOptions() {
        String tenantId = AllianceSupport.requireTenant();
        List<AllianceExpertMapper.MentorOptionRow> rows = expertMapper.listMentorOptions(tenantId);
        List<MentorOptionDto> items = new ArrayList<>(rows.size());
        for (AllianceExpertMapper.MentorOptionRow row : rows) {
            MentorOptionDto dto = new MentorOptionDto();
            dto.setExpertId(row.getExpertId());
            dto.setName(row.getName());
            dto.setTitle(row.getTitle());
            dto.setEnterpriseId(row.getEnterpriseId());
            dto.setEnterpriseName(row.getEnterpriseName());
            dto.setUserId(row.getUserId());
            items.add(dto);
        }
        return ListResponse.of(items, items.size());
    }

    // ===== 人才排名 =====

    @Override
    public Map<String, Object> listTalentRanking(String search) {
        String tenantId = AllianceSupport.requireTenant();
        List<TalentRankMajorGroupDto> groups = buildTalentRanking(tenantId, search, false);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", groups);
        return out;
    }

    @Override
    public Map<String, Object> listBrandMajorRankConfigs() {
        String tenantId = AllianceSupport.requireTenant();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", rankConfigMapper.listConfigs(tenantId).stream().map(this::toRankConfigDto).toList());
        return out;
    }

    @Override
    public Map<String, Object> saveBrandMajorRankConfigs(RankConfigsSaveRequest req) {
        String tenantId = AllianceSupport.requireTenant();
        if (req.getConfigs() != null) {
            for (BrandMajorRankConfigDto c : req.getConfigs()) {
                if (c.getMajorId() == null || c.getMajorId().isEmpty()
                    || c.getRankLimit() == null || c.getRankLimit() < 1 || c.getRankLimit() > 100) {
                    continue;
                }
                rankConfigMapper.saveConfig(tenantId, c.getMajorId(), Boolean.TRUE.equals(c.getEnabled()), c.getRankLimit());
            }
        }
        return listBrandMajorRankConfigs();
    }

    // ===== 组装/转换 =====

    private List<TalentRankMajorGroupDto> buildTalentRanking(String tenantId, String search, boolean excludeUnevaluated) {
        List<BrandMajorRankConfigMapper.RankStudentRow> students = rankConfigMapper.listRankStudents(tenantId, search);
        List<BrandMajorRankConfigMapper.RankPositionRow> positions = rankConfigMapper.listRankPositions(tenantId);
        List<BrandMajorRankConfig> configs = rankConfigMapper.listConfigs(tenantId);
        Map<String, BrandMajorRankConfig> cfgByMajor = new LinkedHashMap<>();
        for (BrandMajorRankConfig c : configs) {
            cfgByMajor.put(c.getMajorId(), c);
        }
        Map<String, List<TalentRankPositionDto>> posByUser = new LinkedHashMap<>();
        for (BrandMajorRankConfigMapper.RankPositionRow p : positions) {
            posByUser.computeIfAbsent(p.getUserId(), k -> new ArrayList<>()).add(toTalentPositionDto(p));
        }
        List<TalentRankMajorGroupDto> groups = new ArrayList<>();
        Map<String, Integer> groupIdx = new LinkedHashMap<>();
        for (BrandMajorRankConfigMapper.RankStudentRow st : students) {
            if (excludeUnevaluated && (st.getPosCount() == null || st.getPosCount() == 0)
                && st.getAvgRate() == null && st.getAvgComp() == null && st.getAvgCompV2() == null && st.getAvgCog() == null) {
                continue;
            }
            TalentRankStudentDto sdto = toTalentStudentDto(st);
            sdto.setPositions(posByUser.getOrDefault(st.getStudentId(), new ArrayList<>()));
            if (sdto.getMajorName() == null || sdto.getMajorName().isEmpty()) {
                sdto.setMajorName("未分配专业");
            }
            String majorId = sdto.getMajorId() == null ? "" : sdto.getMajorId();
            Integer idx = groupIdx.get(majorId);
            if (idx != null) {
                groups.get(idx).getStudents().add(sdto);
                continue;
            }
            BrandMajorRankConfig cfg = cfgByMajor.get(majorId);
            if (cfg == null) {
                TalentRankMajorGroupDto g = new TalentRankMajorGroupDto();
                g.setMajorId(majorId);
                g.setMajorName(sdto.getMajorName());
                g.setEnabled(true);
                g.setRankLimit(10);
                g.setStudents(new ArrayList<>(List.of(sdto)));
                groupIdx.put(majorId, groups.size());
                groups.add(g);
            } else {
                TalentRankMajorGroupDto g = new TalentRankMajorGroupDto();
                g.setMajorId(majorId);
                g.setMajorName(sdto.getMajorName());
                g.setEnabled(Boolean.TRUE.equals(cfg.getEnabled()));
                g.setRankLimit(cfg.getRankLimit() == null ? 10 : cfg.getRankLimit());
                g.setStudents(new ArrayList<>(List.of(sdto)));
                groupIdx.put(majorId, groups.size());
                groups.add(g);
            }
        }
        for (TalentRankMajorGroupDto g : groups) {
            g.setStudentCount(g.getStudents().size());
        }
        return groups;
    }

    private void applyExpertPartial(AllianceExpert e, ExpertDto req) {
        if (req.getGender() != null) {
            e.setGender(req.getGender());
        }
        if (req.getAge() != null) {
            e.setAge(req.getAge());
        }
        if (req.getTitle() != null) {
            e.setTitle(req.getTitle());
        }
        if (req.getPosition() != null) {
            e.setPosition(req.getPosition());
        }
        if (req.getExpertType() != null && !req.getExpertType().isEmpty()) {
            e.setExpertType(req.getExpertType());
        }
        if (req.getIndustry() != null) {
            e.setIndustry(req.getIndustry());
        }
        if (req.getProfessionalFields() != null) {
            e.setProfessionalFields(AllianceSupport.jsonList(req.getProfessionalFields()));
        }
        if (req.getSpecialties() != null) {
            e.setSpecialties(AllianceSupport.jsonList(req.getSpecialties()));
        }
        if (req.getExperienceYears() != null) {
            e.setExperienceYears(req.getExperienceYears());
        }
        if (req.getEducation() != null) {
            e.setEducation(req.getEducation());
        }
        if (req.getIntroduction() != null) {
            e.setIntroduction(req.getIntroduction());
        }
        if (req.getWorkExperience() != null) {
            e.setWorkExperience(req.getWorkExperience());
        }
        if (req.getCity() != null) {
            e.setCity(req.getCity());
        }
        if (req.getAvatarUrl() != null) {
            e.setAvatarUrl(req.getAvatarUrl());
        }
        if (req.getCoverImage() != null) {
            e.setCoverImage(req.getCoverImage());
        }
        if (req.getPhotos() != null) {
            e.setPhotos(AllianceSupport.jsonList(req.getPhotos()));
        }
        if (req.getAttachments() != null) {
            e.setAttachments(AllianceSupport.jsonList(req.getAttachments()));
        }
        if (req.getOrganization() != null) {
            e.setOrganization(req.getOrganization());
        }
        if (req.getRating() != null) {
            e.setRating(req.getRating());
        }
        if (req.getStatus() != null && !req.getStatus().isEmpty()) {
            e.setStatus(req.getStatus());
        }
        if (req.getPartnerSource() != null) {
            e.setPartnerSource(req.getPartnerSource());
        }
        if (req.getPositionDirection() != null) {
            e.setPositionDirection(req.getPositionDirection());
        }
        if (req.getSecondaryColleges() != null) {
            e.setSecondaryColleges(AllianceSupport.jsonList(req.getSecondaryColleges()));
        }
        if (req.getIsPublic() != null) {
            e.setIsPublic(req.getIsPublic());
        }
    }

    private AllianceProject fetchOwnedProject(String id) {
        AllianceProject p = projectMapper.selectById(id);
        if (p == null) {
            throw new ApiException(404, "not_found", "项目不存在");
        }
        AllianceSupport.verifyTenantOwnership(p.getTenantId());
        return p;
    }

    private AllianceAchievement fetchOwnedAchievement(String id) {
        AllianceAchievement a = achievementMapper.selectById(id);
        if (a == null) {
            throw new ApiException(404, "not_found", "成果不存在");
        }
        AllianceSupport.verifyTenantOwnership(a.getTenantId());
        return a;
    }

    private AllianceAgreement fetchOwnedAgreement(String id) {
        AllianceAgreement a = agreementMapper.selectById(id);
        if (a == null) {
            throw new ApiException(404, "not_found", "协议不存在");
        }
        AllianceSupport.verifyTenantOwnership(a.getTenantId());
        return a;
    }

    private AlliancePermission fetchOwnedPermission(String id) {
        AlliancePermission p = permissionMapper.selectById(id);
        if (p == null) {
            throw new ApiException(404, "not_found", "权限不存在");
        }
        AllianceSupport.verifyTenantOwnership(p.getTenantId());
        return p;
    }

    // ---- DTO 转换 ----

    private SchoolInfoDto toSchoolInfoDto(AllianceSchoolInfo i) {
        SchoolInfoDto dto = new SchoolInfoDto();
        dto.setId(i.getId());
        dto.setTenantId(i.getTenantId());
        dto.setName(i.getName());
        dto.setShortName(i.getShortName());
        dto.setSchoolType(i.getSchoolType());
        dto.setProvince(i.getProvince());
        dto.setCity(i.getCity());
        dto.setAddress(i.getAddress());
        dto.setWebsite(i.getWebsite());
        dto.setContactPhone(i.getContactPhone());
        dto.setDescription(i.getDescription());
        dto.setLogoUrl(i.getLogoUrl());
        dto.setScaleData(AllianceSupport.parseObject(i.getScaleData()));
        dto.setSecondaryColleges(AllianceSupport.mapList(i.getSecondaryColleges()));
        dto.setCreatedAt(i.getCreatedAt());
        dto.setUpdatedAt(i.getUpdatedAt());
        return dto;
    }

    private EnterpriseDto toEnterpriseDto(AllianceEnterpriseLinkMapper.LinkedEnterpriseRow row) {
        EnterpriseDto dto = new EnterpriseDto();
        dto.setId(row.getId());
        dto.setTenantId(row.getTenantId());
        dto.setName(row.getName());
        dto.setIndustry(row.getIndustry());
        dto.setRegion(row.getRegion());
        dto.setDescription(row.getDescription());
        dto.setLogoUrl(row.getLogoUrl());
        dto.setCoverImage(row.getCoverImage());
        dto.setCooperationTypes(AllianceSupport.strList(row.getCooperationTypes()));
        dto.setContactPerson(row.getContactPerson());
        dto.setContactPhone(row.getContactPhone());
        dto.setContactEmail(row.getContactEmail());
        dto.setAddress(row.getAddress());
        dto.setUnifiedSocialCreditCode(row.getUnifiedSocialCreditCode());
        dto.setEstablishedYear(row.getEstablishedYear());
        dto.setEmployeeCount(row.getEmployeeCount());
        dto.setBusinessLicensePhotos(AllianceSupport.strList(row.getBusinessLicensePhotos()));
        dto.setQualificationPhotos(AllianceSupport.strList(row.getQualificationPhotos()));
        dto.setIntellectualPropertyPhotos(AllianceSupport.strList(row.getIntellectualPropertyPhotos()));
        dto.setCoverPhotos(AllianceSupport.strList(row.getCoverPhotos()));
        dto.setSecondaryColleges(AllianceSupport.strList(row.getSecondaryColleges()));
        dto.setEnablePublic(row.getEnablePublic());
        dto.setLinkId(row.getLinkId());
        dto.setRelationType(row.getRelationType());
        dto.setStatus(row.getStatus());
        dto.setRating(row.getRating());
        dto.setEnterpriseType(row.getEnterpriseType());
        dto.setIsPublic(row.getIsPublic());
        dto.setCreatedAt(row.getCreatedAt());
        dto.setUpdatedAt(row.getUpdatedAt());
        return dto;
    }

    private EnterpriseDto toEnterpriseDto(AllianceEnterprise e) {
        EnterpriseDto dto = new EnterpriseDto();
        dto.setId(e.getId());
        dto.setTenantId(e.getTenantId());
        dto.setName(e.getName());
        dto.setIndustry(e.getIndustry());
        dto.setRegion(e.getRegion());
        dto.setDescription(e.getDescription());
        dto.setLogoUrl(e.getLogoUrl());
        dto.setCoverImage(e.getCoverImage());
        dto.setCooperationTypes(AllianceSupport.strList(e.getCooperationTypes()));
        dto.setContactPerson(e.getContactPerson());
        dto.setContactPhone(e.getContactPhone());
        dto.setContactEmail(e.getContactEmail());
        dto.setAddress(e.getAddress());
        dto.setUnifiedSocialCreditCode(e.getUnifiedSocialCreditCode());
        dto.setEstablishedYear(e.getEstablishedYear());
        dto.setEmployeeCount(e.getEmployeeCount());
        dto.setBusinessLicensePhotos(AllianceSupport.strList(e.getBusinessLicensePhotos()));
        dto.setQualificationPhotos(AllianceSupport.strList(e.getQualificationPhotos()));
        dto.setIntellectualPropertyPhotos(AllianceSupport.strList(e.getIntellectualPropertyPhotos()));
        dto.setCoverPhotos(AllianceSupport.strList(e.getCoverPhotos()));
        dto.setEnablePublic(e.getEnablePublic());
        dto.setRating(e.getRating());
        dto.setProjectCount(e.getProjectCount());
        dto.setAgreementCount(e.getAgreementCount());
        dto.setAchievementCount(e.getAchievementCount());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }

    private ResourceGrantDto toGrantDto(AllianceResourceGrant g) {
        ResourceGrantDto dto = new ResourceGrantDto();
        dto.setId(g.getId());
        dto.setTenantId(g.getTenantId());
        dto.setEnterpriseId(g.getEnterpriseId());
        dto.setResourceType(g.getResourceType());
        dto.setResourceIds(g.getResourceIds());
        dto.setCreatedBy(g.getCreatedBy());
        dto.setCreatedAt(g.getCreatedAt());
        dto.setUpdatedAt(g.getUpdatedAt());
        return dto;
    }

    private ProjectDto toProjectDto(AllianceProject p) {
        ProjectDto dto = new ProjectDto();
        dto.setId(p.getId());
        dto.setTenantId(p.getTenantId());
        dto.setName(p.getName());
        dto.setType(p.getType());
        dto.setDescription(p.getDescription());
        dto.setPhase(p.getPhase());
        dto.setPublishStatus(p.getPublishStatus());
        dto.setStartDate(p.getStartDate());
        dto.setEndDate(p.getEndDate());
        dto.setBudget(p.getBudget());
        dto.setCoverImage(p.getCoverImage());
        dto.setEnterpriseIds(AllianceSupport.strList(p.getEnterpriseIds()));
        dto.setAgreementIds(AllianceSupport.strList(p.getAgreementIds()));
        dto.setSecondaryColleges(AllianceSupport.strList(p.getSecondaryColleges()));
        dto.setIsPublic(p.getIsPublic());
        dto.setProgress(p.getProgress());
        dto.setCreatedBy(p.getCreatedBy());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private MilestoneDto toMilestoneDto(AllianceProjectMilestone m) {
        MilestoneDto dto = new MilestoneDto();
        dto.setId(m.getId());
        dto.setTenantId(m.getTenantId());
        dto.setProjectId(m.getProjectId());
        dto.setName(m.getName());
        dto.setDescription(m.getDescription());
        dto.setDueDate(m.getDueDate());
        dto.setCompletedDate(m.getCompletedDate());
        dto.setIsCompleted(m.getIsCompleted());
        dto.setSortOrder(m.getSortOrder());
        dto.setCreatedAt(m.getCreatedAt());
        dto.setUpdatedAt(m.getUpdatedAt());
        return dto;
    }

    private AchievementDto toAchievementDto(AllianceAchievement a) {
        AchievementDto dto = new AchievementDto();
        dto.setId(a.getId());
        dto.setTenantId(a.getTenantId());
        dto.setTitle(a.getTitle());
        dto.setType(a.getType());
        dto.setDescription(a.getDescription());
        dto.setAchievementDate(a.getAchievementDate());
        dto.setCoverImage(a.getCoverImage());
        dto.setAttachments(AllianceSupport.strList(a.getAttachments()));
        dto.setCitationReason(a.getCitationReason());
        dto.setImages(AllianceSupport.strList(a.getImages()));
        dto.setOwnerPersons(AllianceSupport.strList(a.getOwnerPersons()));
        dto.setCoBuilders(AllianceSupport.strList(a.getCoBuilders()));
        dto.setEnterpriseIds(AllianceSupport.strList(a.getEnterpriseIds()));
        dto.setProjectIds(AllianceSupport.strList(a.getProjectIds()));
        dto.setRelatedPositions(AllianceSupport.relatedRefs(a.getRelatedPositions()));
        dto.setRelatedScenes(AllianceSupport.relatedRefs(a.getRelatedScenes()));
        dto.setRelatedCourses(AllianceSupport.relatedRefs(a.getRelatedCourses()));
        dto.setStatus(a.getStatus());
        dto.setViewCount(a.getViewCount());
        dto.setSecondaryColleges(AllianceSupport.strList(a.getSecondaryColleges()));
        dto.setIsPublic(a.getIsPublic());
        dto.setCreatedBy(a.getCreatedBy());
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        return dto;
    }

    private ExpertDto toExpertDto(AllianceExpert e) {
        ExpertDto dto = new ExpertDto();
        dto.setId(e.getId());
        dto.setTenantId(e.getTenantId());
        dto.setName(e.getName());
        dto.setGender(e.getGender());
        dto.setAge(e.getAge());
        dto.setTitle(e.getTitle());
        dto.setPosition(e.getPosition());
        dto.setExpertType(e.getExpertType());
        dto.setIndustry(e.getIndustry());
        dto.setProfessionalFields(AllianceSupport.strList(e.getProfessionalFields()));
        dto.setSpecialties(AllianceSupport.strList(e.getSpecialties()));
        dto.setExperienceYears(e.getExperienceYears());
        dto.setEducation(e.getEducation());
        dto.setIntroduction(e.getIntroduction());
        dto.setWorkExperience(e.getWorkExperience());
        dto.setCity(e.getCity());
        dto.setAvatarUrl(e.getAvatarUrl());
        dto.setCoverImage(e.getCoverImage());
        dto.setPartnerSource(e.getPartnerSource());
        dto.setPositionDirection(e.getPositionDirection());
        dto.setPhotos(AllianceSupport.strList(e.getPhotos()));
        dto.setAttachments(AllianceSupport.strList(e.getAttachments()));
        dto.setEnterpriseId(e.getEnterpriseId());
        dto.setEnterpriseName(e.getEnterpriseName());
        dto.setOrganization(e.getOrganization());
        dto.setUserId(e.getUserId());
        dto.setRating(e.getRating());
        dto.setStatus(e.getStatus());
        dto.setSecondaryColleges(AllianceSupport.strList(e.getSecondaryColleges()));
        dto.setIsPublic(e.getIsPublic());
        dto.setCreatedBy(e.getCreatedBy());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        return dto;
    }

    private AgreementDto toAgreementDto(AllianceAgreement a) {
        AgreementDto dto = new AgreementDto();
        dto.setId(a.getId());
        dto.setTenantId(a.getTenantId());
        dto.setName(a.getName());
        dto.setType(a.getType());
        dto.setContent(a.getContent());
        dto.setStartDate(a.getStartDate());
        dto.setEndDate(a.getEndDate());
        dto.setStatus(a.getStatus());
        dto.setEnterpriseIds(AllianceSupport.strList(a.getEnterpriseIds()));
        dto.setProjectIds(AllianceSupport.strList(a.getProjectIds()));
        dto.setAttachments(AllianceSupport.strList(a.getAttachments()));
        dto.setIsPublic(a.getIsPublic());
        dto.setCreatedBy(a.getCreatedBy());
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        return dto;
    }

    private PermissionDto toPermissionDto(AlliancePermission p) {
        PermissionDto dto = new PermissionDto();
        dto.setId(p.getId());
        dto.setTenantId(p.getTenantId());
        dto.setAccountName(p.getAccountName());
        dto.setAccountType(p.getAccountType());
        dto.setEnterpriseId(p.getEnterpriseId());
        dto.setExpertId(p.getExpertId());
        dto.setIsEnabled(p.getIsEnabled());
        dto.setResourcePermissions(AllianceSupport.parseObject(p.getResourcePermissions()));
        dto.setPlatformPermissions(AllianceSupport.strList(p.getPlatformPermissions()));
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private DictionaryDto toDictionaryDto(AllianceDictionary d) {
        DictionaryDto dto = new DictionaryDto();
        dto.setId(d.getId());
        dto.setTenantId(d.getTenantId());
        dto.setDictType(d.getDictType());
        dto.setCode(d.getCode());
        dto.setName(d.getName());
        dto.setSortOrder(d.getSortOrder());
        dto.setCreatedAt(d.getCreatedAt());
        return dto;
    }

    private BrandDto toBrandDto(AllianceBrand b) {
        BrandDto dto = new BrandDto();
        dto.setId(b.getId());
        dto.setTenantId(b.getTenantId());
        dto.setBrandType(b.getBrandType());
        dto.setName(b.getName());
        dto.setStatus(b.getStatus());
        dto.setIsPublic(b.getIsPublic());
        dto.setIsFeatured(b.getIsFeatured());
        dto.setCoverImage(b.getCoverImage());
        dto.setCoverVideo(b.getCoverVideo());
        dto.setDescription(b.getDescription());
        dto.setData(AllianceSupport.parseObject(b.getData()));
        dto.setStudentId(b.getStudentId());
        dto.setEnterpriseId(b.getEnterpriseId());
        dto.setPositionId(b.getPositionId());
        dto.setMajorId(b.getMajorId());
        dto.setTeacherId(b.getTeacherId());
        dto.setExpertId(b.getExpertId());
        dto.setSortOrder(b.getSortOrder());
        dto.setViewCount(b.getViewCount());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
    }

    private EmployerBrandDto toEmployerBrandDto(AllianceBrandMapper.EmployerBrandRow row) {
        EmployerBrandDto dto = new EmployerBrandDto();
        copyBrandBase(dto, row);
        dto.setEnterpriseName(row.getEnterpriseName());
        dto.setEnterpriseLogo(row.getEnterpriseLogo());
        dto.setEnterpriseIndustry(row.getEnterpriseIndustry());
        dto.setEnterpriseRegion(row.getEnterpriseRegion());
        dto.setEnterpriseDescription(row.getEnterpriseDescription());
        dto.setEnterpriseCreditCode(row.getEnterpriseCreditCode());
        dto.setEnterpriseContactPerson(row.getEnterpriseContactPerson());
        dto.setEnterpriseContactPhone(row.getEnterpriseContactPhone());
        dto.setEnterpriseContactEmail(row.getEnterpriseContactEmail());
        dto.setEnterpriseAddress(row.getEnterpriseAddress());
        dto.setEnterpriseEstablishedYear(row.getEnterpriseEstablishedYear());
        dto.setEnterpriseEmployeeCount(row.getEnterpriseEmployeeCount());
        dto.setEnterpriseCoverImage(row.getEnterpriseCoverImage());
        dto.setEnterpriseCoverPhotos(AllianceSupport.strList(row.getEnterpriseCoverPhotos()));
        dto.setEnterpriseBusinessLicensePhotos(AllianceSupport.strList(row.getEnterpriseBusinessLicensePhotos()));
        dto.setEnterpriseIntellectualPropertyPhotos(AllianceSupport.strList(row.getEnterpriseIntellectualPropertyPhotos()));
        dto.setEnterpriseQualificationPhotos(AllianceSupport.strList(row.getEnterpriseQualificationPhotos()));
        return dto;
    }

    private JobBrandDto toJobBrandDto(AllianceBrandMapper.JobBrandRow row) {
        JobBrandDto dto = new JobBrandDto();
        copyBrandBase(dto, row);
        dto.setPositionName(row.getPositionName());
        dto.setPositionType(row.getPositionType());
        dto.setSalaryMin(row.getSalaryMin() == null ? null : java.math.BigDecimal.valueOf(row.getSalaryMin()));
        dto.setSalaryMax(row.getSalaryMax() == null ? null : java.math.BigDecimal.valueOf(row.getSalaryMax()));
        dto.setMajorNames(AllianceSupport.strList(row.getMajorNames()));
        dto.setPositionStatus(row.getPositionStatus());
        return dto;
    }

    private void copyBrandBase(BrandDto dto, AllianceBrand b) {
        dto.setId(b.getId());
        dto.setTenantId(b.getTenantId());
        dto.setBrandType(b.getBrandType());
        dto.setName(b.getName());
        dto.setStatus(b.getStatus());
        dto.setIsPublic(b.getIsPublic());
        dto.setIsFeatured(b.getIsFeatured());
        dto.setCoverImage(b.getCoverImage());
        dto.setCoverVideo(b.getCoverVideo());
        dto.setDescription(b.getDescription());
        dto.setData(AllianceSupport.parseObject(b.getData()));
        dto.setStudentId(b.getStudentId());
        dto.setEnterpriseId(b.getEnterpriseId());
        dto.setPositionId(b.getPositionId());
        dto.setMajorId(b.getMajorId());
        dto.setTeacherId(b.getTeacherId());
        dto.setExpertId(b.getExpertId());
        dto.setSortOrder(b.getSortOrder());
        dto.setViewCount(b.getViewCount());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
    }

    private BrandMajorRankConfigDto toRankConfigDto(BrandMajorRankConfig c) {
        BrandMajorRankConfigDto dto = new BrandMajorRankConfigDto();
        dto.setMajorId(c.getMajorId());
        dto.setEnabled(c.getEnabled());
        dto.setRankLimit(c.getRankLimit());
        return dto;
    }

    private TalentRankPositionDto toTalentPositionDto(BrandMajorRankConfigMapper.RankPositionRow p) {
        TalentRankPositionDto dto = new TalentRankPositionDto();
        dto.setPositionId(p.getPositionId());
        dto.setPositionName(p.getPositionName());
        dto.setAchievementRate(p.getAchievementRate());
        dto.setPositionCompetency(p.getPositionCompetency());
        dto.setPositionCompetencyV2(p.getPositionCompetencyV2());
        dto.setAbilityCognitionScore(p.getAbilityCognitionScore());
        dto.setTotalAbilityPoints(p.getTotalAbilityPoints());
        dto.setAchievedAbilityPoints(p.getAchievedAbilityPoints());
        dto.setGrade(p.getGrade());
        dto.setEvaluatedAt(p.getEvaluatedAt());
        dto.setAbilityPointDetails(AllianceSupport.parseObject(p.getAbilityPointDetails()));
        return dto;
    }

    private TalentRankStudentDto toTalentStudentDto(BrandMajorRankConfigMapper.RankStudentRow s) {
        TalentRankStudentDto dto = new TalentRankStudentDto();
        dto.setStudentId(s.getStudentId());
        dto.setStudentNo(s.getStudentNo());
        dto.setName(s.getName());
        dto.setMajorId(s.getMajorId());
        dto.setMajorName(s.getMajorName());
        dto.setClassName(s.getClassName());
        dto.setDepartmentName(s.getDepartmentName());
        dto.setAvgAchievementRate(s.getAvgRate());
        dto.setAvgPositionCompetency(s.getAvgComp());
        dto.setAvgPositionCompetencyV2(s.getAvgCompV2());
        dto.setAvgAbilityCognitionScore(s.getAvgCog());
        dto.setPositionCount(s.getPosCount());
        dto.setLatestEvaluatedAt(s.getLatestAt());
        return dto;
    }
}
