package org.dromara.zhiyu.service.affairs;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.GenerateTeachingPlanRequest;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryUpdatePayload;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.UpdateTeachingPlanRequest;

/**
 * 教学计划服务（对齐 Go teaching_plan_handler.go + store/teaching_plans.go）。
 *
 * @author zhiyu
 */
public interface ITeachingPlanService {

    ListResponse<TeachingPlanDto> list(String status, String programId, String termId, long limit, long offset);

    TeachingPlanDto get(String id);

    TeachingPlanDto create(GenerateTeachingPlanRequest req);

    TeachingPlanDto update(String id, UpdateTeachingPlanRequest req);

    String delete(String id);

    TeachingPlanDto submit(String id);

    TeachingPlanDto review(String id, ReviewRequest req);

    TeachingPlanDto publish(String id);

    TeachingPlanDto archive(String id);

    TeachingPlanDto unpublish(String id);

    TeachingPlanDto withdraw(String id);

    TeachingPlanDto saveDraft(String id);

    TeachingPlanDto invite(String id, InviteRequest req);

    TeachingPlanDto confirm(String id);

    TeachingPlanEntryDto updateEntry(String id, TeachingPlanEntryUpdatePayload req);

    String deleteEntry(String id);

    ExcelExport exportExcel(String id);
}
