---
name: ui-pc
description: |
  base-dev-framework6-java后台管理端前端页面技能。本仓库的前端不是手写工程，
  而是由 ruoyi-gen 代码生成器按 gen_table.frontend_type 产出，支持 Vue(Element Plus) 与
  React(Ant Design Pro) 双栈。本技能讲清两套栈的页面规范、API/类型约定、页面行为与禁令，
  指导按生成器模板风格写列表页、表单页、树表页。

  触发场景：
  - 为某张业务表编写/补全后台管理列表页或表单页（Vue 或 React）
  - 看不懂代码生成器产出的 index.vue / index.tsx / api.ts / types.ts 想照着改
  - 要新增一种前端栈（往 fm/<type>/ 下加模板）或排查生成的页面跑不起来
  - 不确定该用 el-table 还是 ProTable、useDict 还是 dictOptions、v-hasPermi 还是 hasPermi

  触发词：前端、前端页面、Element Plus、el-table、el-form、el-dialog、Ant Design Pro、
  ProTable、ModalForm、代码生成器前端、Vue页面、React页面、useDict、useFormDialog、
  列表页、表单页、后台页面、ui-pc
---

# ui-pc —— 本项目 后台前端页面（Vue/Element Plus + React/Ant Design Pro 双栈）

## 一、概述：双栈 + 前端在仓库内 frontend/plus-ui/

base-dev-framework6-java的后台管理端前端 **plus-ui 在仓库内 `frontend/plus-ui/` 目录**，本项目
**包含仓库内前端工程**，并内置一套**代码生成器前端模板**。页面靠 `ruoyi-gen` 模块的
FreeMarker 模板（`.ftl`）产出，模板位于：

```
backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/
├── vue/      ← Element Plus 栈：api.ts.ftl / types.ts.ftl / index.vue.ftl / index-tree.vue.ftl
└── react/    ← Ant Design Pro 栈：api.ts.ftl / types.ts.ftl / index.tsx.ftl / index-tree.tsx.ftl
```

### 前端栈如何选择

- `gen_table.frontend_type` 字段存**字符串**，值直接对应 `fm/` 下的目录名：`vue` → Element Plus，
  `react` → Ant Design Pro。
- 生成器按 `fm/<frontendType>/api.ts.ftl`、`types.ts.ftl`、`index.*.ftl`、`index-tree.*.ftl` 查模板。
- 输出后缀由模板文件名决定：`index.vue.ftl` → `index.vue`，`index.tsx.ftl` → `index.tsx`。
- **普通表**用 `index.*.ftl`，**树表**（`gen_table.tpl_category=tree`）用 `index-tree.*.ftl`。

### 新增一种前端栈的唯一正确做法

只需**新增 `fm/<frontendType>/` 目录 + 对应 4 个 FTL 文件**（api/types/index/index-tree），
**不要**在 Java 代码里加数字枚举或硬编码 `if (type == 1)` 分支。`frontend_type` 是开放字符串，
生成器靠目录名动态查找模板。

> 🔴 本技能描述的是**原版 plus-ui** 的页面写法（Element Plus 原生组件 / Ant Design Pro 原生组件）。
> 它**不是**某些定制分支里的「A 封装组件」体系（`AFormInput` / `AModal` / `ASearchForm` 那一套），
> 也**不是**移动端 plus-uniapp（wot-design / `wd-*`）。这两类只允许出现在本文「常见错误对照」的 ❌ 列里。

---

## 二、Vue（Element Plus）栈规范

源模板：`fm/vue/index.vue.ftl`、`fm/vue/index-tree.vue.ftl`。

### 2.1 组件选型（全部 Element Plus 原生 + 仓库复用组件）

| 用途 | 组件 | 说明 |
|------|------|------|
| 表格 | `<el-table>` / `<el-table-column>` | `v-loading="loading"`、`border`、`@selection-change` |
| 搜索/表单 | `<el-form>` / `<el-form-item>` | 搜索区 `:inline="true"`，弹窗表单 `:rules="rules"` |
| 弹窗 | `<el-dialog>` | `v-model="dialog.visible"`、`:title="dialog.title"`、`append-to-body` |
| 输入 | `<el-input>` / `<el-input-number>` | |
| 下拉/单选/开关 | `<el-select>`+`<el-option>` / `<el-radio-group>` / `<el-switch>` | 字典下拉 `v-for="dict in 字典名"` |
| 日期 | `<el-date-picker>` | BETWEEN 用 `type="daterange"` |
| 按钮 | `<el-button>` | icon 用字符串名（`icon="Plus"`） |

**复用组件**（来自 plus-ui，直接用标签，不需 import）：`right-toolbar`、`pagination`、`dict-tag`、
`image-preview`、`image-upload`、`file-upload`、`editor`。

### 2.2 脚本风格

- **必须** `<script setup name="业务名" lang="ts">`。
- 新版生成器优先用 **hooks**（来自 `@/hooks/...`）：
  - `useLoading`（`@/hooks/async/useLoading`）→ `{ loading, withLoading }`
  - `useSearchToggle`（`@/hooks/form/useSearchToggle`）→ `{ showSearch }`
  - `useSearchReset`（`@/hooks/form/useSearchReset`）→ `{ resetQuery }`
  - `useTableSelection`（`@/hooks/table/useTableSelection`）→ `{ ids, single, multiple, handleSelectionChange }`
  - `useFormDialog`（`@/hooks/dialog/useFormDialog`）→ `{ dialog, resetForm, openDialog, showDialog, closeDialog }`
  - `useDateRangeQuery`（`@/hooks/form/useDateRangeQuery`，仅 BETWEEN 日期需要）
- **字典**：`const { 字典1, 字典2 } = toRefs<any>(useDict('字典type1', '字典type2'));`（`useDict` 来自 `@/utils/dict`）。
- **状态聚合**：查询/表单/校验放 `reactive<PageData<Form, Query>>({ form, queryParams, rules })`，再 `toRefs(data)` 暴露。
- **消息/确认**：`import modal from '@/plugins/modal'` → `modal.msgSuccess(...)` / `modal.confirm(...)`。
- **导出**：`import { download as requestDownload } from '@/utils/request'`。
- **权限指令**：`v-hasPermi="['模块:业务:add']"`。

---

## 三、React（Ant Design Pro）栈规范

源模板：`fm/react/index.tsx.ftl`、`fm/react/index-tree.tsx.ftl`。

### 3.1 组件选型（antd + @ant-design/pro-components）

| 用途 | 组件 | 来源 |
|------|------|------|
| 页面容器 | `<PageContainer>` | `@ant-design/pro-components` |
| 表格 | `<ProTable>` | `@ant-design/pro-components`，列用 `ProColumns[]` |
| 弹窗表单 | `<ModalForm>` | `@ant-design/pro-components`，`form={form}` 受控 |
| 表单项 | `<ProFormText>` / `<ProFormTextArea>` / `<ProFormDigit>` / `<ProFormSelect>` / `<ProFormCheckbox.Group>` / `<ProFormDateTimePicker>` / `<ProFormTreeSelect>` | `@ant-design/pro-components` |
| 基础控件 | `<Button>` / `<Switch>` / `<InputNumber>` / `<Popconfirm>` / `<Form.Item>` / `message` | `antd` |
| 图标 | `<PlusOutlined>` / `<EditOutlined>` / `<DeleteOutlined>` / `<DownloadOutlined>` | `@ant-design/icons` |

**复用组件**（`@/components/common/`）：`DictTag`、`ImagePreview`、`ImageUpload`、`FileUpload`、
`RichTextEditor`、`RowActions`。

### 3.2 脚本风格

- 函数组件 `export default function XxxPage()`，`actionRef = useRef<ActionType>()` 驱动 ProTable 刷新。
- 表单：`const [form] = Form.useForm<XxxForm>()`，弹窗开关用 ahooks 的 `useBoolean`。
- **字典**：`const dicts = useDict('字典type')`（来自 `@/hooks/useDict`），下拉选项用 `dictOptions(dicts.字典type)`（`@/utils/dict`）。
- **选择/导出/日期范围** hooks：`useTableSelection`、`useTableExport`、`useDateRangeQuery`（均在 `@/hooks/`）。
- **权限**：`hasPermi(userInfo, ['模块:业务:add'])`（`@/utils/permission`，`userInfo` 来自 `useUserStore`）。
- **数据转换工具**（`@/utils/ruoyi`）：`toPageQuery`（ProTable params → 后端 Query）、`toTableData`（后端 R → ProTable 结果）、
  `formatDateTimeFields` / `toDayjsFields`（日期字段 string ↔ dayjs）、树表的 `handleTree` / `filterTree`。
- **确认**：行内删除用 `<Popconfirm>` 或 `RowActions` 的 `confirm`；状态切换用 `confirmAction`（`@/utils/modal`）。

---

## 四、API 与类型约定（两栈通用，对齐后端路由）

### 4.1 API 文件（`api.ts`）命名 → 路由

| 函数 | 方法 | 路由 |
|------|------|------|
| `listXxx(query)` | GET | `/<module>/<business>/list` |
| `getXxx(id)` | GET | `/<module>/<business>/{id}` |
| `addXxx(data)` | POST | `/<module>/<business>` |
| `updateXxx(data)` | PUT | `/<module>/<business>` |
| `delXxx(id 或 ids)` | DELETE | `/<module>/<business>/{id 或 ids}` |
| `changeXxxStatus(id, status)` | PUT | `/<module>/<business>/changeStatus`（启用状态列时） |
| `updateXxxSort(id, sort)` | PUT | `/<module>/<business>/updateSort`（启用排序列时） |

- **Vue 栈**：`import request from '@/utils/request'`，类型 `import type { AxiosPromise } from '@/utils/api-types'`，
  分页 `import type { PageResult } from '@/api/types'`；列表返回 `AxiosPromise<PageResult<XxxVO>>`。
- **React 栈**：`import request from '@/api/request'`，统一响应 `import type { R } from '@/api/types'`；
  列表返回 `request<R<PageResult<XxxVO>>>(...)`（树表为 `R<XxxVO[]>`）。

### 4.2 类型文件（`types.ts`）三件套

- `XxxVO`：列表/详情展示对象（按 `column.list` 字段；`imageUpload` 列额外带 `xxxUrl`；树表带 `children`）。
- `XxxForm extends BaseEntity`：表单提交对象（按 `column.insert || column.edit` 字段，多为可选 `?`）。
- `XxxQuery`：查询对象，**非树表** `extends PageQuery`；存在日期范围查询时保留 `params`
  （Vue 为 `params?: any`，React 为 `params?: Record<string, unknown>`）。
- ID 字段统一 `string | number`；Java 数值 → `number`；Boolean → `boolean`；其余默认 `string`。
- 两栈 `BaseEntity` / `PageQuery` 均来自 `@/api/types`。

---

## 五、页面行为约定（getList / handleQuery / submitForm …）

| 行为 | Vue（Element Plus） | React（Ant Design Pro） |
|------|---------------------|--------------------------|
| 查询列表 | `getList`：`withLoading` 包裹 → 应用日期范围 → `listXxx` → 回填 `xxxList` / `total` | ProTable 的 `request`：`toPageQuery(params)` → `listXxx` → `toTableData(res)` |
| 搜索 | `handleQuery`：`pageNum=1` 后 `getList` | ProTable 内置（`search` 区）触发 reload |
| 重置 | `resetQuery`（`useSearchReset`，`resetExtras` 清日期范围） | ProTable 重置按钮 + `applyXxxDateRange` |
| 多选 | `handleSelectionChange`（`useTableSelection`）维护 `ids/single/multiple` | `useTableSelection` 维护 `ids/selectedOne` |
| 新增 | `handleAdd`：`openDialog('添加…')` | `openAdd`：`form.resetFields()` + `openModal()` |
| 修改 | `handleUpdate`：`reset()` → `getXxx` → `Object.assign(form.value, res.data)` → `showDialog` | `openEdit`：`getXxx` → `toDayjsFields` → `setFieldsValue` |
| 提交 | `submitForm`：`validate` → `buttonLoading` → 有主键调 `update` 否则 `add` → 刷新 | `submitForm`：`formatDateTimeFields` → 有主键调 `update` 否则 `add` → `actionRef.reload()` |
| 删除 | `handleDelete`：`modal.confirm(...)` → `delXxx` → 刷新 | `remove`：`Popconfirm` 确认 → `delXxx` → `reloadAndRest` |
| 导出 | `handleExport`：`requestDownload('module/business/export', params, 'xxx_时间戳.xlsx')` | `exportFile('/module/business/export', () => 'xxx_时间戳.xlsx')`（`useTableExport`） |

---

## 六、代码示例

### 示例 1：Vue —— api.ts（对齐后端路由）

```ts
import type { DemoForm, DemoQuery, DemoVO } from '@/api/demo/demo/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

// 列表：GET /demo/demo/list
export const listDemo = (query?: DemoQuery): AxiosPromise<PageResult<DemoVO>> =>
  request({ url: '/demo/demo/list', method: 'get', params: query });

// 详情：GET /demo/demo/{id}
export const getDemo = (id: string | number): AxiosPromise<DemoVO> =>
  request({ url: '/demo/demo/' + id, method: 'get' });

// 新增 / 修改
export const addDemo = (data: DemoForm) => request({ url: '/demo/demo', method: 'post', data });
export const updateDemo = (data: DemoForm) => request({ url: '/demo/demo', method: 'put', data });

// 删除（单个或批量）：DELETE /demo/demo/{id 或 ids}
export const delDemo = (id: string | number | Array<string | number>) =>
  request({ url: '/demo/demo/' + id, method: 'delete' });
```

### 示例 2：Vue —— types.ts（VO / Form / Query 三件套）

```ts
import type { BaseEntity, PageQuery } from '@/api/types';

export interface DemoVO {
  id: string | number;
  name: string;
  status: string; // 字典字段
}

export interface DemoForm extends BaseEntity {
  id?: string | number;
  name?: string;
  status?: string;
}

export interface DemoQuery extends PageQuery {
  name?: string;
  status?: string;
  // 存在日期范围查询时保留
  params?: any;
}
```

### 示例 3：Vue —— index.vue 核心脚本（hooks + reactive + 页面行为）

```vue
<script setup name="Demo" lang="ts">
import { addDemo, delDemo, getDemo, listDemo, updateDemo } from '@/api/demo/demo';
import { DemoForm, DemoQuery, DemoVO } from '@/api/demo/demo/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import { useDict } from '@/utils/dict';
import modal from '@/plugins/modal';

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));
const demoList = ref<DemoVO[]>([]);
const buttonLoading = ref(false);
const total = ref(0);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const queryFormRef = ref<ElFormInstance>();
const demoFormRef = ref<ElFormInstance>();

const initFormData: DemoForm = { id: undefined, name: undefined, status: undefined };
const data = reactive<PageData<DemoForm, DemoQuery>>({
  form: { ...initFormData },
  queryParams: { pageNum: 1, pageSize: 10, name: undefined, status: undefined, params: {} },
  rules: { name: [{ required: true, message: '名称不能为空', trigger: 'blur' }] }
});
const { queryParams, form, rules } = toRefs(data);
const { ids, single, multiple, handleSelectionChange } = useTableSelection<DemoVO>(item => item.id);
const { dialog, resetForm: reset, openDialog, showDialog, closeDialog } = useFormDialog({
  form, formRef: demoFormRef, initialFormData: initFormData
});

/** 查询列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listDemo(queryParams.value);
    demoList.value = res.data?.rows;
    total.value = res.data?.total;
  });
};
const handleQuery = () => { queryParams.value.pageNum = 1; getList(); };
const { resetQuery } = useSearchReset({ queryFormRef, queryParams, pageNumKey: 'pageNum', pageSizeKey: 'pageSize', initialPageSize: 10, afterReset: handleQuery });

const handleAdd = () => openDialog('添加示例');
const handleUpdate = async (row?: Partial<DemoVO>) => {
  reset();
  const res = await getDemo(row?.id || ids.value[0]);
  Object.assign(form.value, res.data);
  showDialog('修改示例');
};
const submitForm = () => {
  demoFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    buttonLoading.value = true;
    const action = form.value.id ? updateDemo : addDemo;
    await action(form.value).finally(() => (buttonLoading.value = false));
    modal.msgSuccess('操作成功');
    closeDialog();
    await getList();
  });
};
const handleDelete = async (row?: Partial<DemoVO>) => {
  const _ids = row?.id || ids.value;
  await modal.confirm('是否确认删除示例编号为"' + _ids + '"的数据项？');
  await delDemo(_ids);
  modal.msgSuccess('删除成功');
  await getList();
};
onMounted(() => getList());
</script>
```

### 示例 4：Vue —— 模板片段（el-table / el-dialog / 权限指令 / 复用组件）

```vue
<el-table v-loading="loading" border :data="demoList" @selection-change="handleSelectionChange">
  <el-table-column type="selection" width="55" align="center" />
  <el-table-column label="名称" align="center" prop="name" />
  <el-table-column label="状态" align="center" prop="status">
    <template #default="scope">
      <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
    </template>
  </el-table-column>
  <el-table-column label="操作" align="center">
    <template #default="scope">
      <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"
                 v-hasPermi="['demo:demo:edit']"></el-button>
      <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"
                 v-hasPermi="['demo:demo:remove']"></el-button>
    </template>
  </el-table-column>
</el-table>
<pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize" @pagination="getList" />

<el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
  <el-form ref="demoFormRef" :model="form" :rules="rules" label-width="80px">
    <el-form-item label="名称" prop="name">
      <el-input v-model="form.name" placeholder="请输入名称" />
    </el-form-item>
  </el-form>
  <template #footer>
    <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
    <el-button @click="cancel">取 消</el-button>
  </template>
</el-dialog>
```

### 示例 5：React —— api.ts + types.ts（注意 request 来自 `@/api/request`，包 `R<>`）

```ts
// api.ts
import type { PageResult, R } from '@/api/types';
import request from '@/api/request';
import type { DemoForm, DemoQuery, DemoVO } from './types';

export function listDemo(query?: DemoQuery) {
  return request<R<PageResult<DemoVO>>>({ url: '/demo/demo/list', method: 'get', params: query });
}
export function getDemo(id: string | number) {
  return request<R<DemoVO>>({ url: '/demo/demo/' + id, method: 'get' });
}
export function addDemo(data: DemoForm) { return request<R>({ url: '/demo/demo', method: 'post', data }); }
export function updateDemo(data: DemoForm) { return request<R>({ url: '/demo/demo', method: 'put', data }); }
export function delDemo(id: string | number | Array<string | number>) {
  return request<R>({ url: '/demo/demo/' + id, method: 'delete' });
}
```

```ts
// types.ts
import type { BaseEntity, PageQuery } from '@/api/types';
export interface DemoVO { id: string | number; name: string; status: string; }
export interface DemoForm extends BaseEntity { id?: string | number; name?: string; status?: string; }
export interface DemoQuery extends PageQuery { name?: string; status?: string; params?: Record<string, unknown>; }
```

### 示例 6：React —— index.tsx 核心（ProTable + ModalForm + useDict + hasPermi）

```tsx
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, PageContainer, ProFormSelect, ProFormText, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { useBoolean } from 'ahooks';
import { Button, Form, message, Popconfirm } from 'antd';
import { useRef, useState } from 'react';
import type { DemoForm, DemoQuery, DemoVO } from '@/api/demo/demo/types';
import { addDemo, delDemo, getDemo, listDemo, updateDemo } from '@/api/demo/demo';
import DictTag from '@/components/common/DictTag';
import RowActions from '@/components/common/RowActions';
import { useDict } from '@/hooks/useDict';
import { useTableSelection } from '@/hooks/useTableSelection';
import { useUserStore } from '@/stores/userStore';
import { dictOptions } from '@/utils/dict';
import { hasPermi } from '@/utils/permission';
import { toPageQuery, toTableData } from '@/utils/ruoyi';

export default function DemoPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<DemoForm>();
  const userInfo = useUserStore(state => state.userInfo);
  const dicts = useDict('sys_normal_disable');
  const { ids, selectedOne, handleSelectionChange, clearSelection } = useTableSelection<DemoVO>(r => r.id);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const [modalTitle, setModalTitle] = useState('');
  const canEdit = hasPermi(userInfo, ['demo:demo:edit']);
  const canRemove = hasPermi(userInfo, ['demo:demo:remove']);

  const openEdit = async (row?: DemoVO) => {
    const target = row || selectedOne;
    if (!target?.id) return;
    const res = await getDemo(target.id);
    form.resetFields();
    form.setFieldsValue({ ...res.data });
    setModalTitle('修改示例');
    openModal();
  };
  const submitForm = async (values: DemoForm) => {
    values.id ? await updateDemo(values) : await addDemo(values);
    message.success('操作成功');
    form.resetFields();
    actionRef.current?.reload();
    return true;
  };
  const remove = async (row?: DemoVO) => {
    await delDemo(row?.id || ids);
    message.success('删除成功');
    clearSelection();
    actionRef.current?.reloadAndRest?.();
  };

  const columns: ProColumns<DemoVO>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '状态', dataIndex: 'status', valueType: 'select',
      fieldProps: { options: dictOptions(dicts.sys_normal_disable) },
      render: (_, row) => <DictTag options={dicts.sys_normal_disable} value={row.status} /> },
    { title: '操作', valueType: 'option', fixed: 'right', render: (_, row) => (
        <RowActions actions={[
          canEdit && { key: 'edit', label: '修改', icon: <EditOutlined />, onClick: () => openEdit(row) },
          canRemove && { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true,
            confirm: `是否确认删除编号为"${row.id}"的数据项？`, onClick: () => remove(row) }
        ]} /> ) }
  ];

  return (
    <PageContainer title="示例">
      <ProTable<DemoVO, DemoQuery>
        actionRef={actionRef} rowKey="id" columns={columns}
        rowSelection={{ selectedRowKeys: ids, onChange: handleSelectionChange }}
        request={async params => toTableData(await listDemo(toPageQuery(params)))}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalTitle('添加示例'); openModal(); }}>新增</Button>
        ]} />
      <ModalForm<DemoForm> title={modalTitle} open={modalOpen} form={form} layout="vertical"
        modalProps={{ destroyOnHidden: true, onCancel: closeModal }} onFinish={submitForm}>
        <ProFormText name="id" hidden />
        <ProFormText name="name" label="名称" rules={[{ required: true, message: '名称不能为空' }]} />
        <ProFormSelect name="status" label="状态" options={dictOptions(dicts.sys_normal_disable)} />
      </ModalForm>
    </PageContainer>
  );
}
```

---

## 七、常见错误对照（🔴 重点：原版组件 vs 定制版 A 组件 / 移动端）

### 错误 1：套用「A 封装组件」体系（那是另一个定制分支，原版不存在）

```vue
<!-- ❌ 错误：A 封装组件 / 定制版 ASearchForm 体系，原版 plus-ui 没有这些 -->
<ASearchForm :model="queryParams">
  <AFormInput v-model="queryParams.name" label="名称" />
  <AFormSelect v-model="queryParams.status" :options="..." />
  <AFormDate v-model="queryParams.createTime" />
</ASearchForm>
<AModal v-model="visible" title="编辑">...</AModal>
```

```vue
<!-- ✅ 正确：Element Plus 原生组件 + el-dialog -->
<el-form :model="queryParams" :inline="true">
  <el-form-item label="名称" prop="name">
    <el-input v-model="queryParams.name" placeholder="请输入名称" clearable />
  </el-form-item>
  <el-form-item label="状态" prop="status">
    <el-select v-model="queryParams.status" clearable>
      <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
    </el-select>
  </el-form-item>
</el-form>
<el-dialog v-model="dialog.visible" :title="dialog.title" append-to-body>...</el-dialog>
```

### 错误 2：从移动端库或错误的请求范式 import

```ts
// ❌ 错误：移动端 wot-design / uni-forms / @/wd —— 那是 plus-uniapp / plus-app，不是后台 PC 端
import { wd-button } from 'wot-design';
import { useToast } from '@/wd';
<uni-forms>...</uni-forms>

// ❌ 错误：plus-uniapp 风格的解构返回，原版 PC 端不用 [err, data]
const [err, data] = await listDemo(queryParams.value);
```

```ts
// ✅ 正确（Vue 栈）：标准 request，返回 AxiosPromise，直接 res.data
import request from '@/utils/request';
const res = await listDemo(queryParams.value);
demoList.value = res.data?.rows;

// ✅ 正确（React 栈）：request 来自 @/api/request，响应包 R<>
import request from '@/api/request';
const res = await listDemo(query);   // res: R<PageResult<DemoVO>>
```

### 错误 3：API 函数名 / 路由偏离后端约定，或字典文案硬编码

```ts
// ❌ 错误：函数名与路由段不对齐后端，字典选项硬编码
export const queryDemoPage = (q) => request({ url: '/demo/getList', method: 'post', data: q });
<el-option label="正常" value="0" /><el-option label="停用" value="1" />
```

```ts
// ✅ 正确：listXxx → /module/business/list；状态用字典 useDict，不硬编码
export const listDemo = (query?: DemoQuery) =>
  request({ url: '/demo/demo/list', method: 'get', params: query });
// 模板里：<el-option v-for="dict in sys_normal_disable" ... />
```

### 错误 4：React 栈漏掉 ProTable 数据转换工具

```tsx
// ❌ 错误：直接把 antd params 当后端 Query 传、直接把 R 当 ProTable 结果返回
request={async params => { const res = await listDemo(params as DemoQuery); return res; }}
```

```tsx
// ✅ 正确：toPageQuery 转参数、toTableData 转结果（@/utils/ruoyi）
request={async params => toTableData(await listDemo(toPageQuery(params)))}
```

---

## 八、最佳实践

1. **以生成器模板为唯一权威**：写任何页面前先看 `fm/<frontendType>/*.ftl` 与目标模块最接近的现有页面，
   保持搜索卡片 → 表格卡片 → 工具栏 → 分页 → 弹窗表单的结构，不要擅自换状态管理或布局范式。
2. **两栈选型一眼区分**：Vue 用 `el-*` + hooks（`useFormDialog`/`useLoading` …）+ `v-hasPermi` + `modal`；
   React 用 `ProTable`/`ModalForm`/`ProForm*` + `hasPermi(userInfo, ...)` + `message`/`Popconfirm`。
3. **API/类型对齐后端是硬约束**：`listXxx/getXxx/addXxx/updateXxx/delXxx` 与路由一一对应；
   `VO`/`Form(extends BaseEntity)`/`Query(extends PageQuery)` 三件套不可缺；有日期范围则保留 `params`。
4. **字典走 useDict，绝不硬编码**：Vue `toRefs(useDict(...))` + `dict-tag`；React `useDict` + `dictOptions` + `DictTag`。
5. **复用仓库现成组件**：Vue 的 `right-toolbar/pagination/dict-tag/image-preview/image-upload/file-upload/editor`、
   React 的 `DictTag/ImagePreview/ImageUpload/FileUpload/RichTextEditor/RowActions`，不要自己造轮子。
6. **新增前端栈只动 `fm/<type>/`**：加目录 + 4 个 FTL，绝不在 Java 里加数字枚举或硬编码分支。
7. **树表用 index-tree 模板**：Vue 表格 `row-key` + `default-expand-all`，React 用 `useTreeTableExpand` +
   `handleTree`/`filterTree` + `ProFormTreeSelect` 选父节点；类型多一个 `children` 字段。
8. **🔴 绝不混入 A 封装组件 / 移动端库**：`AFormInput`/`AModal`/`ASearchForm`/`AFormSelect`/`AFormDate`、
   `@/wd`/`wot-design`/`uni-forms`、`plus-uniapp`/`plus-app`、`[err,data]=await` 这些**只属于别的体系**，
   原版 plus-ui 一律不用。
