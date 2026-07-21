"use client"

import { MoreHorizontal, Pencil, Star, Trash2, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Scenario } from "@/lib/types/scene"

interface ScenarioCardProps {
  scenario: Scenario
}

const statusConfig = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  pending: { label: "审批中", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-blue-50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
  published: { label: "已发布", className: "bg-green-50 text-green-600" },
  archived: { label: "已归档", className: "bg-purple-50 text-purple-600" },
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const status = statusConfig[scenario.status]

  const renderDifficulty = (level: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "h-3 w-3",
              i <= level ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <Link href={`/scene/scenarios/${scenario.id}/edit`} className="block group">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
          <Image
            src={scenario.coverImage || "/placeholder.svg"}
            alt={scenario.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className={cn("text-xs font-medium", status.className)}>
              {status.label}
            </Badge>
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-600">
              {scenario.version}
            </Badge>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {renderDifficulty(scenario.difficulty)}
            <Badge variant="secondary" className="bg-gray-50 text-gray-500 text-xs">
              {scenario.professionNames?.join("、") || scenario.professionIds?.join("、") || "未分类"}
            </Badge>
          </div>

          <h3 className="font-semibold text-gray-800 text-base leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {scenario.name}
          </h3>

          <p className="text-sm text-gray-500 mb-1">{scenario.careerPositionId || "-"}</p>
          <p className="text-xs text-gray-400 mb-3 truncate">{scenario.batchId || "-"}</p>

          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-gray-400">
              <User className="h-3.5 w-3.5" />
              <span className="text-sm">{scenario.creatorId || "-"}</span>
              {(scenario.coBuilderIds?.length ?? 0) > 0 && (
                <span className="text-xs">+{scenario.coBuilderIds?.length}</span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  编辑
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => e.stopPropagation()}
                  className="text-destructive"
                >
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Link>
  )
}
