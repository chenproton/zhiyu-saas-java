import { describe, it, expect } from 'vitest'

import { createUnsavedChangesTracker, serializeFormState } from './unsaved-changes'

/** 构造一个挂在 document 上的容器（tracker 依赖真实事件传播） */
function mount(html: string): HTMLDivElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

/** 模拟用户输入：先 keydown（抓干净基线）→ 改值 → input 事件 */
function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.dispatchEvent(new Event('keydown', { bubbles: true }))
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('serializeFormState', () => {
  it('收集输入框/勾选框/下拉的当前值', () => {
    const root = mount(`
      <input value="张三" />
      <input type="checkbox" checked />
      <textarea>备注</textarea>
      <button role="combobox">已选：语文</button>
    `)
    const snapshot = serializeFormState(root)
    expect(snapshot).toContain('张三')
    expect(snapshot).toContain('备注')
    expect(snapshot).toContain('已选：语文')
  })

  it('忽略搜索框、cmdk 搜索输入、hidden 与显式标记忽略的控件', () => {
    const root = mount(`
      <input type="search" value="关键词" />
      <input data-slot="command-input" value="搜索中" />
      <input type="hidden" value="隐藏值" />
      <div data-unsaved-ignore><input value="过滤条件" /></div>
    `)
    expect(serializeFormState(root)).toBe('')
  })
})

describe('createUnsavedChangesTracker', () => {
  it('用户没交互过 → 无未保存内容', () => {
    const root = mount('<input value="预填值" />')
    const tracker = createUnsavedChangesTracker(root)
    expect(tracker.hasUnsavedChanges()).toBe(false)
    tracker.dispose()
  })

  it('弹窗打开后异步回填初始值不算用户改动', () => {
    const root = mount('<input value="" />')
    const tracker = createUnsavedChangesTracker(root)
    const input = root.querySelector('input') as HTMLInputElement
    // 异步回填：程序直接写值，没有用户事件
    input.value = '接口回填的名称'
    expect(tracker.hasUnsavedChanges()).toBe(false)
    // 用户点进来但什么都没改 → 仍可直接关闭
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(tracker.hasUnsavedChanges()).toBe(false)
    tracker.dispose()
  })

  it('用户输入内容 → 判定为有未保存内容', () => {
    const root = mount('<input value="" />')
    const tracker = createUnsavedChangesTracker(root)
    typeInto(root.querySelector('input') as HTMLInputElement, '新填的内容')
    expect(tracker.hasUnsavedChanges()).toBe(true)
    tracker.dispose()
  })

  it('改动后又改回原值 → 视为没改动', () => {
    const root = mount('<input value="原值" />')
    const tracker = createUnsavedChangesTracker(root)
    const input = root.querySelector('input') as HTMLInputElement
    typeInto(input, '原值改了')
    expect(tracker.hasUnsavedChanges()).toBe(true)
    typeInto(input, '原值')
    expect(tracker.hasUnsavedChanges()).toBe(false)
    tracker.dispose()
  })

  it('勾选框与 Radix 开关（aria-checked）改动可被识别', () => {
    const root = mount(`
      <input type="checkbox" />
      <button role="switch" aria-checked="false"></button>
    `)
    const tracker = createUnsavedChangesTracker(root)
    const checkbox = root.querySelector('input') as HTMLInputElement
    checkbox.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    expect(tracker.hasUnsavedChanges()).toBe(true)

    checkbox.checked = false
    expect(tracker.hasUnsavedChanges()).toBe(false)
    const radixSwitch = root.querySelector('[role="switch"]') as HTMLElement
    radixSwitch.setAttribute('aria-checked', 'true')
    expect(tracker.hasUnsavedChanges()).toBe(true)
    tracker.dispose()
  })

  it('新增动态行（用户添加的一项）算未保存内容', () => {
    const root = mount('<div class="rows"><input value="第一项" /></div>')
    const tracker = createUnsavedChangesTracker(root)
    const addTarget = root.querySelector('input') as HTMLInputElement
    addTarget.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    const added = document.createElement('input')
    added.value = '第二项'
    root.querySelector('.rows')?.appendChild(added)
    expect(tracker.hasUnsavedChanges()).toBe(true)
    tracker.dispose()
  })

  it('dispose 后不再追踪', () => {
    const root = mount('<input value="" />')
    const tracker = createUnsavedChangesTracker(root)
    tracker.dispose()
    typeInto(root.querySelector('input') as HTMLInputElement, '关闭后输入')
    expect(tracker.hasUnsavedChanges()).toBe(false)
  })
})
