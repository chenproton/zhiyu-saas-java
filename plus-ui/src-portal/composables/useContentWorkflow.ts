import { ElMessage } from 'element-plus';

// 内容流动作（提交审批/发布/归档/取消发布/撤回）—— 复用 createContentApi 的
// submit/review/publish/archive/unpublish/withdraw，统一 ElMessage 反馈 + 刷新。
interface ContentApi {
  submit: (id: string) => Promise<unknown>;
  publish: (id: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  unpublish: (id: string) => Promise<unknown>;
  withdraw: (id: string) => Promise<unknown>;
}

export function useContentWorkflow(contentApi: ContentApi, loadItems: () => void) {
  async function run(id: string, label: string, fn: (id: string) => Promise<unknown>) {
    try {
      await fn(id);
      ElMessage.success(`${label}成功`);
      loadItems();
    } catch (e) {
      ElMessage.error((e as Error).message || `${label}失败`);
    }
  }
  return {
    submit: (id: string) => run(id, '提交审批', contentApi.submit),
    publish: (id: string) => run(id, '发布', contentApi.publish),
    archive: (id: string) => run(id, '归档', contentApi.archive),
    unpublish: (id: string) => run(id, '取消发布', contentApi.unpublish),
    withdraw: (id: string) => run(id, '撤回', contentApi.withdraw)
  };
}
