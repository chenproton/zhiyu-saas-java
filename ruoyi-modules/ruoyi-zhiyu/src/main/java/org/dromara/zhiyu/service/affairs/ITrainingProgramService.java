package org.dromara.zhiyu.service.affairs;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PutProgramCoursesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramCourseDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramPayload;

/**
 * 人才培养方案服务（对齐 Go training_program_handler.go + content_actions.go）。
 *
 * @author zhiyu
 */
public interface ITrainingProgramService {

    ListResponse<TrainingProgramDto> list(String search, String status, String majorId, long limit, long offset);

    TrainingProgramDto get(String id);

    TrainingProgramDto create(TrainingProgramPayload payload);

    TrainingProgramDto update(String id, TrainingProgramPayload payload);

    String delete(String id);

    TrainingProgramDto submit(String id);

    TrainingProgramDto review(String id, ReviewRequest req);

    TrainingProgramDto publish(String id, String status);

    TrainingProgramDto archive(String id);

    TrainingProgramDto unpublish(String id);

    TrainingProgramDto withdraw(String id);

    TrainingProgramDto saveDraft(String id);

    TrainingProgramDto invite(String id, InviteRequest req);

    ListResponse<TrainingProgramCourseDto> listCourses(String id);

    ListResponse<TrainingProgramCourseDto> putCourses(String id, PutProgramCoursesRequest req);

    TrainingProgramDto clone(String id, CloneRequest req);
}
