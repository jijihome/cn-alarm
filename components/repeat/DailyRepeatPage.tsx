// DailyRepeatPage.tsx - 每天模式专属设置页
import { useObservable, List, Section, Text, Stepper, HStack, Spacer, NavigationStack, Button, Navigation } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"

interface DailyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function DailyRepeatPage({ rule }: DailyRepeatPageProps) {
  const dismiss = Navigation.useDismiss()
  const init = rule.value
  const interval = useObservable(init.interval ?? 1)
  const holidayAction = useObservable<HolidayAction>(init.holidayAction ?? "none")

  const sync = () => {
    rule.setValue({
      mode: "daily",
      interval: interval.value,
      holidayAction: holidayAction.value,
    })
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="每天"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="完成" action={() => dismiss()} />,
        }}
      >
      <Section header={<Text>间隔</Text>}>
        <Stepper
          onIncrement={() => { interval.setValue(Math.min(30, interval.value + 1)); sync() }}
          onDecrement={() => { interval.setValue(Math.max(1, interval.value - 1)); sync() }}
        >
          <HStack alignment="center">
            <Text>间隔</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">每{interval.value}天</Text>
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
