package org.dromara.zhiyu.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.affairs.TrainingProgramCourse;
import org.dromara.zhiyu.mapper.affairs.AffairsScheduleImportMapper;
import org.dromara.zhiyu.mapper.affairs.PeriodSlotMapper;
import org.dromara.zhiyu.mapper.affairs.TermMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramCourseMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramMapper;
import org.dromara.zhiyu.mapper.affairs.VenueMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceBrandMapper;
import org.dromara.zhiyu.mapper.alliance.AllianceExpertMapper;
import org.dromara.zhiyu.mapper.importexport.ImportExportMapper;
import org.dromara.zhiyu.mapper.importexport.QuestionImportMapper;
import org.dromara.zhiyu.mapper.importexport.ScenarioImportMapper;
import org.dromara.zhiyu.mapper.job.JobPositionImportMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseImportMapper;
import org.dromara.zhiyu.mapper.lesson.LessonGranularCourseImportMapper;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.service.impl.importexport.ImportExportServiceImpl;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 方案课程导入跨租户 IDOR 回归测试：programId 不属于当前租户时必须拒绝，
 * 且不得执行 deleteByProgram 全量删除（对齐排课导入的 termExists 租户校验）。
 *
 * @author zhiyu
 */
@Tag("local")
class ImportExportProgramCoursesTest {

    private static final String TENANT_A = "tenant-a";
    private static final String PROGRAM_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
    private static final String PROGRAM_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
    private static final String ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0";

    private SystemRoleMapper roleMapper;
    private TrainingProgramCourseMapper programCourseMapper;
    private TrainingProgramMapper programMapper;
    private ImportExportServiceImpl service;

    @BeforeEach
    void setUp() {
        roleMapper = mock(SystemRoleMapper.class);
        programCourseMapper = mock(TrainingProgramCourseMapper.class);
        programMapper = mock(TrainingProgramMapper.class);
        when(roleMapper.selectRoleCodesByUser(ADMIN)).thenReturn(List.of("school_admin"));
        SystemGuard guard = new SystemGuard(roleMapper);
        service = new ImportExportServiceImpl(
            guard, mock(ImportExportMapper.class), mock(ScenarioImportMapper.class),
            mock(QuestionImportMapper.class), mock(JobPositionImportMapper.class),
            mock(AffairsScheduleImportMapper.class), mock(LessonGranularCourseImportMapper.class),
            mock(LessonCourseImportMapper.class), programCourseMapper, programMapper,
            mock(TermMapper.class), mock(VenueMapper.class), mock(PeriodSlotMapper.class),
            mock(AllianceBrandMapper.class), mock(AllianceExpertMapper.class));
        TenantContext.set(ADMIN, TENANT_A, "admin", "saas");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private MockMultipartFile emptyExcel() throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.createSheet("导入"); // 无数据行，走空列表路径直达方案归属校验
            wb.write(out);
            return new MockMultipartFile("file", "program.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                out.toByteArray());
        }
    }

    @Test
    @DisplayName("他租户 programId：拒绝导入且不执行全量删除")
    void foreignProgramIdIsRejectedBeforeDelete() throws Exception {
        when(programMapper.programExists(PROGRAM_B, TENANT_A)).thenReturn(false);

        assertThrows(ApiException.class, () -> service.importExcel("program-courses", emptyExcel(), false, false, false,
            null, null, null, PROGRAM_B));

        verify(programCourseMapper, never()).deleteByProgram(anyString());
        verify(programCourseMapper, never()).insert(any(TrainingProgramCourse.class));
    }

    @Test
    @DisplayName("本租户 programId：正常走删除重建流程")
    void ownedProgramIdProceeds() throws Exception {
        when(programMapper.programExists(PROGRAM_A, TENANT_A)).thenReturn(true);

        Map<String, Object> result = service.importExcel("program-courses", emptyExcel(), false, false, false,
            null, null, null, PROGRAM_A);

        verify(programMapper, times(1)).programExists(PROGRAM_A, TENANT_A);
        verify(programCourseMapper, times(1)).deleteByProgram(PROGRAM_A);
        // 空数据行 → 无课程插入
        verify(programCourseMapper, never()).insert(any(TrainingProgramCourse.class));
    }
}
