package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.EvalMethodListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.SaveEvalMethodsRequest;

/**
 * 任务测评方式 + 评分模板服务（对齐 Go task_evaluation_handler.go +
 * service/task_evaluation.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneEvalMethodService {

    /** 查询任务全部测评方式（含评估点/评分规则/评审步骤）。 */
    EvalMethodListResponse listMethods(String taskId);

    /** 保存任务测评方式（乐观锁 + 事务内重写；version 冲突 409）。 */
    EvalMethodListResponse saveMethods(String taskId, SaveEvalMethodsRequest req);

    /** 评分模板列表（keyword 搜索，is_deleted=false）。 */
    ListResponse<RubricTemplateDto> listTemplates(String keyword, long limit, long offset);

    /** 评分模板详情。 */
    RubricTemplateDto getTemplate(String id);

    /** 创建评分模板。 */
    RubricTemplateDto createTemplate(RubricTemplateRequest req);

    /** 更新评分模板。 */
    RubricTemplateDto updateTemplate(String id, RubricTemplateRequest req);

    /** 软删除评分模板。 */
    String deleteTemplate(String id);
}
