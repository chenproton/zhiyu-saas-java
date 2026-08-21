package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindAbilityRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindKnowledgeRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskKnowledgeBindingDto;

/**
 * 任务知识/能力绑定服务（对齐 Go task_knowledge_ability_handler.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneTaskBindingService {

    /** 绑定知识点（幂等）。 */
    TaskKnowledgeBindingDto bindKnowledge(BindKnowledgeRequest req);

    /** 解绑知识点（幂等）。 */
    String unbindKnowledge(String id);

    /** 绑定能力点（幂等）。 */
    TaskAbilityBindingDto bindAbility(BindAbilityRequest req);

    /** 解绑能力点（幂等）。 */
    String unbindAbility(String id);
}
