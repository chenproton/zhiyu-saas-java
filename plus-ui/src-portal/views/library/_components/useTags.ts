import { ref } from 'vue';
import { tagApi } from '@/api/library';
import type { TagItem } from '@/types/library';

// 模块级缓存 + 单飞请求：多个列表页共享同一份标签列表，避免重复请求（对齐 React useTags）。
let cache: TagItem[] | null = null;
let inflight: Promise<TagItem[]> | null = null;

export function useTags() {
  const tags = ref<TagItem[]>(cache ?? []);
  const loading = ref(cache === null);

  async function loadTags(): Promise<void> {
    if (cache !== null) {
      tags.value = cache;
      loading.value = false;
      return;
    }
    if (!inflight) {
      inflight = tagApi
        .list()
        .then((res) => res.items || [])
        .catch(() => []);
    }
    loading.value = true;
    const res = await inflight;
    cache = res;
    tags.value = res;
    loading.value = false;
    inflight = null;
  }

  // 标签管理页增删改后调用：失效缓存并重拉（对齐 React useTags.reload）
  async function reload(): Promise<void> {
    cache = null;
    inflight = null;
    await loadTags();
  }

  // 首次实例化即触发加载（单飞保证只发一次请求）
  if (cache === null) void loadTags();

  return { tags, loading, loadTags, reload };
}
