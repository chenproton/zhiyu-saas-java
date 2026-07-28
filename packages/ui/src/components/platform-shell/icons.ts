import type { LucideIcon } from "lucide-react"
import {
  Archive,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  FileText,
  FolderKanban,
  GitBranch,
  GraduationCap,
  Home,
  LayoutGrid,
  Layers,
  Layers3,
  LineChart,
  Route,
  Settings,
  Share2,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react"

export const platformIconMap = {
  archive: Archive,
  award: Award,
  badgeCheck: BadgeCheck,
  barChart: BarChart3,
  barChart3: BarChart3,
  bookOpen: BookOpen,
  briefcase: Briefcase,
  calendar: Calendar,
  checkCircle: CheckCircle,
  fileText: FileText,
  folderKanban: FolderKanban,
  gitBranch: GitBranch,
  graduationCap: GraduationCap,
  home: Home,
  layoutGrid: LayoutGrid,
  layers: Layers,
  layers3: Layers3,
  lineChart: LineChart,
  route: Route,
  settings: Settings,
  share2: Share2,
  sparkles: Sparkles,
  star: Star,
  user: User,
  users: Users,
} satisfies Record<string, LucideIcon>

export type PlatformIconKey = keyof typeof platformIconMap

export type PlatformIcon = LucideIcon | PlatformIconKey

export function resolvePlatformIcon(icon: PlatformIcon): LucideIcon {
  if (typeof icon === "string") {
    return platformIconMap[icon] || Settings
  }
  return icon
}
