"use client"

import { useRouter } from "next/navigation"
import {
  ContentListPage,
} from "@/components/shared/content-list-page"
import { programApi, batchApi, approvalApi, importExportApi } from "@/lib/api"
import type { TrainingProgram } from "@/lib/types"

function mapProgram(backend: any, _currentUserId: string) {
  const p = backend as TrainingProgram
  return {
    ...p,
    id: p.id,
    name: p.name,
    code: p.code,
    status: p.status,
    createdBy: p.createdBy,
    creatorId: p.createdBy || "",
    coCreatorIds: p.collaborators || [],
    batchId: p.batchId,
    batchName: p.batchName || "",
    courseCount: p.courseCount,
    totalCredits: p.totalCredits,
    majorName: p.majorName,
    entryYear: p.entryYear,
    duration: p.duration,
    level: p.level,
    description: p.description,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  } as any
}

function mapBatch(backend: any) {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function ProgramsPage() {
  const router = useRouter()

  return (
    <ContentListPage<TrainingProgram & { creatorId: string; coCreatorIds: string[] }>
      title="人才培养方案"
      subtitle="维护专业人才培养方案及课程设置，发布后可生成学期教学计划"
      entityLabel="人培方案"
      addHref="/affairs/programs"
      permissionModule="affairs"
      permissionResource="programs"
      itemApi={programApi as any}
      batchApi={batchApi as any}
      approvalApi={approvalApi as any}
      importExportApi={importExportApi}
      approvalTargetType="training_program"
      importExcelEntity=""
      importEntityName=""
      exportEntityName=""
      coBuilderField="collaborators"
      createRedirectUrl={(id) => `/affairs/programs/${id}?new=true`}
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapProgram(b, "")}
      mapBatch={mapBatch}
      createPayload={() => ({
        name: "新建人培方案",
        code: undefined,
        majorId: undefined,
        entryYear: new Date().getFullYear(),
        level: "本科",
        duration: 4,
        totalCredits: 0,
        status: "draft",
        description: "",
        createdBy: "",
        collaborators: [],
      })}
      renderList={(props) => {
        const { items, selectedIds, onSelectId, onSelectAll, onClone, onDelete, onSubmitApproval, onWithdrawApproval, onArchive, onInviteCoBuild, batchMap } = props as any
        return (
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-8 px-2 py-2"><input type="checkbox" onChange={(e) => onSelectAll(e.target.checked)} /></th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">方案名称</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">专业</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">年级</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">课程数</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">批次</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">状态</th>
                    <th className="sticky right-0 w-[200px] bg-white px-2 py-2 text-right text-xs font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={8} className="h-24 text-center text-sm text-muted-foreground">暂无人培方案</td></tr>
                  ) : (
                    items.map((item: any) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30 group">
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={selectedIds?.includes(item.id)} onChange={() => onSelectId?.(item.id)} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.code && <div className="text-xs text-muted-foreground">{item.code}</div>}
                        </td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">{item.majorName || "-"}</td>
                        <td className="px-2 py-2 text-sm">{item.entryYear}级</td>
                        <td className="px-2 py-2 text-sm">{item.courseCount}</td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">{item.batchName || "-"}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.status === "published" ? "bg-green-100 text-green-700" :
                            item.status === "approved" ? "bg-blue-100 text-blue-700" :
                            item.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                            item.status === "rejected" ? "bg-red-100 text-red-700" :
                            item.status === "archived" ? "bg-gray-100 text-gray-600" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {({draft: "草稿", pending: "审批中", approved: "已通过", rejected: "已驳回", published: "已发布", archived: "已归档"} as any)[item.status] || item.status}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white px-2 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => router.push(`/affairs/programs/${item.id}`)} className="h-7 px-2 text-xs rounded hover:bg-muted">编辑</button>
                            {item.status === "draft" && <button onClick={() => onSubmitApproval?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted text-blue-600">提交</button>}
                            {item.status === "pending" && <button onClick={() => onWithdrawApproval?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted text-amber-600">撤回</button>}
                            {item.status === "approved" && <button onClick={() => item.publish?.()} className="h-7 px-2 text-xs rounded hover:bg-muted text-green-600">发布</button>}
                            {item.status === "published" && <button onClick={() => item.unpublish?.()} className="h-7 px-2 text-xs rounded hover:bg-muted text-amber-600">取消发布</button>}
                            <button onClick={() => onArchive?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted text-gray-500">归档</button>
                            <button onClick={() => onClone?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted">克隆</button>
                            <button onClick={() => onInviteCoBuild?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted">共建</button>
                            <button onClick={() => onDelete?.(item)} className="h-7 px-2 text-xs rounded hover:bg-muted text-red-500">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }}
    />
  )
}
