package org.dromara.zhiyu.mapper.favorites;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.favorites.ZhiyuFavoriteCounter;

/**
 * 收藏计数 Mapper（favorite_counters 表，upsert 对齐 Go 版 ON CONFLICT SQL）。
 *
 * @author zhiyu
 */
public interface ZhiyuFavoriteCounterMapper extends BaseMapperPlus<ZhiyuFavoriteCounter, ZhiyuFavoriteCounter> {

    /**
     * 取消收藏递减（GREATEST 防负，仅实际删除后调用）。
     */
    @Update("""
        UPDATE favorite_counters SET cnt = GREATEST(cnt - 1, 0), updated_at = now()
        WHERE target_type = #{targetType} AND target_id = #{targetId}::uuid
        """)
    int decrement(@Param("targetType") String targetType, @Param("targetId") String targetId);

    /**
     * 新增收藏递增（ON CONFLICT 累加，仅实际插入后调用）。
     */
    @Insert("""
        INSERT INTO favorite_counters (target_type, target_id, cnt)
        VALUES (#{targetType}, #{targetId}::uuid, 1)
        ON CONFLICT (target_type, target_id) DO UPDATE SET cnt = favorite_counters.cnt + 1, updated_at = now()
        """)
    int increment(@Param("targetType") String targetType, @Param("targetId") String targetId);
}
