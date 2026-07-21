// MonthlyRepeatPage.tsx - 每月模式专属设置页
import { useObservable, List, Section, Text, Picker } from "scripting"
import { RepeatRule } from "../../lib/constants"

const DAY_LABELS = Array.from({ length: 31 }, (_, i) => `${i + 1}号`)

interface MonthlyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function MonthlyRepeatPage({ rule }: MonthlyRepeatPageProps) {
  const init = rule.value
  const dayOfMonth = useObservable(init.dayOfMonth ?? 1)

  const sync = () => {
    rule.setValue({
      mode: "monthly",
      interval: 1,
      dayOfMonth: dayOfMonth.value,
      holidayAware: false,
    })
  }

  return (
    <List navigationTitle="每月" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>选择日期</Text>}>
        <Picker
          title="每月第几天"
          value={dayOfMonth as any}
          onChanged={() => { sync() }}
        >
          {DAY_LABELS.map((label, idx) => <Text key={idx}>{label}</Text>)}
        </Picker>
      </Section>
      <Section>
        <Text foregroundStyle="tertiaryLabel">
          2月无29/30/31号时将自动取当月最后一天
        </Text>
      </Section>
    </List>
  )
}
