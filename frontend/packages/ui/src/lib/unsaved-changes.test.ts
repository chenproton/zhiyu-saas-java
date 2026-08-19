import { describe, it, expect } from 'vitest'

import {
  collectFieldValues,
  createUnsavedChangesTracker,
  shouldBlockClose,
} from './unsaved-changes'

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

/** 模拟用户在弹窗内点一下（抓干净基线，值变化发生在 pointerdown 之后） */
function pointerDown(el: Element) {
  el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

describe('collectFieldValues', () => {
  it('收集输入框/勾选框/下拉/滑块的当前值', () => {
    const root = mount(`
      <input value="张三" />
      <input type="checkbox" checked />
      <textarea>备注</textarea>
      <button role="combobox">已选：语文</button>
      <span role="slider" aria-valuenow="30"></span>
    `)
    const values = [...collectFieldValues(root).values()]
    expect(values).toEqual(['张三', '1', '备注', '已选：语文', '30'])
  })

  it('忽略搜索框、cmdk 搜索输入、hidden 与显式标记忽略的控件', () => {
    const root = mount(`
      <input type="search" value="关键词" />
      <input data-slot="command-input" value="搜索中" />
      <input type="hidden" value="隐藏值" />
      <div data-unsaved-ignore><input value="过滤条件" /></div>
    `)
    expect(collectFieldValues(root).size).toBe(0)
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
    pointerDown(input)
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
      <label><input type="checkbox" /> 同意</label>
      <button role="switch" aria-checked="false"></button>
    `)
    const tracker = createUnsavedChangesTracker(root)
    const checkbox = root.querySelector('input') as HTMLInputElement
    // 点 label 文字触发勾选：pointerdown 在 label 上，基线仍是勾选前状态
    pointerDown(root.querySelector('label') as HTMLElement)
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

  it('Radix 下拉（combobox 显示文案）改动可被识别', () => {
    const root = mount('<button role="combobox">请选择</button>')
    const tracker = createUnsavedChangesTracker(root)
    const trigger = root.querySelector('[role="combobox"]') as HTMLElement
    // 用户点触发器 → 抓基线；选项在 portal 中点选，只回写触发器文案
    pointerDown(trigger)
    trigger.textContent = '语文'
    expect(tracker.hasUnsavedChanges()).toBe(true)
    tracker.dispose()
  })

  it('搜索筛选导致列表条目减少 → 不算未保存内容', () => {
    const root = mount(`
      <input type="search" value="" />
      <div class="rows">
        <label><input type="checkbox" /> 甲</label>
        <label><input type="checkbox" /> 乙</label>
      </div>
    `)
    const tracker = createUnsavedChangesTracker(root)
    const search = root.querySelector('input[type="search"]') as HTMLInputElement
    typeInto(search, '甲')
    // 列表按搜索词重渲染：乙被移除
    const rows = root.querySelectorAll('.rows label')
    rows[1].remove()
    expect(tracker.hasUnsavedChanges()).toBe(false)
    tracker.dispose()
  })

  it('切换 Tab 后新出现的字段（无基线）不算未保存内容', () => {
    const root = mount('<div class="tab"><input value="第一页" /></div>')
    const tracker = createUnsavedChangesTracker(root)
    pointerDown(root.querySelector('input') as HTMLInputElement)
    // 切 Tab：旧字段卸载、新字段挂载且带默认值
    const tab = root.querySelector('.tab') as HTMLElement
    tab.innerHTML = '<input value="第二页默认值" />'
    expect(tracker.hasUnsavedChanges()).toBe(false)
    // 但用户在新字段里输入后就算改动
    typeInto(root.querySelector('input') as HTMLInputElement, '第二页改了')
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

describe('shouldBlockClose', () => {
  it('unsavedGuard=false 一律不拦', () => {
    expect(shouldBlockClose(false, () => true)).toBe(false)
    expect(shouldBlockClose(false, () => false)).toBe(false)
  })

  it('unsavedGuard=true 一律拦（不看自动检测）', () => {
    let called = false
    expect(
      shouldBlockClose(true, () => {
        called = true
        return false
      }),
    ).toBe(true)
    expect(called).toBe(false)
  })

  it("unsavedGuard='auto' 按自动检测结果决定", () => {
    expect(shouldBlockClose('auto', () => true)).toBe(true)
    expect(shouldBlockClose('auto', () => false)).toBe(false)
  })
})
