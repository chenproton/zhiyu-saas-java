/**
 * 弹窗「未保存内容」检测：判断弹窗内的表单是否被用户改动过。
 *
 * 判定口径（见 docs/spec/05-prototype-interaction.md §3.2）：
 * - 以「用户首次交互前」的逐字段基线为准，某个字段的当前值与自己的基线不同才算有未保存内容；
 * - 逐字段比对（不是整体快照串）：搜索筛选/切 Tab/异步重载列表带来的结构变化不算改动；
 * - 基线增量补记：首次交互之后才挂载的字段（切 Tab、动态加行）在下一次交互事件时补记基线；
 * - 弹窗打开后异步回填的初始值不算改动（基线在交互事件时才抓取）；
 * - 改回原值等于没改（当前值与基线相同 → 可直接关闭）。
 *
 * 基线只存在内存中，禁止打日志/上报（可能含密码等输入值）。
 */

/** 参与比对的控件：原生表单控件 + contenteditable + Radix 勾选/开关/单选/下拉/滑块 */
const FIELD_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="slider"]',
].join(',')

/** 不算「内容」的控件：搜索框（列表筛选）、cmdk 搜索输入、显式标记忽略的元素 */
const IGNORED_SELECTOR = [
  'input[type="search"]',
  'input[type="hidden"]',
  '[data-slot="command-input"]',
  '[data-unsaved-ignore]',
].join(',')

function isIgnored(el: Element): boolean {
  return el.matches(IGNORED_SELECTOR) || el.closest('[data-unsaved-ignore]') !== null
}

function fieldValue(el: Element): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '1' : '0'
    if (el.type === 'file') return String(el.files?.length ?? 0)
    return el.value
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value
  const ariaChecked = el.getAttribute('aria-checked')
  if (ariaChecked !== null) return ariaChecked
  const ariaValueNow = el.getAttribute('aria-valuenow')
  if (ariaValueNow !== null) return ariaValueNow
  if (el.hasAttribute('contenteditable')) return el.textContent ?? ''
  // role=combobox（Radix SelectTrigger）：用显示文案代表选中项
  return (el.textContent ?? '').trim()
}

/** 采集容器内参与比对的字段及当前值，按元素身份索引（不用位置索引，避免结构变化误判） */
export function collectFieldValues(root: HTMLElement): Map<Element, string> {
  const values = new Map<Element, string>()
  root.querySelectorAll(FIELD_SELECTOR).forEach((el) => {
    if (!isIgnored(el)) values.set(el, fieldValue(el))
  })
  return values
}

export interface UnsavedChangesTracker {
  /** 当前弹窗内是否存在用户改动且未保存的内容 */
  hasUnsavedChanges: () => boolean
  /** 解绑监听（弹窗内容卸载时调用） */
  dispose: () => void
}

/** 触发「抓取干净基线」的事件：pointerdown/keydown 先于值变化发生，故基线仍是改动前状态 */
const BASELINE_EVENTS = ['pointerdown', 'keydown', 'input', 'change', 'paste'] as const

/**
 * 在给定容器上创建未保存内容追踪器：首次用户交互时逐字段抓取基线，
 * 之后 hasUnsavedChanges() 比对仍在 DOM 中的字段与自己的基线。
 */
export function createUnsavedChangesTracker(root: HTMLElement): UnsavedChangesTracker {
  const baseline = new Map<Element, string>()
  let captured = false

  /**
   * 抓基线：为「尚无基线」的字段补记当前值，已有基线的字段不覆盖。
   * 事件在值变化之前触发（pointerdown/keydown 先于输入与勾选），故记下的是改动前状态；
   * 增量补记让首次交互之后才挂载的字段（切 Tab、动态加行）也能被追踪。
   */
  const captureBaseline = () => {
    captured = true
    collectFieldValues(root).forEach((value, el) => {
      if (!baseline.has(el)) baseline.set(el, value)
    })
  }

  BASELINE_EVENTS.forEach((type) => root.addEventListener(type, captureBaseline, true))

  return {
    hasUnsavedChanges: () => {
      if (!captured) return false
      for (const [el, original] of baseline) {
        // 已从 DOM 移除的字段（搜索筛选、切 Tab、列表重载）不算改动
        if (!root.contains(el)) continue
        if (fieldValue(el) !== original) return true
      }
      return false
    },
    dispose: () => {
      BASELINE_EVENTS.forEach((type) => root.removeEventListener(type, captureBaseline, true))
      baseline.clear()
      captured = false
    },
  }
}

/**
 * 关闭弹窗时是否需要拦下来做二次确认。
 * @param unsavedGuard 守卫开关：`'auto'` 自动检测 / `true` 强制视为有未保存内容 / `false` 关闭守卫
 * @param hasUnsavedChanges 自动检测结果读取器（仅 `'auto'` 时调用）
 */
export function shouldBlockClose(
  unsavedGuard: boolean | 'auto',
  hasUnsavedChanges: () => boolean,
): boolean {
  if (unsavedGuard === false) return false
  if (unsavedGuard === true) return true
  return hasUnsavedChanges()
}
