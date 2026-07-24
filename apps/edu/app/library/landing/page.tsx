"use client"

import Link from "next/link"
import { BookOpen, Lightbulb, Award, FolderKanban, MessageSquare, ArrowRight } from "lucide-react"
import { Footer } from "@/components/portal/footer"

const categories = [
  {
    id: "knowledge",
    icon: BookOpen,
    title: "知识点库",
    desc: "系统化的知识体系，涵盖各专业领域的核心知识点与概念",
    href: "/library/knowledge",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    text: "text-blue-600",
  },
  {
    id: "ability",
    icon: Lightbulb,
    title: "能力点库",
    desc: "全面的能力模型，包括知识、技能、素质等多维度能力指标",
    href: "/library/ability",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
  {
    id: "certificates",
    icon: Award,
    title: "岗位证书库",
    desc: "收录各类职业技能证书，为学生职业发展提供参考与指引",
    href: "/library/certificates",
    color: "from-rose-500 to-pink-500",
    bg: "bg-rose-50",
    text: "text-rose-600",
  },
  {
    id: "resources",
    icon: FolderKanban,
    title: "场景任务资源库",
    desc: "丰富的教学资源，包括文档、图片、视频、场地等11种资源类型",
    href: "/library/resources",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
  },
  {
    id: "questions",
    icon: MessageSquare,
    title: "现场问答题库",
    desc: "场景任务测评方式题库，支持简答、论述、口答、实操等题型",
    href: "/library/questions",
    color: "from-violet-500 to-purple-500",
    bg: "bg-violet-50",
    text: "text-violet-600",
  },
]

export default function LibraryLandingPage() {
  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -2,
          background: `
            radial-gradient(circle at 5% 8%, rgba(124,58,237,0.12), transparent 28%),
            radial-gradient(circle at 95% 6%, rgba(59,130,246,0.1), transparent 30%),
            radial-gradient(circle at 88% 92%, rgba(16,185,129,0.1), transparent 32%),
            radial-gradient(circle at 10% 95%, rgba(245,158,11,0.08), transparent 30%),
            #eef1f8
          `,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -1,
          backgroundImage: `
            linear-gradient(rgba(79,70,229,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,70,229,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 75%)",
          maskImage: "linear-gradient(180deg, #000 0%, transparent 75%)",
        }}
      />

      <section className="relative pt-14 pb-8 text-center px-10">
        <div className="relative max-w-3xl mx-auto" style={{ zIndex: 2 }}>
          <h1 className="text-4xl font-extrabold text-[#141a2e] tracking-wide leading-tight mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-400 bg-clip-text text-transparent">
              教学资产共享中心
            </span>
          </h1>
          <p className="text-base text-[#5b677b] max-w-xl mx-auto leading-relaxed">
            沉淀校本智力资产，构建共建共享、持续进化的场景化数智教学资源生态
          </p>
        </div>
      </section>

      <main className="max-w-[1200px] mx-auto px-10 pb-16 relative" style={{ zIndex: 2 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <Link
                key={cat.id}
                href={cat.href}
                className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-[#e9edf4] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${cat.text}`} />
                </div>
                <h3 className="text-lg font-bold text-[#141a2e] mb-2">{cat.title}</h3>
                <p className="text-sm text-[#5b677b] leading-relaxed flex-1">{cat.desc}</p>
                <div className="flex items-center gap-1 mt-4 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                  <span>浏览资源</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <Footer />
    </div>
  )
}
