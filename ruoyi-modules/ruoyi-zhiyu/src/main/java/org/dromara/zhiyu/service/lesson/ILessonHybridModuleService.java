package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchSaveHybridModulesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.HybridNodeModuleDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpsertHybridModuleRequest;

/**
 * 混合模块服务（对齐 Go hybrid_module_handler.go + store/hybrid_modules.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonHybridModuleService {

    /** 混合模块列表（nodeId/courseId 过滤）。 */
    ListResponse<HybridNodeModuleDto> list(String nodeId, String courseId);

    /** 批量全量替换某节点的混合模块。 */
    String batchSave(BatchSaveHybridModulesRequest req);

    /** 创建/更新单个混合模块（urlId 非空时按 id 更新）。 */
    HybridNodeModuleDto upsert(UpsertHybridModuleRequest req, String urlId);

    /** 删除混合模块。 */
    String delete(String id);
}
