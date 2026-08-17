package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointRequest;
import org.dromara.zhiyu.service.lesson.ILessonKnowledgePointService;
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
 * 知识点控制器（对齐 Go routes_lesson.go /lesson/knowledge-points 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/knowledge-points")
public class LessonKnowledgePointController {

    private final ILessonKnowledgePointService knowledgePointService;

    @GetMapping
    public ListResponse<KnowledgePointDto> list(@RequestParam(value = "search", required = false) String search,
                                                @RequestParam(value = "linked", required = false) Boolean linked,
                                                @RequestParam(value = "creatorId", required = false) String creatorId,
                                                @RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset) {
        return knowledgePointService.list(search, linked, creatorId, limit == null ? 20 : limit,
            offset == null ? 0 : offset);
    }

    @GetMapping("/citation-stats")
    public CitationStatsDto citationStats() {
        return knowledgePointService.citationStats();
    }

    @GetMapping("/uncited")
    public ListResponse<UncitedItemDto> uncited(@RequestParam(value = "startDate", required = false) String startDate,
                                                @RequestParam(value = "endDate", required = false) String endDate,
                                                @RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset) {
        return knowledgePointService.uncited(startDate, endDate, limit == null ? 20 : limit,
            offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public KnowledgePointDto get(@PathVariable String id) {
        return knowledgePointService.get(id);
    }

    @PostMapping
    public KnowledgePointDto create(@RequestBody KnowledgePointRequest req) {
        return knowledgePointService.create(req);
    }

    @PutMapping("/{id}")
    public KnowledgePointDto update(@PathVariable String id, @RequestBody KnowledgePointRequest req) {
        return knowledgePointService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", knowledgePointService.delete(id));
    }
}
