package org.dromara.zhiyu.service.alliance;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;

import java.util.List;
import java.util.Map;

/**
 * 联盟 school 侧服务（学校信息 / 企业 / 授权 / 项目 / 成果 / 专家 / 协议 / 权限 / 字典 / 品牌 / 人才排名）。
 *
 * @author zhiyu
 */
public interface IAllianceService {

    // 学校信息
    SchoolInfoDto getSchoolInfo();

    SchoolInfoDto updateSchoolInfo(SchoolInfoDto req);

    // 企业（link 合并视图）
    ListResponse<EnterpriseDto> listEnterprises(String search, String status, long limit, long offset);

    EnterpriseDto getEnterprise(String id);

    ListResponse<EnterpriseDto> searchEnterprises(String keyword);

    EnterpriseDto linkEnterprise(String id, EnterpriseLinkRequest req);

    Map<String, String> unlinkEnterprise(String id);

    EnterpriseDto registerEnterprise(EnterpriseRegisterRequest req);

    EnterpriseDto updateEnterprise(String id, EnterpriseLinkUpdateRequest req);

    // 资源授权
    Map<String, Object> listGrants(String enterpriseId);

    Map<String, Object> saveGrants(SaveGrantsRequest req);

    ListResponse<GrantResourceOptionDto> listGrantResourceOptions(String enterpriseId);

    // 项目
    ListResponse<ProjectDto> listProjects(String search, String phase, long limit, long offset);

    ProjectDto getProject(String id);

    ProjectDto createProject(ProjectDto req);

    ProjectDto updateProject(String id, ProjectDto req);

    Map<String, String> deleteProject(String id);

    // 里程碑
    ListResponse<MilestoneDto> listMilestones(String projectId);

    Map<String, String> createMilestone(String projectId, MilestoneDto req);

    Map<String, String> updateMilestone(String id, MilestoneDto req);

    Map<String, String> deleteMilestone(String id);

    // 成果
    ListResponse<AchievementDto> listAchievements(String search, String type, String status, long limit, long offset);

    AchievementDto getAchievement(String id);

    AchievementDto createAchievement(AchievementDto req);

    AchievementDto updateAchievement(String id, AchievementDto req);

    Map<String, String> deleteAchievement(String id);

    // 协议
    ListResponse<AgreementDto> listAgreements(String search, String status, long limit, long offset);

    AgreementDto getAgreement(String id);

    AgreementDto createAgreement(AgreementDto req);

    AgreementDto updateAgreement(String id, AgreementDto req);

    Map<String, String> deleteAgreement(String id);

    // 权限
    ListResponse<PermissionDto> listPermissions(String search, long limit, long offset);

    PermissionDto getPermission(String id);

    Map<String, String> createPermission(PermissionDto req);

    Map<String, String> updatePermission(String id, PermissionDto req);

    Map<String, String> deletePermission(String id);

    // 字典
    ListResponse<DictionaryDto> listDictionaries(String dictType);

    Map<String, String> createDictionary(String dictType, DictionaryCreateRequest req);

    Map<String, String> updateDictionary(String dictType, String id, DictionaryUpdateRequest req);

    Map<String, String> deleteDictionary(String dictType, String id);

    // 品牌
    ListResponse<BrandDto> listBrands(String search, String brandType, String status, long limit, long offset);

    BrandDto getBrand(String id);

    BrandDto createBrand(BrandDto req);

    BrandDto updateBrand(String id, BrandDto req);

    Map<String, String> deleteBrand(String id);

    // 专家
    ListResponse<ExpertDto> listExperts(String search, String status, String enterpriseId, long limit, long offset);

    ExpertDto getExpert(String id);

    ExpertDto createExpert(ExpertDto req);

    ExpertDto updateExpert(String id, ExpertDto req);

    Map<String, String> deleteExpert(String id);

    Map<String, Object> toggleExpertDisplay(String id, boolean isPublic);

    ListResponse<MentorOptionDto> listMentorOptions();

    // 人才排名
    Map<String, Object> listTalentRanking(String search);

    Map<String, Object> listBrandMajorRankConfigs();

    Map<String, Object> saveBrandMajorRankConfigs(RankConfigsSaveRequest req);
}
