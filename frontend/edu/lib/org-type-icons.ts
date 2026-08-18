import { School, Building2, BookOpen, Users, Briefcase, Building } from 'lucide-react'

export function typeMetaFor(typeName?: string): {
  icon: React.ElementType
  color: string
  badge?: string
} {
  const map: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
    学校: {
      icon: School,
      color: 'text-blue-600',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    二级学院: {
      icon: Building2,
      color: 'text-violet-600',
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
    },
    专业: {
      icon: BookOpen,
      color: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    班级: {
      icon: Users,
      color: 'text-cyan-600',
      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
    行政职能部门: {
      icon: Briefcase,
      color: 'text-rose-600',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  }
  return (
    (typeName && map[typeName]) || {
      icon: Building,
      color: 'text-slate-600',
      badge: 'bg-slate-50 text-slate-700 border-slate-200',
    }
  )
}
