'use client'

import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { createTagElement } from '../../lib/dom-utils'

export interface MixedTagEditorProps {
  text: string
  knowledgePointIds: string[]
  abilityPointIds: string[]
  knowledgePoints: { id: string; name: string }[]
  abilityPoints: { id: string; name: string }[]
  onChange: (updates: {
    name?: string
    knowledgePointIds?: string[]
    abilityPointIds?: string[]
  }) => void
  onOpenKpDialog: () => void
  onOpenAbDialog: () => void
  placeholder?: string
  /** 标签紧凑型样式（用于弹窗内较小空间），默认 false 使用标准尺寸 */
  compact?: boolean
}

/**
 * MixedTagEditor
 *
 * contentEditable 输入框，支持纯文本与知识点/能力点标签混排。
 * 用于评价维度名称、量规指标等需要关联知识/能力点的场景。
 */
export function MixedTagEditor({
  text,
  knowledgePointIds,
  abilityPointIds,
  knowledgePoints,
  abilityPoints,
  onChange,
  onOpenKpDialog,
  onOpenAbDialog,
  placeholder = '输入评价维度',
  compact = false,
}: MixedTagEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)
  const onChangeRef = useRef(onChange)
  const kpIdsRef = useRef(knowledgePointIds)
  const abIdsRef = useRef(abilityPointIds)
  const prevTags = useRef({ kp: [] as string[], ab: [] as string[] })
  const cursorOffsetRef = useRef<number | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
    kpIdsRef.current = knowledgePointIds
    abIdsRef.current = abilityPointIds
  }, [onChange, knowledgePointIds, abilityPointIds])

  const updateCursorOffset = () => {
    const el = ref.current
    if (!el) return
    const selection = document.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    if (!el.contains(range.startContainer) && range.startContainer !== el) return

    let offset = 0
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          offset += range.startOffset
          break
        }
        offset += node.textContent?.length || 0
      }
    } else if (range.startContainer === el) {
      for (let i = 0; i < range.startOffset && i < el.childNodes.length; i++) {
        const child = el.childNodes[i]
        if (child.nodeType === Node.TEXT_NODE) {
          offset += child.textContent?.length || 0
        }
      }
    }
    cursorOffsetRef.current = offset
  }

  const createTagSpan = useCallback(
    (type: 'kp' | 'ab', id: string): HTMLSpanElement | null => {
      if (type === 'kp') {
        const kp = knowledgePoints.find((k) => k.id === id)
        if (!kp) return null
        const name = compact && kp.name.length > 5 ? kp.name.slice(0, 5) : kp.name
        const span = createTagElement(
          'kp',
          id,
          name,
          () => {
            onChangeRef.current({ knowledgePointIds: kpIdsRef.current.filter((i) => i !== id) })
          },
          compact
            ? {
                className:
                  'inline-flex items-center px-1 rounded text-[9px] font-normal bg-blue-50 text-blue-600 border border-blue-200 mx-0.5 align-middle cursor-default h-4',
                btnClassName: 'ml-0.5 text-blue-400 hover:text-red-500 leading-none text-[9px]',
              }
            : undefined,
        )
        if (span) span.title = kp.name
        return span
      } else {
        const ab = abilityPoints.find((a) => a.id === id)
        if (!ab) return null
        const name = compact && ab.name.length > 5 ? ab.name.slice(0, 5) : ab.name
        const span = createTagElement(
          'ab',
          id,
          name,
          () => {
            onChangeRef.current({ abilityPointIds: abIdsRef.current.filter((i) => i !== id) })
          },
          compact
            ? {
                className:
                  'inline-flex items-center px-1 rounded text-[9px] font-normal bg-amber-50 text-amber-600 border border-amber-200 mx-0.5 align-middle cursor-default h-4',
                btnClassName: 'ml-0.5 text-amber-400 hover:text-red-500 leading-none text-[9px]',
              }
            : undefined,
        )
        if (span) span.title = ab.name
        return span
      }
    },
    [knowledgePoints, abilityPoints, compact],
  )

  // 初始化/重置时全量渲染
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (text) el.textContent = text
    else el.innerHTML = ''
    knowledgePointIds.forEach((kpid) => {
      const span = createTagSpan('kp', kpid)
      if (span) el.appendChild(span)
    })
    abilityPointIds.forEach((abId) => {
      const span = createTagSpan('ab', abId)
      if (span) el.appendChild(span)
    })
    prevTags.current = { kp: [...knowledgePointIds], ab: [...abilityPointIds] }
    // text 变化通常意味着切换条目，需要全量重建；knowledgePoints/abilityPoints 变化由下方 effect 增量处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // 仅当标签 ID 集合变化时做增量更新，避免输入焦点丢失
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const kpChanged = JSON.stringify(prevTags.current.kp) !== JSON.stringify(knowledgePointIds)
    const abChanged = JSON.stringify(prevTags.current.ab) !== JSON.stringify(abilityPointIds)
    const domText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
    const textChanged = domText !== (text || '')
    if (!kpChanged && !abChanged && !textChanged) return

    if (el !== document.activeElement) {
      const newKpIds = knowledgePointIds.filter((id) => !prevTags.current.kp.includes(id))
      const newAbIds = abilityPointIds.filter((id) => !prevTags.current.ab.includes(id))
      const existingKpIds = knowledgePointIds.filter((id) => prevTags.current.kp.includes(id))
      const existingAbIds = abilityPointIds.filter((id) => prevTags.current.ab.includes(id))

      // 移除已不存在的标签
      Array.from(el.children).forEach((child) => {
        const dataset = (child as HTMLElement).dataset
        if (!dataset.tag) return
        const id = dataset.id
        if (dataset.type === 'kp' && id && !existingKpIds.includes(id)) {
          el.removeChild(child)
        } else if (dataset.type === 'ab' && id && !existingAbIds.includes(id)) {
          el.removeChild(child)
        }
      })

      // 追加新增标签
      newKpIds.forEach((id) => {
        const span = createTagSpan('kp', id)
        if (span) el.appendChild(span)
      })
      newAbIds.forEach((id) => {
        const span = createTagSpan('ab', id)
        if (span) el.appendChild(span)
      })

      prevTags.current = { kp: [...knowledgePointIds], ab: [...abilityPointIds] }
      return
    }

    // 聚焦时保留光标位置，仅追加到末尾（外部新增标签场景）
    const newKpIds = knowledgePointIds.filter((id) => !prevTags.current.kp.includes(id))
    const newAbIds = abilityPointIds.filter((id) => !prevTags.current.ab.includes(id))
    if (newKpIds.length === 0 && newAbIds.length === 0) return

    newKpIds.forEach((id) => {
      const span = createTagSpan('kp', id)
      if (span) el.appendChild(span)
    })
    newAbIds.forEach((id) => {
      const span = createTagSpan('ab', id)
      if (span) el.appendChild(span)
    })
    prevTags.current = { kp: [...knowledgePointIds], ab: [...abilityPointIds] }
  }, [knowledgePointIds, abilityPointIds, text, createTagSpan])

  const handleBlur = () => {
    if (isComposing.current) return
    const el = ref.current
    if (!el) return
    let newText = ''
    const newKpIds: string[] = []
    const newAbIds: string[] = []
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) newText += node.textContent || ''
      else if (node.nodeType === Node.ELEMENT_NODE) {
        const dataset = (node as HTMLElement).dataset
        if (dataset.tag) {
          if (dataset.type === 'kp' && dataset.id) newKpIds.push(dataset.id)
          if (dataset.type === 'ab' && dataset.id) newAbIds.push(dataset.id)
        }
      }
    })
    onChangeRef.current({ name: newText, knowledgePointIds: newKpIds, abilityPointIds: newAbIds })
  }

  return (
    <div className="min-h-[32px] rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm flex flex-wrap gap-1 items-center">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 outline-none min-w-[80px] text-sm leading-6 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        data-placeholder={placeholder}
        onBlur={handleBlur}
        onInput={updateCursorOffset}
        onKeyUp={updateCursorOffset}
        onMouseUp={updateCursorOffset}
        onCompositionStart={() => {
          isComposing.current = true
        }}
        onCompositionEnd={() => {
          isComposing.current = false
        }}
        onPaste={(e) => {
          e.preventDefault()
          const pasted = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, pasted)
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0"
        onClick={onOpenKpDialog}
      >
        关联考查知识点
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-[10px] px-1 text-gray-400 hover:text-primary shrink-0"
        onClick={onOpenAbDialog}
      >
        关联考查能力点
      </Button>
    </div>
  )
}
