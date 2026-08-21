import { ref } from 'vue';
import { request } from '@/api/http';
import { tagApi } from '@/api/library';
import type { TagItem } from '@/types/library';

interface TagRelation {
  resourceId: string;
  tags: TagItem[];
}

/**
 * 列表页资源标签绑定：
 * - loadBindings：批量拉取一页资源的标签（列表展示用）
 * - saveTags：全量替换某资源的标签绑定（表单保存用）
 */
export function useTagBindings(resourceType: string) {
  const tagsByResource = ref<Record<string, TagItem[]>>({});
  const loading = ref(false);
  let seq = 0;

  async function loadBindings(items: { id: string }[]): Promise<void> {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) {
      tagsByResource.value = {};
      return;
    }
    const mySeq = ++seq;
    loading.value = true;
    try {
      // 后端返回 { items: [{ resourceId, tags }] }；Vue api/library.ts 的 queryBindings
      // 返回类型标注为 { resourceId, tagId }[]（陈旧/错误），故这里直接用 request 直连。
      const res = await request<{ items: TagRelation[] }>('/library/resource-tags/query', {
        method: 'POST',
        body: JSON.stringify({ resourceType, resourceIds: ids })
      });
      if (mySeq !== seq) return;
      const map: Record<string, TagItem[]> = {};
      for (const rel of res.items || []) map[rel.resourceId] = rel.tags;
      tagsByResource.value = map;
    } catch {
      if (mySeq !== seq) return;
      tagsByResource.value = {};
    } finally {
      if (mySeq === seq) loading.value = false;
    }
  }

  async function saveTags(resourceId: string, tagIds: string[]): Promise<void> {
    await tagApi.setBindings({ resourceType, resourceId, tagIds });
  }

  return { tagsByResource, loadBindings, saveTags, loading };
}
