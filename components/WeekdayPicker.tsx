// WeekdayPicker.tsx - 星期选择器组件
// 用 Toggle 行列表实现，每个星期一行，比 HStack Button 更可靠
import { Toggle } from "scripting"
import { WEEKDAY_LABELS } from "../lib/constants"

// Apple weekday numbering: 1=Sun, 2=Mon, ..., 7=Sat
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

interface WeekdayPickerProps {
  value: number[]
  onChanged: (weekdays: number[]) => void
}

export function WeekdayPicker({ value, onChanged }: WeekdayPickerProps) {
  const toggleDay = (day: number) => {
    if (value.includes(day)) {
      // 至少保留1天
      if (value.length > 1) {
        onChanged(value.filter((d) => d !== day))
      }
    } else {
      onChanged([...value, day].sort())
    }
  }

  return (
    <>
      {ALL_WEEKDAYS.map((day) => {
        const selected = value.includes(day)
        return (
          <Toggle
            key={day}
            title={`星期${WEEKDAY_LABELS[day - 1]}`}
            value={selected}
            onChanged={() => toggleDay(day)}
          />
        )
      })}
    </>
  )
}
