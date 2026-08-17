package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceDictionary;

/**
 * 联盟字典项 Mapper（alliance_dictionaries 表；无 updated_at）。
 *
 * @author zhiyu
 */
public interface AllianceDictionaryMapper extends BaseMapperPlus<AllianceDictionary, AllianceDictionary> {

    @Insert("INSERT INTO alliance_dictionaries (id, tenant_id, dict_type, code, name, sort_order, created_at)"
        + " VALUES (#{id}, #{tenantId}, #{dictType}, #{code}, #{name}, #{sortOrder}, NOW())")
    int insertDictionary(AllianceDictionary d);

    @Update("UPDATE alliance_dictionaries SET name = #{name}, sort_order = #{sortOrder}"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateDictionary(@Param("id") String id, @Param("tenantId") String tenantId,
                         @Param("name") String name, @Param("sortOrder") Integer sortOrder);

    @Delete("DELETE FROM alliance_dictionaries WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteDictionary(@Param("id") String id, @Param("tenantId") String tenantId);
}
