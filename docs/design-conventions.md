# 前端设计规范速查

> 基于 `zhiyu-saas` 项目提炼，用于快速搭建同风格新系统。

---

## 一、技术栈

| 分类 | 选型 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.x |
| 运行时 | React | 19 |
| 语言 | TypeScript (strict) | 5.7 |
| 构建 | Next.js + webpack | 16.x |
| 样式 | Tailwind CSS | v4 (CSS 配置) |
| 组件库 | shadcn/ui (New York 风格) | latest |
| 图标 | lucide-react | ^0.564 |
| 表单 | react-hook-form + zod | v7 + v3 |
| 主题 | next-themes | ^0.4 |
| 动画 | tw-animate-css | 1.x |
| 字体 | Geist + Geist Mono | Google Fonts |

**核心依赖清单**（`package.json`）：

```
react, react-dom, next
tailwindcss, @tailwindcss/postcss, tw-animate-css
lucide-react
@radix-ui/react-*   (28 个 primitives)
class-variance-authority, clsx, tailwind-merge
react-hook-form, zod, @hookform/resolvers
next-themes
sonner                  (toast 通知)
date-fns, react-day-picker
recharts, d3, @xyflow/react  (图表/流程图)
embla-carousel-react, react-resizable-panels
xlsx
```

**monorepo 结构**（pnpm workspace）：

```
root/
  apps/edu/            ← 主应用
  packages/ui/         ← @zhiyu/ui (共享组件)
  packages/shared-types/ ← @zhiyu/shared-types (类型/状态配置)
  packages/api-client/ ← @zhiyu/api-client (API 层)
```

---

## 二、配色方案

### 色板（OKLCH 色彩空间）

所有颜色通过 CSS 自定义属性定义，Tailwind v4 `@theme inline` 注册。

**核心色板** (`apps/edu/app/globals.css`)：

| Token | 用途 | 色值 (oklch) |
|-------|------|-------------|
| `--background` | 页面背景 | `oklch(0.97 0.008 270)` |
| `--foreground` | 主文字 | `oklch(0.22 0.02 270)` |
| `--card` | 卡片背景 | `oklch(0.995 0.006 270)` |
| `--primary` | 主色（靛紫渐变） | `oklch(0.55 0.2 270)` |
| `--secondary` | 副色（淡紫） | `oklch(0.93 0.05 300)` |
| `--muted` | 次要背景 | `oklch(0.92 0.02 270)` |
| `--border` | 边框 | `oklch(0.88 0.025 270)` |
| `--input` | 输入框边框 | `oklch(0.91 0.02 270)` |
| `--ring` | Focus 光环 | `oklch(0.6 0.18 270)` |

**状态色**：

| Token | 用途 | 色值 |
|-------|------|------|
| `--destructive` | 危险/删除 | `oklch(0.58 0.22 25)` |
| `--success` | 成功/通过 | `oklch(0.62 0.18 150)` |
| `--warning` | 警告/审核中 | `oklch(0.72 0.18 75)` |
| `--info` | 信息/链接 | `oklch(0.58 0.16 245)` |

**圆角**：`--radius: 0.625rem`（生成 sm/md/lg/xl 四级）

### Button 变体风格

通过 `class-variance-authority` 定义，**使用渐变背景 + 阴影**：

- `default`：靛紫渐变 `#4f46e5 → #7c3aed` + 紫色投影
- `destructive`：红渐变 `#f43f5e → #e11d48` + 红色投影
- `outline`：`border-2 border-[#c7d2fe]` 白色背景
- `secondary`：青绿渐变 `#06b6d4 → #14b8a6`
- `ghost`：紫文字 hover 淡紫背景
- `link`：紫文字 + 下划线

### 两套 CSS 入口

1. **`packages/ui/src/globals.css`** — shadcn 默认 neutral 色板（灰白调、纯 dark 模式）
2. **`apps/edu/app/globals.css`** — **覆盖**为 warm slate/indigo/violet 色板，追加 `--success` / `--warning` / `--info`

新应用应直接复用 `apps/edu/app/globals.css` 模式。

---

## 三、组件体系

### 3.1 shadcn/ui 组件（57 个）

位于 `packages/ui/src/components/ui/`，基于 Radix primitives 封装。

**扩展协议**：
- 所有 Dialog 支持 `size` prop（`sm`/`default`/`lg`/`xl`/`full`）
- 所有组件带 `data-slot` 属性
- AlertDialog 的 `AlertDialogContent` 支持 `size="sm"`

### 3.2 公共业务组件

位于 `packages/ui/src/components/shared/`，通过 `@zhiyu/ui` 导出：

| 组件 | 用途 |
|------|------|
| `StatusBadge` | 状态标签，`getStatusConfig()` 自动取色 |
| `ConfirmDialog` | 删除/危险确认，支持 `variant="destructive"` |
| `TableRowActions` | 表格行悬浮操作区（自动 `group-hover:opacity-100`） |
| `HoverActionBar` | 非 Table 场景的悬浮操作栏 |
| `EmptyState` | 空态占位 |
| `LoadingView` | 加载态（带 `<Loader2>` 旋转图标） |

### 3.3 页面级组件

位于 `apps/edu/components/shared/`：

| 组件 | 适用场景 |
|------|---------|
| `ContentListPage<T>` | 内容资源列表（Tab/批量/导入导出） |
| `EditorShell` | 内容编辑器框架（步骤导航 + 保存/提交） |
| `BatchGroupPage` | 批次分组管理 |
| `WorkflowConfigPage` | 审批流配置 |
| `ApprovalListPage<T>` | 审批中心 |
| `ArchiveListPage<T>` | 归档管理 |
| `PortalCrudPage<T>` / `PortalSidebarCrudPage<T>` | 系统管理 CRUD |
| `PlatformShell` | 平台布局壳（侧栏 + 顶栏 + 内容） |
| `LogTableShell<T>` | 日志表格 |

### 3.4 表单/交互组件

| 组件 | 位置 | 用途 |
|------|------|------|
| `BatchSelector` | `shared/` | 批次选择器（下拉 + 新建） |
| `UserSelector` | `shared/` | 用户多选/单选 + 组织树筛选 |
| `OrgNodePicker` | `shared/` | 组织节点选择器 |
| `PageHeaderCard` | `shared/` | 页头统计卡片 |
| `ResourcePreviewModal` | `shared/` | kkFileView 文件预览弹窗 |
| `ImportConfirmDialog` | `shared/` | 导入重复确认 |
| `LandingFilterRow` | `shared/` | Landing 筛选行（标签云） |
| `LandingPagination` | `shared/` | Landing 分页器 |

---

## 四、布局规范

### 4.1 根布局

`app/layout.tsx` 包裹链：

```
<html lang="zh-CN" suppressHydrationWarning>
  <ThemeProvider>          ← next-themes
    <AuthProvider>         ← 认证/权限/角色
      <DataProvider>       ← 数据预加载
        <Content>
```

### 4.2 页面样式基类

```css
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

- `font-sans antialiased` 用于 body
- `scrollbar-hide` 工具类隐藏滚动条

### 4.3 表单模式

```tsx
// react-hook-form + zod 标准写法
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
})

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="xxx"
      render={({ field }) => (
        <FormItem>
          <FormLabel>标签</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">提交</Button>
  </form>
</Form>
```

### 4.4 表格模式

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>列名</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id} className="group">
        <TableCell>{item.name}</TableCell>
        <TableCell>
          <StatusBadge status={item.status} />
        </TableCell>
        <TableCell>
          <TableRowActions>
            <Button variant="ghost" size="icon-sm">...</Button>
          </TableRowActions>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**关键点**：`<TableRow>` 必须加 `className="group"` 才能触发 `TableRowActions` 的悬浮效果。

### 4.5 卡片模式

```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文本</CardDescription>
    <CardAction>{/* 右上角操作 */}</CardAction>
  </CardHeader>
  <CardContent>{/* 主要内容 */}</CardContent>
  <CardFooter>{/* 底部操作 */}</CardFooter>
</Card>
```

圆角：`rounded-xl`，阴影：`shadow-sm`，内间距：`px-6 py-6`。

---

## 五、交互约定

### 5.1 删除确认

**禁止 `window.confirm()`**，一律使用 `<ConfirmDialog>`：

```tsx
<ConfirmDialog
  open={open} onOpenChange={setOpen}
  title="确认删除"
  description="删除后不可恢复，确定要删除「xxx」吗？"
  variant="destructive"
  onConfirm={handleDelete}
/>
```

### 5.2 状态标签

**禁止自定义 `STATUS_CONFIG`**，使用 `getStatusConfig()` + `<StatusBadge>`：

```tsx
import { StatusBadge } from '@zhiyu/ui'
<StatusBadge status="draft" />
```

状态配置（`packages/shared-types/src/status.ts`）：

| 状态值 | 显示 | 色值 |
|--------|------|------|
| `draft` | 草稿 | `#64748b` |
| `pending` | 审核中 | `#2563eb` |
| `approved` | 已通过 | `#16a34a` |
| `rejected` | 已驳回 | `#dc2626` |
| `published` | 已发布 | `#16a34a` |
| `archived` | 已归档 | `#8f959e` |
| `reviewing` | 审批中 | `#f59e0b` |
| `open` / `in_progress` | 进行中 | `#2563eb` / `#16a34a` |
| `closed` | 已关闭 | `#8f959e` |
| `ready` | 待发布 | `#4f46e5` |
| `not_submitted` | 未提交 | `#d97706` |
| `disabled` | 已禁用 | `#8f959e` |
| `finished` | 已结束 | `#8f959e` |

未匹配状态 fallback 为灰色 `#64748b`。

### 5.3 表格行操作

使用 `<TableRowActions>` 包裹操作按钮，自动实现悬浮显示：

```tsx
<TableRowActions>
  <Button variant="ghost" size="icon-sm" onClick={...}>
    <Pencil className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon-sm" onClick={...}>
    <Trash2 className="h-4 w-4" />
  </Button>
</TableRowActions>
```

**禁止手写** `group-hover:opacity-100` / `opacity-0 group-hover:opacity-100`。

### 5.4 导入流程

使用 `useImportFlow` hook：

```tsx
const importFlow = useImportFlow({
  downloadTemplate: () => api.downloadTemplate(),
  previewImport: (file) => api.previewImport(file),
  executeImport: (keys, file, overwrite) => api.executeImport(keys, file, overwrite),
  entityLabel: "题库",
  onComplete: () => refreshList(),
})
```

提供统一下载模板 → 预览 → 去重确认流程。

### 5.5 就近放置

仅被一处使用的子组件放在消费者目录的 `_components/` 下，不要放入 `shared/`。

```
app/job/positions/_components/
  position-form.tsx     ← 仅本页使用，不放 shared/
```

---

## 六、工具函数

### cn()

`packages/ui/src/lib/utils.ts` — 合并 Tailwind 类：

```ts
import { cn } from '@/lib/utils'
// 等价于 twMerge(clsx(inputs))
```

### formatFileSize()

```ts
import { formatFileSize } from '@/lib/utils'
formatFileSize("1048576")  // "1.00 MB"
```

---

## 七、路径别名

`apps/edu/tsconfig.json` 定义：

| 别名 | 映射 |
|------|------|
| `@/*` | `./*` |
| `@/components/ui/*` | `../../packages/ui/src/components/ui/*` |
| `@/lib/utils` | `../../packages/ui/src/lib/utils.ts` |
| `@/lib/api` | `../../packages/api-client/src/index.ts` |
| `@/lib/types` | `../../packages/shared-types/src/index.ts` |
| `@/hooks/use-toast` | `../../packages/ui/src/hooks/use-toast.ts` |
| `@zhiyu/ui` | `../../packages/ui/src/index.ts` |
| `@zhiyu/shared-types` | `../../packages/shared-types/src/index.ts` |

---

## 八、代码格式

**Prettier** (`.prettierrc`)：

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

**关键规则**：无分号、单引号、缩进 2 空格、行宽 100。

---

## 九、文件命名

| 类型 | 命名方式 |
|------|---------|
| 页面 | `app/module/page.tsx` |
| 布局 | `app/module/layout.tsx` |
| 组件 | `kebab-case.tsx` |
| 子组件 | `_components/kebab-case.tsx` |
| Hooks | `use-xxx.ts` |
| 工具/类型 | `kebab-case.ts` / `xxx.ts` |
| CSS | `globals.css` |

---

## 十、新系统搭建清单

1. **创建 monorepo**：`pnpm workspace` 结构
2. **安装依赖**：参考上方"核心依赖清单"
3. **初始化 shadcn/ui**：`npx shadcn@latest init`，选择 New York + neutral + lucide
4. **复制 CSS**：`apps/edu/app/globals.css` → 新项目，按需调色板
5. **复制 `cn()` 和 `@theme inline` 块**
6. **复制核心组件**：
   - `packages/ui/src/components/ui/`（全部 shadcn 组件）
   - `packages/ui/src/components/shared/`（StatusBadge、ConfirmDialog 等）
   - `packages/shared-types/src/status.ts`（状态配置）
7. **配置路径别名**（`tsconfig.json` 的 `paths` 字段）
8. **配置 `next.config`**：`transpilePackages` + `rewrites`（API 代理）
9. **搭建布局壳**：`layout.tsx` → `ThemeProvider` → `AuthProvider` → 侧边栏 + 内容区
10. **复用页面组件**：按业务模块逐一复制 `ContentListPage`、`EditorShell` 等
