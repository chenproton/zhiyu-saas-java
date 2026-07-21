"use client"

import { useState } from "react"
import { ChevronDown, Play, LaptopIcon, ShoppingCart, Smartphone, LineChart, GitBranch, UserCog } from "lucide-react"

interface Scene {
  name: string
  icon: React.ReactNode
  color: string
  meta: string
  tasks: { name: string; tags: string[]; hours: string }[]
}

const DEFAULT_SCENES: Scene[] = [
  {
    name: "基础学习",
    icon: <LaptopIcon className="w-5 h-5" />,
    color: "bg-blue-500",
    meta: "4个任务 · 8课时 · 关联6个能力点",
    tasks: [
      { name: "首页Banner轮播图开发", tags: ["HTML5", "CSS3动画", "JavaScript"], hours: "2课时" },
      { name: "导航菜单与响应式布局", tags: ["Flex布局", "媒体查询"], hours: "2课时" },
      { name: "产品展示区块开发", tags: ["Grid布局", "CSS3过渡"], hours: "2课时" },
      { name: "页脚与返回顶部功能", tags: ["滚动事件", "平滑滚动"], hours: "2课时" },
    ],
  },
  {
    name: "电商后台管理系统",
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "bg-green-500",
    meta: "6个任务 · 12课时 · 关联10个能力点",
    tasks: [
      { name: "Vue3项目初始化与配置", tags: ["Vite", "Vue3"], hours: "2课时" },
      { name: "登录注册模块与鉴权", tags: ["Token", "路由守卫"], hours: "2课时" },
      { name: "商品管理CRUD实现", tags: ["Element Plus", "API对接"], hours: "3课时" },
    ],
  },
  {
    name: "移动端H5活动页开发",
    icon: <Smartphone className="w-5 h-5" />,
    color: "bg-amber-500",
    meta: "4个任务 · 6课时 · 关联5个能力点",
    tasks: [
      { name: "移动端适配方案实现", tags: ["rem/vw", "viewport"], hours: "1课时" },
      { name: "活动页面布局开发", tags: ["全屏滚动", "触摸事件"], hours: "2课时" },
    ],
  },
  {
    name: "数据可视化大屏开发",
    icon: <LineChart className="w-5 h-5" />,
    color: "bg-violet-600",
    meta: "4个任务 · 8课时 · 关联6个能力点",
    tasks: [
      { name: "大屏布局与自适应", tags: ["Scale适配", "Grid布局"], hours: "2课时" },
      { name: "ECharts图表配置", tags: ["ECharts", "图表配置"], hours: "3课时" },
    ],
  },
  {
    name: "前端工程化实践",
    icon: <GitBranch className="w-5 h-5" />,
    color: "bg-teal-500",
    meta: "3个任务 · 6课时 · 关联4个能力点",
    tasks: [
      { name: "Git工作流实践", tags: ["Git Flow", "分支管理"], hours: "2课时" },
      { name: "自动化部署配置", tags: ["CI/CD", "GitHub Actions"], hours: "2课时" },
    ],
  },
  {
    name: "团队协作开发实战",
    icon: <UserCog className="w-5 h-5" />,
    color: "bg-pink-500",
    meta: "3个任务 · 8课时 · 关联5个能力点",
    tasks: [
      { name: "需求分析与任务拆分", tags: ["敏捷开发", "需求分析"], hours: "2课时" },
      { name: "代码评审与重构", tags: ["Code Review", "重构技巧"], hours: "3课时" },
    ],
  },
]

export function SceneList() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true })

  const toggle = (idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[#64748b]">
          共关联 <strong className="text-blue-600">{DEFAULT_SCENES.length}</strong> 个实践场景
        </span>
        <div className="flex gap-2">
          <button
            className="btn px-3 py-1.5 text-xs border border-[#e7e5e4] rounded-md bg-white text-[#475569] hover:bg-[#f8fafc]"
            onClick={() => setExpanded(DEFAULT_SCENES.reduce((acc, _, i) => ({ ...acc, [i]: true }), {}))}
          >
            全部展开
          </button>
          <button
            className="btn px-3 py-1.5 text-xs border border-[#e7e5e4] rounded-md bg-white text-[#475569] hover:bg-[#f8fafc]"
            onClick={() => setExpanded({})}
          >
            全部收起
          </button>
        </div>
      </div>

      {DEFAULT_SCENES.map((scene, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-[#e7e5e4] overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#f8fafc]"
            onClick={() => toggle(idx)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${scene.color} flex items-center justify-center text-white`}>
                {scene.icon}
              </div>
              <div>
                <div className="text-[15px] font-bold text-[#0f172a]">{scene.name}</div>
                <div className="text-xs text-[#94a3b8]">{scene.meta}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-xs px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1">
                <Play className="w-3 h-3" /> 去学习
              </button>
              <ChevronDown className={`w-5 h-5 text-[#94a3b8] transition-transform ${expanded[idx] ? "rotate-180" : ""}`} />
            </div>
          </div>
          {expanded[idx] && (
            <div className="px-4 pb-4">
              {scene.tasks.map((task, ti) => (
                <div key={ti} className="flex items-center justify-between py-3 border-t border-[#f1f5f9]">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-blue-600 flex items-center justify-center text-xs font-bold">
                      {ti + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#0f172a]">{task.name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {task.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#94a3b8]">{task.hours}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
