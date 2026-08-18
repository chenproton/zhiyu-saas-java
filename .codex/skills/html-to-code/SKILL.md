---
name: html-to-code
description: |
  base-dev-framework6-java HTML 设计稿/原型转前端代码指南。把 HTML 静态稿、Figma 导出、AI 生成的原型，转换成 6.x 前端工程认可的代码——目标二选一：Element Plus(Vue3 + script setup) 或 Ant Design Pro(React + ProComponents)，按 gen_table.frontend_type 决定。对齐代码生成器 fm/vue 与 fm/react 模板的页面骨架（搜索卡片 + 表格卡片 + 工具栏 + 分页 + 弹窗表单），字典走 useDict，权限 Vue 用 v-hasPermi、React 用 hasPermi。

  触发场景：
  - 拿到一张 HTML 后台列表/表单设计稿，要落成 6.x 的 index.vue 或 index.tsx
  - 拿到一段 HTML 区块（统计卡片、筛选栏、工具栏），只想转某个局部组件
  - 设计师给了整页原型，要按代码生成器布局骨架还原成框架页面
  - 把 AI 生成的 Tailwind/原生 CSS 原型对齐到 Element Plus 或 Ant Design Pro 组件
  - 不确定该用 Vue 还是 React，需要先确认 frontend_type 再开干

  触发词：HTML转代码、设计稿转换、原型转代码、HTML转前端、HTML转Vue、HTML转React、设计稿转页面、UI原型转换、区块转换、组件转换、Element Plus、Ant Design Pro、html-to-code
---

# base-dev-framework6-java HTML 设计稿转前端代码指南

## 概述

本技能把 **HTML 设计稿 / 原型 / 静态页面**，转换成 base-dev-framework6-java前端工程能直接落地的代码。

本项目前端工程在**仓库内 `frontend/plus-ui/` 目录**（前后端一体化），支持两套技术栈，由数据库 `gen_table.frontend_type` 字段决定：

| frontend_type | 技术栈 | 页面文件 | 组件库 | 表单库 |
|---------------|--------|----------|--------|--------|
| `vue` | Vue3 + `<script setup lang="ts">` | `index.vue` | **Element Plus**（`el-*`） | `el-form` + rules |
| `react` | React + TSX | `index.tsx` | **Ant Design Pro**（ProComponents） | `ProForm` / `ModalForm` |

转换的**黄金参照**不是凭空设计，而是代码生成器自带的 FreeMarker 模板：

- Vue 端：`backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/vue/index.vue.ftl`、`api.ts.ftl`、`types.ts.ftl`
- React 端：`backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/react/index.tsx.ftl`、`api.ts.ftl`、`types.ts.ftl`

> **核心原则**：转换出来的代码必须"像生成器生成的一样"，而不是把 HTML 原样塞进 `<template>`。设计稿只决定**布局意图与字段**，最终结构对齐生成器骨架。

### 转换前必问三件事

1. **frontend_type 是哪个？** —— `vue`（Element Plus）还是 `react`（Ant Design Pro）。不确定就问用户或查 `gen_table` 表，**绝不默认**。
2. **是整页还是区块？** —— 整页 CRUD 列表走"整页转换流程"；单独一块（卡片/筛选栏/工具栏）走"单组件转换"。
3. **字段从哪来？** —— 优先从已有 Entity/`types.ts` 拿真实字段名（`javaField`），其次从设计稿文案推断，**禁止编造不存在的字段**。

---

## 组件映射表（HTML → Element Plus / Ant Design Pro）

下表是转换的字典。左列是 HTML 设计稿里的典型元素/意图，中列是 Vue(Element Plus) 对应组件，右列是 React(Ant Design Pro) 对应组件。

### 布局与容器

| HTML 设计稿 | Element Plus(Vue) | Ant Design Pro(React) |
|-------------|-------------------|------------------------|
| 页面最外层 `<div class="page">` | `<div class="p-2">` 根容器 | `<PageContainer title="...">` |
| 搜索区 `<div class="search">` / `<form>` | `<el-card class="search-panel">` + `<el-form :inline="true">` | ProTable 内置 `search={{ labelWidth: 90 }}` |
| 数据区卡片 `<div class="card">` | `<el-card class="table-panel">` | `<ProTable>`（自带卡片外壳） |
| 卡片标题 `<div class="header">` | `<template #header>` | `toolbar={{ title: '...' }}` |
| 栅格 `<div class="row/col">` | `<el-row>` / `<el-col>` | `<Row>` / `<Col>`（antd） |
| 标签页 `<div class="tabs">` | `<el-tabs>` / `<el-tab-pane>` | `<Tabs>`（antd） |

### 表单元素

| HTML 设计稿 | Element Plus(Vue) | Ant Design Pro(React) |
|-------------|-------------------|------------------------|
| 表单 `<form>` | `<el-form :model :rules>` | `<ModalForm>` / `<ProForm>` |
| 表单项 `<label>+<input>` | `<el-form-item label prop>` | （ProForm 字段自带 label） |
| 文本框 `<input type="text">` | `<el-input v-model>` | `<ProFormText name label>` |
| 多行 `<textarea>` | `<el-input type="textarea">` | `<ProFormTextArea>` |
| 数字框 `<input type="number">` | `<el-input-number>` | `<ProFormDigit min={0}>` |
| 下拉 `<select>` | `<el-select>` + `<el-option>` | `<ProFormSelect options={...}>` |
| 单选 `<input type="radio">` | `<el-radio-group>` + `<el-radio>` | `<ProFormRadio.Group>` / `ProFormSelect` |
| 多选 `<input type="checkbox">` | `<el-checkbox-group>` + `<el-checkbox>` | `<ProFormCheckbox.Group>` |
| 开关 toggle | `<el-switch>` | `<Switch>`（包在 `<Form.Item valuePropName="checked">`） |
| 日期 `<input type="date">` | `<el-date-picker type="date">` | `<ProFormDateTimePicker>` |
| 日期区间 | `<el-date-picker type="daterange">` | ProTable 列 `valueType: 'dateTimeRange'` |
| 富文本 `.editor` | `<editor v-model :min-height>`（项目组件） | `<RichTextEditor>`（`@/components/common`） |
| 图片上传 | `<image-upload v-model>` | `<ImageUpload>` |
| 文件上传 | `<file-upload v-model>` | `<FileUpload>` |

### 数据展示

| HTML 设计稿 | Element Plus(Vue) | Ant Design Pro(React) |
|-------------|-------------------|------------------------|
| 表格 `<table>` | `<el-table :data>` | `<ProTable<VO, Query>>` |
| 表头/列 `<th>` / `<td>` | `<el-table-column label prop>` | `columns: ProColumns[]` 数组项 |
| 多选列 | `<el-table-column type="selection">` | `rowSelection={{...}}` |
| 状态标签 `<span class="tag">` | `<dict-tag :options :value>` | `<DictTag options value>` |
| 状态开关列 | `<el-switch @change>` | `render: () => <Switch onChange>` |
| 图片预览 `<img>` | `<image-preview :src :width :height>` | `<ImagePreview src width height>` |
| 时间格式化 | `{{ parseTime(row.x, '{y}-{m}-{d}') }}` | 列 `valueType: 'dateTime'` |
| 分页 `<div class="pagination">` | `<pagination v-model:page v-model:limit>` | ProTable `pagination={{...}}` |
| 提示气泡 | `<el-tooltip>` | `<Tooltip>`（antd） |

### 操作与反馈

| HTML 设计稿 | Element Plus(Vue) | Ant Design Pro(React) |
|-------------|-------------------|------------------------|
| 普通按钮 `<button>` | `<el-button type icon>` | `<Button type icon>`（antd） |
| 行内操作链接 | `<el-button link icon @click>` | `<RowActions actions={[...]}>` |
| 工具栏 | `<div class="toolbar-actions">` + `<right-toolbar>` | `toolBarRender={() => [...]}` |
| 弹窗 `.modal` | `<el-dialog v-model append-to-body>` | `<ModalForm open onFinish>` |
| 删除二次确认 | `modal.confirm(...)` | `<Popconfirm>` / RowActions `confirm` |
| 成功提示 | `modal.msgSuccess(...)` | `message.success(...)` |
| 加载态 | `v-loading="loading"` | ProTable 内部托管（`request`） |

> **图标**：Element Plus 用字符串名（`icon="Search"` / `icon="Plus"` / `icon="Edit"` / `icon="Delete"` / `icon="Download"` / `icon="Refresh"`，来自 `@element-plus/icons-vue` 全局注册）；Ant Design Pro 用组件（`<SearchOutlined />` / `<PlusOutlined />` / `<EditOutlined />` / `<DeleteOutlined />` / `<DownloadOutlined />`，来自 `@ant-design/icons`）。HTML 里的 `<i class="iconfont">` / SVG 设计稿一律映射到这两套，**不要保留设计稿自带的图标库引用**。

---

## 整页转换流程（CRUD 列表页）

最常见的场景：一张"搜索 + 表格 + 工具栏 + 分页 + 新增/编辑弹窗"的后台管理设计稿，转成完整列表页。

### 步骤 1：识别设计稿结构

把 HTML 设计稿按生成器五区拆解，逐区对号入座：

1. **搜索区** —— 找到顶部一排筛选输入框/下拉，提取每个筛选字段（label + 对应 `javaField`）。
2. **工具栏** —— 找到"新增/修改/删除/导出"按钮组（决定要不要 `enableExport`）。
3. **表格区** —— 找到列头，提取每列 label 与字段，识别哪些是字典列、状态列、时间列、图片列。
4. **分页** —— 固定用 `pagination`（Vue）/ ProTable `pagination`（React），设计稿的分页样式忽略。
5. **弹窗表单** —— 找到"新增/编辑"弹窗里的表单项，提取每个字段的录入控件类型。

### 步骤 2：确认字段与字典

- 字段名优先复用已有 `@/api/{module}/{business}/types.ts` 里的 `VO`/`Form`/`Query`，没有就按生成器命名规则新建。
- 设计稿里的"状态标签/下拉选项"判断是不是**字典**：是字典就用 `useDict('sys_normal_disable')` 之类，**禁止把选项文案硬编码进页面**。
- 主键字段对应 `pkColumn.javaField`（如 `userId`），删除/编辑围绕它展开。

### 步骤 3：搭骨架（对齐生成器模板）

**Vue 端**严格按 `fm/vue/index.vue.ftl` 的结构：

```
<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card class="search-panel"> ... el-form :inline ... </el-card>
    </div>
    <el-card class="table-panel">
      <template #header> 工具栏（新增/修改/删除/导出 + right-toolbar） </template>
      <el-table v-loading="loading" :data="xxxList" @selection-change="handleSelectionChange"> ... </el-table>
      <pagination v-show="total > 0" :total v-model:page v-model:limit @pagination="getList" />
    </el-card>
    <el-dialog :title="dialog.title" v-model="dialog.visible" append-to-body> ... el-form ... </el-dialog>
  </div>
</template>
```

**React 端**严格按 `fm/react/index.tsx.ftl` 的结构：

```
<PageContainer title="...">
  <ProTable<VO, Query>
    actionRef={actionRef} rowKey="..." columns={columns}
    search={{ labelWidth: 90 }} pagination={{ defaultPageSize: 10 }}
    rowSelection={{ selectedRowKeys: ids, onChange: handleSelectionChange }}
    request={async params => { const query = toPageQuery(params); const res = await listXxx(query); return toTableData(res); }}
    toolBarRender={() => [ /* 新增/修改/删除/导出 */ ]}
  />
  <ModalForm open={modalOpen} onFinish={submitForm}> ... ProForm 字段 ... </ModalForm>
</PageContainer>
```

### 步骤 4：填脚本逻辑

**Vue 端** `<script setup>` 必备 hooks（来自生成器）：`useLoading`、`useSearchToggle`、`useSearchReset`、`useTableSelection`、`useFormDialog`，日期范围用 `useDateRangeQuery`，字典用 `toRefs<any>(useDict(...))`。状态集中放 `reactive<PageData<Form, Query>>({...})` 再 `toRefs(data)` 暴露。

**React 端**必备 hooks：`useDict`、`useTableSelection`、`useBoolean`（控制弹窗）、`useTableExport`（导出）、`useDateRangeQuery`（区间），权限用 `hasPermi(userInfo, [...])`，工具方法 `toPageQuery` / `toTableData` / `dictOptions`。

### 步骤 5：补 API 与类型（如缺）

页面依赖 `@/api/{module}/{business}/index.ts` 与 `types.ts`，命名与路由严格遵循后端约定：

```
listXxx   -> GET    /{module}/{business}/list
getXxx    -> GET    /{module}/{business}/{id}
addXxx    -> POST   /{module}/{business}
updateXxx -> PUT    /{module}/{business}
delXxx    -> DELETE /{module}/{business}/{id|ids}
```

类型层定义 `VO` / `Form`（继承 `BaseEntity`） / `Query`（非树表继承 `PageQuery`），ID 字段用 `string | number`，存在日期范围查询时保留 `params?: any`。

### 步骤 6：产物落位

前端工程在仓库内 `frontend/plus-ui/` 目录，**按其目录约定落位**（`src/api`、`src/views`）：

- 页面：`src/views/{module}/{business}/index.vue`（Vue）或 `index.tsx`（React）。
- API：`src/api/{module}/{business}/index.ts`。
- 类型：`src/api/{module}/{business}/types.ts`。

---

## 单组件/区块转换

设计稿只给了一块（不是整页 CRUD），只转那一块即可，不要硬套五区骨架。

### 场景 A：统计卡片区（Dashboard 顶部数字卡）

HTML 设计稿：

```html
<div class="stat-cards">
  <div class="card"><div class="num">128</div><div class="label">今日订单</div></div>
  <div class="card"><div class="num">¥9,860</div><div class="label">今日营收</div></div>
</div>
```

**Element Plus(Vue)**：

```vue
<el-row :gutter="16">
  <el-col :span="6" v-for="item in stats" :key="item.label">
    <el-card shadow="hover">
      <div class="stat-num">{{ item.value }}</div>
      <div class="stat-label">{{ item.label }}</div>
    </el-card>
  </el-col>
</el-row>
```

**Ant Design Pro(React)**：用 `<StatisticCard>`（`@ant-design/pro-components`）或 antd `<Card>` + `<Statistic>`：

```tsx
<Row gutter={16}>
  {stats.map(item => (
    <Col span={6} key={item.label}>
      <Card><Statistic title={item.label} value={item.value} /></Card>
    </Col>
  ))}
</Row>
```

### 场景 B：独立搜索/筛选栏

只转搜索栏时，Vue 用 `<el-form :inline="true">` + 若干 `<el-form-item>`；React 用 `<QueryFilter>`（ProComponents）或直接靠 ProTable 的 `search` 配置生成。**下拉选项是字典就接 useDict，不写死。**

### 场景 C：工具栏按钮组

HTML 的 `<button>新增</button><button>导出</button>` →
Vue：`<el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['mod:biz:add']">新增</el-button>`；
React：`toolBarRender` 里返回 `<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增</Button>`，外面用 `canAdd && (...)` 包权限判断。

---

## 代码示例

### 示例 1：搜索表单项（输入框，Vue）

HTML：`<input placeholder="请输入用户名" />` →

```vue
<el-form-item label="用户名" prop="userName">
  <el-input v-model="queryParams.userName" placeholder="请输入用户名" clearable @keyup.enter="handleQuery" />
</el-form-item>
```

### 示例 2：字典下拉（Vue + React 对照）

HTML：`<select><option>正常</option><option>停用</option></select>`（这是字典 `sys_normal_disable`）：

**Vue**：

```vue
<el-form-item label="状态" prop="status">
  <el-select v-model="queryParams.status" placeholder="请选择状态" clearable>
    <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
  </el-select>
</el-form-item>
```

脚本侧：`const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));`

**React**：

```tsx
// columns 里：
{ title: '状态', dataIndex: 'status', valueType: 'select',
  fieldProps: { options: dictOptions(dicts.sys_normal_disable) },
  render: (_, row) => <DictTag options={dicts.sys_normal_disable} value={row.status} /> }
// 顶部：const dicts = useDict('sys_normal_disable');
```

### 示例 3：表格状态开关列（Vue）

HTML 的"启用/禁用"切换 →

```vue
<el-table-column label="状态" align="center" prop="status">
  <template #default="scope">
    <el-switch v-model="scope.row.status" :active-value="'0'" :inactive-value="'1'" @change="handleStatusChange(scope.row)" />
  </template>
</el-table-column>
```

### 示例 4：行内操作按钮（Vue + React 对照）

**Vue**（带权限指令 + tooltip）：

```vue
<el-table-column label="操作" align="center">
  <template #default="scope">
    <el-tooltip content="修改" placement="top">
      <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:user:edit']" />
    </el-tooltip>
    <el-tooltip content="删除" placement="top">
      <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:user:remove']" />
    </el-tooltip>
  </template>
</el-table-column>
```

**React**（用 RowActions，权限用布尔短路）：

```tsx
{ title: '操作', valueType: 'option', fixed: 'right',
  render: (_, row) => (
    <RowActions actions={[
      canEdit && { key: 'edit', label: '修改', icon: <EditOutlined />, onClick: () => openEdit(row) },
      canRemove && { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true,
        confirm: `是否确认删除编号为"${row.userId}"的数据项？`, onClick: () => remove(row) }
    ]} />
  ) }
```

### 示例 5：新增/编辑弹窗表单（Vue）

HTML 的弹窗表单 →

```vue
<el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
  <el-form ref="userFormRef" :model="form" :rules="rules" label-width="80px">
    <el-form-item label="用户名" prop="userName">
      <el-input v-model="form.userName" placeholder="请输入用户名" />
    </el-form-item>
    <el-form-item label="状态" prop="status">
      <el-radio-group v-model="form.status">
        <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
  <template #footer>
    <div class="dialog-footer">
      <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
      <el-button @click="cancel">取 消</el-button>
    </div>
  </template>
</el-dialog>
```

### 示例 6：新增/编辑弹窗表单（React, ModalForm）

```tsx
<ModalForm<UserForm>
  title={modalTitle} open={modalOpen} width={560} form={form} layout="vertical"
  modalProps={{ destroyOnHidden: true, onCancel: closeModal }} onFinish={submitForm}>
  <ProFormText name="userId" hidden />
  <ProFormText name="userName" label="用户名" rules={[{ required: true, message: '用户名不能为空' }]} />
  <ProFormSelect name="status" label="状态" options={dictOptions(dicts.sys_normal_disable)} />
</ModalForm>
```

---

## 常见错误对比

### ❌ 错误 1：直接把 HTML 原样塞进 template

```vue
<!-- ❌ 把设计稿 div+table 整块复制进来 -->
<div class="my-table">
  <table>
    <tr><th>用户名</th><th>状态</th></tr>
    <tr><td>张三</td><td><span class="tag-green">正常</span></td></tr>
  </table>
</div>
```

```vue
<!-- ✅ 转成 el-table + dict-tag，数据来自接口 -->
<el-table v-loading="loading" border :data="userList">
  <el-table-column label="用户名" align="center" prop="userName" />
  <el-table-column label="状态" align="center" prop="status">
    <template #default="scope">
      <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
    </template>
  </el-table-column>
</el-table>
```

### ❌ 错误 2：把字典选项文案硬编码

```vue
<!-- ❌ 选项写死，字典改了页面不跟着变 -->
<el-select v-model="form.status">
  <el-option label="正常" value="0" />
  <el-option label="停用" value="1" />
</el-select>
```

```vue
<!-- ✅ 走 useDict，字典维护在后台 -->
<el-select v-model="form.status">
  <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
</el-select>
```

### ❌ 错误 3：保留设计稿的图标库 / 内联颜色

```vue
<!-- ❌ 保留设计稿自带的 iconfont / fontawesome / 内联十六进制色 -->
<button style="background:#409EFF"><i class="fa fa-plus"></i> 新增</button>
```

```vue
<!-- ✅ Element Plus 按钮 type + 字符串图标名，颜色交给主题 -->
<el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:user:add']">新增</el-button>
```

### ❌ 错误 4：弄错 frontend_type，混用两套组件

```tsx
// ❌ 在 React(Ant Design Pro) 工程里写 el-table / v-hasPermi —— 完全不识别
<el-table v-hasPermi="['system:user:list']">...</el-table>
```

```tsx
// ✅ React 端用 ProTable + hasPermi() 布尔判断
const canList = hasPermi(userInfo, ['system:user:list']);
<ProTable<UserVO, UserQuery> columns={columns} request={async p => toTableData(await listUser(toPageQuery(p)))} />
```

---

## 最佳实践

1. **先定 frontend_type，再动手**：`vue` → Element Plus/`index.vue`；`react` → Ant Design Pro/`index.tsx`。两套互不混用。
2. **对齐生成器骨架**：列表页永远是"搜索卡片 + 表格卡片 + 工具栏 + 分页 + 弹窗表单"五区，结构向 `fm/vue`、`fm/react` 模板看齐。
3. **复用现成组件**：Vue 端用仓库已有的 `right-toolbar`、`pagination`、`dict-tag`、`image-preview`、`image-upload`、`file-upload`、`editor`；React 端用 `@/components/common` 下的 `DictTag`、`ImagePreview`、`ImageUpload`、`FileUpload`、`RichTextEditor`、`RowActions`。绝不自己造轮子。
4. **字典一律 useDict**：任何"选项/标签/状态"先判断是不是字典，是就接 `useDict`，文案不硬编码。
5. **权限指令到位**：Vue 用 `v-hasPermi="['module:business:action']"`；React 用 `hasPermi(userInfo, ['module:business:action'])` 返回布尔，再短路渲染。权限标识符与后端 `@SaCheckPermission` 一致。
6. **API/类型遵循后端约定**：函数名（`listXxx`/`getXxx`/`addXxx`/`updateXxx`/`delXxx`）与路由段（`/list`、`/{id}`、根路径）不得偏离后端 Controller。
7. **日期范围别删 params**：存在 BETWEEN 日期查询时，Vue 用 `useDateRangeQuery` 生成 `dateRangeXxx`/`applyXxxDateRange`，React 用列 `valueType: 'dateTimeRange'` + `applyXxxDateRange`，并保留 `Query.params?: any`，后端 BO 依赖 begin/end 参数。
8. **产物落位仓库内 frontend/plus-ui/**：plus-ui 前端工程在仓库内 `frontend/plus-ui/` 目录，页面/API/类型按 `src/views`、`src/api` 目录约定放置。
9. **字段不编造**：列与表单字段必须来自真实 Entity/`types.ts` 或设计稿明确文案，拿不准先查后端实体或问用户。
10. **删除设计稿专属壳**：浏览器框、手机模拟器壳、占位 mock 数据、设计稿注释、装饰性内联样式，转换时一律剔除，只保留真实业务内容区。

---

## 与其他技能联动

- **crud-development**：整页列表转换时，后端 Entity/Service/Controller 与前端 API/types 一起生成，参照该技能。
- **ui-pc / 前端组件技能**：Element Plus 组件细节用法、Composables 用法。
- **icon-management**：图标名映射（Element Plus 图标名 / Ant Design icons 组件名）。
- **i18n-development**：转换后若需多语言，label 文案接入 `t()` / `$t()`。
- **collaborating-with-gemini**：复杂前端原型/样式还原可委托 Gemini 出初稿，再按本技能对齐到框架组件。
