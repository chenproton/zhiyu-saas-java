'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Save,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@zhiyu/ui'
import { courseNodeApi, nodeEvaluationResultApi, userManagementApi } from '@/lib/api'
import type { NodeEvaluationResult } from '@zhiyu/api-client'
import { EVAL_METHOD_LABELS_GRADING } from '@/lib/types'
import { getHybridMethodLabel } from '@/lib/hybrid-eval'
import { useT } from '@/lib/i18n/locale-provider'

const methodLabel = (key: string, label: (k: string) => string) =>
  getHybridMethodLabel(key, label)

export default function LessonResultDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useT()
  const id = params.id as string

  const [result, setResult] = useState<NodeEvaluationResult | null>(null)
  const [nodeName, setNodeName] = useState('')
  const [courseId, setCourseId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [res, userRes] = await Promise.all([
          nodeEvaluationResultApi.get(id),
          userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
        ])
        setResult(res)
        if (res.totalScore != null) setScore(String(res.totalScore))
        if (res.comment) setComment(res.comment)
        const user = (userRes.items || []).find((u: any) => u.id === res.evaluateeId)
        if (user) setStudentName(user.name || t('未知'))
        try {
          const node = await courseNodeApi.get(res.nodeId)
          setNodeName(node.name || res.nodeId)
          setCourseId(node.courseId || '')
        } catch {
          setNodeName(res.nodeId)
        }
      } catch {
        toast({ variant: 'destructive', title: t('加载失败'), description: t('测评结果不存在') })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, t])

  const subjective = useMemo(() => {
    const sc = result?.subjectiveContent || {}
    return {
      text: typeof sc.text === 'string' ? sc.text : '',
      files: Array.isArray(sc.files) ? sc.files : [],
      attended: !!sc.attended,
    }
  }, [result])

  const isValidScore = () => {
    if (!result) return false
    const n = parseFloat(score)
    if (isNaN(n)) return false
    const max = result.maxScore || 100
    return n >= 0 && n <= max
  }

  const handleSave = async () => {
    if (!result || !isValidScore()) return
    setSaving(true)
    try {
      await nodeEvaluationResultApi.grade(result.id, {
        score: parseFloat(score),
        comment: comment.trim() || undefined,
      })
      toast({ title: t('评分成功') })
      router.push(`/evaluation/lesson-results${courseId ? `?courseId=${courseId}` : ''}`)
    } catch {
      toast({ variant: 'destructive', title: t('评分失败'), description: t('请稍后重试') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">{t('加载中...')}</div>
    )
  }

  if (!result) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-gray-400">
        <FileText className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">{t('测评结果不存在')}</p>
        <Link href="/evaluation/lesson-results" className="text-primary text-sm mt-2">
          {t('返回评分列表')}
        </Link>
      </div>
    )
  }

  const isPending = result.status === 'pending'
  const maxScore = result.maxScore || 100

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shrink-0 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link
                href={`/evaluation/lesson-results${courseId ? `?courseId=${courseId}` : ''}`}
                aria-label={t('返回')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{t('节点测评评分')}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {nodeName} · {methodLabel(result.methodKey, (k) => t(EVAL_METHOD_LABELS_GRADING[k] || k))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPending ? (
              <Badge className="bg-amber-50 text-amber-600 border-amber-200">{t('待评分')}</Badge>
            ) : (
              <Badge className="bg-green-50 text-green-600 border-green-200">{t('已评分')}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
        {/* 基本信息 */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-bold">
                  {(studentName || '?').charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{studentName || t('未知学生')}</p>
                  <p className="text-[11px] text-gray-400">{result.evaluateeId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <GraduationCap className="h-3.5 w-3.5" />
                {t('节点：{name}', { name: nodeName })}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText className="h-3.5 w-3.5" />
                {t('方式：{name}', {
                  name: methodLabel(result.methodKey, (k) => t(EVAL_METHOD_LABELS_GRADING[k] || k)),
                })}
              </div>
              {result.gradedAt && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  {t('评分时间：{time}', {
                    time: new Date(result.gradedAt).toLocaleString('zh-CN'),
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 得分概览 */}
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm font-semibold text-gray-800">{t('客观题自动得分')}</div>
              <div className="text-2xl font-bold text-primary">
                {result.totalScore != null ? result.totalScore : 0}
                <span className="text-sm font-normal text-gray-400"> / {maxScore}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {isPending
                ? t('该结果包含主观题（填空/简答等）或人工提交内容，需教师评分后计入成绩')
                : t('该结果已完成评分')}
            </p>
          </CardContent>
        </Card>

        {/* 提交内容 */}
        <Card className="border-gray-200">
          <CardContent className="p-5 space-y-4">
            <div className="text-sm font-semibold text-gray-800">{t('提交内容')}</div>
            {subjective.text ? (
              <div>
                <Label className="text-xs text-gray-500">{t('作答内容')}</Label>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1 whitespace-pre-wrap">
                  {subjective.text}
                </p>
              </div>
            ) : subjective.attended ? (
              <div>
                <Label className="text-xs text-gray-500">{t('到场情况')}</Label>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1">
                  {t('学生已标记到场参与（现场问答/现场评审）')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">{t('无文本提交内容')}</p>
            )}
            {subjective.files.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500">
                  {t('附件（{n}）', { n: subjective.files.length })}
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {subjective.files.map((f: any, i: number) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {f.name || t('附件 {n}', { n: i + 1 })}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {result.objectiveAnswers && Object.keys(result.objectiveAnswers).length > 0 && (
              <div>
                <Label className="text-xs text-gray-500">{t('考试作答（含主观题）')}</Label>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-1 overflow-x-auto max-h-72">
                  {JSON.stringify(result.objectiveAnswers, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 评分表单 / 已评分结果 */}
        {isPending ? (
          <Card className="border-gray-200">
            <CardContent className="p-5 space-y-4">
              <div className="text-sm font-semibold text-gray-800">{t('评分')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">
                    {t('得分（0 ~ {n}）', { n: maxScore })}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxScore}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder={t('0-{max}', { max: maxScore })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">{t('评语')}</Label>
                  <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('评语')}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                  {t('取消')}
                </Button>
                <Button size="sm" disabled={saving || !isValidScore()} onClick={handleSave}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? t('保存中...') : t('保存评分')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-gray-800">{t('评分结果')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <span className="text-gray-500">
                  {t('得分：')}
                  <strong className="text-primary">
                    {result.totalScore} / {maxScore}
                  </strong>
                </span>
                {result.comment && (
                  <span className="text-gray-500">{t('评语：{comment}', { comment: result.comment })}</span>
                )}
                {result.gradedAt && (
                  <span className="text-gray-400 text-xs">
                    {t('评分时间：{time}', {
                      time: new Date(result.gradedAt).toLocaleString('zh-CN'),
                    })}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
