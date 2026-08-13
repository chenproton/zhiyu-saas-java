// 分页全量拉取：后端列表接口 maxPageSize 上限为 200，客户端需分页合并避免静默截断。
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 200,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const res = await fetcher(page, pageSize)
    const items = res.items || []
    all.push(...items)
    if (items.length < pageSize) break
  }
  return all
}

/** 列表接口全量拉取一行式封装：listAll((p, ps) => xxxApi.list({ limit: ps, offset: p * ps })) */
export function listAll<T>(fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>, pageSize = 200): Promise<T[]> {
  return fetchAllPages(fetcher, pageSize)
}
