package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CareerPositionDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ContentReviewRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FavoriteStatusDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionUpdateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.SaveFullPositionRequest;

import java.util.Map;

/**
 * 岗位服务接口（对齐 Go PositionService + PositionCloneService + LandingHandler）。
 *
 * @author zhiyu
 */
public interface IJobPositionService {

    /** 管理端岗位列表（search/status/batchId/positionType 过滤；默认排除 archived） */
    ListResponse<CareerPositionDto> list(String search, String status, String batchId, String positionType,
                                         long limit, long offset);

    /** 前台公开岗位列表（仅已发布） */
    ListResponse<CareerPositionDto> publicList(String search, String positionType, long limit, long offset);

    /** 岗位详情（管理端；异步记录浏览量） */
    CareerPositionDto get(String id);

    /** 前台岗位详情（仅登录） */
    CareerPositionDto publicGet(String id);

    /** 创建岗位（draft 状态，GW 编码） */
    CareerPositionDto create(PositionCreateRequest req);

    /** 更新岗位（部分更新语义） */
    CareerPositionDto update(String id, PositionUpdateRequest req);

    /** 删除岗位（存在测评数据/被已发布场景引用时 409 拒绝） */
    String delete(String id);

    /** 完整保存岗位（岗位构建器：岗位+专业+职责+绑定+能力域+证书全量重写） */
    CareerPositionDto saveFull(String id, SaveFullPositionRequest req);

    /** 提交审核（draft/rejected → pending） */
    CareerPositionDto submit(String id);

    /** 撤回（pending → draft，同步删除待审批记录） */
    CareerPositionDto withdraw(String id);

    /** 审核（approved/rejected，仅 pending 可审） */
    CareerPositionDto review(String id, ContentReviewRequest req);

    /** 发布（版本 +0.1，落快照） */
    CareerPositionDto publish(String id);

    /** 归档 */
    CareerPositionDto archive(String id);

    /** 取消发布（→ draft） */
    CareerPositionDto unpublish(String id);

    /** 存草稿 */
    CareerPositionDto saveDraft(String id);

    /** 邀请协作者（须为本租户用户） */
    CareerPositionDto invite(String id, InviteRequest req);

    /** 克隆岗位（含全部关联，状态重置 draft） */
    CareerPositionDto clone(String id, CloneRequest req);

    /** 查询收藏状态 */
    FavoriteStatusDto getFavorite(String id);

    /** 切换收藏 */
    FavoriteStatusDto toggleFavorite(String id);

    /** 当前用户收藏岗位列表（仅已发布） */
    ListResponse<CareerPositionDto> listFavorites(long limit, long offset);

    /** 岗位快照 bundle（?version= 可选；快照缺档按规则回退 live） */
    Map<String, Object> getSnapshot(String id, String version);

    /** 学生目标岗位列表（人培方案按班级排的岗位） */
    ListResponse<CareerPositionDto> listTargetPositions();
}
