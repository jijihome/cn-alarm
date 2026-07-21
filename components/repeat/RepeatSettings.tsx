// RepeatSettings.tsx - 重复模式设置
// 交互设计：点击"重复"行 → push 到模式选择页 → 选模式 → push 到模式专属设置页
// 所有页面共享同一个 rule: Observable<RepeatRule>，子页面修改后自动同步
import { useObservable, Text, List, Section, NavigationLink, NavigationStack } from "scripting"
import { RepeatMode, RepeatRule } from "../../lib/constants"
import { formatRepeatDescription } from "../../lib/scheduler"

import { WeeklyRepeatPage } from "./WeeklyRepeatPage"
import { DailyRepeatPage } from "./DailyRepeatPage"
import { MonthlyRepeatPage } from "./MonthlyRepeatPage"
import { YearlyRepeatPage } from "./YearlyRepeatPage"
import { LunarRepeatPage } from "./LunarRepeatPage"
import { WorkdayRepeatPage } from "./WorkdayRepeatPage"
import { OnceRepeatPage } from "./OnceRepeatPage"

const REPEAT_MODES: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "仅一次" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "lunar_yearly", label: "农历每年" },
  { value: "workday", label: "每工作日" },
]

const DEFAULT_RULE: RepeatRule = {
  mode: "weekly",
  interval: 1,
  holidayAware: true,
  weekdays: [2, 3, 4, 5, 6],
}

interface RepeatSettingsProps {
  initialValue?: RepeatRule
  rule: Observable<RepeatRule>
}

export function RepeatSettings({ initialValue, rule }: RepeatSettingsProps) {
  const init = initialValue ?? DEFAULT_RULE
  const summary = formatRepeatDescription(rule.value)

  return (
    <Section header={<Text>重复</Text>}>
      <NavigationLink
        title={`重复  ${summary}`}
        destination={
          <RepeatModePickerPage rule={rule} />
        }
      />
    </Section>
  )
}

// ==================== 模式选择页 ====================
function RepeatModePickerPage({ rule }: { rule: Observable<RepeatRule> }) {
  const currentMode = rule.value.mode

  const modeDestination = (mode: RepeatMode) => {
    switch (mode) {
      case "once": return <OnceRepeatPage rule={rule} />
      case "daily": return <DailyRepeatPage rule={rule} />
      case "weekly": return <WeeklyRepeatPage rule={rule} />
      case "monthly": return <MonthlyRepeatPage rule={rule} />
      case "yearly": return <YearlyRepeatPage rule={rule} />
      case "lunar_yearly": return <LunarRepeatPage rule={rule} />
      case "workday": return <WorkdayRepeatPage rule={rule} />
    }
  }

  return (
    <List navigationTitle="重复模式" navigationBarTitleDisplayMode="inline">
      {REPEAT_MODES.map((m) => (
        <NavigationLink
          key={m.value}
          title={m.label}
          destination={modeDestination(m.value)}
        />
      ))}
    </List>
  )
}
