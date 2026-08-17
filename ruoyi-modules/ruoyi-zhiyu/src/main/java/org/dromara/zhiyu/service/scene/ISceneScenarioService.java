package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.UpdateScenarioRequest;

import java.util.Map;

/**
 * 场景服务（对齐 Go scenario_handler.go + service/scenario.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneScenarioService {

    /** 场景列表（租户内；学生强制仅已发布）。 */
    ListResponse<ScenarioDto> list(String search, String status, String batchId, String careerPositionId,
                                   long limit, long offset);

    /** 场景详情（含浏览计数；学生仅可读已发布）。 */
    ScenarioDto get(String id);

    /** 创建场景（draft 状态 + 自动生成 CJ- 编码）。 */
    ScenarioDto create(CreateScenarioRequest req);

    /** 更新场景（部分更新语义）。 */
    ScenarioDto update(String id, UpdateScenarioRequest req);

    /** 删除场景（存在测评成绩时拒绝；事务内解绑引用）。 */
    String delete(String id);

    /** 提交审核（draft → pending）。 */
    ScenarioDto submit(String id);

    /** 审核（pending → approved/rejected）。 */
    ScenarioDto review(String id, ReviewRequest req);

    /** 发布（→ published，版本自动 +0.1 并落快照）。 */
    ScenarioDto publish(String id);

    /** 归档（→ archived）。 */
    ScenarioDto archive(String id);

    /** 取消发布（→ draft）。 */
    ScenarioDto unpublish(String id);

    /** 撤回（pending → draft，同步删除待审批记录）。 */
    ScenarioDto withdraw(String id);

    /** 存草稿（任意状态 → draft）。 */
    ScenarioDto saveDraft(String id);

    /** 邀请协作者（co_builder_ids 追加）。 */
    ScenarioDto invite(String id, InviteRequest req);

    /** 克隆场景及全部关联（状态重置 draft）。 */
    ScenarioDto clone(String id, CloneRequest req);

    /** 场景快照 bundle（Map 形状 = 快照 jsonb 原文，snake_case 键）。 */
    Map<String, Object> getSnapshot(String id, String version);
}
