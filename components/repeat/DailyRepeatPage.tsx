// DailyRepeatPage.tsx - 每天模式内联 Section 片段
import { Section, Text, Stepper, HStack, Spacer } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"

interface DailyRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function DailyRepeatSection({ rule }: DailyRepeatSectionProps) {
  const r = rule.value
  const interval = r.interval ?? 1

  return (
    <>
      <Section header={<Text>间隔</Text>}>
        <Stepper
          onIncrement={() => rule.setValue({ ...r, interval: Math.min(30, interval + 1) })}
          onDecrement={() => rule.setValue({ ...r, interval: Math.max(1, interval - 1) })}
        >
          <HStack alignment="center">
            <Text>间隔</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">每{interval}天</Text>
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
