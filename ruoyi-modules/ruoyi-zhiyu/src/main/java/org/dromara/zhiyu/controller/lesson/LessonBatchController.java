package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchUpdateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.LessonBatchDto;
import org.dromara.zhiyu.service.lesson.ILessonBatchService;
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
 * 课程批次控制器（对齐 Go routes_lesson.go /lesson/batches 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/batches")
public class LessonBatchController {

    private final ILessonBatchService batchService;

    @GetMapping
    public ListResponse<LessonBatchDto> list(@RequestParam(value = "orgNodeId", required = false) String orgNodeId,
                                             @RequestParam(value = "status", required = false) String status,
                                             @RequestParam(value = "majorId", required = false) String majorId,
                                             @RequestParam(value = "search", required = false) String search,
                                             @RequestParam(value = "limit", required = false) Long limit,
                                             @RequestParam(value = "offset", required = false) Long offset) {
        return batchService.list(orgNodeId, status, majorId, search, limit == null ? 20 : limit,
            offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public LessonBatchDto get(@PathVariable String id) {
        return batchService.get(id);
    }

    @PostMapping
    public LessonBatchDto create(@RequestBody BatchCreateRequest req) {
        return batchService.create(req);
    }

    @PutMapping("/{id}")
    public LessonBatchDto update(@PathVariable String id, @RequestBody BatchUpdateRequest req) {
        return batchService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", batchService.delete(id));
    }

    @PostMapping("/{id}/status")
    public LessonBatchDto updateStatus(@PathVariable String id, @RequestBody BatchStatusRequest req) {
        return batchService.updateStatus(id, req);
    }
}
