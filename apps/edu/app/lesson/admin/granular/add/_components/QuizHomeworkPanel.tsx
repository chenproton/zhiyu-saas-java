'use client'

import { useState } from 'react'
import { Plus, X, FileText, BookOpen, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface QuizItem {
  id: string
  question: string
  type: 'single' | 'essay'
  score: number
}

interface HomeworkItem {
  id: string
  title: string
  desc: string
  score: number
}

export default function QuizHomeworkPanel() {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([
    { id: 'q1', question: '下列哪种方法可以有效防御SQL注入攻击？', type: 'single', score: 10 },
    { id: 'q2', question: '请简述SQL注入的基本原理及三种常见防御措施。', type: 'essay', score: 20 },
  ])
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([
    {
      id: 'h1',
      title: '课后实验报告',
      desc: '使用SQLMap工具对靶机进行SQL注入测试，并撰写实验报告。',
      score: 30,
    },
  ])
  const [activeTab, setActiveTab] = useState<'quiz' | 'homework'>('quiz')

  const addQuiz = () => {
    setQuizzes((prev) => [
      ...prev,
      { id: `q${Date.now()}`, question: '新建题目（点击编辑）', type: 'single', score: 10 },
    ])
  }

  const removeQuiz = (id: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== id))
  }

  const addHomework = () => {
    setHomeworks((prev) => [
      ...prev,
      { id: `h${Date.now()}`, title: '新建作业', desc: '请填写作业描述...', score: 20 },
    ])
  }

  const removeHomework = (id: string) => {
    setHomeworks((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'quiz'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          随堂测验 ({quizzes.length})
        </button>
        <button
          onClick={() => setActiveTab('homework')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'homework'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          课后作业 ({homeworks.length})
        </button>
      </div>

      {activeTab === 'quiz' && (
        <div className="space-y-2">
          {quizzes.map((q, idx) => (
            <div
              key={q.id}
              className="flex items-start gap-2 p-3 rounded-md border border-gray-100 bg-white"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{q.question}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {q.type === 'single' ? '单选题' : '简答题'}
                  </Badge>
                  <span className="text-[10px] text-gray-400">{q.score}分</span>
                </div>
              </div>
              <button onClick={() => removeQuiz(q.id)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed text-gray-400 hover:text-blue-500 hover:border-blue-300"
            onClick={addQuiz}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加题目
          </Button>
        </div>
      )}

      {activeTab === 'homework' && (
        <div className="space-y-2">
          {homeworks.map((h) => (
            <div key={h.id} className="p-3 rounded-md border border-gray-100 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-gray-700">{h.title}</span>
                </div>
                <button
                  onClick={() => removeHomework(h.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">{h.desc}</p>
              <div className="flex items-center gap-2 mt-2 ml-6">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {h.score}分
                </Badge>
                <Badge variant="outline" className="text-[10px] font-normal">
                  需提交
                </Badge>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed text-gray-400 hover:text-orange-500 hover:border-orange-300"
            onClick={addHomework}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加作业
          </Button>
        </div>
      )}
    </div>
  )
}
