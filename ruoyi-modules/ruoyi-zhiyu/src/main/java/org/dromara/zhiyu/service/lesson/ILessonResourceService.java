package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeResourceDto;

/**
 * 节点/课程资源绑定服务（对齐 Go node_resource_handler.go + course_resource_handler.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonResourceService {

    /** 节点资源列表（nodeId 过滤，search 匹配名称/描述）。 */
    ListResponse<NodeResourceDto> listNodeResources(String nodeId, String search, long limit, long offset);

    /** 创建节点资源（新建资源库条目并绑定节点）。 */
    NodeResourceDto createNodeResource(CreateNodeResourceRequest req);

    /** 绑定已有节点资源。 */
    String bindNodeResource(BindNodeResourceRequest req);

    /** 解绑节点资源。 */
    String unbindNodeResource(String id);

    /** 课程资源列表（courseId 过滤，search 匹配名称/URL）。 */
    ListResponse<NodeResourceDto> listCourseResources(String courseId, String search, long limit, long offset);

    /** 创建课程资源（新建资源库条目并绑定课程，同步聚合字段）。 */
    NodeResourceDto createCourseResource(CreateCourseResourceRequest req);

    /** 绑定已有课程资源。 */
    String bindCourseResource(BindCourseResourceRequest req);

    /** 解绑课程资源。 */
    String unbindCourseResource(String id);
}
