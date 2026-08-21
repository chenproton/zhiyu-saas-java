package org.dromara.zhiyu.service.impl.alliance;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.alliance.AllianceAchievement;
import org.dromara.zhiyu.domain.alliance.AllianceBrand;
import org.dromara.zhiyu.domain.alliance.AllianceEnterprise;
import org.dromara.zhiyu.domain.alliance.AllianceExpert;
import org.dromara.zhiyu.domain.alliance.AllianceProject;
import org.dromara.zhiyu.domain.alliance.AllianceProjectMilestone;
import org.dromara.zhiyu.domain.alliance.AllianceSchoolInfo;
import org.dromara.zhiyu.domain.alliance.BrandMajorRankConfig;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;
import org.dromara.zhiyu.mapper.alliance.AllianceAchievementMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceAgreementMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceBrandMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceEnterpriseMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceExpertMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceProjectMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceProjectMilestoneMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceSchoolInfoMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceStatsMapper;
import org.dromara.zhiyu.mapper.alliance.BrandMajorRankConfigMapper;
import org.dromara.zhiyu.service.alliance.IAlliancePublicService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 联盟门户前台公开服务实现（对齐 Go registerAlliancePublicRoutes 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AlliancePublicServiceImpl implements IAlliancePublicService {

    private static final TypeReference<List<BrandResponsibility>> RESP_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<BrandCertificate>> CERT_REF = new TypeReference<>() {
    };

    private final AllianceSchoolInfoMapper schoolInfoMapper;
    private final AllianceEnterpriseMapper enterpriseMapper;
    private final AllianceProjectMapper projectMapper;
    private final AllianceProjectMilestoneMapper milestoneMapper;
    private final AllianceAchievementMapper achievementMapper;
    private final AllianceAgreementMapper agreementMapper;
    private final AllianceExpertMapper expertMapper;
    private final AllianceBrandMapper brandMapper;
    private final BrandMajorRankConfigMapper rankConfigMapper;
    private final AllianceStatsMapper statsMapper;

    @Override
    public SchoolInfoDto getPublicSchoolInfo(String tenantId) {
        if (tenantId == null || tenantId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少 tenantId");
        }
        AllianceSchoolInfo info = schoolInfoMapper.selectByTenant(tenantId);
        if (info == null) {
            return new SchoolInfoDto();
        }
        return toSchoolInfoDto(info);
    }

    @Override
    public ListResponse<EnterpriseDto> listPublicEnterprises(String tenantId, long limit, long offset) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceEnterprise> rows;
        if (tenantId != null && !tenantId.isEmpty()) {
            rows = enterpriseMapper.listPublicEnterprisesByTenant(tenantId, (int) safeLimit, (int) safeOffset);
        } else {
            rows = enterpriseMapper.listPublicEnterprisesGlobal((int) safeLimit, (int) safeOffset);
        }
        List<EnterpriseDto> items = new ArrayList<>(rows.size());
        for (AllianceEnterprise e : rows) {
            items.add(toEnterpriseDto(e));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public EnterpriseDto getPublicEnterprise(String id, String tenantId) {
        AllianceEnterprise e = (tenantId != null && !tenantId.isEmpty())
            ? enterpriseMapper.selectPublicEnterpriseByTenant(id, tenantId)
            : enterpriseMapper.selectPublicEnterpriseGlobal(id);
        if (e == null) {
            throw new ApiException(404, "not_found", "企业不存在");
        }
        return toEnterpriseDto(e);
    }

    @Override
    public ListResponse<ProjectDto> listPublicProjects(String tenantId, long limit, long offset) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceProject> rows = (tenantId != null && !tenantId.isEmpty())
            ? projectMapper.listPublicProjectsByTenant(tenantId, (int) safeLimit, (int) safeOffset)
            : projectMapper.listPublicProjectsGlobal((int) safeLimit, (int) safeOffset);
        List<ProjectDto> items = new ArrayList<>(rows.size());
        for (AllianceProject p : rows) {
            items.add(toProjectDto(p));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public ProjectDto getPublicProject(String id, String tenantId) {
        AllianceProject p = (tenantId != null && !tenantId.isEmpty())
            ? projectMapper.selectPublicProjectByTenant(id, tenantId)
            : projectMapper.selectPublicProjectGlobal(id);
        if (p == null) {
            throw new ApiException(404, "not_found", "项目不存在");
        }
        projectMapper.incrementView(id);
        return toProjectDto(p);
    }

    @Override
    public ListResponse<MilestoneDto> listPublicMilestones(String projectId, String tenantId) {
        if (projectId == null || projectId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少项目 id");
        }
        List<AllianceProjectMilestone> rows = (tenantId != null && !tenantId.isEmpty())
            ? milestoneMapper.listPublicMilestonesByTenant(projectId, tenantId)
            : milestoneMapper.listPublicMilestonesGlobal(projectId);
        List<MilestoneDto> items = new ArrayList<>(rows.size());
        for (AllianceProjectMilestone m : rows) {
            items.add(toMilestoneDto(m));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public ListResponse<AchievementDto> listPublicAchievements(String tenantId, long limit, long offset) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceAchievement> rows = (tenantId != null && !tenantId.isEmpty())
            ? achievementMapper.listPublicAchievementsByTenant(tenantId, (int) safeLimit, (int) safeOffset)
            : achievementMapper.listPublicAchievementsGlobal((int) safeLimit, (int) safeOffset);
        List<AchievementDto> items = new ArrayList<>(rows.size());
        for (AllianceAchievement a : rows) {
            items.add(toAchievementDto(a));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public AchievementDto getPublicAchievement(String id, String tenantId) {
        AllianceAchievement a = (tenantId != null && !tenantId.isEmpty())
            ? achievementMapper.selectPublicAchievementByTenant(id, tenantId)
            : achievementMapper.selectPublicAchievementGlobal(id);
        if (a == null) {
            throw new ApiException(404, "not_found", "成果不存在");
        }
        achievementMapper.incrementView(id);
        return toAchievementDto(a);
    }

    @Override
    public ListResponse<PublicAgreementDto> listPublicAgreements(String tenantId, long limit, long offset) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceAgreementMapper.PublicAgreementRow> rows = (tenantId != null && !tenantId.isEmpty())
            ? agreementMapper.listPublicAgreementsByTenant(tenantId, (int) safeLimit, (int) safeOffset)
            : agreementMapper.listPublicAgreementsGlobal((int) safeLimit, (int) safeOffset);
        List<PublicAgreementDto> items = new ArrayList<>(rows.size());
        for (AllianceAgreementMapper.PublicAgreementRow row : rows) {
            PublicAgreementDto dto = new PublicAgreementDto();
            dto.setId(row.getId());
            dto.setName(row.getName());
            dto.setType(row.getType());
            dto.setStatus(row.getStatus());
            dto.setStartDate(row.getStartDate());
            dto.setEndDate(row.getEndDate());
            dto.setEnterpriseIds(AllianceSupport.strList(row.getEnterpriseIds()));
            dto.setProjectIds(AllianceSupport.strList(row.getProjectIds()));
            items.add(dto);
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public ListResponse<ExpertDto> listPublicExperts(String tenantId, long limit, long offset, boolean includeNonPublic) {
        long safeLimit = AllianceSupport.clampPublicLimit(limit);
        long safeOffset = AllianceSupport.clampOffset(offset);
        List<AllianceExpert> rows = (tenantId != null && !tenantId.isEmpty())
            ? expertMapper.listPublicExpertsByTenant(tenantId, (int) safeLimit, (int) safeOffset, includeNonPublic)
            : expertMapper.listPublicExpertsGlobal((int) safeLimit, (int) safeOffset, includeNonPublic);
        List<ExpertDto> items = new ArrayList<>(rows.size());
        for (AllianceExpert e : rows) {
            items.add(toExpertDto(e));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public ExpertDto getPublicExpert(String id, String tenantId) {
        AllianceExpert e = (tenantId != null && !tenantId.isEmpty())
            ? expertMapper.selectPublicExpertByTenant(id, tenantId)
            : expertMapper.selectPublicExpertGlobal(id);
        if (e == null) {
            throw new ApiException(404, "not_found", "专家不存在");
        }
        return toExpertDto(e);
    }

    @Override
    public ListResponse<PublicBrandDto> listPublicBrands(String tenantId, String brandType) {
        List<AllianceBrandMapper.PublicBrandRow> rows = brandMapper.listPublicBrands(tenantId, brandType);
        List<PublicBrandDto> items = new ArrayList<>(rows.size());
        for (AllianceBrandMapper.PublicBrandRow row : rows) {
            items.add(toPublicBrandDto(row));
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public PublicBrandDto getPublicBrand(String id, String tenantId) {
        AllianceBrandMapper.PublicBrandRow row = brandMapper.selectPublicBrand(id, tenantId);
        if (row == null) {
            throw new ApiException(404, "not_found", "品牌不存在");
        }
        brandMapper.incrementView(id);
        return toPublicBrandDto(row);
    }

    @Override
    public Map<String, Object> listPublicTalentRanking(String tenantId, String search) {
        if (tenantId == null || tenantId.isEmpty()) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("items", new ArrayList<>());
            return out;
        }
        List<TalentRankMajorGroupDto> groups = buildTalentRanking(tenantId, search, true);
        List<TalentRankMajorGroupDto> out = new ArrayList<>();
        for (TalentRankMajorGroupDto g : groups) {
            if (!Boolean.TRUE.equals(g.getEnabled())) {
                continue;
            }
            int limit = g.getRankLimit() == null ? 10 : g.getRankLimit();
            if (g.getStudents().size() > limit) {
                g.setStudents(new ArrayList<>(g.getStudents().subList(0, limit)));
            }
            for (TalentRankStudentDto st : g.getStudents()) {
                st.setPositions(null);
            }
            out.add(g);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("items", out);
        return resp;
    }

    @Override
    public PublicStatsDto getPublicStats(String tenantId) {
        PublicStatsDto dto = new PublicStatsDto();
        if (tenantId != null && !tenantId.isEmpty()) {
            dto.setEnterpriseCount(statsMapper.countPublicEnterprisesByTenant(tenantId));
            dto.setProjectCount(statsMapper.countPublicProjectsByTenant(tenantId));
            dto.setExpertCount(statsMapper.countPublicExpertsByTenant(tenantId));
            dto.setAchievementCount(statsMapper.countPublicAchievementsByTenant(tenantId));
            dto.setBrandCount(statsMapper.countPublicBrandsByTenant(tenantId));
        } else {
            dto.setEnterpriseCount(statsMapper.countPublicEnterprisesGlobal());
            dto.setProjectCount(statsMapper.countPublicProjectsGlobal());
            dto.setExpertCount(statsMapper.countPublicExpertsGlobal());
            dto.setAchievementCount(statsMapper.countPublicAchievementsGlobal());
            dto.setBrandCount(statsMapper.countPublicBrandsGlobal());
        }
        return dto;
    }

    // ===== 人才排名组装 =====

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
            TalentRankMajorGroupDto g = new TalentRankMajorGroupDto();
            g.setMajorId(majorId);
            g.setMajorName(sdto.getMajorName());
            g.setEnabled(cfg == null || Boolean.TRUE.equals(cfg.getEnabled()));
            g.setRankLimit(cfg == null || cfg.getRankLimit() == null ? 10 : cfg.getRankLimit());
            g.setStudents(new ArrayList<>(List.of(sdto)));
            groupIdx.put(majorId, groups.size());
            groups.add(g);
        }
        for (TalentRankMajorGroupDto g : groups) {
            g.setStudentCount(g.getStudents().size());
        }
        return groups;
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

    // ===== 转换 =====

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

    private PublicBrandDto toPublicBrandDto(AllianceBrandMapper.PublicBrandRow row) {
        PublicBrandDto dto = new PublicBrandDto();
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
        dto.setPositionName(row.getPositionName());
        dto.setPositionType(row.getPositionType());
        dto.setSalaryMin(row.getSalaryMin() == null ? null : java.math.BigDecimal.valueOf(row.getSalaryMin()));
        dto.setSalaryMax(row.getSalaryMax() == null ? null : java.math.BigDecimal.valueOf(row.getSalaryMax()));
        dto.setMajorNames(AllianceSupport.strList(row.getMajorNames()));
        dto.setIndustryName(row.getIndustryName());
        dto.setPositionStatus(row.getPositionStatus());
        dto.setPositionDescription(row.getPositionDescription());
        dto.setPositionRequirements(AllianceSupport.strList(row.getPositionRequirements()));
        dto.setPositionCareerPath(row.getPositionCareerPath());
        dto.setPositionCoverImage(row.getPositionCoverImage());
        dto.setResponsibilities(parseResp(row.getResponsibilities()));
        dto.setCertificates(parseCert(row.getCertificates()));
        dto.setPersonName(row.getPersonName());
        dto.setPersonAvatar(row.getPersonAvatar());
        dto.setPersonTitle(row.getPersonTitle());
        dto.setPersonPosition(row.getPersonPosition());
        dto.setPersonOrganization(row.getPersonOrganization());
        dto.setPersonIndustry(row.getPersonIndustry());
        dto.setPersonExperienceYears(row.getPersonExperienceYears());
        dto.setPersonEducation(row.getPersonEducation());
        dto.setPersonIntroduction(row.getPersonIntroduction());
        dto.setPersonWorkExperience(row.getPersonWorkExperience());
        dto.setPersonCity(row.getPersonCity());
        dto.setPersonExpertType(row.getPersonExpertType());
        dto.setPersonRating(row.getPersonRating());
        dto.setPersonStatus(row.getPersonStatus());
        dto.setPersonGender(row.getPersonGender());
        dto.setPersonAge(row.getPersonAge());
        dto.setPersonSpecialties(AllianceSupport.strList(row.getPersonSpecialties()));
        dto.setPersonProfessionalFields(AllianceSupport.strList(row.getPersonProfessionalFields()));
        dto.setPersonAttachments(AllianceSupport.strList(row.getPersonAttachments()));
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

    private List<BrandResponsibility> parseResp(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<BrandResponsibility> v = ZhiyuJsonUtils.MAPPER.readValue(json, RESP_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<BrandCertificate> parseCert(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<BrandCertificate> v = ZhiyuJsonUtils.MAPPER.readValue(json, CERT_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
