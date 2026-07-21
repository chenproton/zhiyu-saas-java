/**
 * PRD 需求文档标注内容 —— 场景大厅页面
 * 内容提取自《实践场景学习平台产品需求文档.md》第 4.1 节
 */

export interface AnnotationItem {
  id: string
  title: string
  content: string
}

export const sceneHallAnnotations: Record<string, AnnotationItem> = {
  // ===== Part 1: 顶部标题卡片 =====
  "scene-management-title": {
    id: "scene-management-title",
    title: "场景管理",
    content:
      "场景大厅是平台的资源管理中心，支持教研管理员和教师查看、筛选、管理自己创建/共建/公共的场景资源。支持列表视图和批次分组视图两种展示模式。",
  },
  "config-approval-workflow": {
    id: "config-approval-workflow",
    title: "配置审批流程",
    content:
      "点击打开「审批流程管理」弹窗。教研管理员可预设校内审批流模板，供批次关联使用。包含流程名称、流程说明、审批步骤数等信息。",
  },
  "config-batch-group": {
    id: "config-batch-group",
    title: "配置批次分组",
    content:
      "点击打开「批次分组管理」弹窗。用于管理场景建设批次分组，关联审批流程。支持新增批次，列表展示分组名称、批次编号、审批流程、状态（开放中/已截稿）。",
  },
  "import-resource-package": {
    id: "import-resource-package",
    title: "导入资源包",
    content:
      "点击打开「导入资源包」弹窗。支持导入包含场景、任务和资源的完整资源包（本期暂不做）。",
  },
  "import-scenario": {
    id: "import-scenario",
    title: "导入场景",
    content:
      "点击打开「导入场景」弹窗。支持 Excel/JSON 格式批量导入场景数据，上传区域为虚线边框拖拽区。提示：支持 .xlsx, .json 格式，单个文件不超过 10MB。",
  },
  "create-scenario": {
    id: "create-scenario",
    title: "新建场景",
    content:
      "点击跳转全屏场景编辑器页面。进入场景编辑（步骤1 基础信息 / 步骤2 任务编辑），页面采用全屏覆盖模式，隐藏侧边栏，顶部为 sticky 操作栏（上一步、下一步、保存、草稿、预览）。",
  },

  // ===== 统计面板 =====
  "stat-total": {
    id: "stat-total",
    title: "场景总数",
    content: "当前筛选条件下的场景总数量。",
  },
  "stat-draft": {
    id: "stat-draft",
    title: "未提交（草稿）",
    content:
      "草稿(draft)状态的场景数量。草稿状态可编辑、可删除、可克隆、可提交审批。",
  },
  "stat-pending": {
    id: "stat-pending",
    title: "审批中",
    content:
      "审批中(pending)状态的场景数量。审批中状态可撤回审批、可删除、可克隆。",
  },
  "stat-rejected": {
    id: "stat-rejected",
    title: "已驳回",
    content:
      "已驳回(rejected)状态的场景数量。已驳回状态可编辑、可删除、可克隆。",
  },
  "stat-published": {
    id: "stat-published",
    title: "已发布",
    content:
      "已发布(published)状态的场景数量。已发布状态可取消发布、可克隆。",
  },

  // ===== Part 2: 视图切换区 =====
  "tab-my": {
    id: "tab-my",
    title: "我的场景",
    content:
      "展示当前用户创建的场景。切换 Tab 时，清空已选项、岗位筛选、批次筛选。仅在「我的场景」「共建场景」Tab 下显示统计面板。",
  },
  "tab-collab": {
    id: "tab-collab",
    title: "共建场景",
    content:
      "展示当前用户在共建人列表中的场景。切换 Tab 时，清空已选项、岗位筛选、批次筛选。仅在「我的场景」「共建场景」Tab 下显示统计面板。",
  },
  "tab-public": {
    id: "tab-public",
    title: "公共场景",
    content:
      "展示全部已发布场景，不展示统计面板。切换 Tab 时，清空已选项、岗位筛选、批次筛选。",
  },
  "view-list": {
    id: "view-list",
    title: "资源列表视图",
    content:
      "以表格形式展示场景列表，含复选框、场景名称、编码、版本、岗位、批次、创建人、状态、发布时间、任务数量等列，支持筛选和批量操作。",
  },
  "view-group": {
    id: "view-group",
    title: "批次分组视图",
    content:
      "按分组展示场景，每个批次分组为一个折叠面板。面板头部展示批次名称 + 编码 + 场景数量。无批次的草稿场景单独放在底部「未分类」区域。",
  },

  // ===== Part 3: 筛选栏 =====
  "search-box": {
    id: "search-box",
    title: "搜索场景 / 任务",
    content:
      "支持按场景名称和任务名称模糊搜索，搜索结果为场景列表。placeholder 提示：搜索场景名称 / 任务名称。",
  },
  "filter-position": {
    id: "filter-position",
    title: "岗位筛选",
    content:
      "选项分组展示，先按专业分组，再展示岗位。默认选项「全部岗位」。筛选后仅展示关联该岗位的场景。",
  },
  "filter-batch": {
    id: "filter-batch",
    title: "批次筛选",
    content: "展示各批次名称。默认选项「全部批次」。筛选后仅展示属于该批次的场景。",
  },
  "filter-status": {
    id: "filter-status",
    title: "状态筛选",
    content:
      "全部状态 / 草稿 / 审批中 / 已通过 / 已驳回 / 已发布。默认选项「全部状态」。",
  },
  "filter-reset": {
    id: "filter-reset",
    title: "重置筛选",
    content: "清空所有筛选条件（搜索框、岗位、批次、状态），恢复默认状态。",
  },

  // ===== 批量操作栏 =====
  "batch-selection-hint": {
    id: "batch-selection-hint",
    title: "批量选择提示",
    content:
      "有选中场景时高亮显示「已选择 N 项：」，无选中时置灰显示「请选择场景：」。批量操作执行后，自动清空选中态。",
  },
  "batch-submit": {
    id: "batch-submit",
    title: "提交审批",
    content:
      "仅当选中项包含草稿(draft)状态时可用。将草稿状态场景提交进入审批流程。若场景未关联批次，需手动选择审批流程。",
  },
  "batch-withdraw": {
    id: "batch-withdraw",
    title: "撤回审批",
    content:
      "仅当选中项包含审批中(pending)状态时可用。将审批中状态场景撤回至草稿状态。",
  },
  "batch-publish": {
    id: "batch-publish",
    title: "发布",
    content:
      "仅当选中项包含待发布(approved)状态时可用。将通过审批的场景正式发布，发布后将展示在学生端。",
  },
  "batch-unpublish": {
    id: "batch-unpublish",
    title: "取消发布",
    content:
      "仅当选中项包含已发布(published)状态时可用。将已发布场景回退至草稿状态。",
  },
  "batch-delete": {
    id: "batch-delete",
    title: "删除",
    content:
      "选中项不包含已发布(published)状态时可用。删除选中的场景（草稿/审批中/已驳回/待发布均可删除）。已发布场景不可删除。",
  },
  "batch-clone": {
    id: "batch-clone",
    title: "克隆",
    content:
      "有选中项即可用。复制选中的场景为新的草稿场景，默认名称为「{原名称} (克隆)」。任意状态（draft/pending/approved/published）的场景均可克隆。",
  },
  "batch-move": {
    id: "batch-move",
    title: "调整批次分组",
    content:
      "有选中项即可用。将选中的场景移动到其他批次分组，需选择目标批次后确认。",
  },
  "batch-export": {
    id: "batch-export",
    title: "导出",
    content:
      "有选中项即可用。将选中的场景导出为 Excel 或 JSON 格式。Excel 包含场景基础信息和任务配置，JSON 为完整的场景数据结构，适用于备份和迁移。",
  },

  // ===== 弹窗内标注 =====
  "dialog-batch-management": {
    id: "dialog-batch-management",
    title: "批次分组管理弹窗",
    content:
      "管理场景建设批次分组，关联审批流程。右上角「新增批次」按钮可打开内层弹窗创建新批次。列表展示分组名称、批次编号、审批流程、状态（开放中/已截稿）。",
  },
  "dialog-batch-create": {
    id: "dialog-batch-create",
    title: "新增批次",
    content:
      "字段：分组名称（输入）、批次编号（自动生成，disabled，不可修改）、关联审批流（Select，必填）。操作：取消 / 创建批次。",
  },
  "dialog-approval-select": {
    id: "dialog-approval-select",
    title: "审批流程选择",
    content:
      "无批次场景提交审批时弹出。展示审批流程列表选择（展示流程名称+步骤数），底部展示提交场景名称。操作：取消 / 提交审批。",
  },
  "dialog-import": {
    id: "dialog-import",
    title: "导入场景弹窗",
    content:
      "虚线边框拖拽上传区，提示「支持 .xlsx, .json 格式，单个文件不超过 10MB」。操作：取消 / 开始导入。",
  },
  "dialog-export": {
    id: "dialog-export",
    title: "批量导出弹窗",
    content:
      "导出格式选项卡片：Excel / JSON，点击选中。Excel 包含场景基础信息和任务配置，JSON 为完整的场景数据结构。操作：取消 / 确认导出。",
  },
  "dialog-clone-rename": {
    id: "dialog-clone-rename",
    title: "克隆重命名",
    content:
      "触发：点击单行/批量「克隆」后。输入框默认值为「{原名称} (克隆)」。操作：取消 / 确认克隆。",
  },
  "dialog-reject-reason": {
    id: "dialog-reject-reason",
    title: "驳回原因查看",
    content:
      "仅已驳回(reject)状态显示，打开驳回原因弹窗。展示驳回原因文本（从审批记录读取）。操作：关闭。",
  },
  "dialog-batch-move": {
    id: "dialog-batch-move",
    title: "调整批次分组弹窗",
    content:
      "触发：批量操作「调整批次分组」。选择目标批次分组（仅展示开放中的批次），将已选择的场景移动过去。操作：取消 / 确定。",
  },
  "dialog-approval-workflow-config": {
    id: "dialog-approval-workflow-config",
    title: "配置审批流程弹窗",
    content:
      "教研管理员预设校内审批流模板，供批次关联使用。展示流程名称、流程说明、审批步骤数、创建日期。支持新增审批流程（本期以占位按钮实现）。",
  },

  // ===== 场景列表（表格）标注 =====
  "list-header-name": {
    id: "list-header-name",
    title: "场景名称",
    content:
      "列头：场景名称。点击进入场景编辑页面—步骤 1（基础信息编辑）。最短展示宽度 15 字。",
  },
  "list-header-code": {
    id: "list-header-code",
    title: "场景编码",
    content:
      "列头：场景编码。固定 10 字展示。资源类码规则：2位字母+数字随机组合 + 8 位随机递增数字。",
  },
  "list-header-version": {
    id: "list-header-version",
    title: "版本",
    content: "列头：版本号。最短展示宽度 4 字。",
  },
  "list-header-position": {
    id: "list-header-position",
    title: "所属岗位",
    content: "列头：所属岗位。最短展示宽度 8 字。",
  },
  "list-header-batch": {
    id: "list-header-batch",
    title: "所属批次分组",
    content: "列头：所属批次分组。最短展示宽度 12 字。",
  },
  "list-header-creator": {
    id: "list-header-creator",
    title: "创建人",
    content: "列头：创建人。最短展示宽度 4 字。",
  },
  "list-header-status": {
    id: "list-header-status",
    title: "状态",
    content:
      "列头：状态。包含草稿/审批中/已通过/待发布/已发布五种状态，以不同颜色标签展示。",
  },
  "list-header-publish-time": {
    id: "list-header-publish-time",
    title: "发布时间",
    content: "列头：发布时间。年-月-日格式。",
  },
  "list-header-task-count": {
    id: "list-header-task-count",
    title: "场景任务数量",
    content:
      "列头：场景任务数量。点击进入场景编辑页面—步骤 2（任务链配置）。最短展示宽度 2 字。",
  },
  "list-link-name": {
    id: "list-link-name",
    title: "场景名称（可跳转）",
    content:
      "点击进入场景编辑页面—步骤 1（基础信息编辑）。页面采用全屏覆盖模式，隐藏侧边栏，顶部为 sticky 操作栏（上一步、下一步、保存、草稿、预览）。",
  },
  "list-link-tasks": {
    id: "list-link-tasks",
    title: "场景任务数量（可跳转）",
    content:
      "点击进入场景编辑页面—步骤 2（任务链配置）。以「任务链」形式顺序罗列场景下的所有任务，每个任务通过 8 个配置卡片来定义学习+测评过程。",
  },
  "row-action-view": {
    id: "row-action-view",
    title: "查看详情",
    content: "跳转场景预览页面，使用学生端场景展示页面查看场景完整信息。",
  },
  "row-action-edit": {
    id: "row-action-edit",
    title: "编辑",
    content:
      "跳转场景编辑页面—步骤 1（基础信息编辑）。可修改场景名称、岗位、批次、行业、专业、难度、介绍、封面、共建人等信息。",
  },
  "row-action-tasks": {
    id: "row-action-tasks",
    title: "编排任务",
    content:
      "跳转场景编辑页面—步骤 2（任务链配置）。可添加/删除/拖拽排序任务，配置每个任务的 8 个步骤卡片。",
  },
  "row-action-clone": {
    id: "row-action-clone",
    title: "克隆场景",
    content:
      "全部状态均显示。触发克隆确认弹窗，默认名称为「{原名称} (克隆)」，生成新的草稿场景。",
  },
  "row-action-submit": {
    id: "row-action-submit",
    title: "提交审批（行内）",
    content:
      "仅 draft 状态显示。将草稿状态场景提交进入审批流程。若场景未关联批次，需手动选择审批流程。",
  },
  "row-action-withdraw": {
    id: "row-action-withdraw",
    title: "撤回审批（行内）",
    content:
      "仅 pending 状态显示。将审批中状态场景撤回至草稿状态，可继续编辑后重新提交。",
  },
  "row-action-reject-reason": {
    id: "row-action-reject-reason",
    title: "查看驳回原因（行内）",
    content:
      "仅 rejected 状态显示。打开驳回原因弹窗，展示从审批记录读取的驳回原因文本。",
  },
  "row-action-delete": {
    id: "row-action-delete",
    title: "删除（行内）",
    content:
      "除了 published 状态外都显示。删除该场景（草稿/审批中/已驳回/待发布均可删除）。已发布场景不可删除。",
  },

  // ===== 审批管理页面标注 =====
  "approvals-title": {
    id: "approvals-title",
    title: "资源审批管理",
    content:
      "审批中心供有审批权限的用户查看待审批场景、执行通过/驳回操作，以及查看历史审批记录。页面副标题：审核场景提交申请，管理审批流程。",
  },
  "approvals-tab-pending": {
    id: "approvals-tab-pending",
    title: "待审批",
    content:
      "展示当前用户有权限审批的待处理场景列表。Tab 右上角带数量角标（黄色背景）。每行展示场景名称、编码、版本、岗位、批次、创建人、提交日期、状态。",
  },
  "approvals-tab-approved": {
    id: "approvals-tab-approved",
    title: "已审批",
    content:
      "展示当前用户已处理过的审批记录（已通过/已驳回）。支持查看历史审批意见和结果。",
  },
  "approvals-action-view": {
    id: "approvals-action-view",
    title: "查看",
    content: "跳转场景预览页，使用学生端场景展示页面查看场景完整信息。",
  },
  "approvals-action-reject": {
    id: "approvals-action-reject",
    title: "驳回",
    content:
      "仅待审批状态显示（红色文字按钮，图标 X）。打开驳回确认弹窗，需填写驳回原因（必填）。",
  },
  "approvals-action-pass": {
    id: "approvals-action-pass",
    title: "通过",
    content:
      "仅待审批状态显示（主按钮，图标 Check）。打开通过确认弹窗，可填写审批意见（非必填，默认文案「审批通过。」）。",
  },
  "dialog-approve-confirm": {
    id: "dialog-approve-confirm",
    title: "通过确认弹窗",
    content:
      "审批意见输入框（非必填，默认文案「审批通过。」）。操作：取消 / 确认通过。通过后场景状态变为已通过(approved)。",
  },
  "dialog-reject-confirm": {
    id: "dialog-reject-confirm",
    title: "驳回确认弹窗",
    content:
      "驳回原因输入框（必填）。操作：取消 / 确认驳回。驳回后场景状态变为已驳回(rejected)，创建人可查看驳回原因并修改后重新提交。",
  },

  // ===== 批次分组管理页面标注 =====
  "batches-title": {
    id: "batches-title",
    title: "批次分组管理",
    content:
      "独立于场景大厅的批次分组管理页面，功能与场景大厅内的批次弹窗一致，支持增删改查批次。副标题：管理场景建设批次分组，关联审批流程。",
  },
  "batches-create": {
    id: "batches-create",
    title: "新增批次",
    content:
      "点击打开新增批次弹窗。字段：分组名称（输入）、批次编号（自动生成，disabled）、关联审批流（Select，必填）。操作：取消 / 创建批次。",
  },
  "batches-table-name": {
    id: "batches-table-name",
    title: "分组名称",
    content: "批次分组的名称标识。",
  },
  "batches-table-code": {
    id: "batches-table-code",
    title: "批次编号",
    content: "系统自动生成的唯一编号，不可修改。",
  },
  "batches-table-workflow": {
    id: "batches-table-workflow",
    title: "审批流程",
    content: "该批次关联的审批流程模板名称。",
  },
  "batches-table-status": {
    id: "batches-table-status",
    title: "状态",
    content: "开放中：允许场景关联该批次。已截稿：不再接受新场景关联。",
  },
  "batches-action-edit": {
    id: "batches-action-edit",
    title: "编辑批次",
    content: "修改批次分组名称和关联审批流程。",
  },
  "batches-action-toggle": {
    id: "batches-action-toggle",
    title: "截稿/重新开放",
    content: "切换批次状态。截稿后该批次不再接受新场景关联，已关联场景不受影响。",
  },
  "batches-action-delete": {
    id: "batches-action-delete",
    title: "删除批次",
    content: "删除该批次分组。若批次下有关联场景，可能需要先移除关联。",
  },
  "dialog-batch-form": {
    id: "dialog-batch-form",
    title: "新增/编辑批次弹窗",
    content:
      "字段：分组名称（输入）、批次编号（自动生成，disabled，不可修改）、关联审批流（Select，必填）。操作：取消 / 创建批次 或 保存。",
  },

  // ===== 审批流程模板管理页面标注 =====
  "workflows-title": {
    id: "workflows-title",
    title: "审批流程管理",
    content:
      "教研管理员预设校内审批流模板，供批次关联使用。副标题：预设校内审批流模板，供批次关联使用。",
  },
  "workflows-create": {
    id: "workflows-create",
    title: "新增审批流程",
    content:
      "点击打开新增审批流程弹窗。字段：流程名称（必填）、流程说明（3行文本）、审批步骤（动态列表，每步含序号 Badge、步骤名称、审批角色、删除按钮）。操作：取消 / 保存。",
  },
  "workflows-table-name": {
    id: "workflows-table-name",
    title: "流程名称",
    content: "审批流程模板的名称标识，必填。",
  },
  "workflows-table-desc": {
    id: "workflows-table-desc",
    title: "流程说明",
    content: "对该审批流程用途和适用场景的简要描述。",
  },
  "workflows-table-steps": {
    id: "workflows-table-steps",
    title: "审批步骤",
    content:
      "展示该流程包含的审批步骤列表，以 Badge 形式展示每步名称和审批角色。步骤数大于1时可在编辑中调整。",
  },
  "workflows-table-date": {
    id: "workflows-table-date",
    title: "创建时间",
    content: "该审批流程模板的创建日期。",
  },
  "workflows-action-edit": {
    id: "workflows-action-edit",
    title: "编辑审批流程",
    content: "修改流程名称、说明和审批步骤列表。",
  },
  "workflows-action-delete": {
    id: "workflows-action-delete",
    title: "删除审批流程",
    content: "删除该审批流程模板。若已被批次关联，可能需要先解除关联。",
  },
  "dialog-workflow-form": {
    id: "dialog-workflow-form",
    title: "新增/编辑审批流程弹窗",
    content:
      "字段：流程名称（必填）、流程说明（3行文本）、审批步骤（动态列表，每步含圆形序号 Badge、步骤名称输入、审批角色输入、删除按钮，步骤数大于1时显示删除）。底部「添加步骤」按钮可新增步骤。操作：取消 / 保存（名称必填，且至少保留一个有效步骤）。",
  },

  // ===== 学生能力报告列表页标注 =====
  "students-title": {
    id: "students-title",
    title: "学生能力报告",
    content:
      "教师查看学生完成场景的情况和能力评估报告。支持按院系筛选和搜索，点击学生行可查看详细能力分析报告。",
  },
  "students-search": {
    id: "students-search",
    title: "搜索学生",
    content: "支持按学生姓名、学号、班级进行搜索。",
  },
  "students-dept": {
    id: "students-dept",
    title: "院系筛选",
    content: "按所属院系/部门筛选学生列表。",
  },
  "students-stat-total": {
    id: "students-stat-total",
    title: "学生总数",
    content: "当前筛选条件下的学生总人数。",
  },
  "students-stat-scenarios": {
    id: "students-stat-scenarios",
    title: "完成场景数",
    content: "学生已完成（已提交评分）的场景数量统计。",
  },
  "students-stat-score": {
    id: "students-stat-score",
    title: "平均得分",
    content: "学生在各场景中的平均评分。",
  },
  "students-stat-abilities": {
    id: "students-stat-abilities",
    title: "能力点评估",
    content: "学生已评估的能力点数量统计。",
  },
  "students-list-name": {
    id: "students-list-name",
    title: "学生姓名",
    content: "点击可跳转学生详细能力分析报告页面。",
  },
  "students-list-class": {
    id: "students-list-class",
    title: "班级",
    content: "学生所属班级信息。",
  },
  "students-list-completed": {
    id: "students-list-completed",
    title: "已完成场景",
    content: "该学生已完成并提交评分的场景数量。",
  },
  "students-list-score": {
    id: "students-list-score",
    title: "平均得分",
    content: "该学生在各场景中的平均评分，按分数区间显示不同颜色。",
  },
  "students-list-abilities": {
    id: "students-list-abilities",
    title: "能力点掌握",
    content: "展示该学生 top-3 能力掌握情况，超出显示 +N。",
  },

  // ===== 学生能力报告详情页（competency）标注 =====
  "competency-page-title": {
    id: "competency-page-title",
    title: "页面标题：学生能力报告",
    content: "后台数据来源：页面级展示，无独立数据字段。",
  },
  "competency-student-avatar": {
    id: "competency-student-avatar",
    title: "学生头像",
    content: "后台数据来源：Student.name 首字符自动生成。\n数据结构：students[] → student.name",
  },
  "competency-student-name": {
    id: "competency-student-name",
    title: "学生姓名",
    content: "后台数据来源：Student.name\n数据结构：students[] → student.name",
  },
  "competency-student-number": {
    id: "competency-student-number",
    title: "学号",
    content: "后台数据来源：Student.studentNumber\n数据结构：students[] → student.studentNumber",
  },
  "competency-student-class": {
    id: "competency-student-class",
    title: "班级",
    content: "后台数据来源：Student.class\n数据结构：students[] → student.class",
  },
  "competency-student-department": {
    id: "competency-student-department",
    title: "院系",
    content: "后台数据来源：Student.department\n数据结构：students[] → student.department",
  },
  "competency-student-enrollment-year": {
    id: "competency-student-enrollment-year",
    title: "入学年份",
    content: "后台数据来源：Student.enrollmentYear\n数据结构：students[] → student.enrollmentYear",
  },
  "competency-stat-scenarios": {
    id: "competency-stat-scenarios",
    title: "完成场景数",
    content: "后台数据来源：studentScenarioScores 按 studentId 过滤后的数组长度\n数据结构：studentScenarioScores[] → filter(s => s.studentId === studentId).length",
  },
  "competency-stat-avg-score": {
    id: "competency-stat-avg-score",
    title: "平均得分",
    content: "后台数据来源：studentScenarioScores 按 studentId 过滤后计算平均分\n计算逻辑：reduce(sum + totalScore) / scenarioScores.length\n数据结构：studentScenarioScores[].totalScore",
  },
  "competency-stat-abilities": {
    id: "competency-stat-abilities",
    title: "能力点数",
    content: "后台数据来源：studentAbilityScores 按 studentId 过滤后的数组长度\n数据结构：studentAbilityScores[] → filter(s => s.studentId === studentId).length",
  },
  "competency-tab-competency": {
    id: "competency-tab-competency",
    title: "岗位胜任度 Tab",
    content: "后台数据来源：studentAbilityScores + positionAbilities\n计算逻辑：按岗位分组后，加权计算各能力点得分（ability.score * posAbility.weight）。",
  },
  "competency-tab-scenarios": {
    id: "competency-tab-scenarios",
    title: "场景学习记录 Tab",
    content: "后台数据来源：studentScenarioScores 按 studentId 过滤\n数据结构：studentScenarioScores[] → filter(s => s.studentId === studentId)",
  },
  "competency-position-name": {
    id: "competency-position-name",
    title: "岗位名称",
    content: "后台数据来源：professions → positions\n通过 positionId 在 professions.flatMap(p => p.positions) 中匹配名称。",
  },
  "competency-position-score": {
    id: "competency-position-score",
    title: "岗位胜任度百分比",
    content: "后台数据来源：studentAbilityScores + positionAbilities\n计算逻辑：Σ(ability.score × posAbility.weight) / Σ(posAbility.weight)，结果四舍五入。",
  },
  "competency-overall-label": {
    id: "competency-overall-label",
    title: "综合胜任度",
    content: "后台数据来源：studentAbilityScores + positionAbilities\n与「岗位胜任度百分比」同值，以进度条形式展示。",
  },
  "competency-ability-name": {
    id: "competency-ability-name",
    title: "能力点名称",
    content: "后台数据来源：studentAbilityScores.abilityName\n数据结构：studentAbilityScores[] → abilityName",
  },
  "competency-ability-level": {
    id: "competency-ability-level",
    title: "能力等级",
    content: "后台数据来源：studentAbilityScores.level\n枚举值：expert(精通) / proficient(熟练) / familiar(了解) / beginner(待提升)。\n通过 getAbilityLevelLabel() 转换为中文标签。",
  },
  "competency-ability-weight": {
    id: "competency-ability-weight",
    title: "能力点权重",
    content: "后台数据来源：positionAbilities.weight\n数据结构：positionAbilities[] → weight（百分比）",
  },
  "competency-ability-score": {
    id: "competency-ability-score",
    title: "能力点得分",
    content: "后台数据来源：studentAbilityScores.score\n数据结构：studentAbilityScores[] → score（0-100）",
  },
  "competency-scenario-contribution": {
    id: "competency-scenario-contribution",
    title: "场景贡献",
    content: "后台数据来源：studentAbilityScores.scenarioContributions\n数据结构：scenarioContributions[] → { scenarioId, scenarioName, contribution }\n展示各场景对该能力点的得分贡献。",
  },
  "competency-scenario-name": {
    id: "competency-scenario-name",
    title: "场景名称（学习记录）",
    content: "后台数据来源：studentScenarioScores.scenarioName\n数据结构：studentScenarioScores[] → scenarioName",
  },
  "competency-scenario-position": {
    id: "competency-scenario-position",
    title: "场景关联岗位",
    content: "后台数据来源：studentScenarioScores.positionName\n数据结构：studentScenarioScores[] → positionName",
  },
  "competency-scenario-completed-at": {
    id: "competency-scenario-completed-at",
    title: "完成时间",
    content: "后台数据来源：studentScenarioScores.completedAt\n数据结构：studentScenarioScores[] → completedAt（YYYY-MM-DD 格式）",
  },
  "competency-scenario-total-score": {
    id: "competency-scenario-total-score",
    title: "场景总得分",
    content: "后台数据来源：studentScenarioScores.totalScore\n数据结构：studentScenarioScores[] → totalScore",
  },
  "competency-task-name": {
    id: "competency-task-name",
    title: "任务名称",
    content: "后台数据来源：studentScenarioScores.taskScores.taskName\n数据结构：studentScenarioScores[].taskScores[] → taskName",
  },
  "competency-task-score": {
    id: "competency-task-score",
    title: "任务得分",
    content: "后台数据来源：studentScenarioScores.taskScores.score\n数据结构：studentScenarioScores[].taskScores[] → score",
  },
  "competency-task-max-score": {
    id: "competency-task-max-score",
    title: "任务满分",
    content: "后台数据来源：studentScenarioScores.taskScores.maxScore\n数据结构：studentScenarioScores[].taskScores[] → maxScore",
  },

  // ===== 场景评分管理页面标注 =====
  "grading-title": {
    id: "grading-title",
    title: "场景评分管理",
    content:
      "教师查看已发布场景下的学生提交，按任务和测评形式维度进行评分管理。页面采用左右分栏布局。",
  },
  "grading-sidebar-search": {
    id: "grading-sidebar-search",
    title: "场景搜索",
    content: "按场景名称/编码搜索左侧场景列表。",
  },
  "grading-sidebar-position": {
    id: "grading-sidebar-position",
    title: "岗位分组",
    content:
      "左侧场景列表按岗位分组折叠展示。岗位名 + 场景数量，点击展开/折叠。",
  },
  "grading-sidebar-scenario": {
    id: "grading-sidebar-scenario",
    title: "场景卡片",
    content:
      "每个场景卡片展示：场景名称 + 编码 + 统计（任务数、待评分、已评分、学生数）。点击选中后右侧展示该场景的任务分组。",
  },
  "grading-task-header": {
    id: "grading-task-header",
    title: "任务评分区",
    content:
      "右侧展示选中场景的任务列表，每个任务为一个折叠面板。头部：任务名 + 任务类型（训练/考核）+ 测评形式 + 待评分/已评分数量。",
  },
  "grading-task-expand": {
    id: "grading-task-expand",
    title: "任务展开",
    content:
      "展开后按测评形式分 Tab 展示学生提交列表。学生提交列表表格：学生姓名、学号、班级、入学年份、提交状态、操作（进入评分）。",
  },
  "grading-action-view": {
    id: "grading-action-view",
    title: "查看",
    content: "查看学生提交的测评详情。",
  },
  "grading-action-grade": {
    id: "grading-action-grade",
    title: "评分",
    content:
      "跳转不同类型的评分详情页。试卷/题库：展示学生客观题答案与正误对比，主观题需教师人工评分。现场问答：记录教师现场抽题和学生回答情况，按评价点打分。现场评审：查看学生提交的材料，按评审量规的多维度评价点打分。",
  },
  "grading-task-form-tabs": {
    id: "grading-task-form-tabs",
    title: "测评形式切换",
    content:
      "展开任务后，若该任务配置了多种测评形式（如现场问答+现场评审），则以 Tab 形式切换展示不同测评形式下的学生提交列表。当前选中的测评形式以主色高亮显示。",
  },

  // ===== 场景编辑器 — 步骤1 基础信息标注 =====
  "editor-step1-cancel": {
    id: "editor-step1-cancel",
    title: "取消",
    content: "点击返回场景大厅，不保存当前编辑内容。",
  },
  "editor-step1-save": {
    id: "editor-step1-save",
    title: "保存草稿",
    content: "将当前场景数据保存（步骤1+步骤2数据）。保存后场景状态为草稿(draft)。",
  },
  "editor-step1-preview": {
    id: "editor-step1-preview",
    title: "预览",
    content: "打开预览弹窗，使用学生端场景展示页面查看当前场景效果。",
  },
  "editor-step1-next": {
    id: "editor-step1-next",
    title: "下一步",
    content: "必填校验通过后可用（场景名称非空），跳转步骤2（任务链配置）页面。",
  },
  "editor-field-position": {
    id: "editor-field-position",
    title: "目标岗位",
    content:
      "自定义复合选择器，点击展开浮层：含 Tabs（我的/共建/公共库）、搜索框、按专业分组展示岗位。选中后自动填充「适用专业」。非必填。",
  },
  "editor-field-batch": {
    id: "editor-field-batch",
    title: "所属批次",
    content: "选择器，选择该场景关联的批次分组。非必填。",
  },
  "editor-field-name": {
    id: "editor-field-name",
    title: "场景名称",
    content: "必填，输入框，placeholder 请输入场景名称。",
  },
  "editor-field-code": {
    id: "editor-field-code",
    title: "场景编码",
    content: "系统自动生成（SC-XXXXXXXXXX），disabled，不可修改。",
  },
  "editor-field-industry": {
    id: "editor-field-industry",
    title: "面向行业",
    content: "多选标签选择器，非必填，支持搜索，选中项以 Tag 形式展示，可逐个删除。",
  },
  "editor-field-profession": {
    id: "editor-field-profession",
    title: "适用专业",
    content: "多选标签选择器，非必填，选中岗位后自动填充，同上面向行业组件。",
  },
  "editor-field-difficulty": {
    id: "editor-field-difficulty",
    title: "难度等级",
    content: "星级选择器，1-5 星，点击切换。对应文案：1入门/2基础/3中级/4高级/5专家。",
  },
  "editor-field-intro": {
    id: "editor-field-intro",
    title: "场景介绍",
    content: "富文本编辑器，含工具栏的富文本编辑器。placeholder 提示编写背景、意义和学习目标。",
  },
  "editor-sidebar-cover": {
    id: "editor-sidebar-cover",
    title: "场景封面",
    content: "虚线边框上传区（aspect-video），placeholder：点击上传封面图片，需要支持裁切功能。",
  },
  "editor-sidebar-creator": {
    id: "editor-sidebar-creator",
    title: "创建人",
    content: "只读展示 creatorName。",
  },
  "editor-sidebar-cobuilders": {
    id: "editor-sidebar-cobuilders",
    title: "共建人/共建部门",
    content: "点击打开「选择共建人」穿梭框弹窗。已选人以 Tag 展示，可删除。",
  },
  "editor-sidebar-version": {
    id: "editor-sidebar-version",
    title: "当前版本号",
    content: "只读展示，根据规则自动升级。",
  },
  "dialog-cobuilder-select": {
    id: "dialog-cobuilder-select",
    title: "选择共建人",
    content:
      "左右分栏穿梭框。左侧：组织架构搜索框（搜索用户或部门）、按部门折叠树（部门名+展开/折叠+人数）、展开后用户列表（复选框+用户名+角色标签）。右侧：已选数量、已选用户列表（用户名+部门+删除按钮）。操作：完成（关闭弹窗，无取消按钮，穿梭框即时生效）。",
  },

  // ===== 场景编辑器 — 步骤2 任务链配置标注 =====
  "editor-step2-back": {
    id: "editor-step2-back",
    title: "返回上一步",
    content: "返回步骤 1 基础信息编辑页，不丢失已配置的任务链数据。",
  },
  "editor-step2-save": {
    id: "editor-step2-save",
    title: "保存草稿",
    content: "将当前场景数据保存（步骤1+步骤2数据）。保存后场景状态为草稿(draft)。",
  },
  "editor-step2-preview": {
    id: "editor-step2-preview",
    title: "预览",
    content: "打开预览弹窗，使用学生端场景展示页面查看当前场景效果。",
  },
  "editor-step2-finish": {
    id: "editor-step2-finish",
    title: "完成配置",
    content: "点击返回场景大厅，同时保存当前场景数据（步骤1+步骤2数据）。",
  },
  "editor-scenario-summary": {
    id: "editor-scenario-summary",
    title: "场景信息摘要卡片",
    content:
      "展示当前场景的关键信息：场景名称+共建状态、岗位名|行业名|专业名+共建人列表（Tag形式）、难度星级+版本号、场景背景介绍文本。",
  },
  "editor-task-list-title": {
    id: "editor-task-list-title",
    title: "任务列表",
    content: "展示当前场景下的所有任务，标题旁显示任务数量。",
  },
  "editor-task-weight-hint": {
    id: "editor-task-weight-hint",
    title: "权重校验提示",
    content:
      "展示当前所有任务权重加总值。当所有任务权重加总=100% 时绿色背景；否则黄色背景，提示需调整。",
  },
  "editor-add-task": {
    id: "editor-add-task",
    title: "添加任务",
    content:
      "打开「添加任务」弹窗。字段：任务名称（必填）、任务类型（训练任务/考核任务）、预估学时（数字，附带说明文字「学生完成任务的预估时长」）、难度（星级选择器，1-5星）、背景介绍（纯文本输入框，预留3行高度）。操作：取消 / 添加。",
  },
  "editor-clone-task": {
    id: "editor-clone-task",
    title: "克隆/引用任务",
    content:
      "打开「克隆/引用任务」弹窗。顶部模式切换：克隆（可编辑）/ 引用（只读）。搜索框按任务名称/编码/关联场景搜索。Tab：我的/共建/公共库。列表展示任务名称、编码、关联场景、关联岗位，点击行切换复选框选中态。操作：取消 / 确定。",
  },
  "editor-config-weight": {
    id: "editor-config-weight",
    title: "配置任务权重",
    content:
      "打开「权重配置」弹窗。每个任务一行：任务名称 + 权重数字输入框 + 锁定开关。锁定任务在「均匀分配」时权重保持不变。「一键平均分配」按钮：按未锁定任务平均分配权重，确保总和为100%。底部总权重实时计算，不等于100%时黄色高亮提示。",
  },
  "editor-card-info": {
    id: "editor-card-info",
    title: "配置任务基础信息",
    content:
      "点击打开编辑弹窗。字段：任务名称（纯文本输入框，1行）、任务类型（训练/考核）、预估学时（附带说明文案）、难度（星级选择器，1-5星）、背景（纯文本输入框，3行）。",
  },
  "editor-card-description": {
    id: "editor-card-description",
    title: "配置任务说明",
    content:
      "点击打开编辑弹窗。Tab切换：富文本编辑 / 上传任务说明书。富文本编辑含工具栏（标题/正文/加粗/斜体/下划线/删除线/对齐/列表/引用/代码/链接/图片/视频/表格/分割线/字体颜色/背景色），编辑区带默认模板文案（任务描述/任务目标/任务结果/测评要求）。PDF上传支持点击/拖拽，已上传后展示PDF图标+文件名+移除文件按钮（只允许上传1个）。",
  },
  "editor-card-knowledge": {
    id: "editor-card-knowledge",
    title: "考查知识点",
    content:
      "点击打开编辑弹窗。左右分栏布局（左3/5，右2/5）。顶部搜索栏搜索知识点名称/描述/编码。左侧知识点库列表展示名称、编码、描述、操作（详情/引用/克隆/取消）。右侧已选知识点以网格卡片展示（名称、描述、关联颗粒课Tag）。支持新增/克隆/编辑知识点，以及颗粒课选择弹窗。",
  },
  "editor-card-ability": {
    id: "editor-card-ability",
    title: "考查能力点",
    content:
      "点击打开编辑弹窗。若场景未关联岗位，展示警告提示「请先关联岗位后，再选择考察能力点」。顶部搜索栏+统计「共N个关联能力点，已选M个」。按「能力领域」分组折叠展示能力点卡片，每行含复选框、名称、编码、掌握程度（了解/理解/掌握/熟练/精通，各有颜色）、描述、关联岗位Tag。支持能力点详情弹窗。",
  },
  "editor-card-resources": {
    id: "editor-card-resources",
    title: "配置任务资源",
    content:
      "点击打开编辑弹窗。左右分栏布局（左4/5，右1/5）。顶部工具栏：资源类型筛选标签（全部/文档/表格/图片/链接/音频/视频/压缩包/场地/设施设备/软件/其他）、搜索框、上传资源按钮。左侧资源库网格卡片展示（缩略图+类型Badge+选中角标+信息+预览/选择按钮）。右侧已选资源列表。支持上传资源（11种类型）并填写特定字段。",
  },
  "editor-card-evaluation": {
    id: "editor-card-evaluation",
    title: "配置任务测评形式",
    content:
      "点击打开编辑弹窗。按分类分组展示（基础考核/综合评估/互动评价/智能评测），每组一个浅色背景卡片区。每个测评形式以卡片按钮展示：左侧图标+名称+描述，右侧「查看介绍」按钮（书本图标，点击新开标签页跳转）。本期仅4种测评形式可用：现场问答、现场评审、试卷、题库。其余均显示未开通状态（灰色+未开通水印）。点击卡片切换选中/取消选中（仅对已开通有效）。",
  },
  "editor-card-evaluation-rules": {
    id: "editor-card-evaluation-rules",
    title: "配置任务评价规则",
    content:
      "点击打开编辑弹窗。本节为最复杂配置模块，包含评价点管理、评分主体配置、各测评形式的细化规则。测评形式配置概览：对已选每种测评形式展示概览卡片，点击展开详细配置面板。包含：测评对象配置（个人/小组）、评分主体配置（教师/企业导师/自评/互评/AI评价/服务对象，每行用开关控制启用/禁用）、各测评形式测评资源配置（现场问答/现场评审/试卷/题库各有独立配置）、评价标准配置管理（评价量规/评分规则）。",
  },
  "editor-card-weight": {
    id: "editor-card-weight",
    title: "配置任务权重",
    content:
      "在任务列表的 weight 卡片中只读展示百分比。点击「配置任务权重」按钮打开弹窗：每个任务一行（任务名称+权重数字输入框+锁定开关）。锁定任务在「均匀分配」时权重保持不变。底部总权重实时计算，不等于100%时黄色高亮提示。",
  },

  // ===== 岗位能力点管理页面标注 =====
  "positions-title": {
    id: "positions-title",
    title: "岗位能力点管理",
    content: "管理各岗位关联的能力点体系，按能力领域分组展示能力点，支持添加、编辑、删除能力点。",
  },

  // ===== 数据统计工作台页面标注 =====
  "dashboard-title": {
    id: "dashboard-title",
    title: "数据统计工作台",
    content: "平台核心数据统计概览，包括场景建设进度、审批状态分布、学生参与情况、能力点覆盖等关键指标。",
  },

  // ===== 任务链配置 — 弹窗标注 =====
  "dialog-knowledge-form": {
    id: "dialog-knowledge-form",
    title: "新增/克隆/编辑知识点",
    content:
      "字段：知识点名称（必填）、描述、编码（新增/克隆时自动生成不可改，编辑时可改）、关联颗粒课（Tag展示 + 选择颗粒课按钮 + 新建颗粒课外链按钮）。操作：取消 / 新增并选中 或 克隆并选中 或 保存修改。",
  },
  "dialog-knowledge-detail": {
    id: "dialog-knowledge-detail",
    title: "知识点详情",
    content:
      "展示：名称、知识点描述、编码、关联颗粒课列表。引用知识点标注「引用（不可编辑）」；自定义知识点标注「自定义（可编辑）」，并支持「引用颗粒课」「新增颗粒课」按钮。",
  },
  "dialog-ability-detail": {
    id: "dialog-ability-detail",
    title: "能力点详情",
    content:
      "展示：能力点名称、描述、所属领域、关联岗位、掌握程度要求（了解/理解/掌握/熟练/精通）、熟练程度描述。能力点数据来源于岗位功能，不从本模块维护。",
  },
  "dialog-resource-type-select": {
    id: "dialog-resource-type-select",
    title: "选择资源类型",
    content:
      "网格展示11种资源类型图标+名称（文档、表格、图片、链接、音频、视频、压缩包、场地、设施设备、软件、其他），点击后进入上传弹窗并预填类型。",
  },
  "dialog-resource-upload": {
    id: "dialog-resource-upload",
    title: "上传资源到公共库",
    content:
      "通用字段：资源名称（必填）、资源描述。根据资源类型展示特定字段：链接(URL)、场地(地址/开放时间/容纳人数/联系人)、设施设备(位置/数量)、软件(版本号/下载链接/授权信息)、文件类(上传拖拽区，支持多种格式最大100MB)。操作：取消 / 上传并选中。",
  },
  "dialog-link-ability": {
    id: "dialog-link-ability",
    title: "关联能力点",
    content:
      "左右分栏：左侧全部能力点列表（搜索+复选框），右侧已选列表。按能力领域分组折叠展示。操作：确定。",
  },
  "dialog-link-knowledge": {
    id: "dialog-link-knowledge",
    title: "关联知识点",
    content:
      "左右分栏：左侧全部知识点列表（搜索+复选框），右侧已选列表。操作：确定。",
  },
  "dialog-eval-from-ability": {
    id: "dialog-eval-from-ability",
    title: "从能力点创建评价维度",
    content:
      "基于已选能力点快速生成评价维度。选择能力点后，系统自动填充评价维度名称，并关联对应能力点。",
  },
  "dialog-eval-from-knowledge": {
    id: "dialog-eval-from-knowledge",
    title: "从知识点创建评价维度",
    content:
      "基于已选知识点快速生成评价维度。选择知识点后，系统自动填充评价维度名称，并关联对应知识点。",
  },
  "dialog-save-template": {
    id: "dialog-save-template",
    title: "保存到模板",
    content:
      "将当前配置好的评价量规表或评分规则配置表保存为模板，供后续任务快速复用。输入模板名称后确认保存。",
  },
  "dialog-edit-grade-level": {
    id: "dialog-edit-grade-level",
    title: "编辑评分等级",
    content:
      "等级名称输入（如A/B/C/D）、颜色圆点、分数区间（min-max数字输入）、等级备注（一句话辅助教师参考）。可新增删除修改等级。",
  },
  "dialog-eval-order": {
    id: "dialog-eval-order",
    title: "评价方式顺序配置",
    content:
      "配置多种测评形式的执行顺序。拖拽调整顺序，影响学生端测评的呈现和提交顺序。",
  },
  "dialog-eval-weight": {
    id: "dialog-eval-weight",
    title: "评价方式权重配置",
    content:
      "为当前任务已选的各测评形式配置权重占比。每个测评形式一行：名称+权重数字输入框。底部实时计算总权重，需等于100%。",
  },
  "dialog-test-object": {
    id: "dialog-test-object",
    title: "测评对象配置",
    content:
      "2种测评对象：个人或小组。目前无实际功能区分，仅作数据记录。选择后影响评分维度。",
  },
  "dialog-eval-subject": {
    id: "dialog-eval-subject",
    title: "评价主体配置",
    content:
      "4种评分主体，每行用开关控制启用/禁用：教师（专业背景/评分人数/记分规则/权重/最低教龄）、企业导师（专业领域/工作年限/岗位经历/评分人数/记分规则/权重）、自评（是否需要反思/反思最低字数/权重）、互评（互评人数/互评规则/是否匿名/权重）。",
  },
  "dialog-test-resource": {
    id: "dialog-test-resource",
    title: "测评资源配置",
    content:
      "根据已选测评形式配置对应资源：现场问答（题库选题/抽题规则）、现场评审（评审材料要求/评审步骤配置）、试卷（试卷库选择/新建试卷/参数配置）、题库（题库选题/抽题规则）。",
  },
  "dialog-eval-standard": {
    id: "dialog-eval-standard",
    title: "评价标准配置",
    content:
      "每个测评形式独立维护评价点列表。支持评价量规（评价维度+关联能力点+关联知识点+等级转换规则+权重）和评分规则（评价项+加减分规则+分值）两种类型。支持保存为模板、一键覆盖、删除模板。",
  },
  "dialog-question-detail": {
    id: "dialog-question-detail",
    title: "题目详情",
    content: "展示题目完整信息：题干、题型、选项/答案、分值、关联知识点/能力点。",
  },
  "dialog-add-question": {
    id: "dialog-add-question",
    title: "新增题目",
    content:
      "添加新题目到题库。字段：题干、题型（单选/多选/判断/填空/简答）、选项与正确答案、分值、关联知识点/能力点。",
  },
  "dialog-paper-detail": {
    id: "dialog-paper-detail",
    title: "试卷详情",
    content: "展示试卷完整信息：试卷名称、题数、总分、题目列表、各题分值。",
  },
  "dialog-create-paper": {
    id: "dialog-create-paper",
    title: "新建试卷",
    content: "创建新试卷。字段：试卷名称、选题（从题库勾选）、题目排序、分值设置。完成后跳转测评认证中心查看。",
  },
  "dialog-link-knowledge-eval": {
    id: "dialog-link-knowledge-eval",
    title: "关联知识点（评价标准）",
    content:
      "在评价标准配置中，为当前评价维度关联知识点。展示已关联知识点Tag（可删除）+ 添加知识点按钮（打开知识点搜索弹窗）。",
  },
  "dialog-link-ability-eval": {
    id: "dialog-link-ability-eval",
    title: "关联能力点（评价标准）",
    content:
      "在评价标准配置中，为当前评价维度关联能力点。展示已关联能力点Tag（可删除）+ 添加能力点按钮（打开能力点搜索弹窗）。",
  },

  // ===== 弹窗内部操作按钮标注 =====
  "kp-action-detail": {
    id: "kp-action-detail",
    title: "详情",
    content: "打开知识点详情弹窗，展示该知识点的名称、描述、编码、关联颗粒课列表。引用知识点不可编辑，自定义知识点可编辑。",
  },
  "kp-action-reference": {
    id: "kp-action-reference",
    title: "引用",
    content: "将该知识点以引用状态加入右侧已选列表。引用知识点右下角带灰色「引用」角标，不可编辑，关联颗粒课同步保留。",
  },
  "kp-action-clone": {
    id: "kp-action-clone",
    title: "克隆",
    content: "基于该知识点创建副本（自定义状态），自动填充名称+「克隆」后缀，生成新编码，加入右侧已选列表。自定义知识点可编辑。",
  },
  "kp-action-cancel": {
    id: "kp-action-cancel",
    title: "取消",
    content: "从右侧已选知识点列表中移除该知识点。",
  },
  "kp-right-delete": {
    id: "kp-right-delete",
    title: "删除已选知识点",
    content: "从右侧已选列表中移除该知识点。",
  },
  "ability-action-select": {
    id: "ability-action-select",
    title: "选择能力点",
    content: "点击整行或「选择」按钮，将该能力点加入已选列表。已选中行左侧带高亮背景。",
  },
  "ability-action-cancel": {
    id: "ability-action-cancel",
    title: "取消选择能力点",
    content: "从已选能力点列表中移除该能力点。",
  },
  "resource-action-preview": {
    id: "resource-action-preview",
    title: "预览资源",
    content: "在新标签页中预览该资源（外链按钮）。",
  },
  "resource-action-select": {
    id: "resource-action-select",
    title: "选择资源",
    content: "点击卡片或「选择」按钮，将该资源加入右侧已选资源列表。",
  },
  "resource-action-cancel": {
    id: "resource-action-cancel",
    title: "取消选择资源",
    content: "从右侧已选资源列表中移除该资源。",
  },
  "eval-action-view-intro": {
    id: "eval-action-view-intro",
    title: "查看介绍",
    content: "点击后新开标签页跳转，查看该测评形式的详细介绍说明。",
  },
  "eval-action-select": {
    id: "eval-action-select",
    title: "选择测评形式",
    content: "点击卡片切换选中/取消选中（仅对已开通的测评形式有效）。选中后该测评形式将用于当前任务的评测。",
  },
  "eval-rule-add-dimension": {
    id: "eval-rule-add-dimension",
    title: "新增评价维度",
    content: "在底部输入框输入评价维度名称后按回车或点击添加。新增维度后需配置关联能力点、关联知识点、等级转换规则和权重。",
  },
  "eval-rule-add-item": {
    id: "eval-rule-add-item",
    title: "新增评价项",
    content: "在底部输入框输入评价项名称后按回车或点击添加。新增评价项后需配置标准描述、加减分规则、分值。",
  },
  "eval-rule-onekey-split": {
    id: "eval-rule-onekey-split",
    title: "一键均分",
    content: "将所有评价维度/评价项的权重/分值进行平均分配，确保总和为100%。",
  },
  "eval-rule-save-template": {
    id: "eval-rule-save-template",
    title: "保存为模板",
    content: "将当前配置好的评价量规表或评分规则配置表保存为模板，供后续任务快速复用。",
  },
  "eval-rule-apply-template": {
    id: "eval-rule-apply-template",
    title: "应用模板",
    content: "选择已保存的模板一键覆盖当前评价标准配置。",
  },
  "eval-subject-toggle": {
    id: "eval-subject-toggle",
    title: "评分主体开关",
    content: "每行评分主体使用开关控制启用/禁用。启用后展示该主体的参数配置区（专业背景、评分人数、记分规则、权重等）。",
  },
  "paper-action-view": {
    id: "paper-action-view",
    title: "查看试卷",
    content: "跳转测评认证中心查看试卷详情（题数、总分、题目列表）。",
  },
  "paper-action-create": {
    id: "paper-action-create",
    title: "新建试卷",
    content: "跳转测评认证中心配置新试卷。",
  },
  "qb-action-select": {
    id: "qb-action-select",
    title: "选用题目",
    content: "勾选题目加入已选列表。已选题目可配置分值。",
  },
  "qb-action-cancel": {
    id: "qb-action-cancel",
    title: "取消选用",
    content: "从已选题目列表中移除该题目。",
  },

  // ==================== 场景任务评价页面 (rating edit) ====================
  "rating-page-title": {
    id: "rating-page-title",
    title: "总评规则配置",
    content: "场景第三步：配置各任务的权重占比和成绩等级映射规则。权重总和必须等于100%，系统提供均匀分配和锁定功能辅助调整。",
  },
  "rating-header-back": {
    id: "rating-header-back",
    title: "返回任务配置",
    content: "返回上一步「任务配置」页面，继续编辑任务列表、评价规则、题目设置等内容。",
  },
  "rating-header-save-draft": {
    id: "rating-header-save-draft",
    title: "保存草稿",
    content: "保存当前权重和等级映射的配置为草稿状态，不触发完整校验，可随时返回继续编辑。",
  },
  "rating-header-preview": {
    id: "rating-header-preview",
    title: "预览",
    content: "预览当前总评规则配置的效果，包括权重分配展示和等级映射结果。",
  },
  "rating-header-save": {
    id: "rating-header-save",
    title: "保存规则",
    content: "保存总评规则配置并返回任务配置页面。保存前会校验权重总和是否为100%，若不满足则给出提示。",
  },
  "rating-weight-card": {
    id: "rating-weight-card",
    title: "任务权重分配",
    content: "为每个任务设置其在总评成绩中的权重占比。所有任务权重之和必须等于100%。支持单个调整、均匀分配和锁定固定值。",
  },
  "rating-weight-total": {
    id: "rating-weight-total",
    title: "总权重显示",
    content: "实时显示当前所有任务权重的总和。当总和等于100%时显示绿色，不等于100%时显示琥珀色并提示差值。",
  },
  "rating-weight-distribute": {
    id: "rating-weight-distribute",
    title: "均匀分配",
    content: "一键将未锁定的任务权重进行平均分配，确保总和为100%。已锁定的任务权重保持不变，剩余权重在解锁任务间均分。",
  },
  "rating-weight-progress": {
    id: "rating-weight-progress",
    title: "权重占比进度条",
    content: "可视化展示各任务权重的占比分布，每种颜色对应一个任务，直观反映权重分配情况。",
  },
  "rating-weight-row": {
    id: "rating-weight-row",
    title: "单个任务权重行",
    content: "显示任务序号、名称和权重输入框。可手动输入0-100的整数值调整权重，或使用右侧锁定按钮固定该任务权重。",
  },
  "rating-weight-lock": {
    id: "rating-weight-lock",
    title: "权重锁定/解锁",
    content: "锁定后该任务权重值固定不变，执行「均匀分配」时不受影响。解锁后可自由调整或由系统自动分配。",
  },
  "rating-grade-card": {
    id: "rating-grade-card",
    title: "成绩等级映射",
    content: "为每个任务配置分数段与成绩等级的对应关系。默认提供A/B/C/D四个等级（90-100/75-89/60-74/0-59），可自定义调整等级名称和分数区间。",
  },
  "rating-grade-task-selector": {
    id: "rating-grade-task-selector",
    title: "任务选择器",
    content: "点击不同任务按钮切换当前正在配置等级映射的任务。每个任务可独立设置不同的等级映射规则。",
  },
  "rating-grade-edit-toggle": {
    id: "rating-grade-edit-toggle",
    title: "编辑等级",
    content: "点击后进入等级编辑模式，可修改等级名称（如A/B/C/D）、调整各等级的最低分和最高分区间。再次点击完成编辑。",
  },
  "rating-grade-visual-bar": {
    id: "rating-grade-visual-bar",
    title: "可视化等级条",
    content: "以彩色条形图展示当前任务各等级所占的分数区间宽度，直观显示等级分布。颜色与下方等级卡片对应。",
  },
  "rating-grade-score-card": {
    id: "rating-grade-score-card",
    title: "等级卡片",
    content: "展示单个等级的名称、颜色标识和分数区间。编辑模式下可修改等级名称和分数上下限。",
  },
  "rating-score-preview": {
    id: "rating-score-preview",
    title: "分数模拟测试",
    content: "输入一个测试分数，系统根据当前等级映射规则实时显示对应的成绩等级。用于验证等级映射配置是否正确。",
  },
  "rating-formula": {
    id: "rating-formula",
    title: "成绩计算公式",
    content: "展示最终总成绩的计算公式：各任务得分 × 对应权重后求和。公式根据当前权重配置动态更新。",
  },
}

/** 从 localStorage 读取用户覆盖 */
function getOverrides(): Record<string, AnnotationItem> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("prd-annotations-overrides")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** 通过 ID 快速获取标注内容（优先 localStorage 覆盖） */
export function getAnnotation(id: string): AnnotationItem | undefined {
  const overrides = getOverrides()
  return overrides[id] ?? sceneHallAnnotations[id]
}

/** 获取所有用户覆盖数据（供导出使用） */
export function getAllOverrides(): Record<string, AnnotationItem> {
  return getOverrides()
}
