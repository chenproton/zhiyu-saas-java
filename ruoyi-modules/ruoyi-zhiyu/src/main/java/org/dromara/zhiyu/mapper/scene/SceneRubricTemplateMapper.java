package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.domain.scene.SceneRubricTemplate;

import java.util.List;
import java.util.Map;

/**
 * 评分模板 Mapper（rubric_templates 表，Go→Java 迁移）。
 *
 * <p>data 为 MySQL JSON 列，写入需显式 CAST；types 为 JSON 数组列（原 PG varchar[]）。</p>
 *
 * @author zhiyu
 */
public interface SceneRubricTemplateMapper extends BaseMapperPlus<SceneRubricTemplate, SceneRubricTemplate> {

    /**
     * 创建评分模板（对齐 Go TaskEvaluationStore.CreateRubricTemplate；id 由 Service 生成）。
     */
    @Insert("INSERT INTO rubric_templates (id, tenant_id, name, mode, types, description, data, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{mode},"
        + " #{types, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler}, #{description},"
        + " CAST(#{data} AS JSON), NOW(), NOW())")
    int insertTemplate(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("mode") String mode, @Param("types") List<String> types,
                       @Param("description") String description, @Param("data") String data);

    /**
     * 更新评分模板（对齐 Go TaskEvaluationStore.UpdateRubricTemplate）。
     */
    @Update("UPDATE rubric_templates SET name = #{name}, mode = #{mode},"
        + " types = #{types, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " description = #{description}, data = CAST(#{data} AS JSON), updated_at = NOW() WHERE id = #{id}")
    int updateTemplate(@Param("id") String id, @Param("name") String name, @Param("mode") String mode,
                       @Param("types") List<String> types, @Param("description") String description,
                       @Param("data") String data);

    /**
     * 软删除评分模板（对齐 Go DeleteRubricTemplate）。
     */
    @Update("UPDATE rubric_templates SET is_deleted = true, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int softDelete(@Param("id") String id, @Param("tenantId") String tenantId);
}
