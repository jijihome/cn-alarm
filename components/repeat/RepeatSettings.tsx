// RepeatSettings.tsx - 重复模式设置（内联版）
// 交互设计：
//   1. "模式" 行 → Picker 下拉菜单选模式（轻量，无页面跳转）
//   2. 模式选完后，下方直接内联渲染该模式的具体设置项（不再弹子页面）
//   DayOfMonthPicker 日历网格仍通过 NavigationLink push 进入
import { Text, Section, Picker } from "scripting"
import { RepeatMode, RepeatRule } from "../../lib/constants"
import { buildRepeatRule } from "../../lib/repeat-rule-builder"

import { WeeklyRepeatSection } from "./WeeklyRepeatPage"
import { DailyRepeatSection } from "./DailyRepeatPage"
import { MonthlyRepeatSection } from "./MonthlyRepeatPage"
import { YearlyRepeatSection } from "./YearlyRepeatPage"
import { LunarRepeatSection } from "./LunarRepeatPage"
import { WorkdayRepeatSection } from "./WorkdayRepeatPage"
import { OnceRepeatSection } from "./OnceRepeatPage"
import { EndConditionPicker } from "./EndConditionPicker"

const REPEAT_MODES: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "仅一次" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "lunar_yearly", label: "农历每年" },
  { value: "workday", label: "每工作日" },
]

interface RepeatSettingsProps {
  initialValue?: RepeatRule
  rule: Observable<RepeatRule>
}

export function RepeatSettings({ rule }: RepeatSettingsProps) {
  return (
    <>
      <Section header={<Text>重复</Text>}>
        <Picker
          title="模式"
          value={rule.value.mode as string}
          onChanged={(newMode: string) => {
            if (newMode !== rule.value.mode) {
              rule.setValue(buildRepeatRule(newMode as RepeatMode, rule.value))
            }
          }}
          pickerStyle="automatic"
        >
          {REPEAT_MODES.map((m) => (
            <Text key={m.value} tag={m.value}>{m.label}</Text>
          ))}
        </Picker>
      </Section>

      {/* 各模式的具体设置项，内联渲染 */}
      {rule.value.mode === "once" && <OnceRepeatSection rule={rule} />}
      {rule.value.mode === "daily" && <DailyRepeatSection rule={rule} />}
      {rule.value.mode === "weekly" && <WeeklyRepeatSection rule={rule} />}
      {rule.value.mode === "monthly" && <MonthlyRepeatSection rule={rule} />}
      {rule.value.mode === "yearly" && <YearlyRepeatSection rule={rule} />}
      {rule.value.mode === "lunar_yearly" && <LunarRepeatSection rule={rule} />}
      {rule.value.mode === "workday" && <WorkdayRepeatSection rule={rule} />}

      {/* once 模式不需要结束条件（本身一次性） */}
      {rule.value.mode !== "once" && <EndConditionPicker rule={rule} />}
    </>
  )
}
