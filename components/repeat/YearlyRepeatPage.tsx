// YearlyRepeatPage.tsx - 每年模式专属设置页
import { useObservable, List, Section, Text, Picker } from "scripting"
import { RepeatRule } from "../../lib/constants"
import { SOLAR_TERM_NAMES } from "../../lib/solar-term"

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const DAY_LABELS = Array.from({ length: 31 }, (_, i) => `${i + 1}号`)
const SOLAR_TERM_OPTIONS = ["按日期", ...SOLAR_TERM_NAMES]

interface YearlyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function YearlyRepeatPage({ rule }: YearlyRepeatPageProps) {
  const init = rule.value
  const initialSolarTermIdx = (() => {
    if (init.solarTerm) {
      const idx = SOLAR_TERM_NAMES.indexOf(init.solarTerm)
      return idx >= 0 ? idx + 1 : 0
    }
    return 0
  })()
  const solarTermIdx = useObservable(initialSolarTermIdx)
  const monthOfYear = useObservable(init.monthOfYear ?? 1)
  const dayOfMonth = useObservable(init.dayOfMonth ?? 1)

  const sync = () => {
    const newRule: RepeatRule = {
      mode: "yearly",
      interval: 1,
      holidayAware: false,
    }
    if (solarTermIdx.value > 0) {
      newRule.solarTerm = SOLAR_TERM_NAMES[solarTermIdx.value - 1]
    } else {
      newRule.monthOfYear = monthOfYear.value
      newRule.dayOfMonth = dayOfMonth.value
    }
    rule.setValue(newRule)
  }

  const isSolarTerm = solarTermIdx.value > 0

  return (
    <List navigationTitle="每年" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>按节气或日期</Text>}>
        <Picker
          title="选择方式"
          value={solarTermIdx as any}
          onChanged={() => { sync() }}
        >
          {SOLAR_TERM_OPTIONS.map((label, idx) => <Text key={idx}>{label}</Text>)}
        </Picker>
      </Section>

      {isSolarTerm ? (
        <Section header={<Text>节气提醒</Text>}>
          <Text font={16} fontWeight="bold">
            {SOLAR_TERM_NAMES[solarTermIdx.value - 1]}
          </Text>
          <Text foregroundStyle="secondaryLabel">
            每年「{SOLAR_TERM_NAMES[solarTermIdx.value - 1]}」当天提醒
          </Text>
        </Section>
      ) : (
        <Section header={<Text>公历日期</Text>}>
          <Picker
            title="月份"
            value={monthOfYear as any}
            onChanged={() => { sync() }}
          >
            {MONTH_LABELS.map((label, idx) => <Text key={idx}>{label}</Text>)}
          </Picker>
          <Picker
            title="日期"
            value={dayOfMonth as any}
            onChanged={() => { sync() }}
          >
            {DAY_LABELS.map((label, idx) => <Text key={idx}>{label}</Text>)}
          </Picker>
        </Section>
      )}
    </List>
  )
}
