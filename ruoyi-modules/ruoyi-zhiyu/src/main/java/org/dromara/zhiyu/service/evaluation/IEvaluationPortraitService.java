package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateStudentArchiveRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.GeneratePortraitRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityArchiveDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityPortraitDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentDashboardDto;

/**
 * 学生能力画像/档案服务（portraits），对齐 Go StudentPortraitHandler。
 *
 * @author zhiyu
 */
public interface IEvaluationPortraitService {

    ListResponse<StudentAbilityPortraitDto> listPortraits(String userId, String careerPositionId, long limit, long offset);

    StudentAbilityPortraitDto getPortrait(String id);

    StudentAbilityPortraitDto generatePortrait(GeneratePortraitRequest req);

    ListResponse<StudentAbilityArchiveDto> listArchives(String userId, String materialType, long limit, long offset);

    StudentAbilityArchiveDto createArchive(CreateStudentArchiveRequest req);

    String deleteArchive(String id);

    StudentDashboardDto studentDashboard(String userId);
}
