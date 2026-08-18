// 混合课测评复合 methodKey 工具
// 混合课一个节点有课前测验/随堂测验/课后作业三个模块，各自测评规则生成的结果
// 以 `${moduleKey}:${methodKey}`（如 preQuiz:quiz）作为 node_evaluation_results 的 method_key，
// 与体系课单规则 methodKey（如 quiz）区分，避免同一节点多测评冲突。

export const HYBRID_EVAL_MODULE_LABELS: Record<string, string> = {
  preQuiz: '课前测验',
  inClassQuiz: '随堂测验',
  homework: '课后作业',
}

export const HYBRID_EVAL_MODULE_ORDER: Record<string, number> = {
  preQuiz: 0,
  inClassQuiz: 1,
  homework: 2,
}

// 解析复合 key，非混合课 key 返回 null。
export function parseHybridMethodKey(
  methodKey: string,
): { moduleKey: string; methodKey: string } | null {
  const idx = methodKey.indexOf(':')
  if (idx <= 0) return null
  const moduleKey = methodKey.slice(0, idx)
  if (!HYBRID_EVAL_MODULE_LABELS[moduleKey]) return null
  return { moduleKey, methodKey: methodKey.slice(idx + 1) }
}

// 复合 key 的展示标签：'preQuiz:quiz' -> '课前测验 · 随堂测'
export function getHybridMethodLabel(
  methodKey: string,
  fallback: (key: string) => string,
): string {
  const parsed = parseHybridMethodKey(methodKey)
  if (!parsed) return fallback(methodKey)
  return `${HYBRID_EVAL_MODULE_LABELS[parsed.moduleKey]} · ${fallback(parsed.methodKey)}`
}

// 混合课复合 key 排序（模块顺序优先，混合课 key 排在普通 key 前）。
export function hybridMethodCompare(a: string, b: string): number {
  const pa = parseHybridMethodKey(a)
  const pb = parseHybridMethodKey(b)
  if (pa && pb) {
    const oa = HYBRID_EVAL_MODULE_ORDER[pa.moduleKey]
    const ob = HYBRID_EVAL_MODULE_ORDER[pb.moduleKey]
    if (oa !== ob) return oa - ob
    return pa.methodKey.localeCompare(pb.methodKey)
  }
  if (pa) return -1
  if (pb) return 1
  return a.localeCompare(b)
}
