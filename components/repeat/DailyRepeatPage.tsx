// DailyRepeatPage.tsx - 每天模式专属设置页
import { useObservable, List, Section, Text, Stepper, Toggle, HStack, Spacer } from "scripting"
import { RepeatRule } from "../../lib/constants"

interface DailyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function DailyRepeatPage({ rule }: DailyRepeatPageProps) {
  const init = rule.value
  const interval = useObservable(init.interval ?? 1)
  const holidayAware = useObservable(init.holidayAware ?? true)

  const sync = () => {
    rule.setValue({
      mode: "daily",
      interval: interval.value,
      holidayAware: holidayAware.value,
    })
  }

  return (
    <List navigationTitle="每天" navigationBarTitleDisplayMode="inline">
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

      <Section header={<Text>智能调休</Text>}>
        <Toggle
          title="调休联动"
          value={holidayAware.value}
          onChanged={(v: boolean) => { holidayAware.setValue(v); sync() }}
        />
        <Text font={13} foregroundStyle="tertiaryLabel">
          {holidayAware.value
            ? "法定节假日自动跳过，补班日自动响铃"
            : "不受调休影响，每天固定响铃"}
        </Text>
      </Section>
    </List>
  )
}
