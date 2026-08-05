'use client'

import { useState } from 'react'
import { BookOpen, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  hybridCourseSessions,
  scenarioTasks,
  type PrepSubItem,
} from '../_data/workspace-teacher-types'

interface PrepAssociateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  planName: string
  isHybrid: boolean
  currentSubItemIds?: string[]
  onConfirm: (subItems: PrepSubItem[]) => void
  prepUrl?: string
}

export function PrepAssociateDialog({
  open,
  onOpenChange,
  planId,
  planName,
  isHybrid,
  currentSubItemIds,
  onConfirm,
  prepUrl,
}: PrepAssociateDialogProps) {
  const subItems = isHybrid ? hybridCourseSessions[planId] || [] : scenarioTasks[planId] || []
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentSubItemIds || []))
  const [confirmed, setConfirmed] = useState(false)

  const level1Label = isHybrid ? '混合课程' : '实践场景'
  const level2Label = isHybrid ? '节次' : '任务'

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const items = subItems.filter((s) => selectedIds.has(s.id))
    if (items.length > 0) {
      onConfirm(items)
      setConfirmed(true)
    }
  }

  const handleNavigate = () => {
    if (prepUrl) {
      window.open(prepUrl, '_blank')
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          setSelectedIds(new Set(currentSubItemIds || []))
          setConfirmed(false)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            关联备课内容
          </DialogTitle>
          <DialogDescription>
            勾选要备课的{level2Label}（可多选），后续可直接跳转到对应备课页面。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">{level1Label}</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50">
              <Badge
                variant="outline"
                className={
                  isHybrid ? 'border-blue-200 text-blue-600' : 'border-emerald-200 text-emerald-600'
                }
              >
                {level1Label}
              </Badge>
              <span className="text-sm font-medium text-gray-900">{planName}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">{level2Label}名称</label>
              {selectedIds.size > 0 && (
                <span className="text-xs text-gray-400">
                  已选 {selectedIds.size}/{subItems.length}
                </span>
              )}
            </div>
            {subItems.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">暂无可用{level2Label}</p>
            ) : (
              <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                {subItems.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? isHybrid
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-emerald-300 bg-emerald-50'
                          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <span
                        className={`text-sm flex-1 ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                      >
                        {item.name}
                      </span>
                      {isSelected && confirmed ? (
                        <span
                          className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded border ${isHybrid ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200'}`}
                        >
                          已关联
                        </span>
                      ) : isSelected ? (
                        <Check
                          className={`h-4 w-4 shrink-0 ${isHybrid ? 'text-blue-600' : 'text-emerald-600'}`}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400"
              onClick={() => setSelectedIds(new Set())}
            >
              清空选择
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.size === 0}
                className={
                  isHybrid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }
                onClick={handleConfirm}
              >
                {confirmed ? '修改关联' : '确认关联'}
              </Button>
              {confirmed && prepUrl && (
                <Button
                  size="sm"
                  className={
                    isHybrid
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }
                  onClick={handleNavigate}
                >
                  {isHybrid ? '前往备课' : '前往导学'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
