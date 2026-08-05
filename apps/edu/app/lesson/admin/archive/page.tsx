'use client'

import { useMemo, useState } from 'react'

import { courseApi, lessonBatchApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import type { Course } from '@/lib/types/lesson'

import { useToast, StatusBadge, useAsync } from '@zhiyu/ui'
import { ArchiveListPage, type ArchiveColumn } from '@/components/shared/archive-list-page'

export default function LessonArchivePage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null)

  const { data, loading, refresh } = useAsync(async () => {
    const [courseRes, batchRes] = await Promise.all([
      courseApi.list({ status: 'archived', limit: 1000 }),
      lessonBatchApi.list({ limit: 1000 }),
    ])
    return { courses: courseRes.items, batches: batchRes.items }
  })

  const { courses, batches } = data ?? {}

  const majors = useMemo(() => {
    const set = new Set<string>()
    ;(courses ?? []).forEach((c) => {
      if (c.majorName) set.add(c.majorName)
    })
    return Array.from(set).sort()
  }, [courses])

  const filtered = useMemo(() => {
    let result = courses ?? []
    if (selectedMajor) {
      result = result.filter((c) => c.majorName === selectedMajor)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.majorName || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q),
      )
    }
    return result
  }, [courses, selectedMajor, search])

  const batchMap = useMemo(() => new Map((batches ?? []).map((b) => [b.id, b])), [batches])

  const handleRestore = async (course: Course) => {
    try {
      await courseApi.saveDraft(course.id)
      await refresh()
      toast({ title: '已恢复' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '恢复失败',
        description: err.message || '请稍后重试',
      })
    }
  }

  const editHref = (type: Course['type'], id: string) => {
    if (type === 'system') return `/lesson/admin/system/add?id=${id}`
    if (type === 'granular') return `/lesson/admin/granular/add?id=${id}`
    return `/lesson/admin/hybrid/add?id=${id}`
  }

  const columns: ArchiveColumn<Course>[] = [
    {
      header: '课程名称',
      cell: (course) => (
        <div>
          <span className="font-medium">{course.name}</span>
          <p className="text-xs text-muted-foreground">
            {course.category || '-'} · {course.majorName || '-'}
          </p>
        </div>
      ),
    },
    {
      header: '课程编码',
      cell: (course) => <span className="text-sm text-muted-foreground">{course.code}</span>,
    },
    {
      header: '课程类型',
      cell: (course) => (
        <span className="text-sm">
          {course.type === 'system' ? '体系课' : course.type === 'granular' ? '颗粒课' : '混合课'}
        </span>
      ),
    },
    {
      header: '版本',
      cell: (course) => <span className="text-sm">{course.version || '-'}</span>,
    },
    {
      header: '适用专业',
      cell: (course) => <span className="text-sm">{course.majorName || '-'}</span>,
    },
    {
      header: '所属批次分组',
      cell: (course) => (
        <span className="text-sm">
          {course.batchId ? batchMap.get(course.batchId)?.name || course.batchId : '-'}
        </span>
      ),
    },
    {
      header: '归档时间',
      cell: (course) => (
        <span className="text-sm text-muted-foreground">{formatDate(course.updatedAt)}</span>
      ),
    },
  ]

  const renderStatus = (course: Course) => <StatusBadge status={course.status} />

  return (
    <ArchiveListPage
      entityLabel="课程"
      pageTitle="课程历史档案库"
      pageDescription="查看已归档的课程记录，支持恢复为草稿继续编辑"
      sidebarTitle="按专业归档"
      sidebarItems={majors.map((m) => ({ id: m, name: m }))}
      sidebarSelectedId={selectedMajor}
      onSidebarSelect={setSelectedMajor}
      items={filtered}
      loading={loading}
      onRestore={handleRestore}
      detailHref={(item) => editHref(item.type, item.id)}
      searchPlaceholder="搜索课程名称 / 编码 / 专业 / 分类"
      searchValue={search}
      onSearchChange={setSearch}
      columns={columns}
      renderStatus={renderStatus}
    />
  )
}
