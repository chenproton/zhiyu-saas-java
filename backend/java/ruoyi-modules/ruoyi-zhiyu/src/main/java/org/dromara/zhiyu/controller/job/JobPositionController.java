package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CareerPositionDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ContentReviewRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FavoriteStatusDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionUpdateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.SaveFullPositionRequest;
import org.dromara.zhiyu.service.job.IJobPositionService;
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
 * 岗位控制器（对齐 Go routes_job.go 的 /job/positions 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/positions")
public class JobPositionController {

    private final IJobPositionService positionService;

    /** 岗位列表（search/status/batchId/positionType 过滤，默认排除 archived） */
    @GetMapping
    public ListResponse<CareerPositionDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset,
                                                @RequestParam(value = "search", required = false) String search,
                                                @RequestParam(value = "status", required = false) String status,
                                                @RequestParam(value = "batchId", required = false) String batchId,
                                                @RequestParam(value = "positionType", required = false) String positionType) {
        return positionService.list(search, status, batchId, positionType,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 岗位详情（记录浏览量） */
    @GetMapping("/{id}")
    public CareerPositionDto get(@PathVariable String id) {
        return positionService.get(id);
    }

    /** 创建岗位（draft 状态） */
    @PostMapping
    public CareerPositionDto create(@RequestBody PositionCreateRequest req) {
        return positionService.create(req);
    }

    /** 更新岗位（部分更新语义） */
    @PutMapping("/{id}")
    public CareerPositionDto update(@PathVariable String id, @RequestBody PositionUpdateRequest req) {
        return positionService.update(id, req);
    }

    /** 删除岗位 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", positionService.delete(id));
    }

    /** 提交审核 */
    @PostMapping("/{id}/submit")
    public CareerPositionDto submit(@PathVariable String id) {
        return positionService.submit(id);
    }

    /** 审核（approved/rejected） */
    @PostMapping("/{id}/review")
    public CareerPositionDto review(@PathVariable String id, @RequestBody ContentReviewRequest req) {
        return positionService.review(id, req);
    }

    /** 发布 */
    @PostMapping("/{id}/publish")
    public CareerPositionDto publish(@PathVariable String id) {
        return positionService.publish(id);
    }

    /** 归档 */
    @PostMapping("/{id}/archive")
    public CareerPositionDto archive(@PathVariable String id) {
        return positionService.archive(id);
    }

    /** 取消发布 */
    @PostMapping("/{id}/unpublish")
    public CareerPositionDto unpublish(@PathVariable String id) {
        return positionService.unpublish(id);
    }

    /** 撤回（删除待审批记录） */
    @PostMapping("/{id}/withdraw")
    public CareerPositionDto withdraw(@PathVariable String id) {
        return positionService.withdraw(id);
    }

    /** 存草稿 */
    @PostMapping("/{id}/save-draft")
    public CareerPositionDto saveDraft(@PathVariable String id) {
        return positionService.saveDraft(id);
    }

    /** 邀请协作者 */
    @PostMapping("/{id}/invite")
    public CareerPositionDto invite(@PathVariable String id, @RequestBody InviteRequest req) {
        return positionService.invite(id, req);
    }

    /** 克隆岗位（含全部关联，状态重置 draft） */
    @PostMapping("/{id}/clone")
    public CareerPositionDto clone(@PathVariable String id, @RequestBody(required = false) CloneRequest req) {
        return positionService.clone(id, req == null ? new CloneRequest() : req);
    }

    /** 完整保存岗位（岗位构建器保存） */
    @PutMapping("/{id}/save-full")
    public Map<String, CareerPositionDto> saveFull(@PathVariable String id,
                                                   @RequestBody SaveFullPositionRequest req) {
        return Map.of("position", positionService.saveFull(id, req));
    }

    /** 查询收藏状态 */
    @GetMapping("/{id}/favorite")
    public FavoriteStatusDto getFavorite(@PathVariable String id) {
        return positionService.getFavorite(id);
    }

    /** 切换收藏 */
    @PostMapping("/{id}/favorite")
    public FavoriteStatusDto toggleFavorite(@PathVariable String id) {
        return positionService.toggleFavorite(id);
    }

    /** 当前用户收藏岗位列表（仅已发布） */
    @GetMapping("/favorites")
    public ListResponse<CareerPositionDto> listFavorites(@RequestParam(value = "limit", required = false) Long limit,
                                                         @RequestParam(value = "offset", required = false) Long offset) {
        return positionService.listFavorites(limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 岗位快照 bundle（?version= 可选） */
    @GetMapping("/{id}/snapshot")
    public Map<String, Object> snapshot(@PathVariable String id,
                                        @RequestParam(value = "version", required = false) String version) {
        return positionService.getSnapshot(id, version);
    }
}
