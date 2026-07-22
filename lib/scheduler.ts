// scheduler.ts - 多调度引擎核心
import { AlarmItem, RepeatRule } from "./constants"
import { HolidayAction } from "./constants"
import { isHoliday, isWorkday, formatDate } from "./holiday"
import { lunarToSolar } from "./lunar"
import { getNextSolarTerm } from "./solar-term"


// ==================== 结束条件判断 ====================

/** 判断候选触发时间是否超过 endDate */
function isPastEndDate(repeat: RepeatRule, candidate: Date): boolean {
  if (!repeat.endDate) return false
  // endDate 当天仍触发：只比较日期部分，candidate 日期 > endDate 日期
  const endDate = new Date(repeat.endDate)
  endDate.setHours(23, 59, 59, 999) // endDate 当天 23:59:59.999
  return candidate.getTime() > endDate.getTime()
}

/** 计算从 anchorDate 到 now 已过的周期数（用于 endAfterOccurrences 判断） */
function getElapsedOccurrences(repeat: RepeatRule, now: Date): number {
  const endN = repeat.endAfterOccurrences
  if (!endN || endN <= 0) return 0

  // anchorDate 是必需的基准点，缺失时用 30 天前作为兜底
  const anchorStr = repeat.anchorDate
  if (!anchorStr) return 0
  const anchor = new Date(anchorStr)
  if (now <= anchor) return 0

  const interval = repeat.interval || 1

  switch (repeat.mode) {
    case "daily": {
      const daysDiff = Math.floor((now.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000))
      return Math.floor(daysDiff / interval)
    }
    case "weekly": {
      const weeksDiff = Math.floor((now.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000))
      return Math.floor(weeksDiff / interval)
    }
    case "monthly": {
      const monthsDiff = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth())
      return Math.floor(monthsDiff / interval)
    }
    case "yearly":
    case "lunar_yearly": {
      return now.getFullYear() - anchor.getFullYear()
    }
    case "workday": {
      // 工作日模式：从 anchor 逐日数到 now 的实际工作日数
      let count = 0
      const d = new Date(anchor)
      while (d < now) {
        const dayOfWeek = d.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isHol = isHoliday(d)
        const isWork = isWorkday(d)
        if (isWork || (!isWeekend && !isHol)) {
          count++
        }
        d.setDate(d.getDate() + 1)
      }
      return Math.floor(count / interval)
    }
    default:
      return 0
  }
}

/** 判断是否已达到 endAfterOccurrences 限制 */
function hasReachedOccurrenceLimit(repeat: RepeatRule, now: Date): boolean {
  const endN = repeat.endAfterOccurrences
  if (!endN || endN <= 0) return false
  return getElapsedOccurrences(repeat, now) >= endN
}

// ==================== 辅助：defer 顺延 ====================
// 候选日是节假日时，逐日 +1 直到非节假日（补班日算非节假日，停）
function deferPastHoliday(candidate: Date): Date {
  let d = new Date(candidate)
  // 最多顺延 30 天，防止死循环
  for (let i = 0; i < 30; i++) {
    if (!isHoliday(d)) return d
    d.setDate(d.getDate() + 1)
  }
  return d
}

// ==================== 主入口：获取下一个触发时间 ====================
export function getNextTrigger(alarm: AlarmItem, now: Date): Date | null {
  if (!alarm.enabled) return null

  // 结束条件判断：endAfterOccurrences
  if (hasReachedOccurrenceLimit(alarm.repeat, now)) return null

  const result = (() => {
    switch (alarm.repeat.mode) {
      case "once": return getNextOnce(alarm, now)
      case "daily": return getNextDaily(alarm, now)
      case "weekly": return getNextWeekly(alarm, now)
      case "monthly": return getNextMonthly(alarm, now)
      case "yearly": return getNextYearly(alarm, now)
      case "lunar_yearly": return getNextLunar(alarm, now)
      case "workday": return getNextWorkday(alarm, now)
      default: return null
    }
  })()

  // 结束条件判断：endDate（候选日 > endDate 时返回 null）
  if (result && isPastEndDate(alarm.repeat, result)) return null

  return result
}

// ==================== once: 一次性 ====================
function getNextOnce(alarm: AlarmItem, now: Date): Date | null {
  // once 模式没有 anchorDate 时用 createdAt
  const anchor = alarm.repeat.anchorDate ?? new Date(alarm.createdAt).toISOString().slice(0, 10)
  const date = new Date(anchor)
  date.setHours(alarm.hour, alarm.minute, 0, 0)
  if (date > now) return date
  return null
}

// ==================== daily: 每N天 ====================
function getNextDaily(alarm: AlarmItem, now: Date): Date | null {
  const interval = alarm.repeat.interval || 1
  const action: HolidayAction = alarm.repeat.holidayAction ?? "none"

  for (let offset = 0; offset < interval * 2 + 30; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(alarm.hour, alarm.minute, 0, 0)

    if (offset === 0 && candidate <= now) continue

    // 检查间隔
    if (interval > 1 && alarm.repeat.anchorDate) {
      const anchor = new Date(alarm.repeat.anchorDate)
      const daysDiff = Math.floor((candidate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000))
      if (daysDiff % interval !== 0) continue
    }

    // 调休动作
    if (action === "skip") {
      if (isHoliday(candidate)) continue
      // 补班日强制响
      if (isWorkday(candidate)) return candidate
    } else if (action === "defer") {
      // defer: 节假日当天顺延到下一个非节假日
      if (isHoliday(candidate)) {
        const deferred = deferPastHoliday(candidate)
        deferred.setHours(alarm.hour, alarm.minute, 0, 0)
        return deferred
      }
    }

    return candidate
  }
  return null
}

// ==================== weekly: 每N周 ====================
function getNextWeekly(alarm: AlarmItem, now: Date): Date | null {
  const weekdays = alarm.repeat.weekdays ?? []
  const interval = alarm.repeat.interval || 1
  const action: HolidayAction = alarm.repeat.holidayAction ?? "none"

  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(alarm.hour, alarm.minute, 0, 0)

    if (offset === 0 && candidate <= now) continue

    const dayOfWeek = candidate.getDay() + 1 // Apple: 1=日 2=一 ... 7=六
    if (!weekdays.includes(dayOfWeek)) continue

    // 调休动作：weekly 的 skip 和 defer 都=节假日跳过不补（不顺延到非已选星期）
    if (action === "skip" || action === "defer") {
      if (isHoliday(candidate)) continue
    }

    // interval > 1: 检查周间隔（对所有日期统一执行，包括补班日）
    if (interval > 1 && alarm.repeat.anchorDate) {
      const anchor = new Date(alarm.repeat.anchorDate)
      const weekDiff = Math.floor((candidate.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000))
      if (weekDiff % interval !== 0) continue
    }

    // 补班日强制响（在 interval 检查通过后）
    if (action !== "none" && isWorkday(candidate)) return candidate

    return candidate
  }
  return null
}

// ==================== 辅助：计算某月第N周的星期X ====================
function getWeekdayOfMonth(year: number, month: number, weekOfMonth: number, weekday: number): Date | null {
  // weekday: Apple numbering 1=Sun 2=Mon ... 7=Sat → JS getDay(): 0=Sun 1=Mon ... 6=Sat
  const jsWeekday = weekday % 7

  if (weekOfMonth > 0) {
    // 正数：第1周=该月第一个星期X
    const firstDay = new Date(year, month - 1, 1)
    const firstDayOfWeek = firstDay.getDay()
    const diff = (jsWeekday - firstDayOfWeek + 7) % 7
    const day = 1 + diff + (weekOfMonth - 1) * 7
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day > daysInMonth) return null
    return new Date(year, month - 1, day)
  } else {
    // 负数：-1=倒数第一个（最后一个），-2=倒数第二个
    const lastDay = new Date(year, month, 0) // 下月第0天=本月最后一天
    const lastDayOfWeek = lastDay.getDay()
    const diff = (lastDayOfWeek - jsWeekday + 7) % 7
    const day = lastDay.getDate() - diff + (weekOfMonth + 1) * 7
    if (day < 1) return null
    return new Date(year, month - 1, day)
  }
}

// ==================== 辅助：计算每年第N个工作日 ====================
function getNthWorkdayOfYear(year: number, nthWorkday: number): Date | null {
  let count = 0
  const date = new Date(year, 0, 1) // 1月1日
  while (date.getFullYear() === year) {
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (!isWeekend || isWorkday(date)) {
      if (isWeekend && !isWorkday(date)) {
        // 周末且不是补班日 → 跳过
        date.setDate(date.getDate() + 1)
        continue
      }
      count++
      if (count === nthWorkday) return new Date(date)
    }
    date.setDate(date.getDate() + 1)
  }
  return null
}

// ==================== monthly: 每N月 ====================
function getNextMonthly(alarm: AlarmItem, now: Date): Date | null {
  const interval = alarm.repeat.interval || 1
  const subMode = alarm.repeat.monthlySubMode ?? "day"
  const action: HolidayAction = alarm.repeat.holidayAction ?? "none"

  let year = now.getFullYear()
  let month = now.getMonth() + 1

  for (let i = 0; i < 24; i++) {
    let candidate: Date | null = null

    if (subMode === "weekday" && alarm.repeat.weekOfMonth && alarm.repeat.weekdayOfMonth) {
      // 每月第N周的星期X
      candidate = getWeekdayOfMonth(year, month, alarm.repeat.weekOfMonth, alarm.repeat.weekdayOfMonth)
    } else {
      // 每月第N号（默认）
      const dayOfMonth = alarm.repeat.dayOfMonth ?? 1
      const daysInMonth = new Date(year, month, 0).getDate()
      const actualDay = Math.min(dayOfMonth, daysInMonth)
      candidate = new Date(year, month - 1, actualDay)
    }

    if (candidate && candidate > now) {
      // 检查间隔
      if (interval > 1 && alarm.repeat.anchorDate) {
        const anchor = new Date(alarm.repeat.anchorDate)
        const monthDiff = (year - anchor.getFullYear()) * 12 + (month - (anchor.getMonth() + 1))
        if (monthDiff % interval !== 0) {
          month++
          if (month > 12) { month = 1; year++ }
          continue
        }
      }
      candidate.setHours(alarm.hour, alarm.minute, 0, 0)

      // 调休动作
      if (action === "skip") {
        if (isHoliday(candidate)) {
          month++
          if (month > 12) { month = 1; year++ }
          continue
        }
        if (isWorkday(candidate)) return candidate
      } else if (action === "defer") {
        if (isHoliday(candidate)) {
          const deferred = deferPastHoliday(candidate)
          deferred.setHours(alarm.hour, alarm.minute, 0, 0)
          return deferred
        }
      }

      return candidate
    }

    month++
    if (month > 12) { month = 1; year++ }
  }
  return null
}

// ==================== yearly: 每年（含节气） ====================
function getNextYearly(alarm: AlarmItem, now: Date): Date | null {
  const subMode = alarm.repeat.yearlySubMode ?? (alarm.repeat.solarTerm ? "solarTerm" : "date")
  const action: HolidayAction = alarm.repeat.holidayAction ?? "none"

  // 对候选日应用调休动作，返回可能调整后的 Date（或 null 表示跳过）
  const applyHoliday = (candidate: Date): Date | null => {
    if (action === "none") return candidate
    if (action === "skip") {
      if (isHoliday(candidate)) return null
      if (isWorkday(candidate)) return candidate
      return candidate
    }
    // defer: 节假日当天顺延到下一个非节假日
    if (isHoliday(candidate)) {
      const deferred = deferPastHoliday(candidate)
      deferred.setHours(alarm.hour, alarm.minute, 0, 0)
      return deferred
    }
    return candidate
  }

  // 节气
  if (subMode === "solarTerm" && alarm.repeat.solarTerm) {
    const termDate = getNextSolarTerm(alarm.repeat.solarTerm, now)
    if (termDate) {
      termDate.setHours(alarm.hour, alarm.minute, 0, 0)
      if (termDate > now) {
        const adjusted = applyHoliday(termDate)
        if (adjusted) return adjusted
      }
    }
    return null
  }

  // 每年第N个工作日
  if (subMode === "nthWorkday" && alarm.repeat.nthWorkdayOfYear) {
    let year = now.getFullYear()
    for (let i = 0; i < 3; i++) {
      const candidate = getNthWorkdayOfYear(year, alarm.repeat.nthWorkdayOfYear)
      if (candidate) {
        candidate.setHours(alarm.hour, alarm.minute, 0, 0)
        if (candidate > now) {
          const adjusted = applyHoliday(candidate)
          if (adjusted) return adjusted
        }
      }
      year++
    }
    return null
  }

  // 每年某月的第N周星期X
  if (subMode === "weekday" && alarm.repeat.monthOfYear && alarm.repeat.weekOfMonth && alarm.repeat.weekdayOfMonth) {
    let year = now.getFullYear()
    for (let i = 0; i < 3; i++) {
      const candidate = getWeekdayOfMonth(year, alarm.repeat.monthOfYear, alarm.repeat.weekOfMonth, alarm.repeat.weekdayOfMonth)
      if (candidate) {
        candidate.setHours(alarm.hour, alarm.minute, 0, 0)
        if (candidate > now) {
          const adjusted = applyHoliday(candidate)
          if (adjusted) return adjusted
        }
      }
      year++
    }
    return null
  }

  // 普通每年重复（月+日）
  const monthOfYear = alarm.repeat.monthOfYear ?? 1
  const dayOfMonth = alarm.repeat.dayOfMonth ?? 1
  let year = now.getFullYear()

  for (let i = 0; i < 3; i++) {
    const daysInMonth = new Date(year, monthOfYear, 0).getDate()
    const actualDay = Math.min(dayOfMonth, daysInMonth)
    const candidate = new Date(year, monthOfYear - 1, actualDay, alarm.hour, alarm.minute, 0, 0)
    if (candidate > now) {
      const adjusted = applyHoliday(candidate)
      if (adjusted) return adjusted
    }
    year++
  }
  return null
}

// ==================== lunar_yearly: 农历每年 ====================
function getNextLunar(alarm: AlarmItem, now: Date): Date | null {
  const lunarMonth = alarm.repeat.lunarMonth ?? 1
  const lunarDay = alarm.repeat.lunarDay ?? 1
  const nowYear = now.getFullYear()
  const action: HolidayAction = alarm.repeat.holidayAction ?? "none"

  // 先试今年
  for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
    const lunarYear = nowYear + yearOffset
    try {
      const solarDate = lunarToSolar(lunarYear, lunarMonth, lunarDay)
      solarDate.setHours(alarm.hour, alarm.minute, 0, 0)
      if (solarDate > now) {
        // 调休动作
        if (action === "skip") {
          if (isHoliday(solarDate)) continue
          if (isWorkday(solarDate)) return solarDate
          return solarDate
        } else if (action === "defer") {
          if (isHoliday(solarDate)) {
            const deferred = deferPastHoliday(solarDate)
            deferred.setHours(alarm.hour, alarm.minute, 0, 0)
            return deferred
          }
          return solarDate
        }
        return solarDate
      }
    } catch (e) {
      // 农历数据表范围外，跳过
      continue
    }
  }
  return null
}

// ==================== workday: 每N工作日 ====================
function getNextWorkday(alarm: AlarmItem, now: Date): Date | null {
  const interval = alarm.repeat.interval || 1
  const action: HolidayAction = alarm.repeat.holidayAction ?? "skip"

  let workdayCount = 0
  for (let offset = 0; offset < 30; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(alarm.hour, alarm.minute, 0, 0)

    if (offset === 0 && candidate <= now) continue

    // 判断是否工作日
    const dayOfWeek = candidate.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHol = isHoliday(candidate)
    const isWork = isWorkday(candidate)

    let isWorkdayToday = false
    if (action === "none") {
      // 不查调休：纯周一到周五
      isWorkdayToday = !isWeekend
    } else {
      // skip / defer：查调休日历
      if (isWork) {
        isWorkdayToday = true // 补班日
      } else if (isHol) {
        isWorkdayToday = false // 节假日
      } else if (!isWeekend) {
        isWorkdayToday = true // 普通工作日
      }
    }

    if (isWorkdayToday) {
      workdayCount++
      if (workdayCount === interval) return candidate
    }
  }
  return null
}

// ==================== 获取所有启用闹钟的下一个触发 ====================
export function getNextAlarmFromList(alarms: AlarmItem[], now: Date): { alarm: AlarmItem; date: Date } | null {
  let earliest: { alarm: AlarmItem; date: Date } | null = null

  for (const alarm of alarms) {
    if (!alarm.enabled) continue
    const trigger = getNextTrigger(alarm, now)
    if (!trigger) continue
    if (!earliest || trigger < earliest.date) {
      earliest = { alarm, date: trigger }
    }
  }

  return earliest
}

// ==================== 格式化倒计时 ====================
export function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return "已过"

  const diffMin = Math.floor(diffMs / (60 * 1000))
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) {
    return `${diffDay}天${diffHour % 24}小时后`
  }
  if (diffHour > 0) {
    return `${diffHour}小时${diffMin % 60}分钟后`
  }
  return `${diffMin}分钟后`
}

// ==================== 格式化重复描述 ====================
// 调休动作后缀
function holidaySuffix(action: HolidayAction | undefined): string {
  if (action === "skip") return "（节假日跳过）"
  if (action === "defer") return "（节假日顺延）"
  return ""
}

// 结束条件后缀
function endConditionSuffix(repeat: RepeatRule): string {
  const parts: string[] = []
  if (repeat.endDate) {
    const d = new Date(repeat.endDate)
    parts.push(`至${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`)
  }
  if (repeat.endAfterOccurrences && repeat.endAfterOccurrences > 0) {
    const n = repeat.endAfterOccurrences
    const interval = repeat.interval || 1
    switch (repeat.mode) {
      case "daily":
        parts.push(interval === 1 ? `共${n}天` : `共${n}个周期`)
        break
      case "weekly":
        parts.push(interval === 1 ? `共${n}周` : `共${n}个周期`)
        break
      case "monthly":
        parts.push(interval === 1 ? `共${n}个月` : `共${n}个周期`)
        break
      case "yearly":
      case "lunar_yearly":
        parts.push(`共${n}年`)
        break
      case "workday":
        parts.push(interval === 1 ? `共${n}个工作日` : `共${n}个周期`)
        break
      default:
        parts.push(`共${n}个周期`)
    }
  }
  return parts.length > 0 ? "（" + parts.join("，") + "）" : ""
}

export function formatRepeatDescription(repeat: RepeatRule): string {
  const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"]

  switch (repeat.mode) {
    case "once": {
      if (repeat.anchorDate) {
        const parts = repeat.anchorDate.split("-")
        return `${+parts[0]}年${+parts[1]}月${+parts[2]}日`
      }
      return "仅一次"
    }

    case "daily": {
      const base = repeat.interval === 1 ? "每天" : `每${repeat.interval}天`
      return base + holidaySuffix(repeat.holidayAction) + endConditionSuffix(repeat)
    }

    case "weekly": {
      const days = (repeat.weekdays ?? []).sort()
      const labels = days.map((d) => weekdayLabels[d - 1]).join("至")
      const prefix = repeat.interval === 1 ? "" : `每${repeat.interval}周 `
      return `${prefix}每周${labels}${holidaySuffix(repeat.holidayAction)}${endConditionSuffix(repeat)}`
    }

    case "monthly": {
      const subMode = repeat.monthlySubMode ?? "day"
      let base: string
      if (subMode === "weekday" && repeat.weekOfMonth && repeat.weekdayOfMonth) {
        const weekLabel = repeat.weekOfMonth === -1 ? "最后一" : `第${repeat.weekOfMonth}`
        base = `每月${weekLabel}周星期${weekdayLabels[repeat.weekdayOfMonth - 1]}`
      } else {
        base = repeat.interval === 1 ? `每月${repeat.dayOfMonth}号` : `每${repeat.interval}月 ${repeat.dayOfMonth}号`
      }
      return base + holidaySuffix(repeat.holidayAction) + endConditionSuffix(repeat)
    }

    case "yearly": {
      const subMode = repeat.yearlySubMode ?? (repeat.solarTerm ? "solarTerm" : "date")
      let base: string
      if (subMode === "solarTerm" && repeat.solarTerm) {
        base = `每年${repeat.solarTerm}`
      } else if (subMode === "nthWorkday" && repeat.nthWorkdayOfYear) {
        base = `每年第${repeat.nthWorkdayOfYear}个工作日`
      } else if (subMode === "weekday" && repeat.monthOfYear && repeat.weekOfMonth && repeat.weekdayOfMonth) {
        const weekLabel = repeat.weekOfMonth === -1 ? "最后一" : `第${repeat.weekOfMonth}`
        base = `每年${repeat.monthOfYear}月${weekLabel}周星期${weekdayLabels[repeat.weekdayOfMonth - 1]}`
      } else {
        base = `每年${repeat.monthOfYear}月${repeat.dayOfMonth}号`
      }
      return base + holidaySuffix(repeat.holidayAction) + endConditionSuffix(repeat)
    }

    case "lunar_yearly":
      return `农历每年${repeat.lunarMonth}月${repeat.lunarDay}${holidaySuffix(repeat.holidayAction)}${endConditionSuffix(repeat)}`

    case "workday":
      if (repeat.interval === 1) return "每个工作日" + endConditionSuffix(repeat)
      return `每${repeat.interval}个工作日${endConditionSuffix(repeat)}`

    default:
      return ""
  }
}
