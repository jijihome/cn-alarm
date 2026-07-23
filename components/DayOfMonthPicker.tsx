// DayOfMonthPicker.tsx - 月内日期多选器（日历网格页面）
// iOS 日历风格：圆形选中标记、今天蓝圈、节假日/补班/周末颜色区分
// 根据系统地区自动判断周起始日（中国等亚洲地区=周一开始）
// 作为 NavigationLink destination push 进入的独立页面
import { ScrollView, VStack, HStack, Button, Text, Spacer, Circle, ZStack, RoundedRectangle, useObservable, Navigation } from "scripting"
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
  const dismiss = Navigation.useDismiss()
  // 本地暂存选择状态，确定时才写回
  const localDays = useObservable(value)

  const toggleDay = (day: number) => {
    const current = localDays.value
    if (current.includes(day)) {
      if (current.length > 1) {
        localDays.setValue(current.filter((d) => d !== day).sort((a, b) => a - b))
      }
    } else {
      localDays.setValue([...current, day].sort((a, b) => a - b))
    }
  }

  const handleReset = () => {
    localDays.setValue(value)
  }

  const handleConfirm = () => {
    onChanged(localDays.value)
    dismiss()
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

  return (
    <ScrollView navigationTitle={monthLabel} navigationBarTitleDisplayMode="inline">
      <VStack alignment="center" spacing={6} padding={{ top: 12, bottom: 20, leading: 8, trailing: 8 }}>
        <HStack spacing={2}>
          {WEEKDAY_HEADERS.map((h) => (
            <Text key={h} font="caption2" foregroundStyle="tertiaryLabel" frame={{ width: cellSize, height: 18 }}>{h}</Text>
          ))}
        </HStack>
        {rows.map((row, rowIdx) => (
          <HStack key={rowIdx} spacing={2}>
            {row.map((day, colIdx) => {
              if (day == null) {
                return <VStack key={`empty${colIdx}`} frame={{ width: cellSize, height: cellSize }} />
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
        <Spacer />
        {/* 图例卡片 */}
        <VStack spacing={6} padding={{ top: 8, bottom: 8, leading: 12, trailing: 12 }} frame={{ maxWidth: 340 }} background={<RoundedRectangle fill={"systemGray6" as any} cornerRadius={10} />}>
          <HStack spacing={12}>
            <HStack spacing={3}>
              <Circle fill={"systemRed" as any} frame={{ width: 8, height: 8 }} />
              <Text font="caption2" foregroundStyle="secondaryLabel">节假日</Text>
            </HStack>
            <HStack spacing={3}>
              <Circle fill={"systemOrange" as any} frame={{ width: 8, height: 8 }} />
              <Text font="caption2" foregroundStyle="secondaryLabel">补班</Text>
            </HStack>
            <HStack spacing={3}>
              <Circle fill={"tertiaryLabel" as any} frame={{ width: 8, height: 8 }} />
              <Text font="caption2" foregroundStyle="secondaryLabel">周末</Text>
            </HStack>
            <HStack spacing={3}>
              <Circle stroke={{ shapeStyle: "systemBlue" as any, strokeStyle: { lineWidth: 1.5 } }} frame={{ width: 8, height: 8 }} />
              <Text font="caption2" foregroundStyle="secondaryLabel">今天</Text>
            </HStack>
          </HStack>
        </VStack>
        {/* 已选摘要 */}
        <Text font="subheadline" foregroundStyle="secondaryLabel" padding={{ top: 16, bottom: 4 }}>
          已选：{formatDaysOfMonth(localDays.value)}
        </Text>
        {/* 重置按钮 */}
        <Button action={handleReset}>
          <HStack alignment="center" padding={12} frame={{ maxWidth: 340 }} background={<RoundedRectangle fill={"systemGray6" as any} cornerRadius={10} />}>
            <Text font="body" foregroundStyle="systemRed">重置</Text>
          </HStack>
        </Button>
        {/* 确定按钮 */}
        <Button action={handleConfirm}>
          <HStack alignment="center" padding={12} frame={{ maxWidth: 340 }} background={<RoundedRectangle fill={"systemGray6" as any} cornerRadius={10} />}>
            <Text font="body" foregroundStyle="systemBlue">确定</Text>
          </HStack>
        </Button>
      </VStack>
    </ScrollView>
  )
}

export function formatDaysOfMonth(days: number[]): string {
  if (days.length === 0) return "未选"
  return days.sort((a, b) => a - b).map((d) => `${d}号`).join("、")
}
