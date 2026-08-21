package org.dromara.zhiyu.core.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.CallableStatement;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * MySQL JSON 数组列 ↔ {@link List}&lt;String&gt; 类型处理器（原 PG uuid[]/varchar[] 列已迁移为 JSON）。
 *
 * <p>zhiyu-saas 现有表大量数组语义列（schedule_entries.class_node_ids、
 * exam_usages.target_ids、announcements.target_roles 等）在 MySQL 中以 JSON 文本存储，
 * MyBatis-Plus 默认无法将 JSON 数组映射为 Java List，这里按 Go 版 JSONSliceToStrings/parseUUIDs
 * 语义做读写转换（读：JSON 反序列化；写：JSON 序列化文本）。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.VARCHAR)
public class JsonStringArrayTypeHandler extends BaseTypeHandler<List<String>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> LIST_REF = new TypeReference<>() {
    };

    /** MySQL 版：数组列以 JSON 文本存储（原 PG uuid[]/varchar[] → JSON），读写走 JSON 序列化。 */
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
        throws SQLException {
        try {
            ps.setString(i, MAPPER.writeValueAsString(parameter == null ? java.util.List.of() : parameter));
        } catch (Exception e) {
            throw new SQLException("数组列 JSON 序列化失败", e);
        }
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private List<String> parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, LIST_REF);
        } catch (Exception ignored) {
            return null;
        }
    }
}
