package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CloneCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CourseDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateCourseRequest;

import java.util.Map;

/**
 * 课程服务（对齐 Go course_handler.go + content_actions.go + course_clone.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonCourseService {

    /** 课程列表（租户内；学生强制仅已发布）。 */
    ListResponse<CourseDto> list(String search, String type, String category, String status, String batchId,
                                 long limit, long offset);

    /** 课程详情（学生仅可读已发布）。 */
    CourseDto get(String id);

    /** 创建课程（draft 状态 + 自动生成 XT-/KL- 编码）。 */
    CourseDto create(CreateCourseRequest req);

    /** 更新课程（部分更新语义）。 */
    CourseDto update(String id, UpdateCourseRequest req);

    /** 删除课程（存在测评成绩时拒绝；事务内解绑引用）。 */
    String delete(String id);

    /** 提交审核（→ pending）。 */
    CourseDto submit(String id);

    /** 审核（pending → approved/rejected）。 */
    CourseDto review(String id, ReviewRequest req);

    /** 发布（→ published，版本 +0.1）。 */
    CourseDto publish(String id);

    /** 归档（→ archived）。 */
    CourseDto archive(String id);

    /** 取消发布（→ draft）。 */
    CourseDto unpublish(String id);

    /** 撤回（pending → draft）。 */
    CourseDto withdraw(String id);

    /** 存草稿（任意状态 → draft）。 */
    CourseDto saveDraft(String id);

    /** 邀请协作者（co_creator_ids 追加）。 */
    CourseDto invite(String id, InviteRequest req);

    /** 克隆课程及全部关联（状态重置 draft）。 */
    CourseDto clone(String id, CloneCourseRequest req);

    /** 课程快照 bundle（?version= 可选）。 */
    Map<String, Object> getSnapshot(String id, String version);
}
