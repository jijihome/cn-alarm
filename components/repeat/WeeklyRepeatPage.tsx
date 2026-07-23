// WeeklyRepeatPage.tsx - 每周模式专属设置页
import { useObservable, List, Section, Text, Stepper, HStack, Spacer, NavigationStack, Button, Navigation } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { WeekdayPicker } from "../WeekdayPicker"
import { HolidayActionPicker } from "./HolidayActionPicker"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

interface WeeklyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function WeeklyRepeatPage({ rule }: WeeklyRepeatPageProps) {
  const dismiss = Navigation.useDismiss()
  const init = rule.value
  const interval = useObservable(init.interval ?? 1)
  const weekdays = useObservable<number[]>(init.weekdays ?? [2, 3, 4, 5, 6])
  const holidayAction = useObservable<HolidayAction>(init.holidayAction ?? "none")

  const sync = () => {
    rule.setValue({
      mode: "weekly",
      interval: interval.value,
      weekdays: weekdays.value,
      holidayAction: holidayAction.value,
    })
  }

  // 星期摘要
  const weekdaySummary = weekdays.value
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d - 1])
    .join("、")

  return (
    <NavigationStack>
      <List
        navigationTitle="每周"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="完成" action={() => dismiss()} />,
        }}
      >
      <Section header={<Text>选择星期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">已选：{weekdaySummary}</Text>}>
        <WeekdayPicker
          value={weekdays.value}
          onChanged={(v) => {
            if (v.length > 0) {
              weekdays.setValue(v)
              sync()
            }
          }}
        />
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

      <HolidayActionPicker
        value={holidayAction.value}
        onChanged={(v) => { holidayAction.setValue(v); sync() }}
      />
      </List>
    </NavigationStack>
  )
}
