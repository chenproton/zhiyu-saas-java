/**
 * 弹窗未保存内容守卫的三条关闭路径（遮罩 / ESC / 右上角 X）行为测试。
 *
 * 用 react-dom/client + React.act 直接渲染，零新增依赖（无 @testing-library）。
 * 表单用**受控 input**，与真实业务弹窗一致：每次输入都会重渲染，
 * 用于守住「Radix 重挂 ref 导致基线被清空、守卫永远判没改动」这个回归。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** 受控表单弹窗（等价于业务里的「新建资源」弹窗） */
function FormDialog({
  onOpenChange,
  unsavedGuard,
}: {
  onOpenChange: (open: boolean) => void
  unsavedGuard?: boolean | 'auto'
}) {
  const [name, setName] = React.useState('')
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent unsavedGuard={unsavedGuard}>
        <DialogHeader>
          <DialogTitle>新增资源</DialogTitle>
          <DialogDescription>填写资源信息</DialogDescription>
        </DialogHeader>
        <input data-testid="name" value={name} onChange={(e) => setName(e.target.value)} />
      </DialogContent>
    </Dialog>
  )
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await React.act(async () => root.unmount())
  container.remove()
})

async function render(onOpenChange: (open: boolean) => void, unsavedGuard?: boolean | 'auto') {
  await React.act(async () => {
    root.render(<FormDialog onOpenChange={onOpenChange} unsavedGuard={unsavedGuard} />)
  })
  // Radix 的 pointerdown-outside 监听是 setTimeout(0) 之后才注册的，先让定时器跑完
  await React.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

/** 模拟用户逐字输入（受控 input：派发 keydown → 改值 → input，触发 React onChange 重渲染） */
async function typeInto(value: string) {
  const input = document.querySelector('[data-testid="name"]') as HTMLInputElement
  for (const char of value) {
    await React.act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char }))
      input.value += char
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
}

async function clickOverlay() {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement
  await React.act(async () => {
    overlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
}

async function pressEscape() {
  await React.act(async () => {
    // cancelable 必须为 true，否则 preventDefault 无效（真实浏览器 keydown 可取消）
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
  })
}

async function clickCloseButton() {
  const close = document.querySelector('[data-slot="dialog-close"]') as HTMLElement
  await React.act(async () => close.click())
}

function confirmVisible() {
  return (document.body.textContent ?? '').includes('确认离开')
}

async function clickConfirmText(text: string) {
  const btn = [...document.querySelectorAll('[data-slot="alert-dialog-content"] button')].find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLElement
  expect(btn).toBeTruthy()
  await React.act(async () => btn.click())
}

describe('DialogContent 未保存内容守卫', () => {
  it('空表单点遮罩：直接关闭，不弹确认', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await clickOverlay()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(confirmVisible()).toBe(false)
  })

  it('填了内容点遮罩：拦下关闭并弹确认', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('资源A')
    await clickOverlay()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(confirmVisible()).toBe(true)
  })

  it('填了内容按 ESC：拦下关闭并弹确认', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('资源B')
    await pressEscape()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(confirmVisible()).toBe(true)
  })

  it('填了内容点右上角 X：拦下关闭并弹确认', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('资源C')
    await clickCloseButton()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(confirmVisible()).toBe(true)
  })

  it('确认框选「继续编辑」：弹窗保持打开', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('资源D')
    await clickOverlay()
    await clickConfirmText('继续编辑')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy()
  })

  it('确认框选「离开」：真正关闭弹窗', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('资源E')
    await clickOverlay()
    await clickConfirmText('离开')
    // confirmDiscard 用 requestAnimationFrame 延后一帧关闭
    await React.act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('输入后改回空值：视为没改动，点遮罩直接关闭', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange)
    await typeInto('临时')
    const input = document.querySelector('[data-testid="name"]') as HTMLInputElement
    await React.act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' }))
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await clickOverlay()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(confirmVisible()).toBe(false)
  })

  it('unsavedGuard={false}：填了内容也直接关闭', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange, false)
    await typeInto('资源F')
    await clickOverlay()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(confirmVisible()).toBe(false)
  })

  it('unsavedGuard={true}：空表单也弹确认', async () => {
    const onOpenChange = vi.fn()
    await render(onOpenChange, true)
    await clickOverlay()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(confirmVisible()).toBe(true)
  })
})
