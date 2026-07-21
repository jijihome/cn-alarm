// WeekdayPicker.tsx - 星期选择器组件
import { HStack, Button } from "scripting"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]
// Apple weekday numbering: 1=Sun, 2=Mon, ..., 7=Sat
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

interface WeekdayPickerProps {
  value: number[]
  onChanged: (weekdays: number[]) => void
}

export function WeekdayPicker({ value, onChanged }: WeekdayPickerProps) {
  const toggleDay = (day: number) => {
    if (value.includes(day)) {
      onChanged(value.filter((d) => d !== day))
    } else {
      onChanged([...value, day].sort())
    }
  }

  return (
    <HStack alignment="center" spacing={6}>
      {ALL_WEEKDAYS.map((day) => {
        const selected = value.includes(day)
        return (
          <Button
            key={day}
            title={WEEKDAY_LABELS[day - 1]}
            action={() => toggleDay(day)}
            tint={selected ? "systemBlue" : "systemGray"}
            font={selected ? 14 : 13}
            fontWeight={selected ? "bold" : "regular"}
          />
        )
      })}
    </HStack>
  )
}
