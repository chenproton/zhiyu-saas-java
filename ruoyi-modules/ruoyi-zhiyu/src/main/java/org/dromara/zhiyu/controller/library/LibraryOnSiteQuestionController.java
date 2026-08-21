package org.dromara.zhiyu.controller.library;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionRequest;
import org.dromara.zhiyu.service.library.ILibraryOnSiteQuestionService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 现场题库控制器（对齐 Go /library/on-site-questions 路由组）。
 *
 * <p>学生视角列表/详情不下发答案与分值；列表分页 limit/offset（默认 50、上限 200）。</p>
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/library/on-site-questions")
public class LibraryOnSiteQuestionController {

    private final ILibraryOnSiteQuestionService questionService;

    /** 现场题库列表（search 匹配题干/答案） */
    @GetMapping
    public ListResponse<OnSiteQuestionItemDto> list(
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false, defaultValue = "50") int limit,
        @RequestParam(value = "offset", required = false, defaultValue = "0") int offset) {
        return questionService.list(search, limit, offset);
    }

    /** 题目详情 */
    @GetMapping("/{id}")
    public OnSiteQuestionItemDto get(@PathVariable String id) {
        return questionService.get(id);
    }

    /** 创建题目 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OnSiteQuestionItemDto create(@RequestBody OnSiteQuestionRequest req) {
        return questionService.create(req);
    }

    /** 更新题目（部分更新：null 字段保留原值） */
    @PutMapping("/{id}")
    public OnSiteQuestionItemDto update(@PathVariable String id, @RequestBody OnSiteQuestionRequest req) {
        return questionService.update(id, req);
    }

    /** 删除题目 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", questionService.delete(id));
    }
}
