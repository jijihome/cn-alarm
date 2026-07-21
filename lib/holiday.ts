// holiday.ts - 调休日历判断逻辑
import { STORAGE_KEYS, DEFAULT_HOLIDAYS, HolidayCalendar, RepeatRule, AppSettings } from "./constants"

const SHARED = { shared: true }

// ==================== 加载调休日历 ====================
export function loadHolidays(): HolidayCalendar[] {
  const data = Storage.get<HolidayCalendar[]>(STORAGE_KEYS.HOLIDAYS, SHARED)
  return data ?? DEFAULT_HOLIDAYS
}

export function saveHolidays(calendars: HolidayCalendar[]): void {
  Storage.set(STORAGE_KEYS.HOLIDAYS, calendars, SHARED)
}

// ==================== 日期格式化 ====================
// Date → "YYYY-MM-DD"
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// ==================== 判断是否节假日 ====================
export function isHoliday(date: Date, calendars?: HolidayCalendar[]): boolean {
  const cals = calendars ?? loadHolidays()
  const dateStr = formatDate(date)
  return cals.some((c) => c.holidays.some((h) => h.date === dateStr))
}

// ==================== 判断是否调休补班日 ====================
export function isWorkday(date: Date, calendars?: HolidayCalendar[]): boolean {
  const cals = calendars ?? loadHolidays()
  const dateStr = formatDate(date)
  return cals.some((c) => c.workdays.some((w) => w.date === dateStr))
}

// ==================== 判断某天某闹钟是否该响 ====================
export function shouldRing(date: Date, repeat: RepeatRule, settings: AppSettings, calendars?: HolidayCalendar[]): boolean {
  if (repeat.mode === "once") return true

  if (repeat.holidayAware) {
    // 节假日 → 跳过
    if (settings.holidayAutoSkip && isHoliday(date, calendars)) return false
    // 补班日 → 响铃（即使周末）
    if (isWorkday(date, calendars)) return true
  }

  // 按星期判断（weekly 模式）
  if (repeat.mode === "weekly") {
    const dayOfWeek = date.getDay() + 1 // Apple编号: 1=日 2=一 ... 7=六
    return repeat.weekdays?.includes(dayOfWeek) ?? false
  }

  // workday 模式：非节假日的工作日都算
  if (repeat.mode === "workday") {
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (isWeekend) {
      // 周末只有补班日才响
      return isWorkday(date, calendars)
    }
    // 工作日：节假日不响，否则响
    if (repeat.holidayAware && isHoliday(date, calendars)) return false
    return true
  }

  // daily 模式：每天都响（除非 holidayAware + 节假日）
  if (repeat.mode === "daily") {
    if (repeat.holidayAware && settings.holidayAutoSkip && isHoliday(date, calendars)) return false
    return true
  }

  return false
}

// ==================== 获取某天的节假日名称 ====================
export function getHolidayName(date: Date, calendars?: HolidayCalendar[]): string | null {
  const cals = calendars ?? loadHolidays()
  const dateStr = formatDate(date)
  for (const c of cals) {
    const h = c.holidays.find((h) => h.date === dateStr)
    if (h) return h.name
  }
  return null
}

// ==================== 获取某天的补班名称 ====================
export function getWorkdayName(date: Date, calendars?: HolidayCalendar[]): string | null {
  const cals = calendars ?? loadHolidays()
  const dateStr = formatDate(date)
  for (const c of cals) {
    const w = c.workdays.find((w) => w.date === dateStr)
    if (w) return w.name
  }
  return null
}

// ==================== 获取/重置某年日历 ====================
export function getHolidayByYear(year: number, calendars?: HolidayCalendar[]): HolidayCalendar | null {
  const cals = calendars ?? loadHolidays()
  return cals.find((c) => c.year === year) ?? null
}

export function resetYearToDefault(year: number): HolidayCalendar | null {
  const defaultCal = DEFAULT_HOLIDAYS.find((c) => c.year === year)
  if (!defaultCal) return null
  const cals = loadHolidays()
  const idx = cals.findIndex((c) => c.year === year)
  if (idx >= 0) {
    cals[idx] = defaultCal
  } else {
    cals.push(defaultCal)
  }
  saveHolidays(cals)
  return defaultCal
}
