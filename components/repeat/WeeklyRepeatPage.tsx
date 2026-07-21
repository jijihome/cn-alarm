// WeeklyRepeatPage.tsx - 每周模式专属设置页
import { useObservable, List, Section, Text, Stepper, Toggle, HStack, Spacer } from "scripting"
import { RepeatRule } from "../../lib/constants"
import { WeekdayPicker } from "../WeekdayPicker"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

interface WeeklyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function WeeklyRepeatPage({ rule }: WeeklyRepeatPageProps) {
  const init = rule.value
  const interval = useObservable(init.interval ?? 1)
  const weekdays = useObservable<number[]>(init.weekdays ?? [2, 3, 4, 5, 6])
  const holidayAware = useObservable(init.holidayAware ?? true)

  const sync = () => {
    rule.setValue({
      mode: "weekly",
      interval: interval.value,
      weekdays: weekdays.value,
      holidayAware: holidayAware.value,
    })
  }

  // 星期摘要
  const weekdaySummary = weekdays.value
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d - 1])
    .join("、")

  return (
    <List navigationTitle="每周" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>选择星期</Text>}>
        <WeekdayPicker
          value={weekdays.value}
          onChanged={(v) => {
            if (v.length > 0) {
              weekdays.setValue(v)
              sync()
            }
          }}
        />
        <Text font={14} foregroundStyle="secondaryLabel">
          已选：{weekdaySummary}
        </Text>
      </Section>

      <Section header={<Text>间隔</Text>}>
        <Stepper
          onIncrement={() => { interval.setValue(Math.min(4, interval.value + 1)); sync() }}
          onDecrement={() => { interval.setValue(Math.max(1, interval.value - 1)); sync() }}
        >
          <HStack alignment="center">
            <Text>间隔</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">每{interval.value}{interval.value === 1 ? "周" : "周"}</Text>
          </HStack>
        </Stepper>
      </Section>

      <Section header={<Text>智能调休</Text>}>
        <Toggle
          title="调休联动"
          value={holidayAware.value}
          onChanged={(v: boolean) => { holidayAware.setValue(v); sync() }}
        />
        <Text font={13} foregroundStyle="tertiaryLabel">
          {holidayAware.value
            ? "法定节假日自动跳过，补班日自动响铃"
            : "不受调休影响，选定星期固定响铃"}
        </Text>
      </Section>
    </List>
  )
}
