# affairs/lesson 域实体归位（P1 纯重构，行为不变）

> 任务：把复用在 `domain/portal` 的 affairs/lesson 实体迁到对应域，消除「controller 在 affairs/lesson、entity/mapper 在 portal」的跨域耦合。
> 类型：纯重构（等价变换，行为不变，不涉及 spec 变更，commit 声明 `spec:nochange`）。
> 校验：`cd backend/java && ./mvnw -o -q -pl ruoyi-modules/ruoyi-zhiyu -am compile` → **exit 0**。

---

## 1. 移动的类（旧 → 新）

### 实体（domain）

| 旧（domain/portal） | 新 | @TableName |
|---|---|---|
| `PortalTerm` | `domain/affairs/Term` | `terms` |
| `PortalVenue` | `domain/affairs/Venue` | `venues` |
| `PortalPeriodSlot` | `domain/affairs/PeriodSlot` | `period_slots` |
| `PortalScheduleEntry` | `domain/affairs/ScheduleEntry` | `schedule_entries` |
| `PortalCourse` | `domain/lesson/LessonCourse` | `courses` |

### Mapper

| 旧（mapper/portal） | 新 |
|---|---|
| `PortalTermMapper` | `mapper/affairs/TermMapper` |
| `PortalVenueMapper` | `mapper/affairs/VenueMapper` |
| `PortalPeriodSlotMapper` | `mapper/affairs/PeriodSlotMapper` |
| `PortalScheduleEntryMapper` | `mapper/affairs/ScheduleEntryMapper` |
| `PortalCourseMapper` | `mapper/lesson/LessonCourseMapper` |

> 迁移方式：字段、注解（`@TableName`/`@TableId`/`@TableField`/`typeHandler`）、Mapper 方法与 SQL **原样搬移**，仅改包名与类名。`ScheduleEntry` 仍 `extends BaseZhiyuEntity` 并保留 `PgArrayTypeHandler`（classNodeIds）与 `JsonStringListTypeHandler`（periods）；`LessonCourse` 仍 `extends BaseZhiyuEntity` 并保留 `PgArrayTypeHandler`（knowledgePointIds/abilityPointIds/resourceIds/coCreatorIds）。数组列写入 SQL 中的 `typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler` 引用不变（core 类，非 Portal 类）。

---

## 2. 改动的引用文件（16 个）

跨域引用点全部改 import 与类型（`PortalXxx` → 新类，含字段声明、泛型、方法引用、QueryBuilder.lambda 类型），行为不变：

- `service/impl/portal/WorkspaceServiceImpl.java`（工作台聚合，用 Term/Venue/PeriodSlot/ScheduleEntry/Course）
- `service/impl/affairs/SchedulingServiceImpl.java`（Term/Venue/PeriodSlot/ScheduleEntry/Course）
- `service/impl/affairs/TeachingPlanServiceImpl.java`（Term）
- `service/impl/affairs/TermServiceImpl.java`（Term + ScheduleEntry）
- `service/impl/affairs/TrainingProgramServiceImpl.java`（Course）
- `service/impl/importexport/ImportExportServiceImpl.java`（TermMapper/VenueMapper/PeriodSlotMapper，含 `affairsConfigImport` 内注入与调用）
- `mapper/affairs/AffairsScheduleMapper.java`（实体泛型 `ScheduleEntry`，javadoc 同步）
- `service/impl/favorites/FavoritesServiceImpl.java`（Course）
- `service/impl/lesson/LessonResourceServiceImpl.java`（CourseMapper）
- `service/impl/lesson/LessonNodeServiceImpl.java`（CourseMapper）
- `service/impl/lesson/LessonBehaviorServiceImpl.java`（CourseMapper）
- `service/impl/lesson/LessonCourseServiceImpl.java`（Course，lesson 域主使用方）
- `controller/partner/PartnerCoBuildController.java`（Course）
- `service/impl/partner/PartnerCoBuildServiceImpl.java`（Course）
- `service/partner/IPartnerCoBuildService.java`（Course 返回类型）
- `mapper/lesson/LessonCourseCloneMapper.java`（实体泛型 `LessonCourse`）

---

## 3. 删除的旧文件（10 个，删除前 grep 确认零引用）

- `domain/portal/PortalTerm.java`、`PortalVenue.java`、`PortalPeriodSlot.java`、`PortalScheduleEntry.java`、`PortalCourse.java`
- `mapper/portal/PortalTermMapper.java`、`PortalVenueMapper.java`、`PortalPeriodSlotMapper.java`、`PortalScheduleEntryMapper.java`、`PortalCourseMapper.java`

> 删除前对 `PortalTerm/PortalVenue/PortalPeriodSlot/PortalScheduleEntry/PortalCourse` 五词全仓 grep 确认仅剩旧文件自身引用；删除后再次 grep 全 `backend/java` 均为 0 匹配。

---

## 4. 校验结果

```
cd backend/java && ./mvnw -o -q -pl ruoyi-modules/ruoyi-zhiyu -am compile
```
**exit 0**（无编译错误）。UTF-8 无 BOM、LF 换行（复用原文件内容，未引入编码变更）。

---

## 5. 已知简化点 / 说明

1. **课程实体仍被多域复用（已知，非本任务范围）**：`LessonCourse`/mapper 现归位于 lesson 域，但 portal（`WorkspaceServiceImpl`）、favorites（`FavoritesServiceImpl`）、partner（`PartnerCoBuildServiceImpl`/controller/service 接口）仍引用它做跨域只读/聚合。这是「课程实体由 lesson 域拥有、其他域跨域读取」的既定方向（与 Go `store/courses.go` 属 lesson/portal 共用一致），未在本任务拆解这些跨域读引用。
2. **Term/Venue/PeriodSlot/ScheduleEntry 被 portal 工作台聚合读取**：同第 1 点，`WorkspaceServiceImpl` 作为跨域聚合服务仍引用 affairs 域实体，属合法跨域读，非耦合回归。
3. **纯移动、零行为变更**：实体字段/注解、Mapper SQL 与方法签名一字未改，仅包名/类名/import 变更；未新增/删除任何接口或 SQL。
4. `docs/spec/06-acceptance-flows.md` 与 `scripts/ui-smoke/*` 未改动（按任务约束跳过）。

---

*本报告由代码迁移子代理生成；编译门禁 exit 0，旧 Portal* 引用全仓归零。*
