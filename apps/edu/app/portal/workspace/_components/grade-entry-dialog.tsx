'use client'

import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface StudentGradeEntry {
  id: string
  name: string
  studentNo: string
  score: string
}

interface GradeEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  className?: string
}

function getMockStudents(className?: string): StudentGradeEntry[] {
  const lastNames = [
    '张',
    '李',
    '王',
    '赵',
    '陈',
    '刘',
    '周',
    '吴',
    '孙',
    '郑',
    '林',
    '杨',
    '黄',
    '朱',
    '马',
    '胡',
    '郭',
    '何',
    '罗',
    '高',
  ]
  const firstNames = [
    '伟',
    '芳',
    '明',
    '静',
    '涛',
    '敏',
    '洋',
    '杰',
    '丽',
    '强',
    '军',
    '磊',
    '婷',
    '文',
    '波',
    '娜',
    '辉',
    '雪',
    '勇',
    '云',
  ]
  const students: StudentGradeEntry[] = []
  for (let i = 0; i < 20; i++) {
    const lastIdx = i % lastNames.length
    const firstIdx = (i + 3) % firstNames.length
    const num = String(i + 1).padStart(2, '0')
    students.push({
      id: `mock-s-${i}`,
      name: `${lastNames[lastIdx]}${firstNames[firstIdx]}`,
      studentNo: className ? `20240101${num}` : `20240102${num}`,
      score: i < 6 ? String(Math.floor(70 + Math.random() * 25)) : '-',
    })
  }
  return students
}

export function GradeEntryDialog({
  open,
  onOpenChange,
  sessionTitle,
  className,
}: GradeEntryDialogProps) {
  const [students, setStudents] = useState<StudentGradeEntry[]>([])
  const [saved, setSaved] = useState(false)

  const initData = () => {
    setStudents(getMockStudents(className))
    setSaved(false)
  }

  const updateScore = (id: string, value: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, score: value } : s)))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => onOpenChange(false), 800)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (v) initData()
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-amber-600" />
            录入成绩
          </DialogTitle>
          <DialogDescription>
            {sessionTitle} · {className || '全部学生'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-12">序号</TableHead>
                <TableHead className="text-xs">姓名</TableHead>
                <TableHead className="text-xs">学号</TableHead>
                <TableHead className="text-xs w-28">成绩 (0-100)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs text-gray-500">{s.studentNo}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.score}
                      onChange={(e) => updateScore(s.id, e.target.value)}
                      className="h-8 text-xs w-24"
                      placeholder="输入成绩"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">保存成功</Badge>
          ) : (
            <span className="text-xs text-gray-400">
              {students.filter((s) => s.score !== '-').length} / {students.length} 已录入
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleSave}>
              保存成绩
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
