package org.dromara.zhiyu.service.favorites;

import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteListResponse;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteStatus;

/**
 * 通用收藏服务（对齐 Go favorites_handler.go + FavoritesService：场景/课程/题库/试卷/AI 知识库/AI 智能体）。
 *
 * @author zhiyu
 */
public interface IFavoritesService {

    /**
     * 查询收藏状态。
     *
     * @param targetType 收藏目标类型
     * @param targetId   收藏目标 ID
     * @return 收藏状态
     */
    FavoriteStatus getFavorite(String targetType, String targetId);

    /**
     * 切换收藏，返回新状态（收藏表与计数在同一事务内更新）。
     *
     * @param targetType 收藏目标类型
     * @param targetId   收藏目标 ID
     * @return 新收藏状态
     */
    FavoriteStatus toggleFavorite(String targetType, String targetId);

    /**
     * 查询当前用户全部收藏（按类型分组）。
     *
     * @return 收藏列表
     */
    FavoriteListResponse list();
}
