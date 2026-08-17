---
name: workflow-warmflow
description: |
  base-dev-framework6-java的 Warm-Flow 国产工作流引擎集成指南。覆盖发起流程、办理/驳回/转办、查询待办/已办、流程图、与业务单据通过事件回调联动等全套审批流开发。强调业务模块只依赖 ruoyi-api 的 WorkflowService 契约，绝不直接 import workflow 实现。

  触发场景：
  - 需要在业务模块（如请假、报销、合同）里发起审批流并把流程状态回写到业务表
  - 需要办理任务、驳回到前置节点、转办/委派/加签/减签、终止流程、催办、抄送
  - 需要查询当前用户的待办/已办、查全量待办已办、查抄送、查流程实例与流程图
  - 需要监听流程节点变更（ProcessEvent / ProcessTaskEvent / ProcessDeleteEvent）做业务联动
  - 需要新增 workflow 模块内的 bean/controller/service 或排查 @ConditionalOnEnable 未生效

  触发词：工作流、流程、审批、Warm-Flow、warm-flow、WorkflowService、流程引擎、发起流程、办理任务、待办、已办、流程图、审批流、ProcessEvent、workflow、warmflow
---

# workflow-warmflow — Warm-Flow 工作流（base-dev-framework6-java）

## 概述

本项目 的工作流能力由 **Warm-Flow**（国产开源工作流引擎，本项目锁定版本 **1.8.8**）提供，全部实现集中在 `ruoyi-modules/ruoyi-workflow` 模块。

核心事实（务必先记住，否则会写出错误代码）：

1. **跨模块只走 ruoyi-api 契约**。业务模块（请假、报销、订单等）想发起或办理流程时，只能注入 `org.dromara.workflow.api.WorkflowService` 接口（位于 `ruoyi-api` 模块），**绝不** `import org.dromara.workflow.service.*` 或 `org.dromara.workflow.service.impl.*` 的实现类。这样业务模块在编译期不依赖 workflow 实现，工作流可整体开关、可替换。
2. **流程引擎类全在 `org.dromara.warm.flow.*` 包**，例如 `FlowEngine`、`Instance`、`Task`、`Definition`、`Node`、`GlobalListener`、`FlowParams`。这些是 Warm-Flow 提供的，不要与本项目自定义的 `Flw*`（如 `IFlwTaskService`、`FlowTaskVo`）混淆。
3. **整模块带 `@ConditionalOnEnable`**。该自定义注解（`org.dromara.workflow.common.ConditionalOnEnable`）等价于 `@ConditionalOnProperty("warm-flow.enabled" havingValue = "true")`。配置项 `warm-flow.enabled=false` 时整个工作流模块（含 `WorkflowService` 实现）都不会装配。**新增 workflow 模块内的 bean / controller / service 时，必须同样加 `@ConditionalOnEnable`**，否则配置关闭后你的类仍被加载、注入 workflow 内部 bean 会启动报错。
4. **业务联动靠 Spring 事件**，不靠轮询。Warm-Flow 在节点流转时通过 `FlowProcessEventHandler` 发布三类事件，业务模块用 `@EventListener` 监听并回写业务表状态。

依赖坐标（`ruoyi-workflow/pom.xml` 真实声明）：

```xml
<!-- Warm-Flow 工作流引擎 -->
<dependency>
    <groupId>org.dromara.warm</groupId>
    <artifactId>warm-flow-mybatis-plus-sb3-starter</artifactId>
</dependency>
<!-- Warm-Flow UI 插件（提供流程设计器 + 流程图渲染） -->
<dependency>
    <groupId>org.dromara.warm</groupId>
    <artifactId>warm-flow-plugin-ui-sb-web</artifactId>
</dependency>
<!-- 跨模块契约 -->
<dependency>
    <groupId>org.dromara</groupId>
    <artifactId>ruoyi-api</artifactId>
</dependency>
```

> 流程图渲染由 UI 插件的 `ChartExtService` 提供（本项目扩展实现见 `FlwChartExtServiceImpl implements org.dromara.warm.flow.ui.service.ChartExtService`），不需要你自己写流程图控制器端点。

## 集成方式（业务模块视角）

业务模块只需做两件事：

1. **注入 `WorkflowService`**（ruoyi-api 契约）发起 / 办理 / 删除流程；
2. **用 `@EventListener` 监听流程事件** 回写业务状态。

`WorkflowService` 契约的全部方法（来自 `ruoyi-api/.../workflow/api/WorkflowService.java`，照抄方法名，勿臆造）：

| 方法 | 说明 |
|------|------|
| `StartProcessReturnDTO startWorkFlow(StartProcessDTO)` | 启动流程，返回 `processInstanceId` + 首任务 `taskId` |
| `boolean startCompleteTask(StartProcessDTO)` | 启动流程并自动办理第一个（申请人）任务 |
| `boolean completeTask(CompleteTaskDTO)` | 办理任务（后台无登录用户时 `variables.put("ignore", true)` 忽略权限） |
| `boolean completeTask(Long taskId, String message)` | 按任务 id + 意见快速办理 |
| `boolean deleteInstance(List<String> businessIds)` | 删除流程实例 + 历史 + 业务关联（删业务单据前调用） |
| `String getBusinessStatus(String businessId)` | 按业务 id 取流程状态 |
| `String getBusinessStatusByTaskId(Long taskId)` | 按任务 id 取流程状态 |
| `Long getInstanceIdByBusinessId(String businessId)` | 业务 id → 流程实例 id |
| `void setVariable(Long instanceId, Map)` / `Map instanceVariable(Long instanceId)` | 读写流程变量 |

`StartProcessDTO` 关键字段（`ruoyi-api/.../workflow/api/domain/StartProcessDTO.java`）：

- `businessId`：业务唯一值（一般是业务单据主键 `.toString()`）
- `flowCode`：流程定义编码（在流程设计器里配，如 `leave1`）
- `handler`：可选，覆盖当前节点办理人（后台/定时任务发起时手动指定）
- `variables`：流程变量 `Map<String,Object>`，前端通常提交 `{'entity': 业务详情}`；`getVariables()` 会自动剔除 null 值

`CompleteTaskDTO` 关键字段：`taskId`、`message`（办理意见）、`fileId`（附件 ossId）、`flowCopyList`（抄送 `List<FlowCopyDTO>`）、`messageType`、`handler`、`variables`、`ext`（逗号分隔 ossId）。

`FlowCopyDTO` 是 record：`record FlowCopyDTO(Long userId, String nickName)`。

## 发起与办理流程

### 发起（业务模块内）

参考真实实现 `TestLeaveServiceImpl.submitAndFlowStart`（这是官方示例的「业务表 + 流程」标准范式）：

1. 先把业务单据落库（`insertOrUpdate`），拿到业务主键；
2. 组装 `StartProcessDTO`，`businessId` = 业务主键、`flowCode` = 流程编码、`variables` = 业务参数；
3. 后台发起（无前端登录态）时塞 `variables.put("ignore", true)` 忽略权限校验；
4. 调 `workflowService.startCompleteTask(startProcess)`（启动并办理申请人首节点）；返回 false 抛 `ServiceException`。

### 办理 / 驳回 / 转办（workflow 模块内，前端走 REST）

前端审批走 `FlwTaskController`（`@RequestMapping("/workflow/task")`），真实端点：

| 动作 | 端点 | Service 方法 |
|------|------|--------------|
| 启动流程 | `POST /workflow/task/startWorkFlow` | `flwTaskService.startWorkFlow(StartProcessBo)` |
| 办理 | `POST /workflow/task/completeTask` | `completeTask(CompleteTaskBo)` |
| 驳回到前置节点 | `POST /workflow/task/backProcess` | `backProcess(BackProcessBo)` |
| 可驳回节点 | `GET /workflow/task/getBackTaskNode/{taskId}/{nowNodeCode}` | `getBackTaskNode(...)` |
| 终止 | `POST /workflow/task/terminationTask` | `terminationTask(FlowTerminationBo)` |
| 委派/转办/加签/减签 | `POST /workflow/task/taskOperation/{taskOperation}` | `taskOperation(bo, taskOperation)` |
| 改办理人 | `PUT /workflow/task/updateAssignee/{userId}` | `updateAssignee(taskIdList, userId)` |
| 催办 | `POST /workflow/task/urgeTask` | `urgeTask(FlowUrgeTaskBo)` |
| 下一节点 | `POST /workflow/task/getNextNodeList` | `getNextNodeList(FlowNextNodeBo)` |

`taskOperation` 的 `{taskOperation}` 取值（见 `FlwTaskController` 注释）：委派 `delegateTask`、转办 `transferTask`、加签 `addSignature`、减签 `reductionSignature`。

> 注意 controller 上的 `@RepeatSubmit`（防重复提交）和 `@Log`（操作日志）注解是这些写操作的标配，新增类似端点请沿用。

## 事件联动（核心：流程 ↔ 业务单据双向同步）

Warm-Flow 节点流转由全局监听器 `WorkflowGlobalListener implements GlobalListener`（`org.dromara.warm.flow.core.listener.GlobalListener`）拦截 `create/start/assignment/finish` 四个生命周期钩子，并在 `finish` 中通过 `FlowProcessEventHandler` 发布 Spring 事件。**业务模块不直接对接监听器，只监听事件**。

三类事件（均在 `ruoyi-api/.../workflow/api/event/`，跨模块可见）：

| 事件 | 触发时机 | 关键字段 |
|------|----------|----------|
| `ProcessEvent` | 总体流程状态变更（草稿/撤销/退回/作废/终止/已完成等） | `flowCode`、`businessId`、`status`、`nodeType`、`nodeCode`、`params`、`submit`（true=申请人节点办理） |
| `ProcessTaskEvent` | 创建新任务（=上一任务完成） | `flowCode`、`businessId`、`taskId`、`nodeCode`、`status`、`params` |
| `ProcessDeleteEvent` | 删除流程 | `flowCode`、`businessId` |

业务模块监听范式（照抄 `TestLeaveServiceImpl` 的三个监听方法）：

- 用 `@EventListener(condition = "#processEvent.flowCode == 'leave1'")` 按流程编码精准过滤（示例用 `startsWith('leave')` 仅为演示，**生产用 `==` 精确匹配自己的 flowCode**）；
- 在 `processHandler(ProcessEvent)` 里：用 `businessId` 查业务单据，把 `processEvent.getStatus()` 回写到业务表 status 字段；`submit==true` 时表示申请人刚提交，置为「待审批」`BusinessStatusEnum.WAITING`；`params` 里可取 `hisTaskExt`（附件）、`handler`（办理人）、`message`（意见）；
- 在 `processDeleteHandler(ProcessDeleteEvent)` 里删对应业务单据。

业务状态枚举统一用 `org.dromara.common.core.enums.BusinessStatusEnum`（`DRAFT`/`WAITING`/`FINISH`/`BACK`/...），不要自己硬编码字符串状态。

## 查询待办 / 已办

通过 `IFlwTaskService`（workflow 模块内）/ `FlwTaskController` 查询，返回 `PageResult<FlowTaskVo>`（待办）或 `PageResult<FlowHisTaskVo>`（已办），分页参数 `PageQuery`，查询条件 `FlowTaskBo`：

| 端点 | 含义 |
|------|------|
| `GET /workflow/task/pageByTaskWait` | 当前用户的待办 |
| `GET /workflow/task/pageByTaskFinish` | 当前用户的已办 |
| `GET /workflow/task/pageByAllTaskWait` | 当前租户全量待办 |
| `GET /workflow/task/pageByAllTaskFinish` | 当前租户全量已办 |
| `GET /workflow/task/pageByTaskCopy` | 当前用户收到的抄送 |
| `GET /workflow/task/currentTaskAllUser/{taskId}` | 当前任务所有办理人 |

`FlowTaskBo` 可按 `nodeName`、`flowName`、`flowCode`、`category`（流程分类 id）、`instanceId`、`flowStatus`、`createByIds`（申请人）过滤。

> 查询带用户维度 / 分类权限过滤（区分「当前用户待办」与「全量待办」），改查询逻辑前先读对应 `Flw*ServiceImpl`（如 `FlwTaskServiceImpl`、`FlwInstanceServiceImpl`），照其已有的权限拼接方式扩展，不要绕过。

流程实例查询走 `FlwInstanceController`（`/workflow/instance`）：`pageByRunning`（运行中）、`pageByFinish`（已完成）、`getInfo/{businessId}`、`flowHisTaskList/{businessId}`（流转历史）、`instanceVariable/{instanceId}`（流程变量）等。

## 流程分类翻译

流程分类 id → 名称的翻译实现 `CategoryNameTranslationImpl` 放在 workflow 模块内，用 `@TranslationType(type = FlowConstant.CATEGORY_ID_TO_NAME)` + `implements TranslationInterface<String>`，并实现 `translation` 与 `translationBatch`（批量），遵守项目统一的 `TranslationInterface` 翻译规则。给 VO 字段加翻译时用 `@Translation(type = FlowConstant.CATEGORY_ID_TO_NAME, mapper = "category")` 即可，无需手动查名。

---

## 代码示例（全部基于真实类）

### 示例 1：业务提交并发起审批（标准范式）

```java
// 摘自 TestLeaveServiceImpl.submitAndFlowStart —— 业务表 + 流程发起的官方模板
@Transactional(rollbackFor = Exception.class)
@Override
public TestLeaveVo submitAndFlowStart(TestLeaveBo bo) {
    TestLeave leave = MapstructUtils.convert(bo, TestLeave.class);
    boolean flag = leaveMapper.insertOrUpdate(leave);   // 业务单据先落库
    if (flag) {
        bo.setId(leave.getId());
        bo.getParams().put("ignore", true);             // 后端发起忽略权限

        StartProcessDTO startProcess = new StartProcessDTO();
        startProcess.setBusinessId(leave.getId().toString());
        startProcess.setFlowCode(StringUtils.isEmpty(bo.getFlowCode()) ? "leave1" : bo.getFlowCode());
        startProcess.setVariables(bo.getParams());
        // 后端/定时任务无登录用户时：startProcess.setHandler("0");

        boolean ok = workflowService.startCompleteTask(startProcess);
        if (!ok) {
            throw new ServiceException("流程发起异常");
        }
    }
    return MapstructUtils.convert(leave, TestLeaveVo.class);
}
```

### 示例 2：监听流程状态变更，回写业务表

```java
// 摘自 TestLeaveServiceImpl.processHandler —— 流程状态同步到业务单据
@EventListener(condition = "#processEvent.flowCode == 'leave1'")   // 生产用 == 精确匹配
public void processHandler(ProcessEvent processEvent) {
    TestLeave leave = leaveMapper.selectById(Convert.toLong(processEvent.getBusinessId()));
    leave.setStatus(processEvent.getStatus());
    Map<String, Object> params = processEvent.getParams();
    if (MapUtil.isNotEmpty(params)) {
        String hisTaskExt = Convert.toStr(params.get("hisTaskExt")); // 附件
        String handler    = Convert.toStr(params.get("handler"));    // 办理人
        String message    = Convert.toStr(params.get("message"));    // 办理意见
    }
    if (Boolean.TRUE.equals(processEvent.getSubmit())) {             // 申请人提交
        leave.setStatus(BusinessStatusEnum.WAITING.getStatus());
    }
    leaveMapper.updateById(leave);
}
```

### 示例 3：监听删除事件，联动删业务单据

```java
// 摘自 TestLeaveServiceImpl.processDeleteHandler
@EventListener(condition = "#processDeleteEvent.flowCode == 'leave1'")
public void processDeleteHandler(ProcessDeleteEvent processDeleteEvent) {
    TestLeave leave = leaveMapper.selectById(Convert.toLong(processDeleteEvent.getBusinessId()));
    if (ObjectUtil.isNull(leave)) {
        return;
    }
    leaveMapper.deleteById(leave.getId());
}
```

### 示例 4：删除业务前先删流程实例

```java
// 摘自 TestLeaveServiceImpl.deleteWithValidByIds
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean deleteWithValidByIds(Collection<Long> ids) {
    // 删流程实例 + 历史 + 业务关联，再删业务表
    workflowService.deleteInstance(StreamUtils.toList(ids, Convert::toStr));
    return leaveMapper.deleteByIds(ids) > 0;
}
```

### 示例 5：后台快速办理任务（按 taskId + 意见）

```java
// WorkflowService 契约提供的便捷重载，适合系统/定时任务自动审批
@RequiredArgsConstructor
@Service
public class AutoApproveService {

    private final WorkflowService workflowService;   // 注入 ruoyi-api 契约，禁止注入实现类

    public void autoApprove(Long taskId) {
        // 等价于 CompleteTaskDTO + variables.put("ignore", true)
        boolean ok = workflowService.completeTask(taskId, "系统自动通过");
        if (!ok) {
            throw new ServiceException("自动办理失败");
        }
    }
}
```

### 示例 6：抄送 + 自定义办理（CompleteTaskDTO）

```java
CompleteTaskDTO dto = new CompleteTaskDTO();
dto.setTaskId(taskId);
dto.setMessage("同意，转下一节点");
dto.setFlowCopyList(List.of(new FlowCopyDTO(1001L, "张三")));   // record 抄送人
dto.getVariables().put("ignore", true);                        // 后台无登录态时忽略权限
boolean ok = workflowService.completeTask(dto);
```

### 示例 7：新增 workflow 模块内 bean 必须带 @ConditionalOnEnable

```java
@ConditionalOnEnable        // 必加：warm-flow.enabled=false 时整模块不装配
@Service
@RequiredArgsConstructor
public class MyFlwExtServiceImpl implements IMyFlwExtService {
    private final IFlwTaskService flwTaskService;   // 注入 workflow 内部 service 只能在模块内
    // ...
}
```

---

## 常见错误对比（≥3，重点：跨模块走契约）

### 错误 1：业务模块直接 import workflow 实现类

```java
// ❌ 错误：业务模块（如 ruoyi-order）import 了 workflow 的实现/内部 service
import org.dromara.workflow.service.impl.WorkflowServiceImpl;     // 编译耦合 + 跨模块不可见
import org.dromara.workflow.service.IFlwTaskService;              // 内部 service 不对外
@Autowired
private WorkflowServiceImpl workflowServiceImpl;
```

```java
// ✅ 正确：只注入 ruoyi-api 的 WorkflowService 接口
import org.dromara.workflow.api.WorkflowService;
@RequiredArgsConstructor
public class OrderServiceImpl {
    private final WorkflowService workflowService;   // 契约注入，工作流可整体开关
}
```

### 错误 2：新增 workflow 内 bean / controller 漏掉 @ConditionalOnEnable

```java
// ❌ 错误：缺少 @ConditionalOnEnable
@Service
public class FlwReportServiceImpl {
    private final IFlwTaskService flwTaskService;   // warm-flow.enabled=false 时仍被加载 → 注入不到内部 bean，启动报错
}
```

```java
// ✅ 正确：与同模块所有 Flw*ServiceImpl 一致，加上 @ConditionalOnEnable
@ConditionalOnEnable
@Service
@RequiredArgsConstructor
public class FlwReportServiceImpl {
    private final IFlwTaskService flwTaskService;
}
```

### 错误 3：用轮询查流程状态而非监听事件

```java
// ❌ 错误：定时轮询 getBusinessStatus 同步状态，延迟高、浪费资源
@Scheduled(fixedRate = 5000)
public void syncStatus() {
    for (Order o : pendingOrders) {
        o.setStatus(workflowService.getBusinessStatus(o.getId().toString()));
    }
}
```

```java
// ✅ 正确：用 @EventListener 监听 ProcessEvent，节点一变更即回写
@EventListener(condition = "#processEvent.flowCode == 'order_approve'")
public void onProcess(ProcessEvent processEvent) {
    Order o = orderMapper.selectById(Convert.toLong(processEvent.getBusinessId()));
    o.setStatus(processEvent.getStatus());
    orderMapper.updateById(o);
}
```

### 错误 4：6.x 包名 / 分层 / 查询写法踩 5.x 老坑

```java
// ❌ 错误：照搬 5.x 旧版 / 其他框架的写法
import com.ruoyi.workflow.api.WorkflowService;   // 5.x 包名，6.x 是 org.dromara
import plus.ruoyi.xxx;                            // 错误前缀
// 自建 DAO 层 / 用 PlusLambdaQuery / likeCast(...) / TenantEntity 默认继承 / is_deleted 字段
```

```java
// ✅ 正确：6.x 铁律
import org.dromara.workflow.api.WorkflowService;          // 包名 org.dromara
// 三层结构（Controller / Service / Mapper），无独立 DAO 层
// 查询用 LambdaQueryWrapper + Wrappers.lambdaQuery()（见 TestLeaveServiceImpl.buildQueryWrapper）
// 逻辑删除/租户字段由框架基类统一约定，不手写 is_deleted
```

---

## 最佳实践

1. **跨模块零依赖实现**：业务模块永远只依赖 `org.dromara.workflow.api.WorkflowService` 与三类 `*Event`（都在 ruoyi-api），把工作流当外部服务用。改任何业务联动，先确认没有 import 到 `workflow.service.*` / `workflow.service.impl.*`。
2. **事件 flowCode 精确过滤**：`@EventListener(condition = "#processEvent.flowCode == '你的flowCode'")` 用 `==` 而非 `startsWith`（官方示例的 `startsWith('leave')` 仅为演示同时命中多个示例流程）。否则别的流程事件会误触发你的业务回写。
3. **后台/定时任务发起必须处理权限与办理人**：无登录态时 `variables.put("ignore", true)` 忽略权限；必要时 `startProcess.setHandler("0")` 手动指定办理人，避免「无办理人」异常。
4. **删业务单据前先 `deleteInstance`**：保证流程实例、历史任务、业务关联一并清理，避免脏数据残留。否则下次同 businessId 发起会冲突。
5. **新增 workflow 内 bean 一律带 `@ConditionalOnEnable`**，并复用同模块已有的 `IFlwTaskService` / `IFlwInstanceService` / `IFlwCommonService`，不要绕开它们直接调 `FlowEngine` 静态方法（除非确有需要，且参考 `WorkflowGlobalListener` 的用法）。
6. **状态用 `BusinessStatusEnum`**：业务表 status 字段统一映射 `DRAFT/WAITING/BACK/FINISH/...`，与流程引擎语义对齐，前端可直接复用字典展示。
7. **流程分类翻译走 `TranslationInterface`**：分类 id → 名称用 `CategoryNameTranslationImpl` 那套 `@TranslationType` + `@Translation` 机制批量翻译，禁止在 VO 里手动循环查名造成 N+1。
8. **流程图 / 设计器交给 UI 插件**：流程图渲染由 `warm-flow-plugin-ui-sb-web` 的 `ChartExtService`（本项目 `FlwChartExtServiceImpl`）提供，不要自己写图片生成端点；前端流程设计器也由该插件托管。
9. **写操作端点沿用 `@RepeatSubmit` + `@Log`**：办理/驳回/终止等改动型接口照 `FlwTaskController` 加防重与操作日志注解，保持审计一致性。
