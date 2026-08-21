package org.dromara.zhiyu.service.impl.importexport;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.affairs.TrainingProgramCourse;
import org.dromara.zhiyu.domain.alliance.AllianceBrand;
import org.dromara.zhiyu.domain.alliance.AllianceExpert;
import org.dromara.zhiyu.domain.dto.importexport.ImportExportDtos.ImportPreviewItem;
import org.dromara.zhiyu.mapper.affairs.AffairsScheduleImportMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceBrandMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceExpertMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramCourseMapper;
import org.dromara.zhiyu.mapper.importexport.ImportExportMapper;
import org.dromara.zhiyu.mapper.importexport.QuestionImportMapper;
import org.dromara.zhiyu.mapper.importexport.ScenarioImportMapper;
import org.dromara.zhiyu.mapper.job.JobPositionImportMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseImportMapper;
import org.dromara.zhiyu.mapper.lesson.LessonGranularCourseImportMapper;
import org.dromara.zhiyu.mapper.affairs.PeriodSlotMapper;
import org.dromara.zhiyu.mapper.affairs.TermMapper;
import org.dromara.zhiyu.mapper.affairs.VenueMapper;
import org.dromara.zhiyu.service.importexport.IImportExportService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 导入导出服务实现（对齐 Go 版 import/export/templates 全套端点）。
 *
 * <p>响应结构与 Go 版 {@code ImportPreviewResult} / {@code map[string]interface{}} 一一对应；
 * 模板列映射、填写说明、参考字典 Sheet 均取自 Go 源码。复杂实体的深层关系持久化（岗位职责/
 * 场景任务/课程节点/题目选项等）在演示环境按「解析 + 逐行校验 + 计数」实现，见
 * {@link #importExcel} 各分支。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class ImportExportServiceImpl implements IImportExportService {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> LIST_STRING_REF = new TypeReference<>() {
    };

    /** Excel 导入实体（kebab-case URL 段，excel/preview 路径） */
    private static final Set<String> EXCEL_IMPORT_ENTITIES = Set.of(
        "positions", "scenarios", "question-banks", "exams", "courses", "granular-courses",
        "industries", "majors", "organizations", "students", "teachers",
        "alliance-projects", "alliance-achievements", "alliance-agreements",
        "alliance-permissions", "alliance-brands", "schedules", "program-courses", "affairs-config");

    /** 支持 preview 的实体（affairs-config 仅 excel，无 preview） */
    private static final Set<String> PREVIEW_ENTITIES = Set.of(
        "positions", "scenarios", "question-banks", "exams", "courses", "granular-courses",
        "industries", "majors", "organizations", "students", "teachers",
        "alliance-projects", "alliance-achievements", "alliance-agreements",
        "alliance-permissions", "alliance-brands", "schedules", "program-courses");

    /** 通用 CSV 实体（表名白名单，import_export_handler） */
    private static final Set<String> GENERIC_CSV_ENTITIES = Set.of(
        "question_banks", "exams", "courses", "career_positions", "scenarios");

    /** 通用 CSV 业务键列（keyCol） */
    private static final Map<String, String> GENERIC_KEY_COLS = Map.of(
        "question_banks", "name", "exams", "name", "courses", "code",
        "career_positions", "name", "scenarios", "name");

    /** 通用 CSV 导出默认列（对齐 Go defaultCols） */
    private static final Map<String, String[]> GENERIC_DEFAULT_COLS = Map.of(
        "question_banks", new String[]{"id", "name", "description", "status", "created_at"},
        "exams", new String[]{"id", "name", "description", "status", "created_at"},
        "courses", new String[]{"id", "code", "name", "status", "created_at"},
        "career_positions", new String[]{"id", "name", "short_name", "status", "created_at"},
        "scenarios", new String[]{"id", "name", "code", "status", "created_at"});

    private static final Map<String, String> TEMPLATE_FILENAMES = Map.ofEntries(
        Map.entry("positions", "岗位批量导入模板.xlsx"),
        Map.entry("scenarios", "场景批量导入模板.xlsx"),
        Map.entry("courses", "体系课批量导入模板.xlsx"),
        Map.entry("granular-courses", "颗粒课批量导入模板.xlsx"),
        Map.entry("question-banks", "题库批量导入模板.xlsx"),
        Map.entry("questions", "题目批量导入模板.xlsx"),
        Map.entry("exams", "试卷批量导入模板.xlsx"),
        Map.entry("industries", "行业批量导入模板.xlsx"),
        Map.entry("majors", "专业批量导入模板.xlsx"),
        Map.entry("organizations", "组织架构批量导入模板.xlsx"),
        Map.entry("students", "学生批量导入模板.xlsx"),
        Map.entry("teachers", "教师批量导入模板.xlsx"),
        Map.entry("alliance-projects", "合作项目批量导入模板.xlsx"),
        Map.entry("alliance-achievements", "合作成果批量导入模板.xlsx"),
        Map.entry("alliance-agreements", "合作协议批量导入模板.xlsx"),
        Map.entry("alliance-permissions", "合作权限批量导入模板.xlsx"),
        Map.entry("alliance-brands", "品牌内容批量导入模板.xlsx"),
        Map.entry("affairs-config", "教务配置批量导入模板.xlsx"),
        Map.entry("program-courses", "方案课程批量导入模板.xlsx"));

    private static final Map<String, String> EXPORT_FILENAMES = Map.of(
        "positions", "岗位导出.xlsx", "scenarios", "场景导出.xlsx", "courses", "体系课导出.xlsx",
        "granular-courses", "颗粒课导出.xlsx", "question-banks", "题库导出.xlsx",
        "questions", "题目导出.xlsx", "exams", "试卷导出.xlsx",
        "organizations", "组织架构导出.xlsx", "students", "学生导出.xlsx", "teachers", "教师导出.xlsx");

    private final ImportExportMapper mapper;
    private final ScenarioImportMapper scenarioImportMapper;
    private final QuestionImportMapper questionImportMapper;
    private final JobPositionImportMapper positionImportMapper;
    private final AffairsScheduleImportMapper scheduleImportMapper;
    private final LessonGranularCourseImportMapper granularImportMapper;
    private final LessonCourseImportMapper courseImportMapper;
    private final TrainingProgramCourseMapper programCourseMapper;
    private final TermMapper termMapper;
    private final VenueMapper venueMapper;
    private final PeriodSlotMapper periodSlotMapper;
    private final AllianceBrandMapper brandMapper;
    private final AllianceExpertMapper expertMapper;

    // ==================== 模板 ====================

    @Override
    public byte[] buildTemplate(String entity, String bankId, String brandType) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        try (Workbook wb = new XSSFWorkbook()) {
            Styles styles = new Styles(wb);
            switch (entity) {
                case "positions" -> positionTemplate(wb, styles, tenantId);
                case "scenarios" -> scenarioTemplate(wb, styles, tenantId);
                case "courses" -> systemCourseTemplate(wb, styles, tenantId);
                case "granular-courses" -> granularCourseTemplate(wb, styles, tenantId);
                case "question-banks" -> questionBankTemplate(wb, styles, tenantId);
                case "questions" -> questionTemplate(wb, styles, tenantId, bankId);
                case "exams" -> examTemplate(wb, styles, tenantId);
                case "industries" -> industryTemplate(wb, styles);
                case "majors" -> majorTemplate(wb, styles);
                case "organizations" -> organizationTemplate(wb, styles, tenantId);
                case "students" -> studentTemplate(wb, styles, tenantId);
                case "teachers" -> teacherTemplate(wb, styles, tenantId);
                case "alliance-projects" -> projectTemplate(wb, styles);
                case "alliance-achievements" -> achievementTemplate(wb, styles);
                case "alliance-agreements" -> agreementTemplate(wb, styles);
                case "alliance-permissions" -> permissionTemplate(wb, styles);
                case "alliance-brands" -> brandTemplate(wb, styles, tenantId, brandType);
                case "affairs-config" -> affairsConfigTemplate(wb, styles);
                case "program-courses" -> programCourseTemplate(wb, styles);
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            }
            return toBytes(wb);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "生成模板失败");
        }
    }

    private void positionTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("岗位基本信息");
        writeNote(s1, "填写说明：\n* 必填列。薪资单位为元。\n岗位类型：固定为教学岗位，无需填写\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n所需证书：从「系统证书库」Sheet 选取，匹配则关联，不匹配则自动新建并关联\n任职要求：多条可用换行（Alt+Enter）分隔\n导入后默认状态为 draft", 12, st);
        writeHeaders(s1, new String[]{"岗位名称 *", "岗位简称", "岗位类型", "面向行业", "适用专业", "薪资下限", "薪资上限", "岗位背景介绍", "任职要求", "发展路径", "所需证书", "所属批次"},
            new int[]{22, 14, 16, 20, 26, 12, 12, 42, 42, 30, 28, 18}, st);
        Sheet s2 = wb.createSheet("工作职责与能力点");
        writeNote(s2, "填写说明：\n一个岗位 = 多行，相同「职责名称」的行属于同一工作职责\n能力属性：知识 / 技能 / 素质\n胜任力等级：了解 / 理解 / 掌握 / 熟练 / 精通\n岗位名称须与「岗位基本信息」Sheet 中一致，自动匹配", 7, st);
        writeHeaders(s2, new String[]{"岗位名称 *", "职责名称 *", "能力点名称", "能力属性", "能力领域", "胜任力等级", "胜任标准描述"},
            new int[]{22, 28, 28, 14, 18, 14, 44}, st);
        addRefSheet(wb, st, "【参考】行业字典", new String[]{"行业名称", "行业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listIndustries(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        wb.setActiveSheet(0);
    }

    private void scenarioTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("场景基本信息");
        writeNote(s1, "填写说明：\n* 必填列。编码由系统自动生成（格式: SC-YYYY-NNNN），无需填写\n目标岗位：从「岗位字典」Sheet 选取，匹配则关联，不匹配则忽略\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔\n难度等级：1-5，1 最易，5 最难\n导入后默认状态为 draft", 7, st);
        writeHeaders(s1, new String[]{"场景名称 *", "目标岗位", "面向行业", "适用专业", "难度等级", "场景介绍", "所属批次"},
            new int[]{24, 22, 20, 26, 10, 48, 18}, st);
        Sheet s2 = wb.createSheet("任务配置");
        writeNote(s2, "填写说明：\n每个任务一行，相同场景下可有多行任务。\n任务名称：必填。编码由系统自动生成\n任务类型：考核 / 训练\n难度：1-5\n考查知识点/能力点/任务资源：多个逗号分隔\n测评方式：题库 / 试卷 / 随堂测 / 现场问答 / 现场评审 / 成果评价 / 作业", 11, st);
        writeHeaders(s2, new String[]{"场景名称 *", "任务名称 *", "任务类型", "难度", "预估学时(h)", "背景介绍", "详细说明", "考查知识点", "考查能力点", "任务资源", "测评方式"},
            new int[]{22, 24, 12, 8, 12, 34, 34, 28, 28, 28, 28}, st);
        addRefSheet(wb, st, "【参考】岗位字典", new String[]{"岗位名称"}, new int[]{30},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listPublishedPositionNames(tenantId)));
        addRefSheet(wb, st, "【参考】行业字典", new String[]{"行业名称", "行业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listIndustries(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】能力点库", new String[]{"能力点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listAbilityPointNames(tenantId)));
        addRefSheet(wb, st, "【参考】任务资源库", new String[]{"资源名称"}, new int[]{42},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listResourceNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void systemCourseTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("课程基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n所属批次：从「批次字典」Sheet 选取，匹配则关联，不匹配则忽略\n关联能力点：从「能力点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n导入后默认状态为 draft", 5, st);
        writeHeaders(s1, new String[]{"课程名称 *", "适用专业", "课程简介", "所属批次", "关联能力点"},
            new int[]{28, 24, 48, 20, 30}, st);
        Sheet s2 = wb.createSheet("节点配置");
        writeNote(s2, "填写说明：\n每个节点一行，相同课程下可有多行节点。\n课程名称：须与「课程基本信息」Sheet 中一致\n节点名称：必填\n父节点名称：本课程下已出现的节点名称，为空表示一级节点\n节点类型：手动编辑（默认）/ 颗粒课\n排序：数字，越小越靠前\n测评方式：题库 / 试卷 / 随堂测 / 作业", 11, st);
        writeHeaders(s2, new String[]{"课程名称 *", "节点名称 *", "父节点名称", "节点类型", "排序", "学习目标", "预计课时", "难度", "关联知识点", "课程资源", "测评方式"},
            new int[]{22, 24, 18, 12, 8, 34, 12, 8, 28, 28, 28}, st);
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】批次字典", new String[]{"批次名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】能力点库", new String[]{"能力点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listAbilityPointNames(tenantId)));
        addRefSheet(wb, st, "【参考】测评方式", new String[]{"测评方式"}, new int[]{24},
            "仅作参考，无需编辑修改。", List.of(new String[]{"题库"}, new String[]{"试卷"}, new String[]{"随堂测"}, new String[]{"作业"}));
        wb.setActiveSheet(0);
    }

    private void granularCourseTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("课程基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n难度：1-5\n预计课时：数字，单位小时\n关联知识点：多个逗号分隔，不匹配则自动新建并关联\n课程资源：多个逗号分隔\n导入后默认状态为 draft", 8, st);
        writeHeaders(s1, new String[]{"课程名称 *", "适用专业", "难度", "预计课时", "学习目标", "关联知识点", "课程资源", "所属批次"},
            new int[]{28, 24, 10, 12, 48, 28, 28, 20}, st);
        addRefSheet(wb, st, "【参考】专业字典", new String[]{"专业名称", "专业编码"}, new int[]{32, 18},
            "仅作参考，无需编辑修改。", mapToStrings(mapper.listMajors(tenantId, null), "code", "name"));
        addRefSheet(wb, st, "【参考】批次字典", new String[]{"批次名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        addRefSheet(wb, st, "【参考】知识点库", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        addRefSheet(wb, st, "【参考】任务资源库", new String[]{"资源名称"}, new int[]{42},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listResourceNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void questionBankTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("题库基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft", 3, st);
        writeHeaders(s1, new String[]{"题库名称 *", "题库简介", "所属批次"}, new int[]{28, 42, 22}, st);
        addRefSheet(wb, st, "【参考】批次", new String[]{"批次名称"}, new int[]{32},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void questionTemplate(Workbook wb, Styles st, String tenantId, String bankId) {
        if (bankId == null || bankId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        Sheet s1 = wb.createSheet("题目明细");
        writeNote(s1, "填写说明：\n* 必填列。\n题型：单选题 / 多选题 / 判断题 / 填空题 / 问答题 / 简答题\n判断题：正确答案填 正确/错误 或 true/false\n难度：简单 / 中等 / 困难\n知识点：多个用逗号分隔，不存在则自动新建\n导入后默认状态为 draft", 12, st);
        writeHeaders(s1, new String[]{"题型 *", "题目内容 *", "选项A", "选项B", "选项C", "选项D", "正确答案 *", "答案解析", "难度", "知识点", "分数", "来源"},
            new int[]{12, 48, 24, 24, 24, 24, 28, 36, 10, 28, 10, 20}, st);
        addRefSheet(wb, st, "【参考】知识点", new String[]{"知识点名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listKnowledgePointNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void examTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("试卷基本信息");
        writeNote(s1, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft", 3, st);
        writeHeaders(s1, new String[]{"试卷名称 *", "试卷简介", "所属批次"}, new int[]{28, 42, 22}, st);
        Sheet s2 = wb.createSheet("试卷题目");
        writeNote(s2, "填写说明：\n本表可选。\n试卷名称须与「试卷基本信息」Sheet 中一致。\n题目内容须与当前租户下已存在的题目内容一致，系统会按内容匹配并加入试卷。", 3, st);
        writeHeaders(s2, new String[]{"试卷名称 *", "题目内容 *", "分数 *"}, new int[]{28, 48, 12}, st);
        addRefSheet(wb, st, "【参考】批次", new String[]{"批次名称"}, new int[]{32},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listBatchNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void industryTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("行业列表");
        writeNote(s1, "填写说明：\n* 必填列。\n行业代码：租户内唯一，已存在则更新。\n上级行业代码：填写本 Sheet 中已有的行业代码；为空表示顶级行业。\n排序：数字，越小越靠前，默认为 0。\n是否启用：true/是/启用 表示启用，默认启用。", 5, st);
        writeHeaders(s1, new String[]{"行业代码 *", "行业名称 *", "上级行业代码", "排序", "是否启用"}, new int[]{18, 28, 18, 10, 12}, st);
        wb.setActiveSheet(0);
    }

    private void majorTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("专业列表");
        writeNote(s1, "填写说明：\n* 必填列。\n专业代码：租户内唯一，已存在则更新。\n别名：可选简称。\n是否启用：true/是/启用 表示启用，默认启用。", 4, st);
        writeHeaders(s1, new String[]{"专业代码 *", "专业名称 *", "别名", "是否启用"}, new int[]{18, 30, 24, 12}, st);
        wb.setActiveSheet(0);
    }

    private void organizationTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("组织架构");
        writeNote(s1, "填写说明：\n* 必填列。\n组织类型：须与「组织类型参考」Sheet 中的类型名称完全一致。\n父组织名称：本 Sheet 中已有的组织名称；为空表示一级节点。\n排序：数字，越小越靠前，默认为 0。", 4, st);
        writeHeaders(s1, new String[]{"组织名称 *", "组织类型 *", "父组织名称", "排序"}, new int[]{30, 20, 30, 10}, st);
        addRefSheet(wb, st, "【参考】组织类型", new String[]{"组织类型名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listOrgTypeNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void studentTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("学生列表");
        writeNote(s1, "填写说明：\n* 必填列。\n登录账号(学号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n班级(组织节点路径)：支持多级路径，如 学校-学院-班级。\n状态：正常 / 禁用 / 毕业，默认为正常。", 5, st);
        writeHeaders(s1, new String[]{"登录账号(学号) *", "姓名 *", "密码 *", "班级(组织节点路径) *", "状态"}, new int[]{24, 16, 20, 42, 12}, st);
        wb.setActiveSheet(0);
    }

    private void teacherTemplate(Workbook wb, Styles st, String tenantId) {
        Sheet s1 = wb.createSheet("教师列表");
        writeNote(s1, "填写说明：\n* 必填列。\n登录账号(工号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n所属组织节点(路径)：支持多级路径。\n职位：多个职位用逗号分隔。\n状态：正常 / 禁用，默认为正常。", 6, st);
        writeHeaders(s1, new String[]{"登录账号(工号) *", "姓名 *", "密码 *", "所属组织节点(路径)", "职位(逗号分隔)", "状态"}, new int[]{24, 16, 20, 42, 28, 12}, st);
        addRefSheet(wb, st, "【参考】职位", new String[]{"职位名称"}, new int[]{36},
            "仅作参考，无需编辑修改。", namesToStrings(mapper.listStaffTitleNames(tenantId)));
        wb.setActiveSheet(0);
    }

    private void projectTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作项目");
        writeNote(s1, "填写说明：\n* 必填列。\n合作类型：文本，选填（如：联合研发 / 产教融合）\n项目阶段：启动 / 执行中 / 验收 / 关闭（或 initiation / execution / acceptance / closure），默认为 启动\n预算：文本，选填\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n合作企业：企业名称，多值用中文分号「；」分隔\n二级学院：学院名称，多值用中文分号「；」分隔\n公开显示：是 / 否（或 true / false），默认为 否", 10, st);
        writeHeaders(s1, new String[]{"项目名称 *", "合作类型", "项目阶段", "预算", "开始日期", "结束日期", "项目描述", "合作企业", "二级学院", "公开显示"},
            new int[]{28, 20, 22, 20, 16, 16, 48, 40, 30, 14}, st);
        wb.setActiveSheet(0);
    }

    private void achievementTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作成果");
        writeNote(s1, "填写说明：\n* 必填列。\n成果类型：岗位成果 / 场景成果 / 课程成果 / 自定义成果（或 job / scene / course / custom），默认为 自定义成果\n成果日期：格式 YYYY-MM-DD，选填\n归属项目/合作企业/二级学院：多值用中文分号「；」分隔\n公开显示：是 / 否，默认为 否", 8, st);
        writeHeaders(s1, new String[]{"成果名称 *", "成果类型", "成果日期", "成果描述", "归属项目", "合作企业", "二级学院", "公开显示"},
            new int[]{28, 22, 16, 48, 40, 40, 30, 14}, st);
        wb.setActiveSheet(0);
    }

    private void agreementTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作协议");
        writeNote(s1, "填写说明：\n* 必填列。\n协议类型：文本，选填（如：实验室共建 / 实训基地）\n协议状态：草稿 / 生效中 / 已失效 / 已续签 / 已终止（或 draft / active / expired / renewed / terminated），默认为 草稿\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n合作企业/关联项目：多值用中文分号「；」分隔", 8, st);
        writeHeaders(s1, new String[]{"协议名称 *", "协议类型", "协议状态", "开始日期", "结束日期", "内容", "合作企业", "关联项目"},
            new int[]{28, 22, 20, 16, 16, 48, 40, 40}, st);
        wb.setActiveSheet(0);
    }

    private void permissionTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("合作权限");
        writeNote(s1, "填写说明：\n* 必填列。\n账号类型：企业账号 / 专家账号（或 enterprise / expert），默认为 企业账号\n是否启用：是 / 否（或 true / false），默认为 是（启用）", 3, st);
        writeHeaders(s1, new String[]{"账号名称 *", "账号类型", "是否启用"}, new int[]{28, 22, 14}, st);
        wb.setActiveSheet(0);
    }

    private void brandTemplate(Workbook wb, Styles st, String tenantId, String brandType) {
        String bt = brandType == null ? "" : brandType.trim();
        switch (bt) {
            case "talent" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n状态：草稿 / 已发布 / 已归档（或 draft / published / archived），默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 8, st);
                writeHeaders(s, new String[]{"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
                    new int[]{28, 48, 18, 14, 14, 36, 24, 24}, st);
            }
            case "employer" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n企业类型：合作企业 / 独立雇主企业（或 enterprise / independent）\n是否公开 / 是否推荐：是 / 否，默认 否", 21, st);
                writeHeaders(s, new String[]{"企业类型 *", "企业名称 *", "是否公开", "是否推荐", "统一社会信用代码", "所属行业", "所在地区", "成立年份", "企业规模（人数）", "关联二级学院", "企业简介", "联系人", "联系电话", "联系邮箱", "详细地址", "企业Logo URL", "企业主页封面 URL", "企业风采照片URL", "企业营业执照URL", "企业知识产权URL", "企业荣誉资质URL"},
                    new int[]{18, 30, 14, 14, 26, 20, 16, 14, 16, 28, 48, 16, 18, 24, 28, 32, 32, 32, 32, 32, 32}, st);
            }
            case "job" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n岗位类型：教学岗位 / 企业岗位（或 teaching / enterprise）\n薪资下限 / 上限：数字（单位 K）", 12, st);
                writeHeaders(s, new String[]{"岗位类型 *", "岗位名称 *", "是否公开", "是否推荐", "薪资下限(K)", "薪资上限(K)", "面向专业", "所属行业", "岗位简介", "任职要求", "职业发展路径", "岗位职责"},
                    new int[]{18, 30, 14, 14, 16, 16, 30, 20, 48, 36, 36, 48}, st);
            }
            case "major" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n专业名称 / 专业代码：已预填系统全部专业，请勿修改或新增。\n是否公开 / 是否推荐：是 / 否，默认 否", 10, st);
                writeHeaders(s, new String[]{"专业名称", "专业代码", "是否公开", "是否推荐", "品牌介绍", "封面图URL", "关联岗位品牌名称", "关联合作企业名称", "关联合作成果名称", "关联特色课程名称"},
                    new int[]{28, 18, 14, 14, 48, 36, 32, 36, 36, 32}, st);
                // 预填系统全部专业
                List<Map<String, Object>> majors = mapper.listMajors(tenantId, null);
                for (int i = 0; i < majors.size(); i++) {
                    Row r = s.createRow(2 + i);
                    r.createCell(0).setCellValue(str(majors.get(i).get("name")));
                    r.createCell(1).setCellValue(str(majors.get(i).get("code")));
                }
            }
            case "teacher" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n师资类型：校本师资 / 企业专家（或 school / expert）\n性别：男 / 女\n是否公开 / 是否推荐：是 / 否，默认 否", 17, st);
                writeHeaders(s, new String[]{"师资类型 *", "关联教师名称", "关联专家名称", "是否公开", "是否推荐", "性别", "年龄", "所在城市", "职称", "职务", "从业年限", "学历", "所属行业", "擅长领域", "个人简介", "工作经历", "头像URL"},
                    new int[]{18, 24, 24, 14, 14, 12, 12, 16, 20, 20, 14, 18, 20, 32, 48, 48, 32}, st);
            }
            case "culture" -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n状态：草稿 / 已发布 / 已归档，默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 7, st);
                writeHeaders(s, new String[]{"名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联专业名称"},
                    new int[]{28, 48, 18, 14, 14, 36, 24}, st);
            }
            default -> {
                Sheet s = wb.createSheet("品牌内容");
                writeNote(s, "填写说明：\n* 必填列。\n品牌类型：人才品牌 / 雇主品牌 / 岗位品牌 / 专业品牌 / 师资品牌 / 文化品牌（或 talent / employer / job / major / teacher / culture）\n状态：草稿 / 已发布 / 已归档，默认为 草稿\n是否公开 / 是否推荐：是 / 否，默认 否", 13, st);
                writeHeaders(s, new String[]{"品牌类型 *", "名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联企业名称", "关联岗位名称", "关联专业名称", "关联教师名称", "关联专家名称"},
                    new int[]{22, 30, 48, 18, 14, 14, 36, 24, 32, 28, 24, 24, 24}, st);
            }
        }
        wb.setActiveSheet(0);
    }

    private void affairsConfigTemplate(Workbook wb, Styles st) {
        Sheet s1 = wb.createSheet("学期");
        writeNote(s1, "填写说明：\n名称：如 2025-2026-1\n开始/结束日期：YYYY-MM-DD\n周数：整数，默认 16", 4, st);
        writeHeaders(s1, new String[]{"名称 *", "开始日期 *", "结束日期 *", "周数"}, new int[]{18, 14, 14, 8}, st);
        Sheet s2 = wb.createSheet("场地");
        writeNote(s2, "填写说明：\n类型：教室/机房/实训室/实验室/校外基地\n容量：整数，选填", 3, st);
        writeHeaders(s2, new String[]{"名称 *", "类型 *", "容量"}, new int[]{20, 14, 8}, st);
        Sheet s3 = wb.createSheet("节次");
        writeNote(s3, "填写说明：\n名称：如 上午1-2\n时间：HH:MM 格式\n排序：整数\n时段类型：早自习/上午/下午/晚自习，选填", 5, st);
        writeHeaders(s3, new String[]{"名称 *", "开始时间", "结束时间", "排序", "时段类型"}, new int[]{16, 10, 10, 8, 10}, st);
        wb.setActiveSheet(0);
    }

    private void programCourseTemplate(Workbook wb, Styles st) {
        Sheet s = wb.createSheet("导入");
        writeNote(s, "填写说明：\n* 二选一必填列。\n关联岗位名称：填写已发布岗位名称。\n关联体系课名称：填写已发布体系课名称。\n学分：数字，如 3.5。\n总学时：整数。\n性质：默认为「必修」，可选：必修、选修、实践。", 5, st);
        writeHeaders(s, new String[]{"关联岗位名称（二选一）", "关联体系课名称（二选一）", "学分", "总学时", "性质"}, new int[]{24, 24, 10, 10, 12}, st);
        wb.setActiveSheet(0);
    }

    // ==================== 导出 ====================

    @Override
    public byte[] exportExcel(String entity, List<String> ids, String bankId) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        if (!EXPORT_FILENAMES.containsKey(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        // organizations/students/teachers 允许空 ids（导出全部）；其余要求非空
        boolean allowEmpty = Set.of("organizations", "students", "teachers").contains(entity);
        if (!allowEmpty && (ids == null || ids.isEmpty())) {
            String missing = switch (entity) {
                case "positions" -> "缺少岗位ID";
                case "scenarios" -> "缺少场景方案ID";
                case "courses", "granular-courses" -> "缺少课程ID";
                case "question-banks" -> "缺少题库ID";
                case "questions" -> "缺少题目ID";
                case "exams" -> "缺少试卷ID";
                default -> "缺少ID";
            };
            throw new ApiException(400, "bad_request", missing);
        }
        try (Workbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);
            String filename = EXPORT_FILENAMES.get(entity);
            switch (entity) {
                case "positions" -> {
                    positionTemplate(wb, st, tenantId);
                    fillPositions(wb, tenantId, ids);
                }
                case "scenarios" -> {
                    scenarioTemplate(wb, st, tenantId);
                    fillScenarios(wb, tenantId, ids);
                }
                case "courses" -> {
                    systemCourseTemplate(wb, st, tenantId);
                    fillSystemCourses(wb, tenantId, ids);
                }
                case "granular-courses" -> {
                    granularCourseTemplate(wb, st, tenantId);
                    fillGranularCourses(wb, tenantId, ids);
                }
                case "question-banks" -> {
                    questionBankTemplate(wb, st, tenantId);
                    fillQuestionBanks(wb, tenantId, ids);
                }
                case "questions" -> {
                    questionTemplate(wb, st, tenantId, bankId);
                    fillQuestions(wb, tenantId, bankId, ids);
                }
                case "exams" -> {
                    examTemplate(wb, st, tenantId);
                    fillExams(wb, tenantId, ids);
                }
                case "organizations" -> {
                    organizationTemplate(wb, st, tenantId);
                    fillOrganizations(wb, tenantId, ids);
                }
                case "students" -> { // 导出前必须先建 sheet（模板方法），否则 getSheet 返回 null → NPE 500
                    studentTemplate(wb, st, tenantId);
                    fillUsers(wb, tenantId, entity, ids);
                }
                case "teachers" -> {
                    teacherTemplate(wb, st, tenantId);
                    fillUsers(wb, tenantId, entity, ids);
                }
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            }
            return toBytes(wb);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "导出失败");
        }
    }

    private void fillPositions(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("岗位基本信息");
        int r = 2;
        Map<String, String> nameById = new LinkedHashMap<>();
        for (Map<String, Object> m : mapper.listPositionsForExport(tenantId, ids)) {
            String id = str(m.get("id"));
            String name = str(m.get("name"));
            nameById.putIfAbsent(id, name);
            String industryName = "";
            String industryId = str(m.get("industry_id"));
            if (!industryId.isEmpty()) {
                String n = mapper.selectIndustryNameById(tenantId, industryId);
                industryName = n == null ? "" : n;
            }
            String majorNames = String.join(",", mapper.listPositionMajorNames(tenantId, id));
            String certNames = String.join(",", mapper.listPositionCertNames(tenantId, id));
            String batchName = "";
            String batchId = str(m.get("batch_id"));
            if (!batchId.isEmpty()) {
                String n = mapper.selectBatchNameById(tenantId, batchId);
                batchName = n == null ? "" : n;
            }
            String requirements = String.join("\n", parsePgArrayText(str(m.get("requirements"))));
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(name);
            row.createCell(1).setCellValue(str(m.get("short_name")));
            row.createCell(2).setCellValue(mapPositionTypeToChinese(str(m.get("position_type"))));
            row.createCell(3).setCellValue(industryName);
            row.createCell(4).setCellValue(majorNames);
            row.createCell(5).setCellValue(str(m.get("salary_min")));
            row.createCell(6).setCellValue(str(m.get("salary_max")));
            row.createCell(7).setCellValue(str(m.get("description")));
            row.createCell(8).setCellValue(requirements);
            row.createCell(9).setCellValue(str(m.get("career_path")));
            row.createCell(10).setCellValue(certNames);
            row.createCell(11).setCellValue(batchName);
            r++;
        }
        // 第二 Sheet：工作职责与能力点
        Sheet b = wb.getSheet("工作职责与能力点");
        int br = 2;
        for (String pid : ids) {
            String positionName = nameById.get(pid);
            if (positionName == null) {
                positionName = "";
            }
            for (Map<String, Object> bind : mapper.listPositionAbilityBindings(tenantId, pid)) {
                String bindingAttrs = String.join(",", parsePgArrayText(str(bind.get("binding_attributes"))));
                String abilityAttrs = String.join(",", parsePgArrayText(str(bind.get("ability_attributes"))));
                String attrStr = bindingAttrs.isEmpty() ? abilityAttrs : bindingAttrs;
                Row row = b.createRow(br);
                row.createCell(0).setCellValue(positionName);
                row.createCell(1).setCellValue(str(bind.get("responsibility_name")));
                row.createCell(2).setCellValue(str(bind.get("ability_name")));
                row.createCell(3).setCellValue(attrStr);
                row.createCell(4).setCellValue(str(bind.get("domain")));
                row.createCell(5).setCellValue(mapRequiredLevelToChinese(str(bind.get("required_level"))));
                row.createCell(6).setCellValue(str(bind.get("rubric_description")));
                br++;
            }
        }
    }

    private String mapPositionTypeToChinese(String t) {
        return switch (t) {
            case "enterprise" -> "企业岗位";
            case "teaching" -> "教学岗位";
            default -> "其他";
        };
    }

    private String mapRequiredLevelToChinese(String l) {
        return switch (l.trim().toLowerCase()) {
            case "understand", "了解", "l1" -> "了解";
            case "comprehend", "理解", "l2" -> "理解";
            case "master", "掌握", "l3" -> "掌握";
            case "proficient", "熟练" -> "熟练";
            case "expert", "精通" -> "精通";
            default -> l;
        };
    }

    private void fillScenarios(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("场景基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listScenariosForExport(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(4).setCellValue(str(m.get("difficulty")));
            row.createCell(5).setCellValue(str(m.get("background")));
            r++;
        }
    }

    private void fillSystemCourses(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("课程基本信息");
        int r = 2;
        Map<String, String> nameById = new LinkedHashMap<>();
        for (Map<String, Object> m : mapper.listSystemCoursesForExport(tenantId, ids)) {
            String id = str(m.get("id"));
            String name = str(m.get("name"));
            nameById.putIfAbsent(id, name);
            String majorName = "";
            String majorId = str(m.get("major_id"));
            if (!majorId.isEmpty()) {
                String n = mapper.selectMajorNameById(tenantId, majorId);
                majorName = n == null ? "" : n;
            }
            String batchName = "";
            String batchId = str(m.get("batch_id"));
            if (!batchId.isEmpty()) {
                String n = mapper.selectLessonBatchNameById(tenantId, batchId);
                batchName = n == null ? "" : n;
            }
            String abilityPointNames = courseImportMapper.selectCourseAbilityPointNames(id);
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(name);
            row.createCell(1).setCellValue(majorName);
            row.createCell(2).setCellValue(str(m.get("description")));
            row.createCell(3).setCellValue(batchName);
            row.createCell(4).setCellValue(abilityPointNames == null ? "" : abilityPointNames);
            r++;
        }
        // 第二 Sheet：节点配置
        Sheet b = wb.getSheet("节点配置");
        int br = 2;
        for (String cid : ids) {
            String courseName = nameById.get(cid);
            if (courseName == null) {
                continue;
            }
            List<Map<String, Object>> nodes = courseImportMapper.listCourseNodes(tenantId, cid);
            Map<String, String> nodeNameById = new LinkedHashMap<>();
            for (Map<String, Object> n : nodes) {
                nodeNameById.put(str(n.get("id")), str(n.get("name")));
            }
            for (Map<String, Object> n : nodes) {
                String parentName = "";
                String parentId = str(n.get("parent_id"));
                if (!parentId.isEmpty()) {
                    parentName = nodeNameById.getOrDefault(parentId, "");
                }
                String refTypeName = "original".equals(str(n.get("ref_type"))) ? "颗粒课" : "";
                String knowledgeNames = String.join(",", courseImportMapper.listNodeKnowledgePointNames(str(n.get("id"))));
                String resourceNames = String.join(",", courseImportMapper.listNodeResourceNames(str(n.get("id"))));
                List<String> evalChinese = new ArrayList<>();
                for (String mk : courseImportMapper.listNodeEvalMethods(tenantId, str(n.get("id")))) {
                    String ch = mapCourseEvalMethodToChinese(mk);
                    if (!ch.isEmpty()) {
                        evalChinese.add(ch);
                    }
                }
                Row row = b.createRow(br);
                row.createCell(0).setCellValue(courseName);
                row.createCell(1).setCellValue(str(n.get("name")));
                row.createCell(2).setCellValue(parentName);
                row.createCell(3).setCellValue(refTypeName);
                row.createCell(4).setCellValue(str(n.get("sort_order")));
                row.createCell(5).setCellValue(str(n.get("teaching_goals")));
                row.createCell(6).setCellValue(str(n.get("duration")));
                row.createCell(7).setCellValue(str(n.get("difficulty")));
                row.createCell(8).setCellValue(knowledgeNames);
                row.createCell(9).setCellValue(resourceNames);
                row.createCell(10).setCellValue(String.join(",", evalChinese));
                br++;
            }
        }
    }

    private String mapCourseEvalMethodToChinese(String mk) {
        return switch (mk) {
            case "question_bank" -> "题库";
            case "paper" -> "试卷";
            case "quiz" -> "随堂测";
            default -> "";
        };
    }

    private void fillGranularCourses(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("课程基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listGranularCoursesForExport(tenantId, ids)) {
            String id = str(m.get("id"));
            String majorName = "";
            String majorId = str(m.get("major_id"));
            if (!majorId.isEmpty()) {
                String n = mapper.selectMajorNameById(tenantId, majorId);
                majorName = n == null ? "" : n;
            }
            String batchName = "";
            String batchId = str(m.get("batch_id"));
            if (!batchId.isEmpty()) {
                String n = mapper.selectLessonBatchNameById(tenantId, batchId);
                batchName = n == null ? "" : n;
            }
            String diffStr = "";
            Object diff = m.get("difficulty");
            if (diff != null && !"0".equals(String.valueOf(diff))) {
                diffStr = String.valueOf(diff);
            }
            String durationStr = "";
            Object dur = m.get("online_hours");
            if (dur != null && !"0".equals(String.valueOf(dur)) && !"0.0".equals(String.valueOf(dur))) {
                durationStr = String.valueOf(dur);
            }
            String knowledgeNames = String.join(",", granularImportMapper.listCourseKnowledgePointNamesForExport(id, tenantId));
            String resourceNames = String.join(",", granularImportMapper.listCourseResourceNamesForExport(id, tenantId));
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(majorName);
            row.createCell(2).setCellValue(diffStr);
            row.createCell(3).setCellValue(durationStr);
            row.createCell(4).setCellValue(str(m.get("description")));
            row.createCell(5).setCellValue(knowledgeNames);
            row.createCell(6).setCellValue(resourceNames);
            row.createCell(7).setCellValue(batchName);
            r++;
        }
    }

    private void fillQuestionBanks(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("题库基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listQuestionBanks(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillQuestions(Workbook wb, String tenantId, String bankId, List<String> ids) {
        if (bankId == null || bankId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        Sheet s = wb.getSheet("题目明细");
        int r = 2;
        for (Map<String, Object> m : mapper.listQuestionsForExport(tenantId, bankId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("type")));
            row.createCell(1).setCellValue(str(m.get("content")));
            row.createCell(10).setCellValue(str(m.get("score")));
            r++;
        }
    }

    private void fillExams(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("试卷基本信息");
        int r = 2;
        for (Map<String, Object> m : mapper.listExams(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("description")));
            r++;
        }
    }

    private void fillOrganizations(Workbook wb, String tenantId, List<String> ids) {
        Sheet s = wb.getSheet("组织架构");
        int r = 2;
        for (Map<String, Object> m : mapper.listOrganizations(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("name")));
            row.createCell(1).setCellValue(str(m.get("type_name")));
            row.createCell(2).setCellValue(str(m.get("parent_name")));
            r++;
        }
    }

    private void fillUsers(Workbook wb, String tenantId, String entity, List<String> ids) {
        String sheetName = "students".equals(entity) ? "学生列表" : "教师列表";
        Sheet s = wb.getSheet(sheetName);
        int r = 2;
        for (Map<String, Object> m : mapper.listUsers(tenantId, ids)) {
            Row row = s.createRow(r);
            row.createCell(0).setCellValue(str(m.get("login_name")));
            row.createCell(1).setCellValue(str(m.get("name")));
            row.createCell(4).setCellValue(str(m.get("status")));
            r++;
        }
    }

    @Override
    public byte[] exportGeneric(String entity) {
        requireTenant();
        String tenantId = TenantContext.getTenantId();
        if (!GENERIC_CSV_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        String[] header = GENERIC_DEFAULT_COLS.get(entity);
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", header)).append("\n");
        for (Map<String, Object> row : mapper.listGenericExportRows(entity, tenantId)) {
            List<String> cells = new ArrayList<>();
            for (String col : header) {
                cells.add(csvCell(str(row.get(col))));
            }
            sb.append(String.join(",", cells)).append("\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ==================== 导入 ====================

    @Override
    public Map<String, Object> importExcel(String entity, MultipartFile file, boolean preview, boolean overwrite,
                                           boolean rename, String bankId, String brandType, String termId,
                                           String programId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (!EXCEL_IMPORT_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        if (preview && !PREVIEW_ENTITIES.contains(entity)) {
            throw new ApiException(404, "not_found", "不支持的实体");
        }
        try (InputStream in = file.getInputStream(); Workbook wb = new XSSFWorkbook(in)) {
            return switch (entity) {
                case "industries" -> importIndustries(wb, tenantId, preview, overwrite, rename);
                case "majors" -> importMajors(wb, tenantId, preview, overwrite, rename);
                case "organizations" -> importOrganizations(wb, tenantId, preview, overwrite, rename);
                case "students" -> importStudents(wb, tenantId, preview);
                case "teachers" -> importTeachers(wb, tenantId, preview);
                case "alliance-projects" -> importProjects(wb, tenantId, userId, preview);
                case "alliance-achievements" -> importAchievements(wb, tenantId, userId, preview);
                case "alliance-agreements" -> importAgreements(wb, tenantId, userId, preview);
                case "alliance-permissions" -> importPermissions(wb, tenantId, preview);
                case "alliance-brands" -> importBrands(wb, tenantId, userId, preview, overwrite, rename, brandType);
                case "positions" -> importPositions(wb, tenantId, userId, preview, overwrite, rename);
                case "scenarios" -> importScenarios(wb, tenantId, userId, preview, overwrite, rename);
                case "courses" -> importCourses(wb, tenantId, userId, preview, overwrite, rename);
                case "granular-courses" -> importGranularCourses(wb, tenantId, userId, preview, overwrite, rename);
                case "question-banks" -> importQuestionBanks(wb, tenantId, userId, preview, overwrite, rename);
                case "questions" -> importQuestions(wb, tenantId, userId, bankId, preview, overwrite, rename);
                case "exams" -> importExams(wb, tenantId, userId, preview, overwrite, rename);
                case "schedules" -> importSchedules(wb, tenantId, termId, preview);
                case "affairs-config" -> affairsConfigImport(wb, tenantId, preview);
                case "program-courses" -> importProgramCourses(wb, tenantId, programId, preview);
                default -> throw new ApiException(400, "bad_request", "不支持的实体");
            };
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "解析Excel文件失败");
        }
    }

    @Override
    public Map<String, Object> importGeneric(String entity, MultipartFile file, boolean overwrite, boolean rename) {
        return importGenericInternal(entity, file, false, overwrite, rename);
    }

    @Override
    public Map<String, Object> preview(String entity, MultipartFile file, boolean overwrite, boolean rename,
                                       String bankId, String brandType, String termId, String programId) {
        if (EXCEL_IMPORT_ENTITIES.contains(entity)) {
            return importExcel(entity, file, true, overwrite, rename, bankId, brandType, termId, programId);
        }
        if (GENERIC_CSV_ENTITIES.contains(entity)) {
            return importGenericInternal(entity, file, true, overwrite, rename);
        }
        throw new ApiException(400, "bad_request", "不支持的实体");
    }

    private Map<String, Object> importGenericInternal(String entity, MultipartFile file, boolean preview,
                                                      boolean overwrite, boolean rename) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (!GENERIC_CSV_ENTITIES.contains(entity)) {
            throw new ApiException(400, "bad_request", "不支持的实体");
        }
        String keyCol = GENERIC_KEY_COLS.get(entity);
        List<String> lines;
        try {
            lines = new String(file.getBytes(), StandardCharsets.UTF_8).lines()
                .filter(l -> !l.isBlank()).toList();
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "解析导入文件失败");
        }
        if (lines.isEmpty()) {
            throw new ApiException(400, "bad_request", "CSV 为空或格式无效");
        }
        // 表头按列名定位 name/code
        String[] header = lines.get(0).split(",", -1);
        int nameIdx = -1;
        int codeIdx = -1;
        for (int i = 0; i < header.length; i++) {
            String h = header[i].trim();
            if ("name".equals(h) || "名称".equals(h) || "试卷名称".equals(h) || "题库名称".equals(h)
                || "课程名称".equals(h) || "岗位名称".equals(h) || "场景名称".equals(h)) {
                nameIdx = i;
            }
            if ("code".equals(h) || "编码".equals(h)) {
                codeIdx = i;
            }
        }
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int li = 1; li < lines.size(); li++) {
            String[] cols = lines.get(li).split(",", -1);
            int rowNum = li + 1;
            String name = nameIdx >= 0 && nameIdx < cols.length ? cols[nameIdx].trim() : "";
            String code = codeIdx >= 0 && codeIdx < cols.length ? cols[codeIdx].trim() : "";
            if (name.isEmpty()) {
                errors.add("第" + rowNum + "行名称不能为空");
                failed++;
                continue;
            }
            if (code.isEmpty()) {
                code = "IMP-" + UUID.randomUUID().toString().substring(0, 8);
            }
            String key = "code".equals(keyCol) ? code : name;
            String existing = findExistingId(entity, tenantId, keyCol, key);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, key, name));
                if (!preview) {
                    if (overwrite) {
                        updateGeneric(entity, existing, name, code);
                        created++;
                    } else if (rename) {
                        insertGeneric(entity, tenantId, userId, name + suffix(), code);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    insertGeneric(entity, tenantId, userId, name, code);
                }
            }
        }
        if (preview) {
            return previewResult(created, duplicates.size(), failed, duplicates, errors);
        }
        Map<String, Object> res = executeResult(created, failed, skipped, displayName(entity), errors);
        return res;
    }

    // ---------- 简单实体导入 ----------

    private Map<String, Object> importIndustries(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "行业列表");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String code = cell(row, 0);
            String name = cell(row, 1);
            if (code.isEmpty() || name.isEmpty()) {
                continue;
            }
            String parentCode = cell(row, 2);
            int sortOrder = parseIntDefault(cell(row, 3), 0);
            boolean enabled = parseBoolDefault(cell(row, 4), true);
            String parentId = parentCode.isEmpty() ? null : mapper.selectIndustryIdByCode(tenantId, parentCode);
            String existing = mapper.selectIndustryIdByCode(tenantId, code);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, code, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateIndustryByCode(tenantId, code, name, parentId, sortOrder, enabled);
                        created++;
                    } else if (rename) {
                        mapper.insertIndustry(UUID.randomUUID().toString(), tenantId, code + suffix(), name, parentId, sortOrder, enabled);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertIndustry(UUID.randomUUID().toString(), tenantId, code, name, parentId, sortOrder, enabled);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "行业", errors);
    }

    private Map<String, Object> importMajors(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "专业列表");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String code = cell(row, 0);
            String name = cell(row, 1);
            if (code.isEmpty() || name.isEmpty()) {
                continue;
            }
            String alias = cell(row, 2);
            boolean enabled = parseBoolDefault(cell(row, 3), true);
            String existing = mapper.selectMajorIdByCode(tenantId, code);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, code, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateMajorByCode(tenantId, code, name, alias, enabled);
                        created++;
                    } else if (rename) {
                        mapper.insertMajor(UUID.randomUUID().toString(), tenantId, code + suffix(), name, alias, enabled);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertMajor(UUID.randomUUID().toString(), tenantId, code, name, alias, enabled);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "专业", errors);
    }

    private Map<String, Object> importOrganizations(Workbook wb, String tenantId, boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "组织架构");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        Map<String, String> nameToId = new LinkedHashMap<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            String typeName = cell(row, 1);
            if (name.isEmpty() || typeName.isEmpty()) {
                continue;
            }
            String parentName = cell(row, 2);
            int sortOrder = parseIntDefault(cell(row, 3), 0);
            String typeId = mapper.selectOrgTypeIdByName(tenantId, typeName);
            if (typeId == null) {
                errors.add("第" + rowNum + "行组织类型不存在: " + typeName);
                failed++;
                continue;
            }
            String parentId = null;
            if (!parentName.isEmpty()) {
                parentId = nameToId.get(parentName);
                if (parentId == null) {
                    parentId = mapper.selectOrgIdByName(tenantId, parentName);
                }
            }
            String existing = mapper.selectOrgIdByNameType(tenantId, name, typeName);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateOrganizationParent(existing, parentId, sortOrder);
                        created++;
                    } else if (rename) {
                        String newName = name + suffix();
                        String id = UUID.randomUUID().toString();
                        mapper.insertOrganization(id, tenantId, newName, typeId, parentId, sortOrder);
                        nameToId.put(name, id);
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                String id = UUID.randomUUID().toString();
                if (!preview) {
                    mapper.insertOrganization(id, tenantId, name, typeId, parentId, sortOrder);
                }
                nameToId.put(name, id);
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "组织架构", errors);
    }

    private Map<String, Object> importStudents(Workbook wb, String tenantId, boolean preview) {
        return importUsers(wb, tenantId, preview, "学生列表", "学生", "正常");
    }

    private Map<String, Object> importTeachers(Workbook wb, String tenantId, boolean preview) {
        return importUsers(wb, tenantId, preview, "教师列表", "教师", "正常");
    }

    private Map<String, Object> importUsers(Workbook wb, String tenantId, boolean preview, String sheetName,
                                            String entity, String defaultStatus) {
        List<List<String>> rows = readRows(wb, sheetName);
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String loginName = cell(row, 0);
            String name = cell(row, 1);
            String password = cell(row, 2);
            if (loginName.isEmpty() || name.isEmpty() || password.isEmpty()) {
                continue;
            }
            if (!isValidPassword(password)) {
                errors.add("第" + rowNum + "行密码需至少 8 位且同时包含字母和数字");
                failed++;
                continue;
            }
            String status = mapUserStatus(cell(row, 4), defaultStatus);
            String existing = mapper.selectUserIdByLoginName(tenantId, loginName);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, loginName, name));
                if (!preview) {
                    skipped++;
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertUser(UUID.randomUUID().toString(), tenantId, null, tenantId + "_" + loginName,
                        loginName, PASSWORD_ENCODER.encode(password), name, status);
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, entity, errors);
    }

    private Map<String, Object> importProjects(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作项目");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceProject(UUID.randomUUID().toString(), tenantId, name, cell(row, 1),
                    mapProjectPhase(cell(row, 2)), cell(row, 3), parseDateOrNull(cell(row, 4)),
                    parseDateOrNull(cell(row, 5)), cell(row, 6), cell(row, 7), cell(row, 8),
                    parseImportBool(cell(row, 9)), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作项目", errors);
    }

    private Map<String, Object> importAchievements(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作成果");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String title = cell(row, 0);
            if (title.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceAchievement(UUID.randomUUID().toString(), tenantId, title,
                    mapAchievementType(cell(row, 1)), parseDateOrNull(cell(row, 2)), cell(row, 3),
                    cell(row, 4), cell(row, 5), cell(row, 6), parseImportBool(cell(row, 7)), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作成果", errors);
    }

    private Map<String, Object> importAgreements(Workbook wb, String tenantId, String userId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作协议");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAllianceAgreement(UUID.randomUUID().toString(), tenantId, name, cell(row, 1),
                    mapAgreementStatus(cell(row, 2)), parseDateOrNull(cell(row, 3)), parseDateOrNull(cell(row, 4)),
                    cell(row, 5), cell(row, 6), cell(row, 7), userId);
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作协议", errors);
    }

    private Map<String, Object> importPermissions(Workbook wb, String tenantId, boolean preview) {
        List<List<String>> rows = readRows(wb, "合作权限");
        List<String> errors = new ArrayList<>();
        int created = 0;
        int failed = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String accountName = cell(row, 0);
            if (accountName.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                mapper.insertAlliancePermission(UUID.randomUUID().toString(), tenantId, accountName,
                    mapAccountType(cell(row, 1)), parseBoolDefault(cell(row, 2), true));
            }
        }
        return preview ? previewResult(created, 0, failed, List.of(), errors)
            : executeResult(created, failed, 0, "合作权限", errors);
    }

    // ==================== 品牌 Excel 导入（对齐 Go DoImportBrandsTyped） ====================

    private Map<String, Object> importBrands(Workbook wb, String tenantId, String userId, boolean preview,
                                             boolean overwrite, boolean rename, String brandType) {
        String bt = brandType == null ? "" : brandType.trim();
        if (bt.isEmpty()) {
            return importBrandsGeneric(wb, tenantId, preview);
        }
        return importBrandsTyped(wb, tenantId, userId, bt, preview, overwrite, rename);
    }

    /** 通用模板（brandType 为空，向后兼容）：仅 name/type 落库，不做深链。 */
    private Map<String, Object> importBrandsGeneric(Workbook wb, String tenantId, boolean preview) {
        List<List<String>> rows = readRows(wb, "品牌内容");
        List<String> errors = new ArrayList<>();
        int created = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String type = mapBrandType(cell(row, 0));
            String name = cell(row, 1);
            if (name.isEmpty()) {
                continue;
            }
            created++;
            if (!preview) {
                AllianceBrand b = new AllianceBrand();
                b.setId(UUID.randomUUID().toString());
                b.setTenantId(tenantId);
                b.setBrandType(type);
                b.setName(name);
                b.setStatus("draft");
                b.setIsPublic(false);
                b.setIsFeatured(false);
                b.setDescription(nullableStr(cell(row, 2)));
                b.setData("{}");
                b.setSortOrder(0);
                b.setViewCount(0);
                brandMapper.insertBrand(b);
            }
        }
        return preview ? previewResult(created, 0, 0, List.of(), errors)
            : executeResult(created, 0, 0, "品牌内容", errors);
    }

    /** 按品牌类型深链导入（6 种 typed 模板）。 */
    private Map<String, Object> importBrandsTyped(Workbook wb, String tenantId, String userId, String bt,
                                                  boolean preview, boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "品牌内容");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            BrandRow br;
            try {
                br = parseBrandRow(tenantId, row, bt);
            } catch (RowParseException e) {
                failed++;
                errors.add("第" + rowNum + "行" + e.getMessage());
                continue;
            }
            if (br == null) {
                continue; // major 空白行（未开启展示且未填任何内容）
            }
            String existingId = brandMapper.selectBrandByName(tenantId, bt, br.name);
            if (existingId != null && !existingId.isEmpty()) {
                if (!overwrite && !(rename && !preview)) {
                    skipped++;
                    if (duplicates.size() < 100) {
                        duplicates.add(new ImportPreviewItem(rowNum, bt + "|" + br.name, br.name));
                    }
                    continue;
                }
                if (overwrite) {
                    if (!preview) {
                        try {
                            AllianceBrand existing = brandMapper.selectById(existingId);
                            if (existing == null) {
                                failed++;
                                errors.add("第" + rowNum + "行品牌[" + br.name + "]读取失败");
                                continue;
                            }
                            applyBrandRefs(tenantId, userId, existing.getPositionId(), br);
                            applyOverwrite(existing, br);
                            brandMapper.updateBrand(existing);
                        } catch (Exception e) {
                            failed++;
                            errors.add("第" + rowNum + "行品牌[" + br.name + "]更新失败: " + e.getMessage());
                            continue;
                        }
                    }
                    created++;
                    continue;
                }
                // rename 模式（仅执行阶段）：追加随机后缀生成新名称，按新对象导入
                br.name = uniqueSuffixed(br.name, c -> {
                    String id = brandMapper.selectBrandByName(tenantId, bt, c);
                    return id != null && !id.isEmpty();
                });
            }
            if (!preview) {
                try {
                    applyBrandRefs(tenantId, userId, null, br);
                    AllianceBrand b = new AllianceBrand();
                    b.setId(UUID.randomUUID().toString());
                    b.setTenantId(tenantId);
                    b.setBrandType(bt);
                    b.setName(br.name);
                    b.setStatus(br.status == null || br.status.isEmpty() ? "draft" : br.status);
                    b.setIsPublic(br.isPublic);
                    b.setIsFeatured(br.isFeatured);
                    b.setCoverImage(br.coverImage);
                    b.setDescription(br.description);
                    b.setData(br.data != null ? br.data : "{}");
                    b.setStudentId(br.studentId);
                    b.setEnterpriseId(br.enterpriseId);
                    b.setPositionId(br.positionId);
                    b.setMajorId(br.majorId);
                    b.setTeacherId(br.teacherId);
                    b.setExpertId(br.expertId);
                    b.setSortOrder(0);
                    b.setViewCount(0);
                    brandMapper.insertBrand(b);
                } catch (Exception e) {
                    failed++;
                    errors.add("第" + rowNum + "行品牌[" + br.name + "]创建失败: " + e.getMessage());
                    continue;
                }
            }
            created++;
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "品牌内容", errors);
    }

    /** 仅执行阶段落库企业岗位 / 校本师资档案，并回填 position_id / data。 */
    private void applyBrandRefs(String tenantId, String userId, String existingPositionId, BrandRow br) {
        if (br.enterprisePos != null) {
            br.positionId = saveEnterprisePosition(tenantId, userId, existingPositionId, br.enterprisePos);
        }
        if (br.teacherProfile != null) {
            String eid = upsertTeacherProfile(tenantId, userId, br.name, br.teacherId, br.teacherProfile);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("teacherExpertId", eid);
            br.data = json(data);
        }
    }

    /** 覆盖更新：未提供字段保留原值（data 仅在导入提供时替换）。 */
    private void applyOverwrite(AllianceBrand existing, BrandRow br) {
        existing.setName(br.name);
        if (br.description != null) {
            existing.setDescription(br.description);
        }
        if (br.coverImage != null) {
            existing.setCoverImage(br.coverImage);
        }
        // 单元格填写才覆盖开关/状态（空单元格保留原值，防覆盖导入静默下架已公开内容）
        if (br.statusFilled) {
            existing.setStatus(br.status);
        }
        if (br.isPublicFilled) {
            existing.setIsPublic(br.isPublic);
        }
        if (br.isFeaturedFilled) {
            existing.setIsFeatured(br.isFeatured);
        }
        existing.setStudentId(br.studentId);
        existing.setEnterpriseId(br.enterpriseId);
        existing.setPositionId(br.positionId);
        existing.setMajorId(br.majorId);
        existing.setTeacherId(br.teacherId);
        existing.setExpertId(br.expertId);
        if (br.data != null) {
            existing.setData(br.data);
        }
    }

    private BrandRow parseBrandRow(String tenantId, List<String> row, String brandType) {
        return switch (brandType) {
            case "talent" -> parseTalentBrandRow(tenantId, row);
            case "employer" -> parseEmployerBrandRow(tenantId, row);
            case "job" -> parseJobBrandRow(tenantId, row);
            case "major" -> parseMajorBrandRow(tenantId, row);
            case "teacher" -> parseTeacherBrandRow(tenantId, row);
            case "culture" -> parseCultureBrandRow(tenantId, row);
            default -> throw new RowParseException("品牌类型无法识别: " + brandType);
        };
    }

    private BrandRow parseTalentBrandRow(String tenantId, List<String> row) {
        String name = cell(row, 0);
        if (name.isEmpty()) {
            throw new RowParseException("案例名称不能为空");
        }
        BrandRow br = new BrandRow(name);
        br.description = nullableStr(cell(row, 1));
        String status = cell(row, 2);
        if (!status.isEmpty()) {
            br.status = mapPublishStatus(status);
            br.statusFilled = true;
        }
        br.isPublic = parseBoolDefault(cell(row, 3), false);
        br.isPublicFilled = !cell(row, 3).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 4), false);
        br.isFeaturedFilled = !cell(row, 4).isEmpty();
        br.coverImage = nullableStr(cell(row, 5));
        String studentName = cell(row, 6);
        if (!studentName.isEmpty()) {
            String id = mapper.selectUserIdByNameWithRole(tenantId, studentName, "student");
            if (id == null || id.isEmpty()) {
                throw new RowParseException("学生「" + studentName + "」未找到");
            }
            br.studentId = id;
        }
        String majorName = cell(row, 7);
        if (!majorName.isEmpty()) {
            String id = mapper.selectMajorIdByName(tenantId, majorName);
            if (id == null || id.isEmpty()) {
                throw new RowParseException("专业「" + majorName + "」未找到");
            }
            br.majorId = id;
        }
        return br;
    }

    private BrandRow parseEmployerBrandRow(String tenantId, List<String> row) {
        String entType = mapEnterpriseType(cell(row, 0));
        String name = cell(row, 1);
        if (name.isEmpty()) {
            throw new RowParseException("企业名称不能为空");
        }
        BrandRow br = new BrandRow(name);
        br.isPublic = parseBoolDefault(cell(row, 2), false);
        br.isPublicFilled = !cell(row, 2).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 3), false);
        br.isFeaturedFilled = !cell(row, 3).isEmpty();
        switch (entType) {
            case "enterprise" -> {
                String id = mapper.selectEnterpriseIdByName(tenantId, name);
                if (id == null || id.isEmpty()) {
                    throw new RowParseException("合作企业「" + name + "」未找到（需与「合作企业库」名称一致）");
                }
                br.enterpriseId = id;
            }
            case "independent" -> {
                Map<String, Object> info = new LinkedHashMap<>();
                info.put("enterpriseInfo", buildEnterpriseInfo(row, name));
                br.data = json(info);
            }
            default -> throw new RowParseException("企业类型无法识别: " + cell(row, 0));
        }
        return br;
    }

    /** 组装独立雇主企业资料（字段与前端 EnterpriseInfo 一致）。 */
    private Map<String, Object> buildEnterpriseInfo(List<String> row, String name) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name", name);
        info.put("enterpriseType", "third-party");
        setStr(info, "unifiedSocialCreditCode", cell(row, 4));
        setStr(info, "industry", cell(row, 5));
        setStr(info, "region", cell(row, 6));
        setInt(info, "establishedYear", cell(row, 7));
        setInt(info, "employeeCount", cell(row, 8));
        setMulti(info, "secondaryColleges", cell(row, 9));
        setStr(info, "description", cell(row, 10));
        setStr(info, "contactPerson", cell(row, 11));
        setStr(info, "contactPhone", cell(row, 12));
        setStr(info, "contactEmail", cell(row, 13));
        setStr(info, "address", cell(row, 14));
        setStr(info, "logoUrl", cell(row, 15));
        setStr(info, "coverImage", cell(row, 16));
        setMulti(info, "coverPhotos", cell(row, 17));
        setMulti(info, "businessLicensePhotos", cell(row, 18));
        setMulti(info, "intellectualPropertyPhotos", cell(row, 19));
        setMulti(info, "qualificationPhotos", cell(row, 20));
        return info;
    }

    private BrandRow parseJobBrandRow(String tenantId, List<String> row) {
        String posType = mapJobPositionType(cell(row, 0));
        String name = cell(row, 1);
        if (name.isEmpty()) {
            throw new RowParseException("岗位名称不能为空");
        }
        BrandRow br = new BrandRow(name);
        br.isPublic = parseBoolDefault(cell(row, 2), false);
        br.isPublicFilled = !cell(row, 2).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 3), false);
        br.isFeaturedFilled = !cell(row, 3).isEmpty();
        switch (posType) {
            case "teaching" -> {
                String id = mapper.selectTeachingPositionIdByName(tenantId, name);
                if (id == null || id.isEmpty()) {
                    throw new RowParseException("教学岗位「" + name + "」未找到（需与「职业岗位库」名称一致）");
                }
                br.positionId = id;
            }
            case "enterprise" -> {
                EnterprisePosition pos = new EnterprisePosition();
                pos.name = name;
                pos.salaryMin = parseNullableInt(trimK(cell(row, 4)));
                pos.salaryMax = parseNullableInt(trimK(cell(row, 5)));
                String industryName = cell(row, 7);
                if (!industryName.isEmpty()) {
                    String id = mapper.selectIndustryIdByName(tenantId, industryName);
                    if (id != null && !id.isEmpty()) {
                        pos.industryId = id;
                    }
                }
                pos.description = nullableStr(cell(row, 8));
                pos.requirements = splitMulti(cell(row, 9));
                pos.careerPath = nullableStr(cell(row, 10));
                for (String n : splitMulti(cell(row, 6))) {
                    String id = mapper.selectMajorIdByName(tenantId, n);
                    if (id != null && !id.isEmpty()) {
                        pos.majorIds.add(id);
                    }
                }
                // 岗位职责：每行一条「职责名|职责描述」，多条用换行分隔
                for (String line : cell(row, 11).split("\n")) {
                    String t = line.trim();
                    if (t.isEmpty()) {
                        continue;
                    }
                    String[] parts = t.split("\\|", 2);
                    if (parts.length == 1) {
                        parts = t.split("｜", 2);
                    }
                    String respName = parts[0].trim();
                    if (respName.isEmpty()) {
                        continue;
                    }
                    String desc = parts.length == 2 ? nullableStr(parts[1]) : null;
                    pos.responsibilities.add(new String[]{respName, desc});
                }
                br.enterprisePos = pos;
            }
            default -> throw new RowParseException("岗位类型无法识别: " + cell(row, 0));
        }
        return br;
    }

    private BrandRow parseMajorBrandRow(String tenantId, List<String> row) {
        String name = cell(row, 0);
        if (name.isEmpty()) {
            throw new RowParseException("专业名称不能为空");
        }
        String majorId = mapper.selectMajorIdByName(tenantId, name);
        if (majorId == null || majorId.isEmpty()) {
            throw new RowParseException("专业「" + name + "」未找到（以系统专业为基础，不会新增专业）");
        }
        BrandRow br = new BrandRow(name);
        br.majorId = majorId;
        br.isPublic = parseBoolDefault(cell(row, 2), false);
        br.isPublicFilled = !cell(row, 2).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 3), false);
        br.isFeaturedFilled = !cell(row, 3).isEmpty();
        br.description = nullableStr(cell(row, 4));
        br.coverImage = nullableStr(cell(row, 5));

        Map<String, Object> data = new LinkedHashMap<>();
        boolean anyContent = br.isPublic || br.isFeatured || br.description != null || br.coverImage != null;
        anyContent |= collectMajorRefs(tenantId, data, "employmentDirections", cell(row, 6));
        anyContent |= collectMajorRefs(tenantId, data, "cooperationEnterprises", cell(row, 7));
        anyContent |= collectMajorRefs(tenantId, data, "cooperationAchievements", cell(row, 8));
        anyContent |= collectMajorRefs(tenantId, data, "featuredCourses", cell(row, 9));
        if (!anyContent) {
            return null;
        }
        br.data = json(data);
        return br;
    }

    /** 专业品牌关联列按名称匹配 ID（未命中忽略，能查到的 ID 才加）。 */
    private boolean collectMajorRefs(String tenantId, Map<String, Object> data, String key, String names) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (String n : splitMulti(names)) {
            String id = lookupMajorRefId(tenantId, key, n);
            if (id != null && !id.isEmpty()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", id);
                item.put("name", n);
                items.add(item);
            }
        }
        if (!items.isEmpty()) {
            data.put(key, items);
            return true;
        }
        return false;
    }

    private String lookupMajorRefId(String tenantId, String key, String name) {
        switch (key) {
            case "employmentDirections":
                return mapper.selectJobBrandIdByName(tenantId, name);
            case "cooperationEnterprises": {
                String id = mapper.selectEnterpriseIdByName(tenantId, name);
                if (id != null && !id.isEmpty()) {
                    return id;
                }
                return mapper.selectIndependentEmployerBrandIdByName(tenantId, name);
            }
            case "cooperationAchievements":
                return mapper.selectAchievementIdByTitle(tenantId, name);
            case "featuredCourses":
                return mapper.selectCourseIdByName(tenantId, name);
            default:
                return null;
        }
    }

    private BrandRow parseTeacherBrandRow(String tenantId, List<String> row) {
        String teacherType = mapTeacherType(cell(row, 0));
        BrandRow br = new BrandRow(null);
        br.isPublic = parseBoolDefault(cell(row, 3), false);
        br.isPublicFilled = !cell(row, 3).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 4), false);
        br.isFeaturedFilled = !cell(row, 4).isEmpty();
        switch (teacherType) {
            case "school" -> {
                String teacherName = cell(row, 1);
                if (teacherName.isEmpty()) {
                    throw new RowParseException("校本师资需填写「关联教师名称」");
                }
                String id = mapper.selectUserIdByNameWithRole(tenantId, teacherName, "teacher");
                if (id == null || id.isEmpty()) {
                    throw new RowParseException("教师「" + teacherName + "」未找到");
                }
                br.name = teacherName;
                br.teacherId = id;
                TeacherProfile p = new TeacherProfile();
                String gender = cell(row, 5);
                if ("男".equals(gender)) {
                    p.gender = "male";
                } else if ("女".equals(gender)) {
                    p.gender = "female";
                }
                p.age = parseNullableInt(cell(row, 6));
                p.city = nullableStr(cell(row, 7));
                p.title = nullableStr(cell(row, 8));
                p.position = nullableStr(cell(row, 9));
                p.experienceYears = parseNullableInt(cell(row, 10));
                p.education = nullableStr(cell(row, 11));
                p.industry = nullableStr(cell(row, 12));
                p.specialties = splitMulti(cell(row, 13));
                p.introduction = nullableStr(cell(row, 14));
                p.workExperience = nullableStr(cell(row, 15));
                p.avatarUrl = nullableStr(cell(row, 16));
                br.teacherProfile = p;
            }
            case "expert" -> {
                String expertName = cell(row, 2);
                if (expertName.isEmpty()) {
                    throw new RowParseException("企业专家需填写「关联专家名称」");
                }
                String id = mapper.selectExpertIdByName(tenantId, expertName);
                if (id == null || id.isEmpty()) {
                    throw new RowParseException("专家「" + expertName + "」未找到");
                }
                br.name = expertName;
                br.expertId = id;
            }
            default -> throw new RowParseException("师资类型无法识别: " + cell(row, 0));
        }
        return br;
    }

    private BrandRow parseCultureBrandRow(String tenantId, List<String> row) {
        String name = cell(row, 0);
        if (name.isEmpty()) {
            throw new RowParseException("名称不能为空");
        }
        BrandRow br = new BrandRow(name);
        br.description = nullableStr(cell(row, 1));
        String status = cell(row, 2);
        if (!status.isEmpty()) {
            br.status = mapPublishStatus(status);
            br.statusFilled = true;
        }
        br.isPublic = parseBoolDefault(cell(row, 3), false);
        br.isPublicFilled = !cell(row, 3).isEmpty();
        br.isFeatured = parseBoolDefault(cell(row, 4), false);
        br.isFeaturedFilled = !cell(row, 4).isEmpty();
        br.coverImage = nullableStr(cell(row, 5));
        String majorName = cell(row, 6);
        if (!majorName.isEmpty()) {
            String id = mapper.selectMajorIdByName(tenantId, majorName);
            if (id == null || id.isEmpty()) {
                throw new RowParseException("专业「" + majorName + "」未找到");
            }
            br.majorId = id;
        }
        return br;
    }

    /** 企业岗位建草稿岗位（enterprise 类型），已有岗位则更新其内容；回填 position_id。 */
    private String saveEnterprisePosition(String tenantId, String userId, String existingPositionId,
                                          EnterprisePosition pos) {
        boolean create = existingPositionId == null || existingPositionId.isEmpty();
        String positionId = create ? UUID.randomUUID().toString() : existingPositionId;
        String requirements = toPgArray(pos.requirements == null ? List.of() : pos.requirements);
        if (create) {
            String code = generatePositionCode(tenantId);
            positionImportMapper.insertImportPosition(positionId, tenantId, code, pos.name, null, pos.industryId,
                "enterprise", pos.salaryMin, pos.salaryMax, pos.description, requirements, pos.careerPath, userId);
        } else {
            positionImportMapper.updatePositionImportFields(positionId, tenantId, pos.name, null, pos.industryId,
                "enterprise", pos.salaryMin, pos.salaryMax, pos.description, requirements, pos.careerPath, null);
        }
        // 面向专业 + 职责全量同步（覆盖复用已有岗位时先清后插）
        positionImportMapper.deletePositionAbilityBindings(positionId);
        positionImportMapper.deleteAbilityDomains(positionId);
        positionImportMapper.deletePositionResponsibilities(positionId);
        positionImportMapper.deletePositionMajors(positionId);
        for (String mid : pos.majorIds) {
            positionImportMapper.insertPositionMajor(UUID.randomUUID().toString(), positionId, mid);
        }
        int sort = 0;
        for (String[] resp : pos.responsibilities) {
            positionImportMapper.insertPositionResponsibilityFull(UUID.randomUUID().toString(), tenantId, positionId,
                resp[0], resp[1], ++sort);
        }
        return positionId;
    }

    /** 校本师资档案创建/更新（对齐 Go UpsertTeacherExpertProfile：nil 字段保留原值）。 */
    private String upsertTeacherProfile(String tenantId, String userId, String name, String teacherId,
                                        TeacherProfile p) {
        AllianceExpert existing = expertMapper.selectByUserId(tenantId, teacherId);
        if (existing == null) {
            AllianceExpert e = new AllianceExpert();
            e.setId(UUID.randomUUID().toString());
            e.setTenantId(tenantId);
            e.setName(name);
            e.setGender(p.gender);
            e.setAge(p.age);
            e.setTitle(p.title);
            e.setPosition(p.position);
            e.setExpertType("teacher");
            e.setIndustry(p.industry);
            e.setSpecialties(jsonList(p.specialties));
            e.setProfessionalFields("[]");
            e.setPhotos("[]");
            e.setAttachments("[]");
            e.setSecondaryColleges("[]");
            e.setExperienceYears(p.experienceYears);
            e.setEducation(p.education);
            e.setIntroduction(p.introduction);
            e.setWorkExperience(p.workExperience);
            e.setCity(p.city);
            e.setAvatarUrl(p.avatarUrl);
            e.setEnterpriseId(null);
            e.setStatus("active");
            e.setIsPublic(false);
            e.setUserId(teacherId);
            e.setCreatedBy(userId);
            expertMapper.insertExpert(e);
            return e.getId();
        }
        // 存在则仅更新导入提供的字段（COALESCE 语义）
        existing.setName(name);
        if (p.gender != null) existing.setGender(p.gender);
        if (p.age != null) existing.setAge(p.age);
        if (p.title != null) existing.setTitle(p.title);
        if (p.position != null) existing.setPosition(p.position);
        if (p.industry != null) existing.setIndustry(p.industry);
        if (p.specialties != null && !p.specialties.isEmpty()) existing.setSpecialties(jsonList(p.specialties));
        if (p.experienceYears != null) existing.setExperienceYears(p.experienceYears);
        if (p.education != null) existing.setEducation(p.education);
        if (p.introduction != null) existing.setIntroduction(p.introduction);
        if (p.workExperience != null) existing.setWorkExperience(p.workExperience);
        if (p.city != null) existing.setCity(p.city);
        if (p.avatarUrl != null) existing.setAvatarUrl(p.avatarUrl);
        expertMapper.updateExpert(existing);
        return existing.getId();
    }

    // ---- 品牌导入辅助 ----

    private static String json(Object o) {
        if (o == null) {
            return null;
        }
        try {
            return JSON_MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            return null;
        }
    }

    private static String jsonList(List<String> list) {
        if (list == null || list.isEmpty()) {
            return "[]";
        }
        try {
            return JSON_MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static String mapEnterpriseType(String v) {
        String s = v == null ? "" : v.trim();
        return switch (s) {
            case "合作企业", "合作", "企业", "enterprise" -> "enterprise";
            case "独立雇主企业", "独立雇主", "独立", "independent" -> "independent";
            default -> s;
        };
    }

    private static String mapJobPositionType(String v) {
        String s = v == null ? "" : v.trim();
        return switch (s) {
            case "教学岗位", "教学", "teaching" -> "teaching";
            case "企业岗位", "企业", "enterprise" -> "enterprise";
            default -> s;
        };
    }

    private static String mapTeacherType(String v) {
        String s = v == null ? "" : v.trim();
        return switch (s) {
            case "校本师资", "校本", "school" -> "school";
            case "企业专家", "专家", "expert" -> "expert";
            default -> s;
        };
    }

    private static String trimK(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim();
        while (!t.isEmpty() && (t.endsWith("K") || t.endsWith("k"))) {
            t = t.substring(0, t.length() - 1).trim();
        }
        return t;
    }

    private static List<String> splitMulti(String s) {
        if (s == null || s.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String p : s.split("[;；,，]")) {
            String t = p.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    private static void setStr(Map<String, Object> info, String key, String value) {
        if (value != null && !value.isEmpty()) {
            info.put(key, value);
        }
    }

    private static void setInt(Map<String, Object> info, String key, String value) {
        String v = trimK(value);
        if (!v.isEmpty()) {
            try {
                info.put(key, Integer.parseInt(v));
            } catch (NumberFormatException ignored) {
                // 忽略非数字
            }
        }
    }

    private static void setMulti(Map<String, Object> info, String key, String value) {
        List<String> v = splitMulti(value);
        if (!v.isEmpty()) {
            info.put(key, v);
        }
    }

    private static final class RowParseException extends RuntimeException {
        RowParseException(String msg) {
            super(msg);
        }
    }

    private static final class BrandRow {
        BrandRow(String name) {
            this.name = name;
        }
        String name;
        String description;
        String status = "draft";
        boolean statusFilled;
        boolean isPublic;
        boolean isPublicFilled;
        boolean isFeatured;
        boolean isFeaturedFilled;
        String coverImage;
        String studentId;
        String enterpriseId;
        String positionId;
        String majorId;
        String teacherId;
        String expertId;
        String data;
        EnterprisePosition enterprisePos;
        TeacherProfile teacherProfile;
    }

    private static final class EnterprisePosition {
        String name;
        Integer salaryMin;
        Integer salaryMax;
        String industryId;
        String description;
        List<String> requirements = new ArrayList<>();
        String careerPath;
        List<String> majorIds = new ArrayList<>();
        List<String[]> responsibilities = new ArrayList<>();
    }

    private static final class TeacherProfile {
        String gender;
        Integer age;
        String city;
        String title;
        String position;
        Integer experienceYears;
        String education;
        String industry;
        List<String> specialties = new ArrayList<>();
        String introduction;
        String workExperience;
        String avatarUrl;
    }

    private Map<String, Object> importQuestionBanks(Workbook wb, String tenantId, String userId, boolean preview,
                                                    boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "题库基本信息");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            String existing = mapper.selectQuestionBankIdByName(tenantId, name);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateQuestionBankName(existing, name);
                        created++;
                    } else if (rename) {
                        mapper.insertQuestionBank(UUID.randomUUID().toString(), tenantId, name + suffix(), cell(row, 1), userId,
                            randomCode("TK"));
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertQuestionBank(UUID.randomUUID().toString(), tenantId, name, cell(row, 1), userId,
                        randomCode("TK"));
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "题库", errors);
    }

    private Map<String, Object> importExams(Workbook wb, String tenantId, String userId, boolean preview,
                                            boolean overwrite, boolean rename) {
        List<List<String>> rows = readRows(wb, "试卷基本信息");
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicates = new ArrayList<>();
        int created = 0;
        int failed = 0;
        int skipped = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String name = cell(row, 0);
            if (name.isEmpty()) {
                continue;
            }
            String existing = mapper.selectExamIdByName(tenantId, name);
            if (existing != null) {
                duplicates.add(new ImportPreviewItem(rowNum, name, name));
                if (!preview) {
                    if (overwrite) {
                        mapper.updateExamName(existing, name);
                        created++;
                    } else if (rename) {
                        mapper.insertExam(UUID.randomUUID().toString(), tenantId, name + suffix(), cell(row, 1), userId,
                            randomCode("SJ"));
                        created++;
                    } else {
                        skipped++;
                    }
                }
            } else {
                created++;
                if (!preview) {
                    mapper.insertExam(UUID.randomUUID().toString(), tenantId, name, cell(row, 1), userId,
                        randomCode("SJ"));
                }
            }
        }
        return preview ? previewResult(created, duplicates.size(), failed, duplicates, errors)
            : executeResult(created, failed, skipped, "试卷", errors);
    }

    /** 解析 + 逐行校验 + 计数（复杂实体演示简化：不落深层关系）。 */
    // ==================== 岗位 Excel 导入（对齐 Go position_import.go） ====================

    private Map<String, Object> importPositions(Workbook wb, String tenantId, String userId, boolean preview,
                                                boolean overwrite, boolean rename) {
        Map<String, String> positionMap = new LinkedHashMap<>();
        PositionImportAccum acc = new PositionImportAccum();
        importPositionsSheet(wb, tenantId, userId, preview, overwrite, rename, positionMap, acc);
        importResponsibilitiesSheet(wb, tenantId, preview, positionMap, acc);
        if (preview) {
            return previewResult(acc.created, acc.duplicates, acc.failed, acc.duplicateItems, acc.errors);
        }
        return executeResult(acc.created, acc.failed, acc.skipped, "岗位", acc.errors);
    }

    private void importPositionsSheet(Workbook wb, String tenantId, String userId, boolean preview,
                                      boolean overwrite, boolean rename, Map<String, String> positionMap,
                                      PositionImportAccum acc) {
        List<List<String>> rows = readRows(wb, "岗位基本信息");
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0).trim();
            if (name.isEmpty()) {
                continue;
            }
            String shortName = cell(row, 1);
            String positionType = "teaching";
            String industryName = cell(row, 3);
            List<String> majorNames = splitTrim(cell(row, 4), ",");
            Integer salaryMin = parseNullableInt(cell(row, 5));
            Integer salaryMax = parseNullableInt(cell(row, 6));
            String description = nullableStr(cell(row, 7));
            List<String> requirements = parseRequirements(cell(row, 8));
            String careerPath = nullableStr(cell(row, 9));
            List<String> certNames = splitTrim(cell(row, 10), ",");
            String batchName = cell(row, 11);

            String industryId = lookupIndustry(tenantId, industryName);
            String batchId = batchName.isEmpty() ? null : positionImportMapper.findBatchIdByName(tenantId, batchName);
            List<String> majorIds = lookupMajors(tenantId, majorNames);

            Map<String, Object> dup = positionImportMapper.findPositionByTenantAndName(tenantId, name);
            String existingId = dup == null ? null : str(dup.get("id"));
            String existingCreator = dup == null ? null : str(dup.get("created_by"));
            String existingCollaborators = dup == null ? null : str(dup.get("collaborators"));
            boolean exists = existingId != null && !existingId.isEmpty();

            String origName = "";
            if (exists) {
                if (preview) {
                    if (acc.duplicateItems.size() < 100) {
                        acc.duplicateItems.add(new ImportPreviewItem(i + 1, name, name));
                    }
                    acc.duplicates++;
                    acc.skipped++;
                    continue;
                }
                if (!overwrite && !rename) {
                    acc.skipped++;
                    continue;
                }
                if (overwrite) {
                    if (!canOverwriteContent(existingCreator, parsePgArrayText(existingCollaborators), userId)) {
                        acc.skipped++;
                        continue;
                    }
                    try {
                        positionImportMapper.updatePositionImportFields(existingId, tenantId, name, shortName,
                            industryId, positionType, salaryMin, salaryMax, description, toPgArray(requirements),
                            careerPath, batchId);
                        positionImportMapper.deletePositionMajors(existingId);
                        positionImportMapper.deletePositionCertificates(existingId);
                        positionImportMapper.deletePositionResponsibilities(existingId);
                        positionImportMapper.deletePositionAbilityBindings(existingId);
                        positionImportMapper.deleteAbilityDomains(existingId);
                        for (String mid : majorIds) {
                            positionImportMapper.insertPositionMajor(UUID.randomUUID().toString(), existingId, mid);
                        }
                        for (String certName : certNames) {
                            if (certName.isEmpty()) {
                                continue;
                            }
                            positionImportMapper.insertPositionCertificate(UUID.randomUUID().toString(), tenantId,
                                existingId, findOrCreateCert(tenantId, certName));
                        }
                    } catch (Exception e) {
                        acc.failed++;
                        acc.errors.add("岗位[" + name + "]关联数据写入失败");
                        continue;
                    }
                    positionMap.put(name, existingId);
                    continue;
                }
                // rename 模式
                origName = name;
                name = uniqueSuffixed(name, c -> positionImportMapper.findPositionIdByTenantAndName(tenantId, c) != null);
            }

            if (preview) {
                acc.created++;
                continue;
            }

            String positionId = UUID.randomUUID().toString();
            String code = generatePositionCode(tenantId);
            try {
                positionImportMapper.insertImportPosition(positionId, tenantId, code, name, shortName, industryId,
                    positionType, salaryMin, salaryMax, description, toPgArray(requirements), careerPath, userId);
                if (batchId != null) {
                    positionImportMapper.updatePositionBatchId(batchId, positionId);
                }
                for (String mid : majorIds) {
                    positionImportMapper.insertPositionMajor(UUID.randomUUID().toString(), positionId, mid);
                }
                for (String certName : certNames) {
                    if (certName.isEmpty()) {
                        continue;
                    }
                    positionImportMapper.insertPositionCertificate(UUID.randomUUID().toString(), tenantId, positionId,
                        findOrCreateCert(tenantId, certName));
                }
            } catch (Exception e) {
                acc.failed++;
                acc.errors.add("岗位[" + name + "]创建失败: " + e.getMessage());
                continue;
            }
            positionMap.put(name, positionId);
            if (!origName.isEmpty()) {
                positionMap.put(origName, positionId);
            }
            acc.created++;
        }
    }

    private void importResponsibilitiesSheet(Workbook wb, String tenantId, boolean preview,
                                             Map<String, String> positionMap, PositionImportAccum acc) {
        if (preview) {
            return;
        }
        List<List<String>> rows = readRows(wb, "工作职责与能力点");
        Map<String, Integer> sortCounter = new LinkedHashMap<>();
        Map<String, String> seenResp = new LinkedHashMap<>();
        Map<String, String> seenAbility = new LinkedHashMap<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String positionName = cell(row, 0).trim();
            String respName = cell(row, 1).trim();
            if (positionName.isEmpty() || respName.isEmpty()) {
                continue;
            }
            String abilityName = cell(row, 2).trim();
            List<String> attributes = splitTrim(cell(row, 3), ",");
            String domainName = cell(row, 4);
            String requiredLevel = mapRequiredLevel(cell(row, 5));
            String rubricDescription = nullableStr(cell(row, 6));

            String positionId = positionMap.get(positionName);
            if (positionId == null) {
                acc.skipped++;
                acc.errors.add("工作职责行[" + positionName + "/" + respName + "]找不到岗位,已跳过");
                continue;
            }
            String respKey = positionId + "|" + respName;
            String respId = seenResp.get(respKey);
            if (respId == null) {
                sortCounter.merge(positionId, 1, Integer::sum);
                respId = UUID.randomUUID().toString();
                try {
                    positionImportMapper.insertPositionResponsibility(respId, tenantId, positionId, respName,
                        sortCounter.get(positionId));
                } catch (Exception e) {
                    respId = positionImportMapper.findResponsibilityIdByPositionAndName(positionId, respName);
                }
                if (respId == null || respId.isEmpty()) {
                    acc.failed++;
                    acc.errors.add("职责[" + positionName + "/" + respName + "]创建后仍未获取到ID,跳过能力绑定");
                    continue;
                }
                seenResp.put(respKey, respId);
                acc.created++;
            }
            if (abilityName.isEmpty()) {
                continue;
            }
            String abilityKey = tenantId + "|" + abilityName;
            String abilityId = seenAbility.get(abilityKey);
            if (abilityId == null) {
                abilityId = findOrCreateAbilityPoint(tenantId, abilityName, attributes);
                seenAbility.put(abilityKey, abilityId);
            }
            String bindingId = UUID.randomUUID().toString();
            try {
                positionImportMapper.insertPositionAbilityBinding(bindingId, tenantId, positionId, respId, abilityId,
                    domainName, requiredLevel, rubricDescription, toPgArray(attributes));
            } catch (Exception e) {
                acc.failed++;
                acc.errors.add("能力点绑定[" + positionName + "/" + respName + "/" + abilityName + "]失败: "
                    + e.getMessage());
                continue;
            }
            acc.created++;
            if (!domainName.isEmpty()) {
                ensureAbilityDomain(tenantId, positionId, domainName, bindingId);
            }
        }
    }

    private String lookupIndustry(String tenantId, String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        return positionImportMapper.findIndustryIdByTenantAndName(tenantId, name);
    }

    private List<String> lookupMajors(String tenantId, List<String> names) {
        List<String> ids = new ArrayList<>();
        for (String name : names) {
            if (name == null || name.isEmpty()) {
                continue;
            }
            String id = mapper.selectMajorIdByName(tenantId, name);
            if (id != null && !id.isEmpty()) {
                ids.add(id);
            }
        }
        return ids;
    }

    private String findOrCreateCert(String tenantId, String name) {
        String id = positionImportMapper.findCertificateLibraryId(tenantId, name);
        if (id != null && !id.isEmpty()) {
            return id;
        }
        id = UUID.randomUUID().toString();
        positionImportMapper.insertCertificateLibrary(id, tenantId, name);
        String existing = positionImportMapper.findCertificateLibraryId(tenantId, name);
        return existing != null && !existing.isEmpty() ? existing : id;
    }

    private String findOrCreateAbilityPoint(String tenantId, String name, List<String> attributes) {
        String id = positionImportMapper.findAbilityPointId(tenantId, name);
        if (id != null && !id.isEmpty()) {
            if (attributes != null && !attributes.isEmpty()) {
                positionImportMapper.updateAbilityPointAttributesIfEmpty(id, toPgArray(attributes));
            }
            return id;
        }
        id = UUID.randomUUID().toString();
        String code = generateAbilityPointCode(tenantId);
        positionImportMapper.insertAbilityPoint(id, tenantId, name, toPgArray(attributes), code);
        String existing = positionImportMapper.findAbilityPointId(tenantId, name);
        return existing != null && !existing.isEmpty() ? existing : id;
    }

    private void ensureAbilityDomain(String tenantId, String positionId, String domainName, String bindingId) {
        String domainId = positionImportMapper.findAbilityDomainId(tenantId, positionId, domainName);
        if (domainId != null && !domainId.isEmpty()) {
            positionImportMapper.appendAbilityDomainBinding(domainId, bindingId);
            return;
        }
        positionImportMapper.insertAbilityDomain(UUID.randomUUID().toString(), tenantId, positionId, domainName, bindingId);
    }

    private String generatePositionCode(String tenantId) {
        for (int i = 0; i < 10; i++) {
            String code = randomCode("GW");
            if (!positionImportMapper.existsPositionCode(tenantId, code)) {
                return code;
            }
        }
        return randomCode("GW");
    }

    private String generateAbilityPointCode(String tenantId) {
        for (int i = 0; i < 10; i++) {
            String code = randomCode("NL");
            if (!positionImportMapper.existsAbilityPointCode(tenantId, code)) {
                return code;
            }
        }
        return randomCode("NL");
    }

    private String randomCode(String prefix) {
        StringBuilder sb = new StringBuilder(prefix).append('-');
        for (int j = 0; j < 8; j++) {
            sb.append(CODE_ALPHABET.charAt(ThreadLocalRandom.current().nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private String mapRequiredLevel(String l) {
        return switch (l.trim()) {
            case "了解" -> "understand";
            case "理解" -> "comprehend";
            case "掌握" -> "master";
            case "熟练" -> "proficient";
            case "精通" -> "expert";
            default -> l.trim();
        };
    }

    private List<String> parseRequirements(String s) {
        if (s == null || s.isEmpty()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String line : s.split("\n")) {
            String t = line.trim();
            if (!t.isEmpty()) {
                result.add(t);
            }
        }
        return result;
    }

    private List<String> splitTrim(String s, String sep) {
        if (s == null || s.isEmpty()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String p : s.split(sep)) {
            String t = p.trim();
            if (!t.isEmpty()) {
                result.add(t);
            }
        }
        return result;
    }

    private Integer parseNullableInt(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        if (t.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(t);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String nullableStr(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private boolean canOverwriteContent(String creatorId, List<String> collaboratorIds, String userId) {
        if (creatorId != null && creatorId.equals(userId)) {
            return true;
        }
        if (collaboratorIds != null) {
            for (String id : collaboratorIds) {
                if (id.equals(userId)) {
                    return true;
                }
            }
        }
        return false;
    }

    private String uniqueSuffixed(String base, java.util.function.Predicate<String> exists) {
        for (int i = 0; i < 20; i++) {
            String candidate = base + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
            if (!exists.test(candidate)) {
                return candidate;
            }
        }
        return base + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private String toPgArray(List<String> list) {
        // MySQL：数组列统一 JSON 数组存储（PG→MySQL 迁移后列类型为 JSON；PG 字面量 {..} 非法 JSON 会写入失败）
        try {
            return JSON_MAPPER.writeValueAsString(list == null ? List.of() : list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> parsePgArrayText(String s) {
        if (s == null || s.isEmpty()) {
            return List.of();
        }
        String t = s.trim();
        if (t.startsWith("[")) {
            // MySQL JSON 数组
            try {
                return JSON_MAPPER.readValue(t, LIST_STRING_REF);
            } catch (Exception ignored) {
                return List.of();
            }
        }
        if ("{}".equals(t) || "{null}".equals(t)) {
            return List.of();
        }
        // 兼容 PG 遗留字面量 {a,b}（迁移前旧数据）
        List<String> result = new ArrayList<>();
        for (String item : t.substring(1, t.length() - 1).split(",")) {
            String v = item.trim();
            if (v.startsWith("\"")) {
                v = v.substring(1, v.length() - 1);
            }
            if (!v.isEmpty() && !"null".equals(v)) {
                result.add(v);
            }
        }
        return result;
    }

    /** 岗位导入累计器（对齐 Go PositionImportResult）。 */
    private static final class PositionImportAccum {
        int created;
        int failed;
        int skipped;
        int duplicates;
        final List<String> errors = new ArrayList<>();
        final List<ImportPreviewItem> duplicateItems = new ArrayList<>();
    }

    // ==================== 方案课程 Excel 导入（对齐 Go program_course_import.go） ====================

    private Map<String, Object> importProgramCourses(Workbook wb, String tenantId, String programId, boolean preview) {
        List<List<String>> rows = readRows(wb, "导入");
        List<TrainingProgramCourse> courses = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int created = 0;
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            int rowNum = i + 1;
            String positionName = cell(row, 0).trim();
            String courseName = cell(row, 1).trim();
            String creditsStr = cell(row, 2).trim();
            String hoursStr = cell(row, 3).trim();
            String nature = cell(row, 4).trim();
            if (positionName.isEmpty() && courseName.isEmpty()) {
                errors.add("第" + rowNum + "行：关联岗位和关联体系课至少填写一项");
                continue;
            }
            java.math.BigDecimal credits = java.math.BigDecimal.ZERO;
            if (!creditsStr.isEmpty()) {
                try {
                    credits = new java.math.BigDecimal(creditsStr);
                } catch (NumberFormatException e) {
                    errors.add("第" + rowNum + "行：学分格式无效");
                    continue;
                }
            }
            int hours = 0;
            if (!hoursStr.isEmpty()) {
                try {
                    hours = Integer.parseInt(hoursStr);
                } catch (NumberFormatException e) {
                    errors.add("第" + rowNum + "行：学时格式无效");
                    continue;
                }
            }
            if (nature.isEmpty()) {
                nature = "必修";
            }
            TrainingProgramCourse c = new TrainingProgramCourse();
            c.setId(UUID.randomUUID().toString());
            c.setProgramId(programId);
            c.setCredits(credits);
            c.setHours(hours);
            c.setNature(nature);
            c.setSemester(1);
            c.setSortOrder(courses.size());
            if (!positionName.isEmpty()) {
                String pid = mapper.selectCareerPositionIdByName(tenantId, positionName);
                if (pid != null && !pid.isEmpty()) {
                    c.setPositionId(pid);
                    c.setName(positionName);
                }
            }
            if (c.getPositionId() == null && !courseName.isEmpty()) {
                Map<String, Object> sc = mapper.selectSystemCourseIdAndName(tenantId, courseName);
                if (sc != null) {
                    String id = str(sc.get("id"));
                    String n = str(sc.get("name"));
                    c.setName(n.isEmpty() ? courseName : n);
                    c.setCourseId(id);
                }
            }
            if (c.getPositionId() == null && c.getCourseId() == null) {
                errors.add("第" + rowNum + "行：岗位/课程名称均未匹配到现有数据");
                continue;
            }
            courses.add(c);
            created++;
        }
        if (preview) {
            return previewResult(created, 0, 0, List.of(), errors);
        }
        if (programId == null || programId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少方案ID");
        }
        programCourseMapper.deleteByProgram(programId);
        for (TrainingProgramCourse c : courses) {
            programCourseMapper.insert(c);
        }
        return executeResult(created, 0, 0, "方案课程", errors);
    }

    // ==================== 排课 Excel 导入（对齐 Go schedule_import.go） ====================

    private Map<String, Object> importSchedules(Workbook wb, String tenantId, String termId, boolean preview) {
        List<String> errors = new ArrayList<>();
        List<List<String>> rows = readRows(wb, "课程列表");
        if (rows.isEmpty()) {
            errors.add("读取「课程列表」Sheet 失败");
            return preview ? previewResult(0, 0, 1, List.of(), errors) : executeResult(0, 1, 0, "排课", errors);
        }

        List<ScheduleItem> items = new ArrayList<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (cell(row, 0).trim().isEmpty()) {
                continue;
            }
            String courseName = cell(row, 0).trim();
            String entryType = cell(row, 1).trim();
            entryType = switch (entryType) {
                case "场景" -> "scene";
                case "课程", "" -> "traditional";
                default -> entryType;
            };
            int startWeek;
            int endWeek;
            try {
                startWeek = Integer.parseInt(cell(row, 2).trim());
                endWeek = Integer.parseInt(cell(row, 3).trim());
            } catch (NumberFormatException e) {
                errors.add("第" + (i + 1) + "行: 周次区间无效（" + cell(row, 2).trim() + " - " + cell(row, 3).trim() + "）");
                continue;
            }
            if (startWeek <= 0 || endWeek < startWeek) {
                errors.add("第" + (i + 1) + "行: 周次区间无效");
                continue;
            }
            String weekPattern = cell(row, 4).trim();
            if (weekPattern.isEmpty()) {
                weekPattern = "all";
            }
            weekPattern = switch (weekPattern) {
                case "全部" -> "all";
                case "单周" -> "odd";
                case "双周" -> "even";
                default -> weekPattern;
            };
            String teacherName = cell(row, 6).trim();
            String venueName = cell(row, 7).trim();
            String classes = cell(row, 8).trim();

            if (preview) {
                // 预览：统计整周矩阵可拆分的排课条数（day 字段暂存 slot 计数）
                items.add(new ScheduleItem(courseName, entryType, startWeek, endWeek, weekPattern,
                    parseWeekMatrix(cell(row, 5)).size(), List.of(), teacherName, venueName, classes));
                continue;
            }
            List<WeekSlot> slots = parseWeekMatrix(cell(row, 5));
            if (slots.isEmpty()) {
                continue;
            }
            for (WeekSlot slot : slots) {
                items.add(new ScheduleItem(courseName, entryType, startWeek, endWeek, weekPattern,
                    slot.day, slot.periods, teacherName, venueName, classes));
            }
        }

        if (preview) {
            int total = items.stream().mapToInt(ScheduleItem::day).sum();
            return previewResult(total, 0, 0, List.of(), errors);
        }

        if (items.isEmpty()) {
            errors.add("课程列表无有效的排课数据（节次列需填写整周矩阵，如 周一:上午1、上午2）");
            return executeResult(0, 1, 0, "排课", errors);
        }

        // 确定目标学期：优先请求携带，其次从第一个有效课程匹配教学计划推断
        if (termId == null || termId.isEmpty()) {
            termId = scheduleImportMapper.inferTermByCourseName(tenantId, items.get(0).courseName);
        } else if (!scheduleImportMapper.termExists(tenantId, termId)) {
            errors.add("学期不存在或不属于当前租户");
            return executeResult(0, 1, 0, "排课", errors);
        }
        if (termId == null || termId.isEmpty()) {
            errors.add("无法识别所属学期，请先选择目标学期再导入");
            return executeResult(0, 1, 0, "排课", errors);
        }

        int created = 0;
        int failed = 0;
        scheduleImportMapper.clearDraftScheduleEntries(tenantId, termId);
        scheduleImportMapper.resetPlanEntriesToPlanned(tenantId, termId);

        Map<String, Map<String, Object>> planEntryCache = new LinkedHashMap<>();
        Map<String, String> classCache = new LinkedHashMap<>();
        Map<String, String> teacherCache = new LinkedHashMap<>();
        Map<String, String> venueCache = new LinkedHashMap<>();

        for (ScheduleItem it : items) {
            Map<String, Object> pe = planEntryCache.get(it.courseName);
            if (pe == null) {
                pe = scheduleImportMapper.findPlanEntryByCourse(tenantId, termId, it.courseName);
                if (pe == null || str(pe.get("id")).isEmpty()) {
                    failed++;
                    errors.add("课程[" + it.courseName + "]未匹配到教学计划条目");
                    continue;
                }
                planEntryCache.put(it.courseName, pe);
            }
            // 解析班级
            List<String> classIds = new ArrayList<>();
            boolean parseOk = true;
            for (String cn : it.classes.replace(",", "，").split("，")) {
                cn = cn.trim();
                if (cn.isEmpty()) {
                    continue;
                }
                String cid = classCache.get(cn);
                if (cid == null) {
                    cid = scheduleImportMapper.findOrgIdByName(tenantId, cn);
                    if (cid == null) {
                        failed++;
                        errors.add("课程[" + it.courseName + "]班级[" + cn + "]不存在");
                        parseOk = false;
                        break;
                    }
                    classCache.put(cn, cid);
                }
                classIds.add(cid);
            }
            if (!parseOk || classIds.isEmpty()) {
                continue;
            }
            String teacherId = null;
            if (!it.teacherName.isEmpty()) {
                teacherId = teacherCache.get(it.teacherName);
                if (teacherId == null) {
                    teacherId = scheduleImportMapper.findTeacherIdByName(tenantId, it.teacherName);
                    if (teacherId == null) {
                        failed++;
                        errors.add("课程[" + it.courseName + "]教师[" + it.teacherName + "]不存在");
                        continue;
                    }
                    teacherCache.put(it.teacherName, teacherId);
                }
            }
            String venueId = null;
            if (!it.venueName.isEmpty()) {
                venueId = venueCache.get(it.venueName);
                if (venueId == null) {
                    venueId = scheduleImportMapper.findVenueIdByName(tenantId, it.venueName);
                    if (venueId == null) {
                        failed++;
                        errors.add("课程[" + it.courseName + "]场地[" + it.venueName + "]不存在");
                        continue;
                    }
                    venueCache.put(it.venueName, venueId);
                }
            }
            try {
                scheduleImportMapper.insertScheduleEntry(UUID.randomUUID().toString(), tenantId, termId,
                    str(pe.get("id")), it.courseName, str(pe.get("course_code")), str(pe.get("course_id")),
                    it.entryType, classIds.get(0), toPgArray(classIds), teacherId, it.day, toPgArray(it.periods),
                    it.startWeek, it.endWeek, it.weekPattern, venueId, str(pe.get("scenario_id")));
                scheduleImportMapper.markPlanEntryScheduled(str(pe.get("id")));
                created++;
            } catch (Exception e) {
                failed++;
                errors.add("课程[" + it.courseName + "]导入失败: " + e.getMessage());
            }
        }
        return executeResult(created, failed, 0, "排课", errors);
    }

    private List<WeekSlot> parseWeekMatrix(String s) {
        List<WeekSlot> slots = new ArrayList<>();
        if (s == null) {
            return slots;
        }
        for (String line : s.split("\n")) {
            line = line.trim();
            if (line.isEmpty()) {
                continue;
            }
            int idx = line.indexOf(':');
            if (idx < 0) {
                continue;
            }
            int day = parseDayOfWeek(line.substring(0, idx).trim());
            if (day == 0) {
                continue;
            }
            List<String> periods = normalizePeriods(splitTrim(line.substring(idx + 1).replace("、", ","), ","));
            if (periods.isEmpty()) {
                continue;
            }
            slots.add(new WeekSlot(day, periods));
        }
        return slots;
    }

    private int parseDayOfWeek(String s) {
        return switch (s.trim()) {
            case "周一", "星期一", "1" -> 1;
            case "周二", "星期二", "2" -> 2;
            case "周三", "星期三", "3" -> 3;
            case "周四", "星期四", "4" -> 4;
            case "周五", "星期五", "5" -> 5;
            case "周六", "星期六", "6" -> 6;
            case "周日", "星期日", "周天", "星期天", "7" -> 7;
            default -> 0;
        };
    }

    private List<String> normalizePeriods(List<String> periods) {
        List<String> out = new ArrayList<>();
        for (String p : periods) {
            out.add(switch (p) {
                case "上午1" -> "上午第一节课";
                case "上午2" -> "上午第二节课";
                case "上午3" -> "上午第三节课";
                case "上午4" -> "上午第四节课";
                case "下午1" -> "下午第一节课";
                case "下午2" -> "下午第二节课";
                case "下午3" -> "下午第三节课";
                case "下午4" -> "下午第四节课";
                case "晚上1" -> "晚上第一节课";
                case "晚上2" -> "晚上第二节课";
                default -> p;
            });
        }
        return out;
    }

    private record WeekSlot(int day, List<String> periods) {
    }

    private record ScheduleItem(String courseName, String entryType, int startWeek, int endWeek,
                                String weekPattern, int day, List<String> periods, String teacherName,
                                String venueName, String classes) {
    }

    // ==================== 颗粒课 Excel 导入（对齐 Go granular_course_import.go） ====================

    private Map<String, Object> importGranularCourses(Workbook wb, String tenantId, String userId, boolean preview,
                                                      boolean overwrite, boolean rename) {
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicateItems = new ArrayList<>();
        int created = 0, failed = 0, skipped = 0, duplicates = 0;
        List<List<String>> rows = readRows(wb, "课程基本信息");
        // 编码序列在循环外取一次最大值、循环内自增：MySQL REPEATABLE READ 下快照读看不到本事务未提交插入，
        // 逐行查询会重复生成 GRA-2026-0001 触发 uq_courses_tenant_code 冲突（导入实测）
        String codeYear = String.valueOf(java.time.Year.now().getValue());
        int codeSeq = granularImportMapper.selectMaxGranularCourseCodeNum(tenantId, codeYear);
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0).trim();
            if (name.isEmpty()) {
                continue;
            }
            String majorName = cell(row, 1);
            int difficulty = parseIntSafe(cell(row, 2), 0);
            double duration = parseDoubleSafe(cell(row, 3), 0);
            String learningGoal = cell(row, 4);
            List<String> knowledgeNames = splitTrim(cell(row, 5), ",");
            List<String> resourceNames = splitTrim(cell(row, 6), ",");
            String batchName = cell(row, 7);

            String majorId = majorName.isEmpty() ? null : mapper.selectMajorIdByName(tenantId, majorName);
            String batchId = batchName.isEmpty() ? null : granularImportMapper.selectLessonBatchIdByName(tenantId, batchName);
            String description = learningGoal.isEmpty() ? null : learningGoal;
            Integer difficultyPtr = difficulty > 0 ? difficulty : null;
            Double durationPtr = duration > 0 ? duration : null;

            Map<String, Object> ident = granularImportMapper.selectGranularCourseIdentity(tenantId, name);
            String existingId = ident == null ? null : str(ident.get("id"));
            String existingCreator = ident == null ? null : str(ident.get("creator_id"));
            String existingCoCreators = ident == null ? null : str(ident.get("co_creator_ids"));
            boolean exists = existingId != null && !existingId.isEmpty();

            if (exists) {
                if (preview) {
                    if (duplicateItems.size() < 100) {
                        duplicateItems.add(new ImportPreviewItem(i + 1, name, name));
                    }
                    duplicates++;
                    skipped++;
                    continue;
                }
                if (!overwrite && !rename) {
                    skipped++;
                    continue;
                }
                if (overwrite && !canOverwriteContent(existingCreator, parsePgArrayText(existingCoCreators), userId)) {
                    skipped++;
                    continue;
                }
            }

            // 覆盖权限判定通过后才创建知识点（preview 与权限不足路径均无写副作用）
            List<String> knowledgePointIds = new ArrayList<>();
            for (String kn : knowledgeNames) {
                String kpId = findOrCreateKnowledgePoint(tenantId, kn);
                if (kpId != null && !kpId.isEmpty()) {
                    knowledgePointIds.add(kpId);
                }
            }
            List<String> resourceIds = new ArrayList<>();
            for (String rn : resourceNames) {
                String rid = findOrCreateResource(tenantId, rn, userId);
                if (rid != null && !rid.isEmpty()) {
                    resourceIds.add(rid);
                }
            }

            if (exists && overwrite) {
                try {
                    granularImportMapper.updateGranularCourse(existingId, tenantId, majorId, batchId, difficultyPtr,
                        description, durationPtr, toPgArray(knowledgePointIds), toPgArray(resourceIds));
                    replaceCourseBindings(existingId, tenantId, knowledgePointIds, resourceIds);
                } catch (Exception e) {
                    failed++;
                    errors.add("颗粒课[" + name + "]更新失败: " + e.getMessage());
                }
                continue;
            }
            if (exists) {
                // rename 模式
                name = uniqueSuffixed(name, c -> granularImportMapper.selectGranularCourseIdByName(tenantId, c) != null);
            }
            if (preview) {
                created++;
                continue;
            }
            String courseId = UUID.randomUUID().toString();
            String code = String.format("GRA-%s-%04d", codeYear, ++codeSeq);
            try {
                granularImportMapper.insertGranularCourse(courseId, tenantId, code, name, majorId, durationPtr,
                    difficultyPtr, description, userId, batchId, toPgArray(knowledgePointIds), toPgArray(resourceIds));
                replaceCourseBindings(courseId, tenantId, knowledgePointIds, resourceIds);
                created++;
            } catch (Exception e) {
                failed++;
                errors.add("颗粒课[" + name + "]创建失败: " + e.getMessage());
            }
        }
        if (preview) {
            return previewResult(created, duplicates, failed, duplicateItems, errors);
        }
        return executeResult(created, failed, skipped, "颗粒课", errors);
    }

    private void replaceCourseBindings(String courseId, String tenantId, List<String> knowledgePointIds,
                                       List<String> resourceIds) {
        granularImportMapper.deleteCourseKnowledgeBindings(courseId);
        granularImportMapper.deleteCourseResourceBindings(courseId);
        for (String kpId : knowledgePointIds) {
            granularImportMapper.insertCourseKnowledgeBinding(UUID.randomUUID().toString(), tenantId, courseId, kpId);
        }
        for (String resId : resourceIds) {
            granularImportMapper.insertCourseResourceBinding(UUID.randomUUID().toString(), tenantId, courseId, resId);
        }
    }

    private String findOrCreateKnowledgePoint(String tenantId, String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        String id = granularImportMapper.selectKnowledgePointIdByName(tenantId, name);
        if (id != null && !id.isEmpty()) {
            return id;
        }
        id = UUID.randomUUID().toString();
        granularImportMapper.insertKnowledgePoint(id, tenantId, name, randomCode("KP"));
        String existing = granularImportMapper.selectKnowledgePointIdByName(tenantId, name);
        return existing != null && !existing.isEmpty() ? existing : id;
    }

    // 颗粒课编码：改由 importGranularCourses 循环内自增（codeSeq）生成，避免 MySQL 快照读重复；原 generateGranularCourseCode 已移除

    /** 资源按名称 find-or-create（按后缀推断类型，默认 other），对齐 Go FindOrCreateResources。 */
    private String findOrCreateResource(String tenantId, String name, String userId) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        String id = granularImportMapper.selectResourceIdByName(tenantId, name);
        if (id != null && !id.isEmpty()) {
            return id;
        }
        id = UUID.randomUUID().toString();
        granularImportMapper.insertResource(id, tenantId, name, resourceTypeByExt(name), userId);
        String existing = granularImportMapper.selectResourceIdByName(tenantId, name);
        return existing != null && !existing.isEmpty() ? existing : id;
    }

    private String resourceTypeByExt(String name) {
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            ext = name.substring(dot + 1).toLowerCase();
        }
        if (Set.of("pdf", "doc", "docx", "ppt", "pptx", "txt", "md", "xls", "xlsx", "csv").contains(ext)) {
            return "document";
        }
        if (Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg").contains(ext)) {
            return "image";
        }
        if (Set.of("mp3", "wav", "m4a", "flac").contains(ext)) {
            return "audio";
        }
        if (Set.of("mp4", "webm", "mov", "avi", "mkv").contains(ext)) {
            return "video";
        }
        if (Set.of("zip", "rar", "7z", "tar", "gz").contains(ext)) {
            return "archive";
        }
        return "other";
    }

    private double parseDoubleSafe(String s, double def) {
        if (s == null || s.isEmpty()) {
            return def;
        }
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    // ==================== 体系课 Excel 导入（对齐 Go course_import.go） ====================

    private Map<String, Object> importCourses(Workbook wb, String tenantId, String userId, boolean preview,
                                              boolean overwrite, boolean rename) {
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicateItems = new ArrayList<>();
        int created = 0, failed = 0, skipped = 0, duplicates = 0;
        Map<String, String> courseMap = new LinkedHashMap<>();

        // ---------- 课程基本信息 ----------
        List<List<String>> rows = readRows(wb, "课程基本信息");
        Map<String, String> abilityCache = new LinkedHashMap<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0).trim();
            if (name.isEmpty()) {
                continue;
            }
            String majorName = cell(row, 1);
            String courseIntro = cell(row, 2);
            String batchName = cell(row, 3);
            List<String> abilityPointNames = splitTrim(cell(row, 4), ",");

            String majorId = majorName.isEmpty() ? null : mapper.selectMajorIdByName(tenantId, majorName);
            String batchId = batchName.isEmpty() ? null : granularImportMapper.selectLessonBatchIdByName(tenantId, batchName);
            List<String> abilityPointIds = new ArrayList<>();
            for (String an : abilityPointNames) {
                String id = abilityCache.get(an);
                if (id == null) {
                    id = courseImportMapper.selectAbilityPointIdByName(tenantId, an);
                    abilityCache.put(an, id == null ? "" : id);
                }
                if (id != null && !id.isEmpty()) {
                    abilityPointIds.add(id);
                }
            }
            String description = courseIntro.isEmpty() ? null : courseIntro;

            Map<String, Object> ident = courseImportMapper.selectSystemCourseIdentity(tenantId, name);
            String existingId = ident == null ? null : str(ident.get("id"));
            String existingCreator = ident == null ? null : str(ident.get("creator_id"));
            String existingCoCreators = ident == null ? null : str(ident.get("co_creator_ids"));
            boolean exists = existingId != null && !existingId.isEmpty();

            String origName = "";
            if (exists) {
                if (preview) {
                    if (duplicateItems.size() < 100) {
                        duplicateItems.add(new ImportPreviewItem(i + 1, name, name));
                    }
                    duplicates++;
                    skipped++;
                    continue;
                }
                if (!overwrite && !rename) {
                    skipped++;
                    continue;
                }
                if (overwrite) {
                    if (!canOverwriteContent(existingCreator, parsePgArrayText(existingCoCreators), userId)) {
                        skipped++;
                        continue;
                    }
                    try {
                        courseImportMapper.updateSystemCourseOverwrite(existingId, tenantId, majorId, batchId,
                            description, toPgArray(abilityPointIds));
                        courseImportMapper.deleteNodeQuizzesByCourse(existingId);
                        courseImportMapper.deleteCourseNodes(existingId);
                    } catch (Exception e) {
                        failed++;
                        errors.add("课程[" + name + "]更新失败: " + e.getMessage());
                        continue;
                    }
                    courseMap.put(name, existingId);
                    continue;
                }
                origName = name;
                name = uniqueSuffixed(name, c -> courseImportMapper.selectSystemCourseIdByName(tenantId, c) != null);
            }

            if (preview) {
                created++;
                continue;
            }
            String courseId = UUID.randomUUID().toString();
            try {
                courseImportMapper.insertSystemCourse(courseId, tenantId, randomCode("XT"), name, majorId, description,
                    userId, batchId, toPgArray(abilityPointIds));
            } catch (Exception e) {
                failed++;
                errors.add("课程[" + name + "]创建失败: " + e.getMessage());
                continue;
            }
            courseMap.put(name, courseId);
            if (!origName.isEmpty()) {
                courseMap.put(origName, courseId);
            }
            created++;
        }

        // ---------- 节点配置 ----------
        if (!preview && !courseMap.isEmpty()) {
            importCourseNodes(wb, tenantId, userId, courseMap, errors);
        }

        if (preview) {
            return previewResult(created, duplicates, failed, duplicateItems, errors);
        }
        return executeResult(created, failed, skipped, "体系课", errors);
    }

    private void importCourseNodes(Workbook wb, String tenantId, String userId, Map<String, String> courseMap,
                                   List<String> errors) {
        List<List<String>> rows = readRows(wb, "节点配置");
        List<CourseNodeRow> pending = new ArrayList<>();
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String courseName = cell(row, 0).trim();
            String nodeName = cell(row, 1).trim();
            if (courseName.isEmpty() || nodeName.isEmpty()) {
                continue;
            }
            String courseId = courseMap.get(courseName);
            if (courseId == null) {
                continue;
            }
            pending.add(new CourseNodeRow(i + 1, courseName, nodeName, cell(row, 2).trim(),
                mapCourseRefType(cell(row, 3)), parseIntSafe(cell(row, 4), 0), nullableStr(cell(row, 5)),
                parseDoubleSafe(cell(row, 6), 0), parseIntSafe(cell(row, 7), 0), splitTrim(cell(row, 8), ","),
                splitTrim(cell(row, 9), ","), splitTrim(cell(row, 10).replace("，", ","), ","), courseId));
        }

        Map<String, Map<String, String>> nodeNameMap = new LinkedHashMap<>();
        while (!pending.isEmpty()) {
            boolean progressed = false;
            List<CourseNodeRow> remaining = new ArrayList<>();
            for (CourseNodeRow nr : pending) {
                nodeNameMap.computeIfAbsent(nr.courseName, k -> new LinkedHashMap<>());
                String parentId = null;
                if (!nr.parentName.isEmpty()) {
                    Map<String, String> m = nodeNameMap.get(nr.courseName);
                    if (m.containsKey(nr.parentName)) {
                        parentId = m.get(nr.parentName);
                    } else {
                        remaining.add(nr);
                        continue;
                    }
                }
                if (createSystemCourseNode(tenantId, userId, nr, parentId, nodeNameMap, errors)) {
                    progressed = true;
                }
            }
            if (!progressed) {
                for (CourseNodeRow nr : remaining) {
                    errors.add("节点[" + nr.courseName + "/" + nr.nodeName + "]父节点[" + nr.parentName + "]未找到或存在循环依赖,已跳过");
                }
                break;
            }
            pending = remaining;
        }
    }

    private boolean createSystemCourseNode(String tenantId, String userId, CourseNodeRow nr, String parentId,
                                           Map<String, Map<String, String>> nodeNameMap, List<String> errors) {
        String sourceId = null;
        String sourceName = null;
        String teachingGoals = nr.manualTeachingGoals;
        double duration = nr.manualDuration;
        int difficulty = nr.manualDifficulty;
        List<String> baseKnowledgeIds = List.of();
        List<String> baseResourceIds = List.of();

        if ("original".equals(nr.refType)) {
            Map<String, Object> g = courseImportMapper.selectGranularCourseByName(tenantId, nr.nodeName);
            if (g == null) {
                errors.add("节点[" + nr.courseName + "/" + nr.nodeName + "]未找到同名颗粒课,已跳过");
                return false;
            }
            sourceId = str(g.get("id"));
            sourceName = str(g.get("name"));
            if (teachingGoals == null || teachingGoals.isEmpty()) {
                teachingGoals = str(g.get("description"));
            }
            if (duration == 0 && g.get("online_hours") != null) {
                duration = Double.parseDouble(String.valueOf(g.get("online_hours")));
            }
            if (difficulty == 0 && g.get("difficulty") != null) {
                difficulty = Integer.parseInt(String.valueOf(g.get("difficulty")));
            }
            baseKnowledgeIds = courseImportMapper.selectGranularCourseKnowledgePointIds(sourceId);
            baseResourceIds = courseImportMapper.selectGranularCourseResourceIds(sourceId);
        }

        String nodeId = UUID.randomUUID().toString();
        try {
            courseImportMapper.insertCourseNode(nodeId, tenantId, nr.courseId, parentId, nr.nodeName, nr.sortOrder,
                nr.refType, sourceId, sourceName, teachingGoals, (int) duration, difficulty);
        } catch (Exception e) {
            errors.add("节点[" + nr.courseName + "/" + nr.nodeName + "]创建失败: " + e.getMessage());
            return false;
        }
        nodeNameMap.get(nr.courseName).put(nr.nodeName, nodeId);

        // 知识点（Excel 填写 + 颗粒课回退合并）
        List<String> knowledgePointIds = new ArrayList<>();
        for (String kn : nr.knowledgeNames) {
            String kpId = findOrCreateKnowledgePoint(tenantId, kn);
            if (kpId != null && !kpId.isEmpty()) {
                knowledgePointIds.add(kpId);
            }
        }
        for (String kpId : baseKnowledgeIds) {
            if (!knowledgePointIds.contains(kpId)) {
                knowledgePointIds.add(kpId);
            }
        }
        for (String kpId : knowledgePointIds) {
            courseImportMapper.insertNodeKnowledgeBinding(UUID.randomUUID().toString(), nodeId, kpId);
        }

        // 资源（Excel 填写 find-only + 颗粒课回退合并）
        List<String> resourceIds = new ArrayList<>();
        for (String rn : nr.resourceNames) {
            String rid = findOrCreateResource(tenantId, rn, userId);
            if (rid != null && !rid.isEmpty()) {
                resourceIds.add(rid);
            }
        }
        for (String rid : baseResourceIds) {
            if (!resourceIds.contains(rid)) {
                resourceIds.add(rid);
            }
        }
        for (String rid : resourceIds) {
            courseImportMapper.insertNodeResourceBinding(UUID.randomUUID().toString(), tenantId, nodeId, rid);
        }

        if (!knowledgePointIds.isEmpty() || !resourceIds.isEmpty()) {
            courseImportMapper.updateNodeBindingArrays(nodeId, toPgArray(knowledgePointIds), toPgArray(resourceIds));
        }

        for (String evalName : nr.evalMethodNames) {
            String methodKey = mapCourseEvalMethod(evalName);
            if (methodKey.isEmpty() || "homework".equals(methodKey)) {
                continue;
            }
            String title = "题库测验";
            if ("paper".equals(methodKey)) {
                title = "试卷测验";
            } else if ("quiz".equals(methodKey)) {
                title = "随堂测";
            }
            try {
                courseImportMapper.insertNodeQuiz(UUID.randomUUID().toString(), tenantId, nodeId, title, methodKey);
            } catch (Exception e) {
                errors.add("节点[" + nr.courseName + "/" + nr.nodeName + "]测评[" + evalName + "]创建失败: " + e.getMessage());
            }
        }
        return true;
    }

    private String mapCourseRefType(String t) {
        return "颗粒课".equals(t.trim()) ? "original" : "normal";
    }

    private String mapCourseEvalMethod(String t) {
        return switch (t.trim()) {
            case "题库" -> "question_bank";
            case "试卷" -> "paper";
            case "随堂测" -> "quiz";
            case "作业" -> "homework";
            default -> "";
        };
    }

    private record CourseNodeRow(int rowNum, String courseName, String nodeName, String parentName, String refType,
                                 int sortOrder, String manualTeachingGoals, double manualDuration, int manualDifficulty,
                                 List<String> knowledgeNames, List<String> resourceNames, List<String> evalMethodNames,
                                 String courseId) {
    }

    // ==================== 场景 Excel 导入（对齐 Go scenario_import.go） ====================

    private Map<String, Object> importScenarios(Workbook wb, String tenantId, String userId, boolean preview,
                                                boolean overwrite, boolean rename) {
        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicateItems = new ArrayList<>();
        int created = 0, failed = 0, skipped = 0, permissionSkipped = 0;
        int scenarioCreated = 0, taskCreated = 0;
        Map<String, String> scenarioMap = new LinkedHashMap<>();

        // ---------- 场景基本信息 ----------
        List<List<String>> rows = readRows(wb, "场景基本信息");
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String name = cell(row, 0).trim();
            if (name.isEmpty()) {
                continue;
            }
            String positionName = cell(row, 1);
            List<String> industryNames = splitTrim(cell(row, 2), ",");
            List<String> professionNames = splitTrim(cell(row, 3), ",");
            int difficulty = parseScenarioDifficulty(cell(row, 4));
            String background = nullableStr(cell(row, 5));
            String batchName = cell(row, 6);

            String careerPositionId = positionName.isEmpty() ? null
                : mapper.selectCareerPositionIdByName(tenantId, positionName);
            List<String> industryIds = new ArrayList<>();
            for (String in : industryNames) {
                String id = mapper.selectIndustryIdByName(tenantId, in);
                if (id != null && !id.isEmpty()) {
                    industryIds.add(id);
                }
            }
            List<String> professionIds = new ArrayList<>();
            for (String pn : professionNames) {
                String id = scenarioImportMapper.selectMajorIdByNameNfkc(tenantId, pn);
                if (id != null && !id.isEmpty()) {
                    professionIds.add(id);
                }
            }
            String batchId = batchName.isEmpty() ? null
                : scenarioImportMapper.selectSceneBatchIdByName(tenantId, batchName);

            Map<String, Object> ident = scenarioImportMapper.selectScenarioIdentity(tenantId, name);
            String existingId = ident == null ? null : str(ident.get("id"));
            String existingCreator = ident == null ? null : str(ident.get("creator_id"));
            String existingBuilders = ident == null ? null : str(ident.get("co_builder_ids"));
            boolean exists = existingId != null && !existingId.isEmpty();

            String origName = "";
            if (exists) {
                if (preview) {
                    if (duplicateItems.size() < 100) {
                        duplicateItems.add(new ImportPreviewItem(i + 1, name, name));
                    }
                    skipped++;
                    continue;
                }
                if (!overwrite && !rename) {
                    skipped++;
                    continue;
                }
                if (overwrite) {
                    if (!canOverwriteContent(existingCreator, parsePgArrayText(existingBuilders), userId)) {
                        permissionSkipped++;
                        continue;
                    }
                    try {
                        scenarioImportMapper.updateScenarioImport(existingId, tenantId, name, careerPositionId,
                            industryIds, professionIds, batchId, difficulty, background);
                        scenarioImportMapper.deleteTaskEvalMethodsByScenario(existingId);
                        scenarioImportMapper.deleteScenarioTasks(existingId);
                    } catch (Exception e) {
                        failed++;
                        errors.add("场景[" + name + "]更新失败: " + e.getMessage());
                        continue;
                    }
                    scenarioMap.put(name, existingId);
                    continue;
                }
                origName = name;
                name = uniqueSuffixed(name, c -> scenarioImportMapper.selectScenarioIdByName(tenantId, c) != null);
            }

            if (preview) {
                created++;
                continue;
            }

            String scenarioId = UUID.randomUUID().toString();
            String code = randomCode("CJ");
            try {
                scenarioImportMapper.insertScenario(scenarioId, tenantId, name, code, careerPositionId, industryIds,
                    professionIds, batchId, difficulty, background, userId);
            } catch (Exception e) {
                failed++;
                errors.add("场景[" + name + "]创建失败: " + e.getMessage());
                continue;
            }
            scenarioMap.put(name, scenarioId);
            if (!origName.isEmpty()) {
                scenarioMap.put(origName, scenarioId);
            }
            scenarioCreated++;
            created++;
        }

        // ---------- 任务配置（preview 不解析） ----------
        if (!preview && !scenarioMap.isEmpty()) {
            Map<String, Integer> taskCounter = new LinkedHashMap<>();
            List<List<String>> taskRows = readRows(wb, "任务配置");
            for (int i = 2; i < taskRows.size(); i++) {
                List<String> row = taskRows.get(i);
                String scenarioName = cell(row, 0).trim();
                String taskName = cell(row, 1).trim();
                if (scenarioName.isEmpty() || taskName.isEmpty()) {
                    continue;
                }
                String scenarioId = scenarioMap.get(scenarioName);
                if (scenarioId == null) {
                    skipped++;
                    errors.add("任务[" + scenarioName + "/" + taskName + "]找不到场景,已跳过");
                    continue;
                }
                String taskType = mapScenarioTaskType(cell(row, 2));
                int difficulty = parseScenarioDifficulty(cell(row, 3));
                BigDecimal estimatedHours = BigDecimal.valueOf(parseDoubleSafe(cell(row, 4), 0));
                String background = nullableStr(cell(row, 5));
                String detailedDescription = nullableStr(cell(row, 6));
                List<String> knowledgeNames = splitTrim(cell(row, 7), ",");
                List<String> abilityNames = splitTrim(cell(row, 8), ",");
                List<String> resourceNames = splitTrim(cell(row, 9), ",");
                List<String> evalMethodNames = splitTrim(cell(row, 10), ",");

                int seq = taskCounter.merge(scenarioId, 1, Integer::sum);
                String taskCode = "TSK-" + scenarioId.substring(0, 8) + "-" + String.format("%03d", seq);

                List<String> knowledgePointIds = new ArrayList<>();
                for (String kn : knowledgeNames) {
                    String kpId = findOrCreateKnowledgePoint(tenantId, kn);
                    if (kpId != null && !kpId.isEmpty()) {
                        knowledgePointIds.add(kpId);
                    }
                }
                List<String> abilityPointIds = new ArrayList<>();
                for (String an : abilityNames) {
                    String aid = positionImportMapper.findAbilityPointId(tenantId, an);
                    if (aid != null && !aid.isEmpty()) {
                        abilityPointIds.add(aid);
                    }
                }
                List<String> resourceIds = new ArrayList<>();
                for (String rn : resourceNames) {
                    String rid = findOrCreateScenarioResource(tenantId, rn, userId);
                    if (rid != null && !rid.isEmpty()) {
                        resourceIds.add(rid);
                    }
                }

                String taskId = UUID.randomUUID().toString();
                try {
                    scenarioImportMapper.insertScenarioTask(taskId, tenantId, scenarioId, taskName, taskCode, seq,
                        background, detailedDescription, estimatedHours, taskType, difficulty,
                        knowledgePointIds, abilityPointIds, resourceIds);
                } catch (Exception e) {
                    failed++;
                    errors.add("任务[" + scenarioName + "/" + taskName + "]创建失败: " + e.getMessage());
                    continue;
                }
                taskCreated++;
                created++;

                if (!evalMethodNames.isEmpty()) {
                    List<String> validMethods = new ArrayList<>();
                    for (String en : evalMethodNames) {
                        String mk = mapScenarioEvalMethod(en);
                        if (!mk.isEmpty()) {
                            validMethods.add(mk);
                        }
                    }
                    if (validMethods.isEmpty()) {
                        errors.add("任务[" + scenarioName + "/" + taskName + "]测评方式均未识别，跳过写入");
                        continue;
                    }
                    BigDecimal weight = BigDecimal.valueOf(100.0 / validMethods.size());
                    for (String mk : validMethods) {
                        try {
                            scenarioImportMapper.upsertTaskEvalMethod(UUID.randomUUID().toString(), tenantId, taskId,
                                mk, weight);
                        } catch (Exception e) {
                            errors.add("任务[" + scenarioName + "/" + taskName + "]测评方式[" + mk + "]写入失败: "
                                + e.getMessage());
                        }
                    }
                }
            }
        }

        if (preview) {
            return previewResult(created, duplicateItems.size(), failed, duplicateItems, errors);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("failed", failed);
        m.put("skipped", skipped);
        m.put("permissionSkipped", permissionSkipped);
        m.put("entity", "场景");
        m.put("scenarioCreated", scenarioCreated);
        m.put("taskCreated", taskCreated);
        m.put("errors", errors);
        m.put("sheets", sheetNames(wb));
        return m;
    }

    private String mapScenarioTaskType(String t) {
        String v = t.trim();
        return switch (v) {
            case "考核" -> "assessment";
            case "训练" -> "training";
            default -> ("assessment".equals(v) || "training".equals(v)) ? v : "assessment";
        };
    }

    private int parseScenarioDifficulty(String s) {
        String t = s == null ? "" : s.trim();
        if (t.isEmpty()) {
            return 1;
        }
        int v;
        try {
            v = Integer.parseInt(t);
        } catch (NumberFormatException e) {
            return 1;
        }
        return (v < 1 || v > 5) ? 1 : v;
    }

    private String mapScenarioEvalMethod(String t) {
        return switch (t.trim()) {
            case "题库" -> "question_bank";
            case "试卷" -> "paper";
            case "随堂测" -> "quiz";
            case "现场问答" -> "random_draw";
            case "现场评审" -> "review";
            case "成果评价" -> "outcome";
            case "作业" -> "homework";
            default -> "";
        };
    }

    private String findOrCreateScenarioResource(String tenantId, String name, String userId) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        String id = granularImportMapper.selectResourceIdByName(tenantId, name);
        if (id != null && !id.isEmpty()) {
            return id;
        }
        id = UUID.randomUUID().toString();
        granularImportMapper.insertResource(id, tenantId, name, scenarioResourceTypeByExt(name), userId);
        String existing = granularImportMapper.selectResourceIdByName(tenantId, name);
        return existing != null && !existing.isEmpty() ? existing : id;
    }

    /** 资源按后缀推断类型（对齐 Go ResourceTypeByExt 完整清单），无法识别归入 other。 */
    private String scenarioResourceTypeByExt(String name) {
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            ext = name.substring(dot + 1).toLowerCase();
        }
        if (Set.of("pdf", "doc", "docx", "docm", "dot", "dotx", "dotm", "wps", "wpt", "rtf", "odt", "ott",
            "fodt", "pages", "ppt", "pptx", "dps", "odp", "otp", "sxi", "vsd", "vsdx", "txt", "md", "log",
            "json", "properties", "yaml", "yml", "gitignore", "xml", "xbrl", "html", "htm", "java", "py", "c",
            "cpp", "h", "php", "go", "js", "css", "lua", "sh", "rb", "sql", "bat", "m", "bas", "prg", "cmd",
            "cs", "ftl", "asp", "jsp", "aspx", "ofd", "epub", "eml", "xmind", "drawio", "bpmn", "dcm", "dwg",
            "dxf", "dwf", "dwfx", "dwt", "dng", "cf2", "plt", "stl", "obj", "3ds", "ply", "off", "3dm", "fbx",
            "dae", "wrl", "3mf", "glb", "gltf", "o3dv", "stp", "step", "iges", "igs", "brep", "bim", "fcstd",
            "ifc").contains(ext)) {
            return "document";
        }
        if (Set.of("xls", "xlsx", "xlsm", "xlt", "xltx", "xltm", "xlam", "xla", "et", "ett", "ods", "ots",
            "csv", "tsv").contains(ext)) {
            return "spreadsheet";
        }
        if (Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp", "ico", "jfif", "svg", "tif", "tiff", "tga",
            "psd", "eps", "wmf", "emf").contains(ext)) {
            return "image";
        }
        if (Set.of("mp3", "wav", "m4a", "flac", "aac", "ogg").contains(ext)) {
            return "audio";
        }
        if (Set.of("mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "mpeg", "3gp", "rm", "mpd", "m3u8",
            "ts").contains(ext)) {
            return "video";
        }
        if (Set.of("zip", "rar", "7z", "tar", "gz", "bz2", "jar", "gzip").contains(ext)) {
            return "archive";
        }
        if (Set.of("exe", "dmg", "pkg", "deb", "rpm", "msi", "apk").contains(ext)) {
            return "software";
        }
        return "other";
    }

    // ==================== 题目 Excel 导入（对齐 Go question_import.go） ====================

    private Map<String, Object> importQuestions(Workbook wb, String tenantId, String userId, String bankId,
                                                boolean preview, boolean overwrite, boolean rename) {
        if (bankId == null || bankId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        if (questionImportMapper.selectQuestionBankIdScoped(bankId, tenantId) == null) {
            throw new ApiException(400, "bad_request", "题库不存在");
        }

        List<String> errors = new ArrayList<>();
        List<ImportPreviewItem> duplicateItems = new ArrayList<>();
        int created = 0, failed = 0, skipped = 0, permissionSkipped = 0, duplicates = 0;
        Set<String> seen = new java.util.HashSet<>();

        List<List<String>> rows = readRows(wb, "题目明细");
        for (int i = 2; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String typeRaw = cell(row, 0).trim();
            String content = cell(row, 1).trim();
            if (typeRaw.isEmpty() || content.isEmpty()) {
                continue;
            }
            String qType = mapQuestionType(typeRaw);
            if (qType.isEmpty()) {
                failed++;
                errors.add("第" + (i + 1) + "行题型无法识别: \"" + typeRaw + "\"");
                continue;
            }

            List<String> options = new ArrayList<>();
            for (int idx = 2; idx <= 5; idx++) {
                String opt = cell(row, idx).trim();
                if (!opt.isEmpty()) {
                    options.add(opt);
                }
            }
            for (int idx = 12; idx <= 15; idx++) {
                String opt = cell(row, idx).trim();
                if (!opt.isEmpty()) {
                    options.add(opt);
                }
            }
            String answerRaw = cell(row, 6);
            String analysis = nullableStr(cell(row, 7));
            String difficulty = mapQuestionDifficulty(cell(row, 8));
            List<String> knowledgeNames = splitTrim(cell(row, 9), ",");
            BigDecimal score = BigDecimal.valueOf(parseDoubleSafe(cell(row, 10), 0));
            String source = cell(row, 11).trim();
            if (source.isEmpty()) {
                source = "Excel导入";
            }

            List<String> answer = buildQuestionAnswer(qType, answerRaw, options);
            String answerJson = jsonArray(answer);
            String optionsJson = jsonArray(options);

            String key = bankId + "|" + content;
            if (!seen.add(key)) {
                if (preview) {
                    duplicates++;
                    if (duplicateItems.size() < 100) {
                        duplicateItems.add(new ImportPreviewItem(i + 1, content, content));
                    }
                } else {
                    skipped++;
                }
                continue;
            }

            Map<String, Object> ident = questionImportMapper.selectQuestionIdentity(tenantId, bankId, content);
            String existingId = ident == null ? null : str(ident.get("id"));
            String existingCreator = ident == null ? null : str(ident.get("creator_id"));
            boolean found = existingId != null && !existingId.isEmpty();

            if (preview) {
                if (found) {
                    duplicates++;
                    if (duplicateItems.size() < 100) {
                        duplicateItems.add(new ImportPreviewItem(i + 1, content, content));
                    }
                } else {
                    created++;
                }
                continue;
            }

            if (found) {
                if (overwrite) {
                    if (!canOverwriteContent(existingCreator, List.of(), userId)) {
                        permissionSkipped++;
                        continue;
                    }
                    List<String> knowledgePointIds = new ArrayList<>();
                    for (String kn : knowledgeNames) {
                        String kpId = findOrCreateKnowledgePoint(tenantId, kn);
                        if (kpId != null && !kpId.isEmpty()) {
                            knowledgePointIds.add(kpId);
                        }
                    }
                    try {
                        questionImportMapper.updateQuestionImport(existingId, tenantId, qType, optionsJson, answerJson,
                            analysis, score, difficulty, knowledgePointIds);
                    } catch (Exception e) {
                        failed++;
                        errors.add("第" + (i + 1) + "行题目更新失败: " + e.getMessage());
                        continue;
                    }
                    created++;
                    continue;
                }
                if (rename) {
                    content = uniqueSuffixed(content,
                        c -> questionImportMapper.selectQuestionIdByContent(tenantId, bankId, c) != null);
                } else {
                    skipped++;
                    continue;
                }
            }

            List<String> knowledgePointIds = new ArrayList<>();
            for (String kn : knowledgeNames) {
                String kpId = findOrCreateKnowledgePoint(tenantId, kn);
                if (kpId != null && !kpId.isEmpty()) {
                    knowledgePointIds.add(kpId);
                }
            }
            String questionId = UUID.randomUUID().toString();
            String code = randomCode("TM");
            try {
                questionImportMapper.insertQuestionImport(questionId, tenantId, code, bankId, qType, content,
                    optionsJson, answerJson, analysis, score, difficulty, knowledgePointIds, userId, source);
            } catch (Exception e) {
                failed++;
                errors.add("第" + (i + 1) + "行题目创建失败: " + e.getMessage());
                continue;
            }
            created++;
        }

        if (preview) {
            return previewResult(created, duplicates, failed, duplicateItems, errors);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("failed", failed);
        m.put("skipped", skipped);
        m.put("permissionSkipped", permissionSkipped);
        m.put("entity", "题目");
        m.put("errors", errors);
        return m;
    }

    private String mapQuestionType(String t) {
        String v = t.trim();
        String mapped = switch (v) {
            case "单选题" -> "single";
            case "多选题" -> "multiple";
            case "判断题" -> "judge";
            case "填空题" -> "fill";
            case "问答题" -> "essay";
            case "简答题" -> "short_answer";
            default -> "";
        };
        if (!mapped.isEmpty()) {
            return mapped;
        }
        String lower = v.toLowerCase();
        return switch (lower) {
            case "single", "multiple", "judge", "fill", "essay", "short_answer" -> lower;
            default -> "";
        };
    }

    private String mapQuestionDifficulty(String d) {
        return switch (d.trim()) {
            case "简单", "easy" -> "easy";
            case "中等", "medium" -> "medium";
            case "困难", "hard" -> "hard";
            default -> null;
        };
    }

    private List<String> buildQuestionAnswer(String qType, String answerRaw, List<String> options) {
        String a = answerRaw.trim();
        if (a.isEmpty()) {
            return List.of();
        }
        return switch (qType) {
            case "single" -> {
                String ans = mapOptionLetter(a, options);
                yield List.of(ans.isEmpty() ? a : ans);
            }
            case "multiple" -> {
                List<String> result = new ArrayList<>();
                for (String p : splitTrim(a, ",")) {
                    String mapped = mapOptionLetter(p, options);
                    result.add(mapped.isEmpty() ? p : mapped);
                }
                yield result.isEmpty() ? List.of(a) : result;
            }
            case "judge" -> {
                String lower = a.toLowerCase();
                yield switch (lower) {
                    case "正确", "对", "true", "1", "是" -> List.of("true");
                    case "错误", "错", "false", "0", "否" -> List.of("false");
                    default -> List.of(a);
                };
            }
            case "fill" -> splitTrim(a, ",");
            default -> List.of(a);
        };
    }

    private String mapOptionLetter(String val, List<String> options) {
        String v = val.trim();
        if (v.length() != 1) {
            return "";
        }
        int idx = switch (v) {
            case "A", "a" -> 0;
            case "B", "b" -> 1;
            case "C", "c" -> 2;
            case "D", "d" -> 3;
            default -> -1;
        };
        return idx >= 0 && idx < options.size() ? options.get(idx) : "";
    }

    private String jsonArray(List<String> list) {
        try {
            return JSON_MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> sheetNames(Workbook wb) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < wb.getNumberOfSheets(); i++) {
            out.add(wb.getSheetName(i));
        }
        return out;
    }

    private Map<String, Object> affairsConfigImport(Workbook wb, String tenantId, boolean preview) {
        if (preview) {
            // affairs-config 仅 excel 路径（无 preview），此处兜底返回空
            return previewResult(0, 0, 0, List.of(), List.of());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        int termsCreated = 0, termsSkipped = 0, termsFailed = 0;
        int venuesCreated = 0, venuesSkipped = 0, venuesFailed = 0;
        int slotsCreated = 0, slotsSkipped = 0, slotsFailed = 0;

        // 学期
        List<List<String>> termRows = readRows(wb, "学期");
        for (int i = 2; i < termRows.size(); i++) {
            List<String> row = termRows.get(i);
            String name = cell(row, 0).trim();
            LocalDate startDate = parseDateLenient(cell(row, 1));
            LocalDate endDate = parseDateLenient(cell(row, 2));
            String weeksStr = cell(row, 3).trim();
            if (name.isEmpty() || startDate == null || endDate == null) {
                termsSkipped++;
                continue;
            }
            int weeks = parseIntSafe(weeksStr, 16);
            try {
                if (termMapper.selectIdByName(tenantId, name) != null) {
                    termsSkipped++;
                } else {
                    termMapper.insertTerm(UUID.randomUUID().toString(), tenantId, name, startDate, endDate, weeks);
                    termsCreated++;
                }
            } catch (Exception e) {
                termsFailed++;
            }
        }
        result.put("termsCreated", termsCreated);
        result.put("termsSkipped", termsSkipped);
        result.put("termsFailed", termsFailed);

        // 场地
        List<List<String>> venueRows = readRows(wb, "场地");
        for (int i = 2; i < venueRows.size(); i++) {
            List<String> row = venueRows.get(i);
            String name = cell(row, 0).trim();
            String type = cell(row, 1).trim();
            String capacityStr = cell(row, 2).trim();
            if (name.isEmpty() || type.isEmpty()) {
                venuesSkipped++;
                continue;
            }
            int capacity = parseIntSafe(capacityStr, 0);
            Integer cap = capacity > 0 ? capacity : null;
            try {
                if (venueMapper.selectIdByName(tenantId, name) != null) {
                    venuesSkipped++;
                } else {
                    venueMapper.insertVenue(UUID.randomUUID().toString(), tenantId, name, type, cap);
                    venuesCreated++;
                }
            } catch (Exception e) {
                venuesFailed++;
            }
        }
        result.put("venuesCreated", venuesCreated);
        result.put("venuesSkipped", venuesSkipped);
        result.put("venuesFailed", venuesFailed);

        // 节次
        List<List<String>> slotRows = readRows(wb, "节次");
        for (int i = 2; i < slotRows.size(); i++) {
            List<String> row = slotRows.get(i);
            String name = cell(row, 0).trim();
            String startTimeStr = cell(row, 1).trim();
            String endTimeStr = cell(row, 2).trim();
            String sortStr = cell(row, 3).trim();
            if (name.isEmpty()) {
                slotsSkipped++;
                continue;
            }
            int sortOrder = parseIntSafe(sortStr, 0);
            String slotType = parseSlotTypeName(cell(row, 4));
            if (slotType == null) {
                slotType = "morning";
                if (sortOrder >= 4 && sortOrder < 8) {
                    slotType = "afternoon";
                } else if (sortOrder >= 8) {
                    slotType = "evening";
                }
            }
            LocalTime startTime = parseTimeLenient(startTimeStr);
            LocalTime endTime = parseTimeLenient(endTimeStr);
            try {
                if (periodSlotMapper.selectIdByName(tenantId, name) != null) {
                    slotsSkipped++;
                } else {
                    periodSlotMapper.insertPeriodSlot(UUID.randomUUID().toString(), tenantId, name, slotType,
                        startTime, endTime, sortOrder);
                    slotsCreated++;
                }
            } catch (Exception e) {
                slotsFailed++;
            }
        }
        result.put("periodSlotsCreated", slotsCreated);
        result.put("periodSlotsSkipped", slotsSkipped);
        result.put("periodSlotsFailed", slotsFailed);

        int totalCreated = termsCreated + venuesCreated + slotsCreated;
        int totalFailed = termsFailed + venuesFailed + slotsFailed;
        result.put("created", totalCreated);
        result.put("failed", totalFailed);
        result.put("skipped", termsSkipped + venuesSkipped + slotsSkipped);
        result.put("permissionSkipped", 0);
        result.put("errors", List.of());
        return result;
    }

    /** 时段类型中文名 → 英文 code（对齐 Go parseSlotTypeName）。 */
    private String parseSlotTypeName(String s) {
        return switch (s.trim()) {
            case "早自习" -> "morning_self";
            case "上午" -> "morning";
            case "下午" -> "afternoon";
            case "晚自习" -> "evening";
            default -> null;
        };
    }

    private int parseIntSafe(String s, int def) {
        if (s == null || s.isEmpty()) {
            return def;
        }
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private LocalDate parseDateLenient(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        if (t.isEmpty()) {
            return null;
        }
        for (DateTimeFormatter f : new DateTimeFormatter[]{
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("yyyy/M/d"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy年M月d日"),
            // POI DataFormatter 对日期数字单元格默认输出短格式 M/d/yy（如 9/1/25），
            // 缺失时学期等日期列全部解析失败被跳过（教务配置导入实测）
            DateTimeFormatter.ofPattern("M/d/yy"),
            DateTimeFormatter.ofPattern("M/d/yyyy")
        }) {
            try {
                return LocalDate.parse(t, f);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        // Excel 日期序列号（1899-12-30 起）
        try {
            double serial = Double.parseDouble(t);
            return LocalDate.of(1899, 12, 30).plusDays((long) serial);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private LocalTime parseTimeLenient(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        if (t.isEmpty()) {
            return null;
        }
        for (DateTimeFormatter f : new DateTimeFormatter[]{
            DateTimeFormatter.ISO_LOCAL_TIME,
            DateTimeFormatter.ofPattern("H:mm"),
            DateTimeFormatter.ofPattern("HH:mm"),
            DateTimeFormatter.ofPattern("H:mm:ss")
        }) {
            try {
                return LocalTime.parse(t, f);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return null;
    }

    // ==================== 通用 CSV 持久化 ====================

    private String findExistingId(String entity, String tenantId, String keyCol, String key) {
        return switch (entity) {
            case "question_banks" -> mapper.selectQuestionBankIdByName(tenantId, key);
            case "exams" -> mapper.selectExamIdByName(tenantId, key);
            case "courses" -> mapper.selectCourseIdByCode(tenantId, key);
            case "career_positions" -> mapper.selectCareerPositionIdByName(tenantId, key);
            case "scenarios" -> mapper.selectScenarioIdByName(tenantId, key);
            default -> null;
        };
    }

    private void insertGeneric(String entity, String tenantId, String userId, String name, String code) {
        String id = UUID.randomUUID().toString();
        switch (entity) {
            case "question_banks" -> mapper.insertQuestionBank(id, tenantId, name, null, userId, randomCode("TK"));
            case "exams" -> mapper.insertExam(id, tenantId, name, null, userId, randomCode("SJ"));
            case "courses" -> mapper.insertCourse(id, tenantId, code, name, userId);
            case "career_positions" -> mapper.insertCareerPosition(id, tenantId, name, null, userId);
            case "scenarios" -> mapper.insertScenario(id, tenantId, name, code, userId);
            default -> throw new ApiException(400, "bad_request", "不支持的实体");
        }
    }

    private void updateGeneric(String entity, String existingId, String name, String code) {
        switch (entity) {
            case "question_banks" -> mapper.updateQuestionBankName(existingId, name);
            case "exams" -> mapper.updateExamName(existingId, name);
            case "courses" -> mapper.updateCourseName(existingId, name, code);
            case "career_positions" -> mapper.updateCareerPositionName(existingId, name);
            case "scenarios" -> mapper.updateScenarioName(existingId, name, code);
            default -> throw new ApiException(400, "bad_request", "不支持的实体");
        }
    }

    private String displayName(String entity) {
        return switch (entity) {
            case "question_banks" -> "题库";
            case "exams" -> "试卷";
            case "courses" -> "课程";
            case "career_positions" -> "岗位";
            case "scenarios" -> "场景";
            default -> entity;
        };
    }

    // ==================== 工具 ====================

    private Map<String, Object> previewResult(int created, int duplicates, int failed,
                                              List<ImportPreviewItem> duplicateItems, List<String> errors) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("duplicates", duplicates);
        m.put("failed", failed);
        m.put("duplicateItems", duplicateItems);
        m.put("errors", errors);
        return m;
    }

    private Map<String, Object> executeResult(int created, int failed, int skipped, String entity, List<String> errors) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("created", created);
        m.put("failed", failed);
        m.put("skipped", skipped);
        m.put("permissionSkipped", 0);
        m.put("entity", entity);
        m.put("errors", errors);
        return m;
    }

    private List<List<String>> readRows(Workbook wb, String sheetName) {
        Sheet sheet = wb.getSheet(sheetName);
        if (sheet == null) {
            return List.of();
        }
        DataFormatter fmt = new DataFormatter();
        List<List<String>> rows = new ArrayList<>();
        for (Row r : sheet) {
            List<String> row = new ArrayList<>();
            int last = r.getLastCellNum() < 0 ? 0 : r.getLastCellNum();
            for (int c = 0; c < last; c++) {
                Cell cell = r.getCell(c);
                row.add(cell == null ? "" : fmt.formatCellValue(cell).trim());
            }
            rows.add(row);
        }
        return rows;
    }

    private String cell(List<String> row, int idx) {
        return idx < row.size() ? row.get(idx) : "";
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private static String csvCell(String v) {
        if (v == null) {
            return "";
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static boolean parseImportBool(String s) {
        String v = s == null ? "" : s.trim().toLowerCase();
        return switch (v) {
            case "是", "true", "1", "yes", "y", "t" -> true;
            default -> false;
        };
    }

    private static boolean parseBoolDefault(String s, boolean def) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return def;
        }
        return parseImportBool(v);
    }

    private static int parseIntDefault(String s, int def) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return def;
        }
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static LocalDate parseDateOrNull(String s) {
        String v = s == null ? "" : s.trim();
        if (v.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(v);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String mapProjectPhase(String v) {
        return mapDict(v, "启动", "initiation", "发起", "initiation", "执行中", "execution", "执行", "execution",
            "验收", "acceptance", "关闭", "closure", "已归档", "archived", "归档", "archived",
            "已终止", "terminated", "终止", "terminated", "initiation");
    }

    private static String mapPublishStatus(String v) {
        return mapDict(v, "草稿", "draft", "已发布", "published", "发布", "published", "已归档", "archived", "归档", "archived", "draft");
    }

    private static String mapAchievementType(String v) {
        return mapDict(v, "岗位成果", "job", "岗位", "job", "场景成果", "scene", "场景", "scene",
            "课程成果", "course", "课程", "course", "自定义成果", "custom", "自定义", "custom", "其他", "custom", "custom");
    }

    private static String mapAgreementStatus(String v) {
        return mapDict(v, "草稿", "draft", "生效中", "active", "生效", "active", "有效", "active",
            "已失效", "expired", "失效", "expired", "已过期", "expired", "过期", "expired",
            "已续签", "renewed", "续签", "renewed", "已终止", "terminated", "终止", "terminated", "draft");
    }

    private static String mapAccountType(String v) {
        return mapDict(v, "企业账号", "enterprise", "企业", "enterprise", "专家账号", "expert", "专家", "expert", "enterprise");
    }

    private static String mapBrandType(String v) {
        return mapDict(v, "人才品牌", "talent", "人才", "talent", "雇主品牌", "employer", "雇主", "employer",
            "岗位品牌", "job", "岗位", "job", "专业品牌", "major", "专业", "major",
            "师资品牌", "teacher", "教师", "teacher", "师资", "teacher", "文化品牌", "culture", "文化", "culture", "");
    }

    private static String mapDict(String v, String... pairs) {
        String value = v == null ? "" : v.trim();
        if (value.isEmpty()) {
            return pairs.length > 0 ? pairs[pairs.length - 1] : "";
        }
        for (int i = 0; i + 1 < pairs.length - 1; i += 2) {
            if (value.equals(pairs[i])) {
                return pairs[i + 1];
            }
        }
        return value;
    }

    private static String mapUserStatus(String v, String def) {
        String s = v == null ? "" : v.trim();
        if (s.isEmpty()) {
            return def;
        }
        return switch (s) {
            case "正常" -> "active";
            case "禁用" -> "disabled";
            case "毕业" -> "graduated";
            default -> s;
        };
    }

    private static boolean isValidPassword(String p) {
        if (p == null || p.length() < 8) {
            return false;
        }
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : p.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }
        return hasLetter && hasDigit;
    }

    private static String suffix() {
        return "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private List<String[]> namesToStrings(List<String> names) {
        List<String[]> out = new ArrayList<>();
        for (String n : names) {
            out.add(new String[]{n});
        }
        return out;
    }

    private List<String[]> mapToStrings(List<Map<String, Object>> rows, String colA, String colB) {
        List<String[]> out = new ArrayList<>();
        for (Map<String, Object> m : rows) {
            out.add(new String[]{str(m.get(colA)), str(m.get(colB))});
        }
        return out;
    }

    private byte[] toBytes(Workbook wb) throws Exception {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.write(out);
            return out.toByteArray();
        }
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    // ---------- POI 样式与写入辅助 ----------

    private void writeNote(Sheet sheet, String note, int cols, Styles st) {
        Row r = sheet.createRow(0);
        r.createCell(0).setCellValue(note);
        if (cols > 1) {
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, cols - 1));
        }
        r.getCell(0).setCellStyle(st.note);
        r.setHeightInPoints((countLines(note) + 2) * 16f);
    }

    private void writeHeaders(Sheet sheet, String[] headers, int[] widths, Styles st) {
        Row r = sheet.createRow(1);
        for (int i = 0; i < headers.length; i++) {
            Cell c = r.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(st.header);
            sheet.setColumnWidth(i, widths[i] * 256);
        }
        r.setHeightInPoints(28);
        sheet.createFreezePane(0, 2);
    }

    private void addRefSheet(Workbook wb, Styles st, String name, String[] headers, int[] widths, String note,
                             List<String[]> data) {
        Sheet s = wb.createSheet(name);
        writeNote(s, note, headers.length, st);
        writeHeaders(s, headers, widths, st);
        for (int i = 0; i < data.size(); i++) {
            Row r = s.createRow(2 + i);
            String[] vals = data.get(i);
            for (int c = 0; c < vals.length; c++) {
                r.createCell(c).setCellValue(vals[c] == null ? "" : vals[c]);
                r.getCell(c).setCellStyle(st.data);
            }
            r.setHeightInPoints(24);
        }
    }

    private static int countLines(String s) {
        int n = 1;
        for (char c : s.toCharArray()) {
            if (c == '\n') {
                n++;
            }
        }
        return n;
    }

    /** 每工作簿复用的三种样式（表头/说明/数据），对齐 Go makeHeaderStyle/makeNoteStyle/makeDataStyle。 */
    private static final class Styles {
        final CellStyle header;
        final CellStyle note;
        final CellStyle data;

        Styles(Workbook wb) {
            header = wb.createCellStyle();
            Font hf = wb.createFont();
            hf.setBold(true);
            hf.setFontHeightInPoints((short) 11);
            hf.setColor(IndexedColors.WHITE.getIndex());
            header.setFont(hf);
            header.setFillForegroundColor(IndexedColors.BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            header.setWrapText(true);
            border(header);

            note = wb.createCellStyle();
            Font nf = wb.createFont();
            nf.setFontHeightInPoints((short) 10);
            nf.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            nf.setItalic(true);
            note.setFont(nf);
            note.setWrapText(true);
            note.setVerticalAlignment(VerticalAlignment.TOP);

            data = wb.createCellStyle();
            border(data);
            data.setWrapText(true);
            data.setVerticalAlignment(VerticalAlignment.TOP);
        }

        private static void border(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
