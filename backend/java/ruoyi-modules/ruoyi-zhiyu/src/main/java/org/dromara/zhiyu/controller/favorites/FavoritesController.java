package org.dromara.zhiyu.controller.favorites;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteListResponse;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteStatus;
import org.dromara.zhiyu.service.favorites.IFavoritesService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 通用收藏控制器（对齐 Go routes.go 的 /favorites 路由组：场景/课程/题库/试卷/AI 知识库/AI 智能体）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/favorites")
public class FavoritesController {

    private final IFavoritesService favoritesService;

    /** 查询收藏状态 */
    @GetMapping("/{targetType}/{id}")
    public FavoriteStatus getFavorite(@PathVariable String targetType, @PathVariable String id) {
        return favoritesService.getFavorite(targetType, id);
    }

    /** 切换收藏（返回新状态） */
    @PostMapping("/{targetType}/{id}")
    public FavoriteStatus toggleFavorite(@PathVariable String targetType, @PathVariable String id) {
        return favoritesService.toggleFavorite(targetType, id);
    }

    /** 当前用户全部收藏（按类型分组） */
    @GetMapping
    public FavoriteListResponse list() {
        return favoritesService.list();
    }
}
