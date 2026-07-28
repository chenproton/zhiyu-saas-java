import { School, Building2, BookOpen, Users, Briefcase, Building } from "lucide-react"

export function typeMetaFor(typeName?: string): { icon: React.ElementType; color: string } {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    "学校": { icon: School, color: "text-blue-600" },
    "二级学院": { icon: Building2, color: "text-violet-600" },
    "专业": { icon: BookOpen, color: "text-emerald-600" },
    "班级": { icon: Users, color: "text-cyan-600" },
    "行政职能部门": { icon: Briefcase, color: "text-rose-600" },
  }
  return (typeName && map[typeName]) || { icon: Building, color: "text-slate-600" }
}
