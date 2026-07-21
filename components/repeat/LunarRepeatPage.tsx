// LunarRepeatPage.tsx - 农历每年模式专属设置页
import { useObservable, List, Section, Text, Picker } from "scripting"
import { RepeatRule } from "../../lib/constants"

const LUNAR_MONTH_LABELS = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月",
]

const LUNAR_DAY_LABELS = Array.from({ length: 30 }, (_, i) => {
  const d = i + 1
  const names: Record<number, string> = {
    1: "初一", 2: "初二", 3: "初三", 4: "初四", 5: "初五",
    6: "初六", 7: "初七", 8: "初八", 9: "初九", 10: "初十",
    11: "十一", 12: "十二", 13: "十三", 14: "十四", 15: "十五",
    16: "十六", 17: "十七", 18: "十八", 19: "十九", 20: "二十",
    21: "廿一", 22: "廿二", 23: "廿三", 24: "廿四", 25: "廿五",
    26: "廿六", 27: "廿七", 28: "廿八", 29: "廿九", 30: "三十",
  }
  return names[d] ?? `${d}日`
})

interface LunarRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function LunarRepeatPage({ rule }: LunarRepeatPageProps) {
  const init = rule.value
  const lunarMonth = useObservable(init.lunarMonth ?? 1)
  const lunarDay = useObservable(init.lunarDay ?? 1)

  const sync = () => {
    rule.setValue({
      mode: "lunar_yearly",
      interval: 1,
      lunarMonth: lunarMonth.value,
      lunarDay: lunarDay.value,
      holidayAware: false,
    })
  }

  return (
    <List navigationTitle="农历每年" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>农历日期</Text>}>
        <Picker
          title="农历月"
          value={lunarMonth as any}
          onChanged={() => { sync() }}
        >
          {LUNAR_MONTH_LABELS.map((label, idx) => <Text key={idx}>{label}</Text>)}
        </Picker>
        <Picker
          title="农历日"
          value={lunarDay as any}
          onChanged={() => { sync() }}
        >
          {LUNAR_DAY_LABELS.map((label, idx) => <Text key={idx}>{label}</Text>)}
        </Picker>
      </Section>
      <Section>
        <Text foregroundStyle="tertiaryLabel">
          系统将自动换算为对应的公历日期
        </Text>
      </Section>
    </List>
  )
}
