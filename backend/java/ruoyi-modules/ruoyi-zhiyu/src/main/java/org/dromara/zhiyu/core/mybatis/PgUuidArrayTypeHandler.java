package org.dromara.zhiyu.core.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.MappedTypes;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * PostgreSQL uuid[] 列 ↔ {@link List}&lt;String&gt; 类型处理器。
 *
 * <p>{@link PgArrayTypeHandler} 写入时按 text[] 创建数组，对 uuid[] 列会报
 * 「column is of type uuid[] but expression is of type text[]」。本处理器按 uuid[]
 * 创建（值须为合法 UUID 字符串，读回时逐元素 toString）。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.VARCHAR)
public class PgUuidArrayTypeHandler extends BaseTypeHandler<List<String>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> LIST_REF = new TypeReference<>() {
    };

    /** MySQL 版：uuid[] 列以 JSON 文本存储（原 PG uuid[] → JSON），读写走 JSON 序列化。 */
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
        throws SQLException {
        try {
            ps.setString(i, MAPPER.writeValueAsString(parameter == null ? java.util.List.of() : parameter));
        } catch (Exception e) {
            throw new SQLException("uuid 数组列 JSON 序列化失败", e);
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
