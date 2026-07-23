// DayOfMonthPicker.tsx - 月内日期多选器（日历网格页面）
// List+Section 风格，日历网格每行一个 HStack（独立 List 行），避免 Button 与 List 行选择冲突
// 根据系统地区自动判断周起始日（中国等亚洲地区=周一开始）
// 作为 NavigationLink destination push 进入的独立页面
import { List, Section, HStack, Button, Text, Circle, ZStack, useObservable } from "scripting"
import { isHoliday, isWorkday, loadHolidays } from "../lib/holiday"
import { HolidayCalendar } from "../lib/constants"

// 根据系统地区判断周起始日
const MONDAY_START_COUNTRIES = new Set(["CN", "TW", "HK", "JP", "KR", "SG", "MO"])
const weekStartsOnMonday = MONDAY_START_COUNTRIES.has(Device.systemCountryCode ?? "")

const WEEKDAY_HEADERS = weekStartsOnMonday
  ? ["一", "二", "三", "四", "五", "六", "日"]
  : ["日", "一", "二", "三", "四", "五", "六"]

interface DayOfMonthPickerProps {
  value: number[]
  onChanged: (days: number[]) => void
}

export function DayOfMonthPicker({ value, onChanged }: DayOfMonthPickerProps) {
  // 本地暂存选择状态，实时同步到父组件
  const localDays = useObservable(value)

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

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const startOffset = weekStartsOnMonday ? (firstDayOfWeek + 6) % 7 : firstDayOfWeek

  const calendars: HolidayCalendar[] = loadHolidays()

  const getDayKind = (day: number): "holiday" | "workday" | "weekend" | "weekday" => {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (isHoliday(date, calendars)) return "holiday"
    if (isWeekend && isWorkday(date, calendars)) return "workday"
    if (isWeekend) return "weekend"
    return "weekday"
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }

  const monthLabel = `${year}年${month}月`
  const cellSize = 44
  const circleSize = 36

  // 图例 footer
  const legendText = "🔴 节假日  🟠 补班  ⚪ 周末  🔵 今天"

  return (
    <List navigationTitle={monthLabel} navigationBarTitleDisplayMode="inline" buttonStyle="plain">
      <Section
        header={<Text>选择日期</Text>}
        footer={<Text font="footnote" foregroundStyle="systemGray">{legendText}</Text>}
      >
        {/* 星期标题行 */}
        <HStack spacing={2} listRowSeparator="hidden" listRowInsets={{ top: 8, bottom: 2, leading: 0, trailing: 0 }}>
          {WEEKDAY_HEADERS.map((h) => (
            <Text key={h} font="caption2" foregroundStyle="tertiaryLabel" frame={{ width: cellSize, height: 18 }}>{h}</Text>
          ))}
        </HStack>
        {/* 日期行：每行一个 HStack，作为独立的 List 行 */}
        {rows.map((row, rowIdx) => (
          <HStack key={rowIdx} spacing={2} listRowInsets={{ top: 1, bottom: 1, leading: 0, trailing: 0 }}>
            {row.map((day, colIdx) => {
              if (day == null) {
                return <ZStack key={`empty${colIdx}`} frame={{ width: cellSize, height: cellSize }} />
              }
              const selected = localDays.value.includes(day)
              const isToday = day === today
              const kind = getDayKind(day)
              const fgColor = selected
                ? "white"
                : kind === "holiday"
                  ? "systemRed"
                  : kind === "workday"
                    ? "systemOrange"
                    : kind === "weekend"
                      ? "tertiaryLabel"
                      : "label"
              return (
                <Button key={day} action={() => toggleDay(day)}>
                  <ZStack frame={{ width: cellSize, height: cellSize }}>
                    {selected ? (
                      <Circle fill={"systemBlue" as any} frame={{ width: circleSize, height: circleSize }} />
                    ) : null}
                    {isToday && !selected ? (
                      <Circle stroke={{ shapeStyle: "systemBlue" as any, strokeStyle: { lineWidth: 2 } }} frame={{ width: circleSize, height: circleSize }} />
                    ) : null}
                    <Text font={selected ? "headline" : "body"} foregroundStyle={fgColor as any}>{day}</Text>
                  </ZStack>
                </Button>
              )
            })}
          </HStack>
        ))}
      </Section>
      <Section footer={<Text font="footnote" foregroundStyle="systemGray">已选：{formatDaysOfMonth(localDays.value)}</Text>}>
      </Section>
    </List>
  )
}

export function formatDaysOfMonth(days: number[]): string {
  if (days.length === 0) return "未选"
  return days.sort((a, b) => a - b).map((d) => `${d}号`).join("、")
}
