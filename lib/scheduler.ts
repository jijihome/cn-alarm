// scheduler.ts - 多调度引擎核心
import { AlarmItem, RepeatRule, AppSettings } from "./constants"
import { shouldRing, isHoliday, isWorkday, formatDate } from "./holiday"
import { lunarToSolar } from "./lunar"
import { getNextSolarTerm } from "./solar-term"
import { loadSettings } from "./alarm-store"

// ==================== 主入口：获取下一个触发时间 ====================
export function getNextTrigger(alarm: AlarmItem, now: Date): Date | null {
  if (!alarm.enabled) return null

  switch (alarm.repeat.mode) {
    case "once":
      return getNextOnce(alarm, now)
    case "daily":
      return getNextDaily(alarm, now)
    case "weekly":
      return getNextWeekly(alarm, now)
    case "monthly":
      return getNextMonthly(alarm, now)
    case "yearly":
      return getNextYearly(alarm, now)
    case "lunar_yearly":
      return getNextLunar(alarm, now)
    case "workday":
      return getNextWorkday(alarm, now)
    default:
      return null
  }
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
  const settings = loadSettings()
  const interval = alarm.repeat.interval || 1

  for (let offset = 0; offset < interval * 2 + 1; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(alarm.hour, alarm.minute, 0, 0)

    if (offset === 0 && candidate <= now) continue

    if (alarm.repeat.holidayAware && settings.holidayAutoSkip && isHoliday(candidate)) continue

    // 检查间隔
    if (interval > 1 && alarm.repeat.anchorDate) {
      const anchor = new Date(alarm.repeat.anchorDate)
      const daysDiff = Math.floor((candidate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000))
      if (daysDiff % interval !== 0) continue
    }

    return candidate
  }
  return null
}

// ==================== weekly: 每N周 ====================
function getNextWeekly(alarm: AlarmItem, now: Date): Date | null {
  const settings = loadSettings()
  const weekdays = alarm.repeat.weekdays ?? []
  const interval = alarm.repeat.interval || 1

  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(alarm.hour, alarm.minute, 0, 0)

    if (offset === 0 && candidate <= now) continue

    const dayOfWeek = candidate.getDay() + 1 // Apple: 1=日 2=一 ... 7=六
    if (!weekdays.includes(dayOfWeek)) continue

    // 调休联动判断
    if (alarm.repeat.holidayAware) {
      if (settings.holidayAutoSkip && isHoliday(candidate)) continue
    }

    // interval > 1: 检查周间隔（对所有日期统一执行，包括补班日）
    if (interval > 1 && alarm.repeat.anchorDate) {
      const anchor = new Date(alarm.repeat.anchorDate)
      const weekDiff = Math.floor((candidate.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000))
      if (weekDiff % interval !== 0) continue
    }

    // 补班日强制响（在 interval 检查通过后）
    if (alarm.repeat.holidayAware && isWorkday(candidate)) return candidate

    return candidate
  }
  return null
}

// ==================== monthly: 每N月 ====================
function getNextMonthly(alarm: AlarmItem, now: Date): Date | null {
  const dayOfMonth = alarm.repeat.dayOfMonth ?? 1
  const interval = alarm.repeat.interval || 1

  let year = now.getFullYear()
  let month = now.getMonth() + 1

  for (let i = 0; i < 24; i++) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const actualDay = Math.min(dayOfMonth, daysInMonth)

    const candidate = new Date(year, month - 1, actualDay, alarm.hour, alarm.minute, 0, 0)

    if (candidate > now) {
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
      return candidate
    }

    month++
    if (month > 12) { month = 1; year++ }
  }
  return null
}

// ==================== yearly: 每年（含节气） ====================
function getNextYearly(alarm: AlarmItem, now: Date): Date | null {
  // 如果有节气配置
  if (alarm.repeat.solarTerm) {
    const termDate = getNextSolarTerm(alarm.repeat.solarTerm, now)
    if (termDate) {
      termDate.setHours(alarm.hour, alarm.minute, 0, 0)
      if (termDate > now) return termDate
    }
    return null
  }

  // 普通每年重复
  const monthOfYear = alarm.repeat.monthOfYear ?? 1
  const dayOfMonth = alarm.repeat.dayOfMonth ?? 1
  let year = now.getFullYear()

  for (let i = 0; i < 3; i++) {
    const daysInMonth = new Date(year, monthOfYear, 0).getDate()
    const actualDay = Math.min(dayOfMonth, daysInMonth)
    const candidate = new Date(year, monthOfYear - 1, actualDay, alarm.hour, alarm.minute, 0, 0)
    if (candidate > now) return candidate
    year++
  }
  return null
}

// ==================== lunar_yearly: 农历每年 ====================
function getNextLunar(alarm: AlarmItem, now: Date): Date | null {
  const lunarMonth = alarm.repeat.lunarMonth ?? 1
  const lunarDay = alarm.repeat.lunarDay ?? 1
  const nowYear = now.getFullYear()

  // 先试今年
  for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
    const lunarYear = nowYear + yearOffset
    try {
      const solarDate = lunarToSolar(lunarYear, lunarMonth, lunarDay)
      solarDate.setHours(alarm.hour, alarm.minute, 0, 0)
      if (solarDate > now) return solarDate
    } catch (e) {
      // 农历数据表范围外，跳过
      continue
    }
  }
  return null
}

// ==================== workday: 每N工作日 ====================
function getNextWorkday(alarm: AlarmItem, now: Date): Date | null {
  const settings = loadSettings()
  const interval = alarm.repeat.interval || 1

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
    if (isWork) {
      isWorkdayToday = true // 补班日
    } else if (isHol) {
      isWorkdayToday = false // 节假日
    } else if (!isWeekend) {
      isWorkdayToday = true // 普通工作日
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
export function formatRepeatDescription(repeat: RepeatRule): string {
  const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"]

  switch (repeat.mode) {
    case "once":
      return "仅一次"

    case "daily":
      if (repeat.interval === 1) return "每天"
      return `每${repeat.interval}天`

    case "weekly": {
      const days = (repeat.weekdays ?? []).sort()
      const labels = days.map((d) => weekdayLabels[d - 1]).join("至")
      const prefix = repeat.interval === 1 ? "" : `每${repeat.interval}周 `
      if (repeat.holidayAware) {
        return `${prefix}每周${labels}（智能调休）`
      }
      return `${prefix}每周${labels}`
    }

    case "monthly":
      if (repeat.interval === 1) return `每月${repeat.dayOfMonth}号`
      return `每${repeat.interval}月 ${repeat.dayOfMonth}号`

    case "yearly":
      if (repeat.solarTerm) return `每年${repeat.solarTerm}`
      return `每年${repeat.monthOfYear}月${repeat.dayOfMonth}号`

    case "lunar_yearly":
      return `农历每年${repeat.lunarMonth}月${repeat.lunarDay}`

    case "workday":
      if (repeat.interval === 1) return "每个工作日"
      return `每${repeat.interval}个工作日`

    default:
      return ""
  }
}
