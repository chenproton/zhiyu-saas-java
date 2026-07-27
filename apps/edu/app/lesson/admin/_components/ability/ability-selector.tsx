"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Search, Plus, X, Award } from "lucide-react"
import { abilityApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface AbilityPointItem {
  id: string
  name: string
  category: string
  description?: string
}

interface AbilitySelectorProps {
  selected: AbilityPointItem[]
  onChange?: (selected: AbilityPointItem[]) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  knowledge: "知识", skill: "技能", quality: "素质",
}
const CATEGORY_COLORS: Record<string, string> = {
  knowledge: "text-purple-600 bg-purple-50 border-purple-200",
  skill: "text-orange-600 bg-orange-50 border-orange-200",
  quality: "text-cyan-600 bg-cyan-50 border-cyan-200",
}

export function AbilitySelector({ selected, onChange }: AbilitySelectorProps) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [allItems, setAllItems] = useState<AbilityPointItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dialogOpen) return
    setLoading(true)
    abilityApi.list({ limit: 500 }).then((res) => {
      setAllItems(res.items || [])
    }).catch(() => {
      toast({ variant: "destructive", title: "加载能力点失败" })
    }).finally(() => setLoading(false))
  }, [dialogOpen])

  const filtered = search
    ? allItems.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : allItems

  const selectedIds = new Set(selected.map((s) => s.id))

  const toggle = (item: AbilityPointItem) => {
    const next = selectedIds.has(item.id)
      ? selected.filter((s) => s.id !== item.id)
      : [...selected, item]
    onChange?.(next)
  }

  const remove = (id: string) => {
    onChange?.(selected.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">能力点</span>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          关联能力点
        </Button>
      </div>

      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂未关联能力点</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge key={item.id} variant="outline" className={`flex items-center gap-1 pr-1 ${CATEGORY_COLORS[item.category] || ""}`}>
              <Award className="h-3 w-3" />
              {item.name}
              <button onClick={() => remove(item.id)} className="ml-0.5 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择能力点</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索能力点..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">加载中...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无能力点</p>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                      isSelected ? "bg-primary/5 border-primary/30" : "hover:bg-muted"
                    }`}
                  >
                    <Award className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
