// 联盟管理应用（portal/apps/alliance）列表页 / 编辑页共享样板。
// 共同形状收在这里：分页+搜索列表、前台展示开关、删除确认、编辑页加载（notFound 守卫）、
// 保存提交包装、挂载时补用户上下文；各页差异（请求、文案、载荷、额外筛选）经 options 注入。
// 仅承载样板，不含任何具体业务端点（端点见 crud-shared.ts / alliance-admin.ts）。
import { computed, onMounted, ref } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

/* ==================== 列表页 ==================== */

export interface ListPageQuery {
  // index signature 取各 list 接口参数类型的交集（窄），query 可直接透传
  [key: string]: string | number | undefined;
  search?: string;
  limit: number;
  offset: number;
}

export interface AllianceListPageOptions<TRow> {
  /** 列表请求（分页 + 搜索词由 composable 组装，额外筛选参数页面在 fetchList 内自行拼入） */
  fetchList: (query: ListPageQuery) => Promise<{ items?: TRow[]; total?: number }>;
  /** 列表加载成功后的后置处理（如 projects 页补拉里程碑进度） */
  afterLoaded?: (items: TRow[]) => Promise<void> | void;
  /** 前台展示开关；不传则页面自行处理 */
  togglePublic?: {
    update: (row: TRow, next: boolean) => Promise<unknown>;
    apply: (row: TRow, next: boolean) => void;
    successText: (next: boolean) => string;
  };
  /** 删除确认与执行 */
  remove: {
    confirmText: (row: TRow) => string;
    deleteRow: (row: TRow) => Promise<unknown>;
    successText: string;
  };
  /** 挂载时的额外加载（引用数据 / 字典等） */
  onMountedExtras?: () => void;
  /** 加载守卫（如就业项目页要求 tenantId 就绪），返回 false 跳过本次加载 */
  loadGuard?: () => boolean;
  /** 挂载时是否先补齐用户上下文（默认 true；就业项目列表页原本不拉） */
  ensureAuth?: boolean;
}

export function useAllianceListPage<TRow>(options: AllianceListPageOptions<TRow>) {
  const auth = useAuthStore();
  const router = useRouter();

  const items = ref([]) as Ref<TRow[]>;
  const loading = ref(false);
  const search = ref('');
  const page = ref(1);
  const pageSize = 20;
  const total = ref(0);

  async function loadItems() {
    if (options.loadGuard && !options.loadGuard()) return;
    loading.value = true;
    try {
      const res = await options.fetchList({
        search: search.value.trim() || undefined,
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
      });
      items.value = res.items || [];
      total.value = res.total ?? 0;
      await options.afterLoaded?.(items.value);
    } catch (e) {
      ElMessage.error((e as Error).message || '加载失败');
    } finally {
      loading.value = false;
    }
  }

  /** 搜索/筛选变化：回到第一页并重载（触发时机如防抖由各页自行包装） */
  function resetAndLoad() {
    page.value = 1;
    loadItems();
  }

  async function togglePublic(row: TRow) {
    const tp = options.togglePublic;
    if (!tp) return;
    const next = !(row as { isPublic?: boolean }).isPublic;
    try {
      await tp.update(row, next);
      tp.apply(row, next);
      ElMessage.success(tp.successText(next));
    } catch (e) {
      ElMessage.error((e as Error).message || '操作失败');
    }
  }

  async function confirmDelete(row: TRow) {
    try {
      await ElMessageBox.confirm(options.remove.confirmText(row), '确认删除', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }
    try {
      await options.remove.deleteRow(row);
      ElMessage.success(options.remove.successText);
      await loadItems();
    } catch (e) {
      ElMessage.error((e as Error).message || '删除失败');
    }
  }

  onMounted(async () => {
    if (options.ensureAuth !== false && !auth.user) {
      try {
        await auth.fetchMe();
      } catch {
        // 未登录态由路由守卫兜底，此处忽略
      }
    }
    options.onMountedExtras?.();
    loadItems();
  });

  return { router, items, loading, search, page, pageSize, total, loadItems, resetAndLoad, togglePublic, confirmDelete };
}

/* ==================== 编辑页 ==================== */

export interface AllianceEditPageOptions<T> {
  /** 列表页路径（新建态取消/返回列表） */
  listPath: string;
  /** 详情页路径（编辑态取消跳转；保存成功后的跳转留在各页 handleSave） */
  detailPath: (id: string) => string;
  /** 编辑态按 id 取实体；纯新建页不传（load 自动变 no-op） */
  fetchEntity?: (id: string) => Promise<T>;
  /** 取到实体后填充表单（页面顺带缓存原实体用于整体提交） */
  fillForm?: (entity: T) => void;
  /** 挂载时的选项/字典加载 */
  loadOptions?: () => Promise<void> | void;
}

export function useAllianceEditPage<T = unknown>(options: AllianceEditPageOptions<T>) {
  const route = useRoute();
  const router = useRouter();
  const auth = useAuthStore();

  const isNew = computed(() => !route.params.id);
  const id = route.params.id as string | undefined;

  const loading = ref(false);
  const saving = ref(false);
  const notFound = ref(false);

  async function load() {
    if (isNew.value || !id || !options.fetchEntity) return;
    loading.value = true;
    try {
      const entity = await options.fetchEntity(id);
      options.fillForm?.(entity);
    } catch (e) {
      notFound.value = true;
      ElMessage.error((e as Error).message || '加载失败');
    } finally {
      loading.value = false;
    }
  }

  /** 表单提交包装：saving 态 + 统一失败提示；校验与成功跳转留在各页 handleSave */
  async function submit(task: () => Promise<void>) {
    saving.value = true;
    try {
      await task();
    } catch (e) {
      ElMessage.error((e as Error).message || '保存失败');
    } finally {
      saving.value = false;
    }
  }

  function onCancel() {
    if (isNew.value) {
      router.push(options.listPath);
    } else if (id) {
      router.push(options.detailPath(id));
    } else {
      router.back();
    }
  }

  onMounted(async () => {
    // 直接进页/硬刷新时 auth.user 尚未填充（路由守卫只校验 token），先补齐用户上下文
    if (!auth.user) {
      try {
        await auth.fetchMe();
      } catch {
        // 忽略：拉取失败时下拉为空，不阻断表单填写
      }
    }
    await Promise.all([options.loadOptions?.(), load()]);
  });

  return { route, router, isNew, id, loading, saving, notFound, load, submit, onCancel };
}
