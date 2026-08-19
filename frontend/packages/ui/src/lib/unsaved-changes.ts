/**
 * 弹窗「未保存内容」检测：判断弹窗内的表单是否被用户改动过。
 *
 * 判定口径（见 docs/spec/05-prototype-interaction.md §3.2）：
 * - 以「用户首次交互前」的表单快照为干净基线，之后当前值与基线不同才算有未保存内容；
 * - 弹窗打开后异步回填的初始值不算改动（基线在首次交互时才抓取）；
 * - 改回原值等于没改（快照相同 → 可直接关闭）。
 *
 * 快照只存在内存 ref 中，禁止打日志/上报（可能含密码等输入值）。
 */

/** 参与快照的控件：原生表单控件 + contenteditable + Radix 勾选/开关/下拉触发器 */
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
  if (el.hasAttribute('contenteditable')) return el.textContent ?? ''
  // role=combobox（Radix SelectTrigger）：用显示文案代表选中项
  return (el.textContent ?? '').trim()
}

/**
 * 序列化容器内所有表单控件的当前值，用于前后比对。
 * 位置索引参与 key：动态增删行（本身就是用户改动）会导致序列化变化，属预期。
 */
export function serializeFormState(root: HTMLElement): string {
  const parts: string[] = []
  root.querySelectorAll(FIELD_SELECTOR).forEach((el, index) => {
    if (isIgnored(el)) return
    parts.push(`${index}:${fieldValue(el)}`)
  })
  return parts.join('\u0001')
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
 * 在给定容器上创建未保存内容追踪器：首次用户交互时抓取基线快照，
 * 之后 hasUnsavedChanges() 比对当前快照与基线。
 */
export function createUnsavedChangesTracker(root: HTMLElement): UnsavedChangesTracker {
  let baseline: string | null = null

  const captureBaseline = () => {
    if (baseline === null) baseline = serializeFormState(root)
  }

  BASELINE_EVENTS.forEach((type) => root.addEventListener(type, captureBaseline, true))

  return {
    hasUnsavedChanges: () => baseline !== null && serializeFormState(root) !== baseline,
    dispose: () => {
      BASELINE_EVENTS.forEach((type) => root.removeEventListener(type, captureBaseline, true))
      baseline = null
    },
  }
}
