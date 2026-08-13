'use client'

import { useMemo, useRef, useState } from 'react'

/**
 * AI 辅助写入公共底座（岗位 AI 辅助编写的样板实现，新 AI 表单功能直接复用）。
 *
 * 三个 hook 各自独立可组合：
 * - useAiNotConfigured：412 ai_not_configured 检测 + 配置引导弹窗状态
 * - useAiFieldWriter：字段级 AI 直接写入（1 级快照历史 + 写入高亮 + 逐字段/全部撤销）
 * - useAiPipeline：串行 AI 任务流水线（进度弹窗 + AbortController 取消 + 统一错误处理）
 *
 * 使用方式与约定见 docs/ai-development.md「岗位 AI 辅助编写（样板）」。
 */

/** 判断请求是否因用户取消被中止（AbortController / AbortSignal.timeout 均抛 AbortError） */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

// ===== useAiNotConfigured：412 ai_not_configured 统一引导 =====

export function useAiNotConfigured() {
  const [notConfiguredOpen, setNotConfiguredOpen] = useState(false)
  // 流水线多任务共享的"已提示"标记：一次运行中命中 412 后中止后续任务，避免重复弹窗
  const notConfiguredRef = useRef(false)

  /** 命中 412（err.message === 'ai_not_configured'）则打开配置引导弹窗并返回 true */
  const markNotConfigured = (err: unknown): boolean => {
    if (err instanceof Error && err.message === 'ai_not_configured') {
      notConfiguredRef.current = true
      setNotConfiguredOpen(true)
      return true
    }
    return false
  }

  const resetNotConfigured = () => {
    notConfiguredRef.current = false
  }

  return {
    notConfiguredOpen,
    setNotConfiguredOpen,
    notConfiguredRef,
    markNotConfigured,
    resetNotConfigured,
  }
}

// ===== useAiFieldWriter：字段级 AI 写入（快照/恢复/高亮） =====

export function useAiFieldWriter<TKey extends string, TValue extends object>(
  keys: TKey[],
  onUpdate: (values: TValue) => void,
  snapshotField: (key: TKey) => TValue,
) {
  /** 字段被 AI 首次覆盖前的快照（1 级历史）；多次覆盖不更新历史，恢复上版回到 AI 介入前原值 */
  const [aiHistories, setAiHistories] = useState<Partial<Record<TKey, TValue>>>({})
  /** 写入高亮字段（短暂紫色闪烁，提示"哪里被 AI 改了"） */
  const [flashKey, setFlashKey] = useState<TKey | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashField = (key: TKey) => {
    setFlashKey(key)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashKey(null), 1400)
  }

  /** 直接写入某字段：记录首次覆盖前快照 + 应用新值 + 高亮 */
  const writeField = (key: TKey, values: TValue) => {
    setAiHistories((prev) => {
      if (prev[key] !== undefined) return prev
      return { ...prev, [key]: snapshotField(key) }
    })
    onUpdate(values)
    flashField(key)
  }

  /** 恢复某字段到 AI 覆盖前的值（清除该字段历史） */
  const restoreField = (key: TKey) => {
    const snapshot = aiHistories[key]
    if (snapshot !== undefined) onUpdate(snapshot)
    setAiHistories((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 全部撤销：恢复所有被 AI 覆盖的字段；onDone 供调用方补充成功提示 */
  const restoreAll = (onDone?: () => void) => {
    const snaps = keys
      .map((k) => aiHistories[k])
      .filter((s): s is TValue => s !== undefined)
    if (snaps.length > 0) {
      onUpdate(Object.assign({}, ...snaps) as TValue)
    }
    setAiHistories({})
    onDone?.()
  }

  /** 当前被 AI 覆盖且未恢复的字段数 */
  const updatedCount = useMemo(
    () => keys.filter((k) => aiHistories[k] !== undefined).length,
    [keys, aiHistories],
  )

  return { aiHistories, flashKey, writeField, restoreField, restoreAll, updatedCount }
}

// ===== useAiPipeline：串行 AI 任务流水线 =====

export interface AiPipelineTask<TMeta, TRes> {
  /** 任务标识（一般对应后端 field，也用于 loading 指示） */
  id: string
  /** 任务附加数据（如逐职责拆解时的当前职责对象） */
  meta: TMeta
  /** 任务开始前回调（如滚动定位到目标区块） */
  onStart?: () => void
  /** 应用结果（前一个任务完成后才执行，串行写入） */
  apply: (res: TRes) => void
}

export interface AiPipelineOptions<TMeta, TRes> {
  /** 进度弹窗步骤列表（建议第 0 步为「阅读信息」占位步） */
  steps: string[]
  /** 发起单个任务请求；signal 用于取消（应透传给底层请求） */
  request: (task: AiPipelineTask<TMeta, TRes>, signal: AbortSignal) => Promise<TRes>
  /**
   * 错误处理：返回 true 中止后续任务，false 继续下一个任务。
   * 取消（AbortError）由 hook 内部处理，不会走到这里。
   */
  onError: (err: unknown) => boolean
}

export interface AiPipelineRunResult {
  /** 全部任务是否按顺序跑完（未被取消/中止） */
  completedAll: boolean
  /** 成功应用结果的任务数（用于部分成功提示） */
  success: number
}

export function useAiPipeline<TMeta, TRes>(options: AiPipelineOptions<TMeta, TRes>) {
  const { steps, request, onError } = options
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(3)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = () => {
    abortRef.current?.abort()
  }

  /** 关闭进度弹窗：运行中关闭视为取消（避免"UI 关了但请求继续写字段"） */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) cancel()
    setOpen(false)
  }

  const run = async (
    tasks: AiPipelineTask<TMeta, TRes>[],
    opts?: { showDialog?: boolean },
  ): Promise<AiPipelineRunResult> => {
    if (isRunning || tasks.length === 0) return { completedAll: false, success: 0 }
    const controller = new AbortController()
    abortRef.current = controller
    setIsRunning(true)
    if (opts?.showDialog !== false) setOpen(true)
    setPhase(0)
    setProgress(3)
    let i = 0
    let success = 0
    try {
      for (; i < tasks.length; i++) {
        if (controller.signal.aborted) break
        const task = tasks[i]
        setRunningId(task.id)
        task.onStart?.()
        let res: TRes | null = null
        try {
          res = await request(task, controller.signal)
        } catch (err) {
          if (isAbortError(err) || controller.signal.aborted) break
          if (onError(err)) break
        } finally {
          const nextPhase = i + 1
          setPhase(nextPhase)
          setProgress(Math.round(((nextPhase + 1) / Math.max(steps.length, 1)) * 100))
        }
        if (res === null || controller.signal.aborted) continue
        task.apply(res)
        success++
      }
    } finally {
      setIsRunning(false)
      setRunningId(null)
      setOpen(false)
      abortRef.current = null
    }
    return { completedAll: i === tasks.length, success }
  }

  return { open, phase, progress, runningId, isRunning, run, cancel, handleOpenChange }
}
