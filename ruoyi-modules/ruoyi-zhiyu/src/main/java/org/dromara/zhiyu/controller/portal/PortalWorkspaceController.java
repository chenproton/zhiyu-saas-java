package org.dromara.zhiyu.controller.portal;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.ZhiyuUserView;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorItem;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorUpsertRequest;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.MyScheduleResponse;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.ChangeMyPasswordRequest;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.UpdateMeRequest;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceDashboard;
import org.dromara.zhiyu.service.portal.IHonorService;
import org.dromara.zhiyu.service.portal.IUserSelfService;
import org.dromara.zhiyu.service.portal.IWorkspaceService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 门户工作台控制器（对齐 Go routes.go 的 /portal/workspace 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/portal/workspace")
public class PortalWorkspaceController {

    private final IWorkspaceService workspaceService;
    private final IHonorService honorService;
    private final IUserSelfService userSelfService;

    /** 工作台仪表盘 */
    @GetMapping("/dashboard")
    public WorkspaceDashboard dashboard(@RequestParam(value = "role", required = false) String role) {
        return workspaceService.dashboard(role);
    }

    /** 我的课表 */
    @GetMapping("/my-schedule")
    public MyScheduleResponse mySchedule(@RequestParam(value = "termId", required = false) String termId) {
        return workspaceService.mySchedule(termId);
    }

    /** 学生荣誉列表 */
    @GetMapping("/honors")
    public ListResponse<HonorItem> listHonors(@RequestParam(value = "userId", required = false) String userId) {
        return honorService.list(userId);
    }

    /** 新增荣誉 */
    @PostMapping("/honors")
    public Map<String, String> createHonor(@RequestBody HonorUpsertRequest req) {
        return Map.of("id", honorService.create(req));
    }

    /** 更新荣誉 */
    @PutMapping("/honors/{id}")
    public Map<String, String> updateHonor(@PathVariable String id, @RequestBody HonorUpsertRequest req) {
        return Map.of("id", honorService.update(id, req));
    }

    /** 删除荣誉 */
    @DeleteMapping("/honors/{id}")
    public Map<String, String> deleteHonor(@PathVariable String id) {
        return Map.of("id", honorService.delete(id));
    }

    /** 修改本人姓名（个人中心） */
    @PutMapping("/me")
    public ZhiyuUserView updateMe(@RequestBody UpdateMeRequest req) {
        return userSelfService.updateMe(req);
    }

    /** 修改本人密码（个人中心，无需旧密码） */
    @PostMapping("/me/password")
    public Map<String, String> changeMyPassword(@RequestBody ChangeMyPasswordRequest req) {
        return Map.of("id", userSelfService.changeMyPassword(req));
    }
}
