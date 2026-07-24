// DayOfMonthPicker.tsx - 月内日期多选器（iOS 原生日历风格）
// ScrollView + VStack + LazyVGrid 紧凑布局，无 List Section 间距
// 精确复刻 iOS Calendar 月视图：农历日名+小蓝点、今天红色圆、溢出月
// 作为 NavigationLink destination push 进入的独立页面
import { NavigationStack, ScrollView, HStack, VStack, Spacer, Button, Text, Image, LazyVGrid, Circle, ZStack, useObservable } from "scripting"
import { isHoliday, isWorkday, loadHolidays, getHolidayName, getWorkdayName } from "../lib/holiday"
import { solarToLunar, getLunarDayName, getLunarMonthName } from "../lib/lunar"
import { getSolarTermsOfYear } from "../lib/solar-term"
import { HolidayCalendar } from "../lib/constants"

const MONDAY_START_COUNTRIES = new Set(["CN", "TW", "HK", "JP", "KR", "SG", "MO"])
const weekStartsOnMonday = MONDAY_START_COUNTRIES.has(Device.systemCountryCode ?? "")

const WEEKDAY_HEADERS = weekStartsOnMonday
  ? ["一", "二", "三", "四", "五", "六", "日"]
  : ["日", "一", "二", "三", "四", "五", "六"]

const WEEKEND_COL_INDICES = weekStartsOnMonday ? [5, 6] : [0, 6]

interface DayOfMonthPickerProps {
  value: number[]
  onChanged: (days: number[]) => void
  month?: number
  year?: number
}

interface CellData {
  day: number
  year: number
  month: number
  isCurrentMonth: boolean
}

export function DayOfMonthPicker({ value, onChanged, month, year }: DayOfMonthPickerProps) {
  const now = new Date()
  const displayYear = useObservable(year ?? now.getFullYear())
  const displayMonth = useObservable(month ?? (now.getMonth() + 1))
  const localDays = useObservable(value)

  const today = now.getDate()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1

  const toggleDay = (day: number) => {
    const current = localDays.value
    let next: number[]
    if (current.includes(day)) {
      if (current.length <= 1) return
      next = current.filter((d) => d !== day).sort((a, b) => a - b)
    } else {
      next = [...current, day].sort((a, b) => a - b)
    }
    localDays.setValue(next)
    onChanged(next)
  }

  const handlePrevMonth = () => {
    let m = displayMonth.value - 1
    let y = displayYear.value
    if (m < 1) { m = 12; y-- }
    displayMonth.setValue(m)
    displayYear.setValue(y)
  }

  const handleNextMonth = () => {
    let m = displayMonth.value + 1
    let y = displayYear.value
    if (m > 12) { m = 1; y++ }
    displayMonth.setValue(m)
    displayYear.setValue(y)
  }

  const handleToday = () => {
    displayYear.setValue(todayYear)
    displayMonth.setValue(todayMonth)
  }

  const y = displayYear.value
  const m = displayMonth.value
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay()
  const startOffset = weekStartsOnMonday ? (firstDayOfWeek + 6) % 7 : firstDayOfWeek

  const prevMonth = m === 1 ? 12 : m - 1
  const prevYear = m === 1 ? y - 1 : y
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate()
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y

  const calendars: HolidayCalendar[] = loadHolidays()

  // 预计算节气映射
  const solarTermsMap = new Map<string, string>()
  const allTerms = getSolarTermsOfYear(y)
  for (const t of allTerms) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`
    solarTermsMap.set(key, t.termName)
  }

  // 构建格子数据
  const cells: (CellData | null)[] = []
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, year: prevYear, month: prevMonth, isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, year: y, month: m, isCurrentMonth: true })
  }
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, year: nextYear, month: nextMonth, isCurrentMonth: false })
  }

  const getLunarLabel = (cell: CellData): string => {
    try {
      const date = new Date(cell.year, cell.month - 1, cell.day)
      const lunar = solarToLunar(date)
      if (lunar.day === 1) {
        return lunar.isLeap ? `闰${getLunarMonthName(lunar.month, false)}` : getLunarMonthName(lunar.month, false)
      }
      return getLunarDayName(lunar.day)
    } catch {
      return ""
    }
  }

  const hasSpecialMark = (cell: CellData): boolean => {
    const date = new Date(cell.year, cell.month - 1, cell.day)
    const dateStr = `${cell.year}-${String(cell.month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
    if (isHoliday(date, calendars)) return true
    if (isWorkday(date, calendars)) return true
    if (solarTermsMap.has(dateStr)) return true
    return false
  }

  const isWeekend = (cell: CellData): boolean => {
    const date = new Date(cell.year, cell.month - 1, cell.day)
    const dow = date.getDay()
    return dow === 0 || dow === 6
  }

  // 格子尺寸
  const cellWidth = 48
  const cellHeight = 50
  const circleSize = 38
  const blueDotSize = 5
  const gridColumns = Array.from({ length: 7 }, () => ({
    size: cellWidth,
    spacing: 0,
  }))

  // 渲染单个日期格子
  const renderCell = (cell: CellData | null, idx: number) => {
    if (cell === null) {
      return <Text key={`e-${idx}`} frame={{ width: cellWidth, height: cellHeight }}>{" "}</Text>
    }

    const { day, isCurrentMonth: isCurMonth } = cell
    const isToday = cell.year === todayYear && cell.month === todayMonth && day === today
    const selected = isCurMonth && localDays.value.includes(day)
    const hasMark = hasSpecialMark(cell)
    const lunarLabel = getLunarLabel(cell)
    const isWe = isWeekend(cell)

    // 溢出月：灰色
    if (!isCurMonth) {
      return (
        <VStack key={`o-${idx}`} spacing={0} frame={{ width: cellWidth, height: cellHeight }}>
          <Text font="callout" foregroundStyle="tertiaryLabel" frame={{ height: 20 }}>{day.toString()}</Text>
          <Text font="caption2" foregroundStyle="tertiaryLabel" frame={{ height: 12 }}>{lunarLabel || " "}</Text>
          <Text frame={{ height: blueDotSize + 2 }}>{" "}</Text>
        </VStack>
      )
    }

    const isHighlighted = selected || isToday
    const fgColor = isHighlighted ? "white" : isWe ? "tertiaryLabel" : "label"
    const lunarFg = isHighlighted ? "white" : "tertiaryLabel"

    return (
      <Button key={`d-${idx}`} action={() => toggleDay(day)} buttonStyle="plain">
        <ZStack frame={{ width: cellWidth, height: cellHeight }}>
          {selected ? (
            <Circle fill={"systemBlue" as any} frame={{ width: circleSize, height: circleSize }} />
          ) : null}
          {isToday && !selected ? (
            <Circle fill={"systemRed" as any} frame={{ width: circleSize, height: circleSize }} />
          ) : null}
          <VStack key={`v-${idx}`} spacing={0} frame={{ width: cellWidth, height: cellHeight }}>
            <Text
              font="callout"
              fontWeight={isHighlighted ? "semibold" : "regular"}
              foregroundStyle={fgColor as any}
              frame={{ height: 20 }}
            >
              {day.toString()}
            </Text>
            <Text font="caption2" foregroundStyle={lunarFg as any} frame={{ height: 12 }}>
              {lunarLabel || " "}
            </Text>
            {hasMark && !isHighlighted ? (
              <Circle fill={"systemBlue" as any} frame={{ width: blueDotSize, height: blueDotSize }} />
            ) : (
              <Text frame={{ height: blueDotSize + 2 }}>{" "}</Text>
            )}
          </VStack>
        </ZStack>
      </Button>
    )
  }

  return (
    <NavigationStack>
      <VStack navigationTitle={`${y}年`} navigationBarTitleDisplayMode="inline">
        <ScrollView>
          <VStack spacing={0} padding={{ horizontal: 4 }}>
            {/* 星期标题行 */}
            <HStack spacing={0} padding={{ top: 8, bottom: 4 }}>
              {WEEKDAY_HEADERS.map((label, i) => (
                <Text
                  key={`wh-${i}`}
                  font="caption"
                  fontWeight="medium"
                  foregroundStyle={WEEKEND_COL_INDICES.includes(i) ? "tertiaryLabel" : "secondaryLabel"}
                  frame={{ width: cellWidth }}
                  multilineTextAlignment="center"
                >
                  {label}
                </Text>
              ))}
            </HStack>

            {/* 日期网格 */}
            <LazyVGrid columns={gridColumns} alignment="center" spacing={0} buttonStyle="plain">
              {cells.map((cell, idx) => renderCell(cell, idx))}
            </LazyVGrid>

            {/* 底部：今天按钮 + 已选摘要 */}
            <HStack spacing={0} padding={{ top: 12, bottom: 16, leading: 16, trailing: 16 }}>
              <Text font="subheadline" foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{formatDaysOfMonth(localDays.value)}</Text>
            </HStack>
          </VStack>
        </ScrollView>
      </VStack>
    </NavigationStack>
  )
}

export function formatDaysOfMonth(days: number[]): string {
  if (days.length === 0) return "未选"
  return days.sort((a, b) => a - b).map((d) => `${d}号`).join("、")
}
