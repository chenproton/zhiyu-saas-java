package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReorderNodesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SystemCourseNodeDto;

/**
 * 体系课节点服务（对齐 Go course_node_handler.go + service/lesson_content.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonNodeService {

    /** 节点列表（courseId/parentId/rootOnly 过滤，无分页）。 */
    ListResponse<SystemCourseNodeDto> list(String courseId, String parentId, String rootOnly);

    /** 节点详情（含知识点/资源/测验富化）。 */
    SystemCourseNodeDto get(String id);

    /** 创建节点（事务内绑定知识点/资源）。 */
    SystemCourseNodeDto create(CreateNodeRequest req);

    /** 更新节点（部分更新语义）。 */
    SystemCourseNodeDto update(String id, CreateNodeRequest req);

    /** 删除节点（存在测评成绩时拒绝）。 */
    String delete(String id);

    /** 批量重排节点。 */
    boolean reorder(ReorderNodesRequest req);
}
