package org.dromara.zhiyu.service.alliance;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.*;

import java.util.Map;

/**
 * 联盟门户前台公开服务（tenantId 过滤本校链接，is_public/enable_public 双控）。
 *
 * @author zhiyu
 */
public interface IAlliancePublicService {

    SchoolInfoDto getPublicSchoolInfo(String tenantId);

    ListResponse<EnterpriseDto> listPublicEnterprises(String tenantId, long limit, long offset);

    EnterpriseDto getPublicEnterprise(String id, String tenantId);

    ListResponse<ProjectDto> listPublicProjects(String tenantId, long limit, long offset);

    ProjectDto getPublicProject(String id, String tenantId);

    ListResponse<MilestoneDto> listPublicMilestones(String projectId, String tenantId);

    ListResponse<AchievementDto> listPublicAchievements(String tenantId, long limit, long offset);

    AchievementDto getPublicAchievement(String id, String tenantId);

    ListResponse<PublicAgreementDto> listPublicAgreements(String tenantId, long limit, long offset);

    ListResponse<ExpertDto> listPublicExperts(String tenantId, long limit, long offset, boolean includeNonPublic);

    ExpertDto getPublicExpert(String id, String tenantId);

    ListResponse<PublicBrandDto> listPublicBrands(String tenantId, String brandType);

    PublicBrandDto getPublicBrand(String id, String tenantId);

    Map<String, Object> listPublicTalentRanking(String tenantId, String search);

    PublicStatsDto getPublicStats(String tenantId);
}
