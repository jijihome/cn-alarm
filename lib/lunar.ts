// lunar.ts - 农历-公历转换
// 基于农历数据表，覆盖 2020-2030

// ==================== 农历数据表 ====================
// 每年一个 number，编码规则：
// bits 0-3: 闰月月份 (0=无闰月)
// bits 4-15: 12个月大小 (1=大月30天, 0=小月29天)，从高位到低位对应1-12月
// bit 16: 闰月大小 (1=大月30天, 0=小月29天)
const LUNAR_INFO: number[] = [
  0x04bd8, // 2020
  0x04ae0, // 2021
  0x0a570, // 2022
  0x054d5, // 2023
  0x0d260, // 2024
  0x0d950, // 2025
  0x16554, // 2026
  0x056a0, // 2027
  0x09ad0, // 2028
  0x055d2, // 2029
  0x04ae0, // 2030
]

const LUNAR_YEAR_BASE = 2020 // 数据表起始年份

// ==================== 农历年首公历日期表 ====================
// 每年农历正月初一对应的公历日期
const LUNAR_NEW_YEAR_DATES: string[] = [
  "2020-01-25", // 2020年正月初一
  "2021-02-12", // 2021
  "2022-02-01", // 2022
  "2023-01-22", // 2023
  "2024-02-10", // 2024
  "2025-01-29", // 2025
  "2026-02-17", // 2026
  "2027-02-06", // 2027
  "2028-01-26", // 2028
  "2029-02-13", // 2029
  "2030-02-03", // 2030
]

// ==================== 工具函数 ====================
// 获取农历年信息
function getLunarYearInfo(lunarYear: number): number {
  const idx = lunarYear - LUNAR_YEAR_BASE
  if (idx < 0 || idx >= LUNAR_INFO.length) {
    throw new Error(`农历年 ${lunarYear} 超出数据表范围 (${LUNAR_YEAR_BASE}-${LUNAR_YEAR_BASE + LUNAR_INFO.length - 1})`)
  }
  return LUNAR_INFO[idx]
}

// 获取闰月月份 (0=无)
function getLeapMonth(lunarYear: number): number {
  return getLunarYearInfo(lunarYear) & 0xf
}

// 获取某月天数 (29 或 30)
function getMonthDays(lunarYear: number, month: number): number {
  const info = getLunarYearInfo(lunarYear)
  // bit 4+month 对应该月大小 (从高位开始)
  // 月份1对应bit15, 月份2对应bit14, ...
  return (info >> (16 - month)) & 0x1 ? 30 : 29
}

// 获取闰月天数
function getLeapMonthDays(lunarYear: number): number {
  const info = getLunarYearInfo(lunarYear)
  return info & 0x10000 ? 30 : 29
}

// 获取农历年总天数
function getLunarYearDays(lunarYear: number): number {
  let sum = 0
  for (let i = 1; i <= 12; i++) {
    sum += getMonthDays(lunarYear, i)
  }
  const leap = getLeapMonth(lunarYear)
  if (leap > 0) {
    sum += getLeapMonthDays(lunarYear)
  }
  return sum
}

// ==================== 农历转公历 ====================
// lunarYear: 农历年, lunarMonth: 农历月(1-12), lunarDay: 农历日(1-30)
// isLeap: 是否闰月
export function lunarToSolar(lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean = false): Date {
  const idx = lunarYear - LUNAR_YEAR_BASE
  if (idx < 0 || idx >= LUNAR_NEW_YEAR_DATES.length) {
    throw new Error(`农历年 ${lunarYear} 超出范围`)
  }

  // 从正月初一开始累加天数
  const newYearDate = new Date(LUNAR_NEW_YEAR_DATES[idx])
  let offset = 0

  // 累加前 lunarMonth-1 个月的天数
  for (let m = 1; m < lunarMonth; m++) {
    offset += getMonthDays(lunarYear, m)
  }

  // 如果是闰月，加上正常月的天数 + 闰月之前
  const leapMonth = getLeapMonth(lunarYear)
  if (isLeap) {
    if (lunarMonth !== leapMonth) {
      throw new Error(`农历年 ${lunarYear} 没有闰${lunarMonth}月`)
    }
    offset += getMonthDays(lunarYear, lunarMonth) // 先加正常月
  } else {
    // 如果目标月 > 闰月，需要加闰月天数
    if (leapMonth > 0 && lunarMonth > leapMonth) {
      offset += getLeapMonthDays(lunarYear)
    }
  }

  // 加上当月天数
  offset += lunarDay - 1

  // 从正月初一加上偏移
  const result = new Date(newYearDate)
  result.setDate(result.getDate() + offset)
  return result
}

// ==================== 公历转农历 ====================
export function solarToLunar(date: Date): { year: number; month: number; day: number; isLeap: boolean; monthName: string } {
  const solarYear = date.getFullYear()

  // 找到对应的农历年
  // 农历年从正月初一开始，所以公历1-2月可能属于上一农历年
  let lunarYear = solarYear
  const newYearDate = new Date(LUNAR_NEW_YEAR_DATES[lunarYear - LUNAR_YEAR_BASE] ?? `${lunarYear}-02-01`)
  if (date < newYearDate) {
    lunarYear = solarYear - 1
  }

  const idx = lunarYear - LUNAR_YEAR_BASE
  if (idx < 0 || idx >= LUNAR_NEW_YEAR_DATES.length) {
    throw new Error(`日期超出农历数据表范围`)
  }

  const lunarNewYear = new Date(LUNAR_NEW_YEAR_DATES[idx])
  let offset = Math.floor((date.getTime() - lunarNewYear.getTime()) / (24 * 60 * 60 * 1000))

  // 逐月减去天数
  let month = 1
  let isLeap = false
  const leapMonth = getLeapMonth(lunarYear)

  while (month <= 12) {
    const monthDays = getMonthDays(lunarYear, month)
    if (offset < monthDays) break
    offset -= monthDays
    month++

    // 检查是否需要处理闰月
    if (month === leapMonth + 1 && leapMonth > 0 && !isLeap) {
      const leapDays = getLeapMonthDays(lunarYear)
      if (offset < leapDays) {
        isLeap = true
        month = leapMonth
        break
      }
      offset -= leapDays
    }
  }

  const day = offset + 1
  return {
    year: lunarYear,
    month,
    day,
    isLeap,
    monthName: getLunarMonthName(month, isLeap),
  }
}

// ==================== 农历月名 ====================
const LUNAR_MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]

export function getLunarMonthName(month: number, isLeap: boolean): string {
  const name = LUNAR_MONTH_NAMES[month - 1] ?? String(month)
  return isLeap ? `闰${name}` : name
}

// ==================== 农历日名 ====================
export function getLunarDayName(day: number): string {
  if (day === 10) return "初十"
  if (day === 20) return "二十"
  if (day === 30) return "三十"
  const tens = ["初", "十", "廿", "三"]
  const ones = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
  const t = Math.floor(day / 10)
  const o = day % 10
  if (o === 0) return tens[t] + "十"
  return tens[t] + ones[o]
}

// ==================== 获取今日农历 ====================
export function getLunarToday(): { year: number; month: number; day: number; isLeap: boolean; monthName: string; dayName: string } {
  const lunar = solarToLunar(new Date())
  return { ...lunar, dayName: getLunarDayName(lunar.day) }
}
