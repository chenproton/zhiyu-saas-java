package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.GenerateTeachingPlanRequest;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryUpdatePayload;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.UpdateTeachingPlanRequest;
import org.dromara.zhiyu.service.affairs.ITeachingPlanService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 教学计划控制器（对齐 Go /affairs/teaching-plans 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/teaching-plans")
public class TeachingPlanController {

    private final ITeachingPlanService teachingPlanService;

    @GetMapping
    public ListResponse<TeachingPlanDto> list(@RequestParam(value = "status", required = false) String status,
                                              @RequestParam(value = "programId", required = false) String programId,
                                              @RequestParam(value = "termId", required = false) String termId,
                                              @RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset) {
        return teachingPlanService.list(status, programId, termId, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public TeachingPlanDto get(@PathVariable String id) {
        return teachingPlanService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeachingPlanDto create(@RequestBody GenerateTeachingPlanRequest req) {
        return teachingPlanService.create(req);
    }

    @PutMapping("/{id}")
    public TeachingPlanDto update(@PathVariable String id, @RequestBody UpdateTeachingPlanRequest req) {
        return teachingPlanService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", teachingPlanService.delete(id));
    }

    @PostMapping("/{id}/submit")
    public TeachingPlanDto submit(@PathVariable String id) {
        return teachingPlanService.submit(id);
    }

    @PostMapping("/{id}/review")
    public TeachingPlanDto review(@PathVariable String id, @RequestBody ReviewRequest req) {
        return teachingPlanService.review(id, req);
    }

    @PostMapping("/{id}/publish")
    public TeachingPlanDto publish(@PathVariable String id) {
        return teachingPlanService.publish(id);
    }

    @PostMapping("/{id}/archive")
    public TeachingPlanDto archive(@PathVariable String id) {
        return teachingPlanService.archive(id);
    }

    @PostMapping("/{id}/unpublish")
    public TeachingPlanDto unpublish(@PathVariable String id) {
        return teachingPlanService.unpublish(id);
    }

    @PostMapping("/{id}/withdraw")
    public TeachingPlanDto withdraw(@PathVariable String id) {
        return teachingPlanService.withdraw(id);
    }

    @PostMapping("/{id}/save-draft")
    public TeachingPlanDto saveDraft(@PathVariable String id) {
        return teachingPlanService.saveDraft(id);
    }

    @PostMapping("/{id}/invite")
    public TeachingPlanDto invite(@PathVariable String id, @RequestBody InviteRequest req) {
        return teachingPlanService.invite(id, req);
    }

    @PostMapping("/{id}/confirm")
    public TeachingPlanDto confirm(@PathVariable String id) {
        return teachingPlanService.confirm(id);
    }

    @PutMapping("/entries/{id}")
    public TeachingPlanEntryDto updateEntry(@PathVariable String id, @RequestBody TeachingPlanEntryUpdatePayload req) {
        return teachingPlanService.updateEntry(id, req);
    }

    @DeleteMapping("/entries/{id}")
    public Map<String, String> deleteEntry(@PathVariable String id) {
        return Map.of("id", teachingPlanService.deleteEntry(id));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable String id) {
        ExcelExport file = teachingPlanService.exportExcel(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(file.content());
    }
}
