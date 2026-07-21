// RepeatSettings.tsx - 重复模式设置
// 交互设计：
//   1. "模式" 行 → sheet 弹出单选列表，选中后自动关闭返回上级
//   2. "设置" 行 → NavigationLink push 到当前模式的专属设置页
// 响应式：所有显示直接读 rule.value（props Observable），rule.setValue 触发
//        AddAlarm 重渲染 → RepeatSettings 作为子组件重渲染 → 显示自动更新
import { useState, Text, List, Section, NavigationLink, NavigationStack, Button, HStack, Spacer } from "scripting"
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
  holidayAction: "none",
  weekdays: [2, 3, 4, 5, 6],
}

interface RepeatSettingsProps {
  initialValue?: RepeatRule
  rule: Observable<RepeatRule>
}

export function RepeatSettings({ rule }: RepeatSettingsProps) {
  // 直接读 rule.value：rule.setValue 触发 AddAlarm 重渲染，
  // RepeatSettings 作为子组件随之重渲染，显示自动更新
  const mode = rule.value.mode
  const currentLabel = REPEAT_MODES.find((m) => m.value === mode)?.label ?? ""
  const summary = formatRepeatDescription(rule.value)

  const settingsDestination = (() => {
    switch (mode) {
      case "once": return <OnceRepeatPage rule={rule} />
      case "daily": return <DailyRepeatPage rule={rule} />
      case "weekly": return <WeeklyRepeatPage rule={rule} />
      case "monthly": return <MonthlyRepeatPage rule={rule} />
      case "yearly": return <YearlyRepeatPage rule={rule} />
      case "lunar_yearly": return <LunarRepeatPage rule={rule} />
      case "workday": return <WorkdayRepeatPage rule={rule} />
    }
  })()

  // 模式选择 sheet 的显示状态
  const [modePickerShown, setModePickerShown] = useState(false)

  return (
    <Section header={<Text>重复</Text>}>
      <Button
        action={() => setModePickerShown(true)}
        sheet={{
          isPresented: modePickerShown,
          onChanged: setModePickerShown,
          content: (
            <NavigationStack>
              <RepeatModePickerPage
                rule={rule}
                onSelected={() => setModePickerShown(false)}
              />
            </NavigationStack>
          ),
        }}
      >
        <HStack alignment="center">
          <Text>模式</Text>
          <Spacer />
          <Text foregroundStyle="secondaryLabel">{currentLabel}</Text>
        </HStack>
      </Button>
      <NavigationLink
        destination={settingsDestination}
      >
        <HStack alignment="center">
          <Text>设置</Text>
          <Spacer />
          <Text foregroundStyle="secondaryLabel">{summary}</Text>
        </HStack>
      </NavigationLink>
    </Section>
  )
}

// ==================== 模式选择页（单选列表，sheet 弹出） ====================
function RepeatModePickerPage({ rule, onSelected }: { rule: Observable<RepeatRule>; onSelected: () => void }) {
  // 直接读 rule.value.mode：rule.setValue 触发 AddAlarm 重渲染，
  // sheet content 随之重渲染，✓ 标记自动更新
  const selectMode = (mode: RepeatMode) => {
    if (mode === rule.value.mode) return
    const newRule: RepeatRule = {
      mode,
      interval: 1,
      holidayAction: rule.value.holidayAction ?? "none",
    }
    if (mode === "weekly") {
      newRule.weekdays = rule.value.weekdays ?? [2, 3, 4, 5, 6]
    }
    if (mode === "monthly") {
      newRule.monthlySubMode = rule.value.monthlySubMode ?? "day"
      newRule.dayOfMonth = rule.value.dayOfMonth ?? 1
      if (rule.value.weekOfMonth) newRule.weekOfMonth = rule.value.weekOfMonth
      if (rule.value.weekdayOfMonth) newRule.weekdayOfMonth = rule.value.weekdayOfMonth
    }
    if (mode === "yearly") {
      newRule.yearlySubMode = rule.value.yearlySubMode ?? "date"
      newRule.monthOfYear = rule.value.monthOfYear ?? 1
      newRule.dayOfMonth = rule.value.dayOfMonth ?? 1
      if (rule.value.solarTerm) newRule.solarTerm = rule.value.solarTerm
      if (rule.value.weekOfMonth) newRule.weekOfMonth = rule.value.weekOfMonth
      if (rule.value.weekdayOfMonth) newRule.weekdayOfMonth = rule.value.weekdayOfMonth
      if (rule.value.nthWorkdayOfYear) newRule.nthWorkdayOfYear = rule.value.nthWorkdayOfYear
    }
    if (mode === "lunar_yearly") {
      newRule.lunarMonth = rule.value.lunarMonth ?? 1
      newRule.lunarDay = rule.value.lunarDay ?? 1
    }
    if (mode === "once") {
      newRule.anchorDate = rule.value.anchorDate ?? new Date().toISOString().slice(0, 10)
    }
    rule.setValue(newRule)
    onSelected() // 选完自动关闭 sheet 返回上级
  }

  return (
    <List navigationTitle="选择重复模式" navigationBarTitleDisplayMode="inline">
      <Section>
        {REPEAT_MODES.map((m) => {
          const selected = m.value === rule.value.mode
          return (
            <Button
              key={m.value}
              action={() => selectMode(m.value)}
            >
              <HStack alignment="center">
                <Text foregroundStyle={selected ? "systemBlue" : "label"}>{m.label}</Text>
                <Spacer />
                {selected ? <Text foregroundStyle="systemBlue">✓</Text> : null}
              </HStack>
            </Button>
          )
        })}
      </Section>
    </List>
  )
}
