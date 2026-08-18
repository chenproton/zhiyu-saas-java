/**
 * 学习/考试入口链接统一拼接（资源快照版本化）。
 *
 * 版本解析取舍（docs/resource-snapshot-versioning.md 8.11）：bundle 接口只有 version 参数，
 * "绑定版本"的解析主体就是入口链接上的 `?v=`——工作台/排课行把 stamp 的 resourceVersion 拼进链接，
 * 学生直访（无 v）则看最新快照。上游无版本字段时保持不带 v（= 最新快照语义）。
 *
 * learn 页 → 考试作答页的链接不带 v：作答页按 exam_usages.exam_version 服务端取试卷快照（8.4），
 * 只消费 task/scene/course/node/method/usage 参数。
 */

/** 为链接追加 `?v=` 资源版本；无版本时原样返回（最新快照语义） */
export function withResourceVersion(href: string, version?: string | null): string {
  if (!version) return href
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}v=${encodeURIComponent(version)}`
}

/** 场景详情页 /scene/landing/{id} */
export function sceneLandingHref(scenarioId: string, version?: string | null): string {
  return withResourceVersion(`/scene/landing/${scenarioId}`, version)
}

/** 场景学习页 /scene/landing/{id}/learn（可带 task 定位） */
export function sceneLearnHref(
  scenarioId: string,
  opts?: { taskId?: string | null; version?: string | null },
): string {
  const base = opts?.taskId
    ? `/scene/landing/${scenarioId}/learn?task=${encodeURIComponent(opts.taskId)}`
    : `/scene/landing/${scenarioId}/learn`
  return withResourceVersion(base, opts?.version)
}

/** 课程详情页 /lesson/landing/{id} */
export function lessonLandingHref(courseId: string, version?: string | null): string {
  return withResourceVersion(`/lesson/landing/${courseId}`, version)
}

/** 课程学习页 /lesson/landing/{id}/learn（可带 node 定位） */
export function lessonLearnHref(
  courseId: string,
  opts?: { nodeId?: string | null; version?: string | null },
): string {
  const base = opts?.nodeId
    ? `/lesson/landing/${courseId}/learn?node=${encodeURIComponent(opts.nodeId)}`
    : `/lesson/landing/${courseId}/learn`
  return withResourceVersion(base, opts?.version)
}

/**
 * 考试作答页 /evaluation/landing/exams/{id}。
 * 参数以对端页面实际消费为准（task/scene/course/node/method/usage），空值参数省略；
 * 试卷版本由作答页按 usage.examVersion 服务端解析，不在链接上携带。
 */
export function examHref(
  examId: string,
  params: Record<string, string | null | undefined>,
): string {
  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&')
  return `/evaluation/landing/exams/${examId}${query ? `?${query}` : ''}`
}
