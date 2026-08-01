'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, Download, CheckCircle2, Circle } from 'lucide-react'
import { toast } from '@zhiyu/ui'
import type { TaskResource } from '../_types/registrar-adapted'

const resourceTypeLabel: Record<string, string> = {
  textbook: '教材',
  ppt: '课件',
  video: '视频',
  link: '链接',
  document: '文档',
  scene_link: '场景链接',
}

export function PreClassTab() {
  const [prepStage, setPrepStage] = useState<'pre' | 'in' | 'post'>('pre')
  const [task] = useState({
    objectives: [] as string[],
    syllabus: '',
    prepContent: {
      pre: { objectives: '', guidePlan: '', previewQuestions: [] },
      in: { coursewareResources: [] as TaskResource[], quizQuestions: [], discussionTopics: [] },
      post: { homework: '', quizQuestions: [], extensionResources: [] },
    },
    resources: [] as TaskResource[],
  })

  const resources = task.resources || []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => toast({ title: '备课功能开发中' })}>
          前往备课
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">备课内容</CardTitle>
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-0.5">
              <button
                onClick={() => setPrepStage('pre')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  prepStage === 'pre'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                课前环节
              </button>
              <button
                onClick={() => setPrepStage('in')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  prepStage === 'in'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                课中环节
              </button>
              <button
                onClick={() => setPrepStage('post')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  prepStage === 'post'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                课后环节
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prepStage === 'pre' && (
            <>
              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
                  <h3 className="text-sm font-semibold">教学目标</h3>
                </div>
                {task.prepContent?.pre?.objectives ? (
                  <div className="text-sm whitespace-pre-wrap">
                    {task.prepContent.pre.objectives}
                  </div>
                ) : task.objectives && task.objectives.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.objectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无教学目标</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
                  <h3 className="text-sm font-semibold">导学教案</h3>
                </div>
                {task.prepContent?.pre?.guidePlan ? (
                  <div className="text-sm whitespace-pre-wrap">
                    {task.prepContent.pre.guidePlan}
                  </div>
                ) : task.syllabus ? (
                  <div className="text-sm whitespace-pre-wrap">{task.syllabus}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无导学教案</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
                  <h3 className="text-sm font-semibold">课前预习</h3>
                </div>
                {task.prepContent?.pre?.previewQuestions &&
                task.prepContent.pre.previewQuestions.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.prepContent.pre.previewQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无预习题目</div>
                )}
              </div>
            </>
          )}

          {prepStage === 'in' && (
            <>
              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
                  <h3 className="text-sm font-semibold">课件资源</h3>
                </div>
                {task.prepContent?.in?.coursewareResources &&
                task.prepContent.in.coursewareResources.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {task.prepContent.in.coursewareResources.map((r: TaskResource) => (
                      <Badge key={r.id} variant="secondary" className="text-xs">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                ) : task.resources && task.resources.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {task.resources.map((r: TaskResource) => (
                      <Badge key={r.id} variant="secondary" className="text-xs">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无课件资源</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
                  <h3 className="text-sm font-semibold">随堂测验</h3>
                </div>
                {task.prepContent?.in?.quizQuestions &&
                task.prepContent.in.quizQuestions.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.prepContent.in.quizQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无随堂测试题目</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
                  <h3 className="text-sm font-semibold">互动讨论</h3>
                </div>
                {task.prepContent?.in?.discussionTopics &&
                task.prepContent.in.discussionTopics.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.prepContent.in.discussionTopics.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无讨论话题</div>
                )}
              </div>
            </>
          )}

          {prepStage === 'post' && (
            <>
              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
                  <h3 className="text-sm font-semibold">课后作业</h3>
                </div>
                {task.prepContent?.post?.homework ? (
                  <div className="text-sm whitespace-pre-wrap">
                    {task.prepContent.post.homework}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无课后作业</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
                  <h3 className="text-sm font-semibold">课后测验</h3>
                </div>
                {task.prepContent?.post?.quizQuestions &&
                task.prepContent.post.quizQuestions.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.prepContent.post.quizQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无课后测验题目</div>
                )}
              </div>

              <div className="rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  <div className="w-1 h-4 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
                  <h3 className="text-sm font-semibold">课后拓展</h3>
                </div>
                {task.prepContent?.post?.extensionResources &&
                task.prepContent.post.extensionResources.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {task.prepContent.post.extensionResources.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无课后拓展资料</div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">备课资源</CardTitle>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无备课资源</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>资源名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>上传者</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead>学生可见</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm">{resourceTypeLabel[r.type] || r.type}</TableCell>
                    <TableCell className="text-sm">{r.uploadBy}</TableCell>
                    <TableCell className="text-sm">{r.uploadedAt}</TableCell>
                    <TableCell>
                      {r.isVisibleToStudents ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!r.url}
                          onClick={() => r.url && window.open(r.url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {r.url ? '查看' : '无链接'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
