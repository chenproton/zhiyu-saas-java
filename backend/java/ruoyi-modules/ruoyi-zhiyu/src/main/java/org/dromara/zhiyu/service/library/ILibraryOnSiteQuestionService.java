package org.dromara.zhiyu.service.library;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionRequest;

/**
 * 现场题库服务（对齐 Go on_site_question_library_handler.go 语义）。
 *
 * <p>学生视角不下发题目答案/分值（stripAnswerForStudents），
 * 更新为部分更新：null 字段保留原值。</p>
 *
 * @author zhiyu
 */
public interface ILibraryOnSiteQuestionService {

    /**
     * 现场题库列表（tenant + question_text/answer 搜索，按创建时间倒序）。
     *
     * @param search 搜索关键字
     * @param limit  每页条数（默认 50，上限 200）
     * @param offset 偏移
     * @return 题目列表
     */
    ListResponse<OnSiteQuestionItemDto> list(String search, int limit, int offset);

    /**
     * 题目详情（租户归属校验；学生视角隐藏答案/分值）。
     *
     * @param id 题目 ID
     * @return 题目
     */
    OnSiteQuestionItemDto get(String id);

    /**
     * 创建题目。
     *
     * @param req 创建请求
     * @return 完整题目
     */
    OnSiteQuestionItemDto create(OnSiteQuestionRequest req);

    /**
     * 更新题目（部分更新：null 字段保留原值，空数组显式清空）。
     *
     * @param id  题目 ID
     * @param req 更新请求
     * @return 完整题目
     */
    OnSiteQuestionItemDto update(String id, OnSiteQuestionRequest req);

    /**
     * 删除题目。
     *
     * @param id 题目 ID
     * @return 删除的题目 ID
     */
    String delete(String id);
}
