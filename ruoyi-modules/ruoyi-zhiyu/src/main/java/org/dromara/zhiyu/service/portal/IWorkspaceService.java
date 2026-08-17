package org.dromara.zhiyu.service.portal;

import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.MyScheduleResponse;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceDashboard;

/**
 * 门户工作台服务（对齐 Go portal_handler.go + scheduling_handler.go MySchedule）。
 *
 * @author zhiyu
 */
public interface IWorkspaceService {

    /**
     * 工作台仪表盘（GET /portal/workspace/dashboard）。
     *
     * @param role 前端传入角色（仅允许切换到用户自己绑定的角色）
     * @return 仪表盘聚合数据
     */
    WorkspaceDashboard dashboard(String role);

    /**
     * 我的课表（GET /portal/workspace/my-schedule）。
     *
     * @param termId 学期 ID（缺省取含本人排课的最优学期）
     * @return 课表响应
     */
    MyScheduleResponse mySchedule(String termId);
}
