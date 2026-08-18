// 周次/周导航公共工具：teacher-dashboard-tab 与 workspace-schedule-grid 共用。
// 约定：一周从周一开始；"某月第 N 周"以"包含当月 1 号的那一周"为第 1 周（其周一可能落在上月）。

/** 取 date 所在周的周一（一周从周一开始） */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/** 取 weekStart 所在周的周日（周一 + 6 天） */
export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return end
}

/** 某年某月（month 为 1-12）包含的周数，第 1 周为包含当月 1 号的那一周 */
export function getWeeksInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startDay = firstDay.getDay() || 7
  const totalDays = lastDay.getDate()
  return Math.ceil((totalDays + startDay - 1) / 7)
}

/**
 * weekStart（该周周一）在 year 年 month 月（1-12）中的周次（1-based）。
 * 基于与"第 1 周周一"的绝对日期差计算，避免当月 1 号非周一时
 * weekStart 落在上月导致 getDate() 取到上月末而算错周次（如 4 月第 1 周被算成第 5 周）。
 */
export function getWeekIndex(weekStart: Date, year: number, month: number): number {
  const firstWeekStart = getWeekStart(new Date(year, month - 1, 1))
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((weekStart.getTime() - firstWeekStart.getTime()) / msPerWeek) + 1
}

/** 由周次换算回该周周一（与 getWeekIndex 互逆），用于周下拉切换 */
export function getWeekTargetDate(year: number, month: number, targetWeek: number): Date {
  const firstDay = new Date(year, month - 1, 1)
  const startDay = firstDay.getDay() || 7
  return new Date(year, month - 1, 1 + (targetWeek - 1) * 7 - (startDay - 1))
}
