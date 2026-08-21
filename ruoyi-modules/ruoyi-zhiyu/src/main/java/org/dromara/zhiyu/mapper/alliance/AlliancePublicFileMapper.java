package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 联盟公开前台文件判定 SQL（对齐 Go store.AllianceStore.IsPublicAllianceFile）。
 *
 * <p>用于 /uploads 跨租户文件放行：文件被 enable_public 企业（logo/封面）、其名下专家
 * （头像/封面/照片）、is_public 成果（封面/图集）、项目或品牌（封面）引用时，任意访问者
 * （含未登录访客）可访问，与公开接口可见性语义一致。仅限公开展示引用的文件，不扩大为
 * 任意跨租户读。</p>
 *
 * @author zhiyu
 */
public interface AlliancePublicFileMapper {

    /** 判定文件 URL 是否属于联盟公开前台内容（任意访问者可见）。 */
    @Select("SELECT EXISTS ("
        + " SELECT 1 FROM partner_enterprises"
        + " WHERE tenant_id = #{tenantId} AND enable_public = true"
        + "   AND (logo_url = #{url} OR cover_image = #{url})"
        + " UNION ALL"
        + " SELECT 1 FROM alliance_experts x"
        + " JOIN partner_enterprises pe ON pe.id = x.enterprise_id AND pe.enable_public = true"
        + " WHERE x.tenant_id = #{tenantId}"
        + "   AND (#{url} = x.avatar_url OR #{url} = x.cover_image"
        + "        OR #{url} IN (SELECT JSON_TABLE(x.photos, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt))"
        + " UNION ALL"
        + " SELECT 1 FROM alliance_achievements"
        + " WHERE tenant_id = #{tenantId} AND is_public = true"
        + "   AND (#{url} = cover_image OR #{url} IN (SELECT JSON_TABLE(images, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt))"
        + " UNION ALL"
        + " SELECT 1 FROM alliance_projects"
        + " WHERE tenant_id = #{tenantId} AND is_public = true AND cover_image = #{url}"
        + " UNION ALL"
        + " SELECT 1 FROM alliance_brands"
        + " WHERE tenant_id = #{tenantId} AND is_public = true AND cover_image = #{url}"
        + ")")
    boolean isPublicAllianceFile(@Param("tenantId") String tenantId, @Param("url") String url);
}
