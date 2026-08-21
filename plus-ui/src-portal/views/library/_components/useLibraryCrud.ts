import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';

type QueryParams = Record<string, string | number | boolean | undefined>;
type ListFn<T> = (params?: QueryParams) => Promise<{ items: T[]; total?: number }>;

interface UseLibraryCrudOptions {
  /** 每页拉取数量（服务端分页），默认 200（与 React useLibraryCrud 一致） */
  limit?: number;
  /** 额外的查询参数构造器（如标签筛选 tagIds），loadItems 调用时读取 */
  getParams?: () => QueryParams;
}

/**
 * 库列表页统一数据加载：search 搜索 + 服务端分页（limit/offset）+ loading + 失败提示。
 * 对齐 React useLibraryCrud：请求序号丢弃过期响应；删除/筛选后页码越界时回退到最后一页。
 */
export function useLibraryCrud<T>(list: ListFn<T>, options: UseLibraryCrudOptions = {}) {
  const limit = options.limit ?? 200;
  const items = ref<T[]>([]);
  const loading = ref(false);
  const searchQuery = ref('');
  const page = ref(1);
  const total = ref(0);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));
  let seq = 0;

  async function loadItems(): Promise<void> {
    const mySeq = ++seq;
    loading.value = true;
    try {
      const params: QueryParams = { limit, offset: (page.value - 1) * limit };
      if (searchQuery.value) params.search = searchQuery.value;
      Object.assign(params, options.getParams?.() ?? {});
      const res = await list(params);
      const tp = Math.max(1, Math.ceil((res.total ?? 0) / limit));
      if (page.value > tp) {
        // 删除/筛选后当前页越界：回退到最后一页重新加载
        page.value = tp;
        void loadItems();
        return;
      }
      if (mySeq !== seq) return;
      items.value = res.items ?? [];
      total.value = res.total ?? 0;
    } catch (e) {
      if (mySeq !== seq) return;
      ElMessage.error((e as Error).message || '加载失败');
    } finally {
      if (mySeq === seq) loading.value = false;
    }
  }

  return { items, loading, searchQuery, loadItems, total, page, totalPages };
}
