package org.dromara.zhiyu.service.partner;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ChangePasswordRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAchievementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationAgreementDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationProjectDetail;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationSchool;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.Dashboard;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ExpertUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MentorTask;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ProfileUpdateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.School;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SchoolStatusRequest;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.domain.partner.PartnerExpert;

import java.util.List;

/**
 * 企业平台服务（主体信息/专家/工作台/合作学校/合作内容/测评任务/密码）。
 *
 * @author zhiyu
 */
public interface IPartnerService {

    PartnerEnterprise getProfile();

    PartnerEnterprise updateProfile(ProfileUpdateRequest req);

    ListResponse<PartnerExpert> listExperts(String search, long limit, long offset);

    PartnerExpert getExpert(String id);

    ExpertCreateResponse createExpert(ExpertCreateRequest req);

    PartnerExpert updateExpert(String id, ExpertUpdateRequest req);

    String deleteExpert(String id);

    PartnerExpert getMyExpert();

    PartnerExpert updateMyExpert(ExpertUpdateRequest req);

    Dashboard dashboard();

    ListResponse<School> listSchools();

    School updateSchoolStatus(String schoolTenantId, SchoolStatusRequest req);

    List<CooperationSchool> listCooperation();

    CooperationProjectDetail getCooperationProject(String id);

    CooperationAchievementDetail getCooperationAchievement(String id);

    CooperationAgreementDetail getCooperationAgreement(String id);

    List<MentorTask> listMentorTasks();

    String changeMyPassword(ChangePasswordRequest req);
}
