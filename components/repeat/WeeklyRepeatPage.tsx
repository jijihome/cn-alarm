// WeeklyRepeatPage.tsx - 每周模式内联 Section 片段
import { Section, Text, Stepper, HStack, Spacer } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { WeekdayPicker } from "../WeekdayPicker"
import { HolidayActionPicker } from "./HolidayActionPicker"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

interface WeeklyRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function WeeklyRepeatSection({ rule }: WeeklyRepeatSectionProps) {
  const r = rule.value
  const interval = r.interval ?? 1
  const weekdays = r.weekdays ?? [2, 3, 4, 5, 6]

  const weekdaySummary = weekdays
    .sort((a: number, b: number) => a - b)
    .map((d: number) => WEEKDAY_LABELS[d - 1])
    .join("、")

  return (
    <>
      <Section header={<Text>选择星期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">已选：{weekdaySummary}</Text>}>
        <WeekdayPicker
          value={weekdays}
          onChanged={(v: number[]) => {
            if (v.length > 0) {
              rule.setValue({ ...r, weekdays: v })
            }
          }}
        />
      </Section>

      <Section header={<Text>间隔</Text>}>
        <Stepper
          onIncrement={() => rule.setValue({ ...r, interval: Math.min(4, interval + 1) })}
          onDecrement={() => rule.setValue({ ...r, interval: Math.max(1, interval - 1) })}
        >
          <HStack alignment="center">
            <Text>间隔</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">每{interval}周</Text>
          </HStack>
        </Stepper>
      </Section>

      <HolidayActionPicker
        value={r.holidayAction ?? "none"}
        onChanged={(v: HolidayAction) => rule.setValue({ ...r, holidayAction: v })}
      />
    </>
  )
}
