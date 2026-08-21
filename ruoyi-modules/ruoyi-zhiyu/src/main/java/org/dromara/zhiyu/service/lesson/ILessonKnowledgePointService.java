package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointRequest;

/**
 * 知识点服务（对齐 Go knowledge_point_handler.go + service/lesson_content.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonKnowledgePointService {

    /** 知识点列表（租户内，search/linked/creatorId 过滤）。 */
    ListResponse<KnowledgePointDto> list(String search, Boolean linked, String creatorId, long limit, long offset);

    /** 知识点详情。 */
    KnowledgePointDto get(String id);

    /** 创建知识点（事务内同步颗粒课引用）。 */
    KnowledgePointDto create(KnowledgePointRequest req);

    /** 更新知识点（部分更新语义）。 */
    KnowledgePointDto update(String id, KnowledgePointRequest req);

    /** 删除知识点（清理标签绑定 + 物理删除）。 */
    String delete(String id);

    /** 知识点引用次数分布统计。 */
    CitationStatsDto citationStats();

    /** 零引用知识点列表（上传时段筛选 + 分页）。 */
    ListResponse<UncitedItemDto> uncited(String startDate, String endDate, long limit, long offset);
}
